import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Topology, TopologyFormData, Device, DeviceModel, ConfigPreviewResult, Job, TopologyRole, PortAssignment, TopologyPreviewDevice, TopologyPreviewResponse } from '@core';
import {
  useTopologies,
  useDevices,
  useTemplates,
  useIpam,
  useSettings,
  useAsyncModal,
  useModalForm,
  useModalRoute,
  useWebSocket,
  getServices,
  addNotification,
  navigateAction,
  EMPTY_TOPOLOGY_FORM,
  slugify,
  isPatchPanel,
} from '@core';
import { ActionMenu } from './ActionMenu';
import { Tooltip } from './Tooltip';
import { Button, RefreshButton } from './Button';
import { Card } from './Card';
import { Toggle } from './Toggle';
import { CommandDrawer } from './CommandDrawer';
import { DevicePortAssignments } from './DevicePortAssignments';
import { IconButton } from './IconButton';
import { ConnectModal, useConnectModal } from './ConnectModal';
import { ConfigViewer } from './ConfigViewer';
import { DialogActions } from './DialogActions';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { NumberInput } from './NumberInput';
import { ModelSelector } from './ModelSelector';
import { SelectField } from './SelectField';
import { InfoSection } from './InfoSection';
import { LoadingState, ModalLoading } from './LoadingState';
import { Modal } from './Modal';
import { ResultItem } from './ResultItem';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { VendorBadge } from './VendorBadge';
import { Icon, PlusIcon, SpinnerIcon, TrashIcon, loadingIcon } from './Icon';
import { TopologyDiagramViewer } from './TopologyDiagram';
import type { TopologyDiagramViewerHandle } from './TopologyDiagram';
import { useConfirm } from './ConfirmDialog';
import { CsvPreviewModal } from './CsvPreviewModal';
import type { CsvPreviewSheet } from './CsvPreviewModal';

function getRoleVariant(d: Device): 'online' | 'provisioning' | 'accent' | 'neutral' | 'offline' {
  if (isPatchPanel(d) || d.topology_role === 'patch panel') return 'neutral';
  switch (d.topology_role) {
    case 'spine': case 'super-spine': case 'core': case 'distribution': return 'online';
    case 'leaf': case 'access': return 'provisioning';
    case 'gpu-node': return 'accent';
    default: return 'offline';
  }
}

function formatPlacement(value: string): string {
  if (!value) return 'Default';
  if (value.match(/^\d+$/)) return `Rack #${value}`;
  switch (value) {
    case 'end': return 'End of Row';
    case 'middle': return 'Middle of Row';
    case 'beginning': return 'Beginning of Row';
    case 'top': return 'Top of Rack';
    case 'bottom': return 'Bottom of Rack';
    default: return value;
  }
}

export function TopologyManagement() {
  const [showInfo, setShowInfo] = useState(false);
  const {
    topologies,
    loading,
    error,
    refresh: refreshTopologies,
    createTopology,
    updateTopology,
    deleteTopology,
  } = useTopologies();
  const { devices, refresh: refreshDevices } = useDevices();
  const { templates } = useTemplates();
  const ipam = useIpam();
  const { regions, campuses, datacenters, halls, rows: ipamRows, racks } = ipam;
  const { settings } = useSettings();
  const [addingNode, setAddingNode] = useState<string | null>(null); // "topologyId:role" while spawning
  const [addMenuOpen, setAddMenuOpen] = useState<string | null>(null); // "topologyId:role" for popover
  const [commandDevice, setCommandDevice] = useState<Device | null>(null);
  const [expandedDiagram, setExpandedDiagram] = useState<number | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ topologyId: number; role: TopologyRole } | null>(null);
  const [swapDevice, setSwapDevice] = useState<Device | null>(null); // device being replaced
  const [portsDevice, setPortsDevice] = useState<Device | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const diagramRef = useRef<TopologyDiagramViewerHandle>(null);
  const [buildingTopology, setBuildingTopology] = useState(false);
  const [showTopologyDialog, setShowTopologyDialog] = useState(false);
  const [topologyConfig, setTopologyConfig] = useState({
    architecture: 'clos' as 'clos' | 'hierarchical',
    external_count: 2, external_to_tier1_ratio: 2,
    tier1_count: 2, tier1_to_tier2_ratio: 2, tier1_model: '', tier1_names: [] as string[],
    tier2_count: 16, tier2_to_tier3_ratio: 2, tier2_model: '',
    tier3_count: 0, tier3_model: '',
    spawn_containers: false, ceos_image: '',
    tier1_placement: '' as string,
    tier2_placement: '' as string,
    tier3_placement: 'bottom' as string,
    region_id: '', campus_id: '', datacenter_id: '',
    halls: 1, rows_per_hall: 4, racks_per_row: 8, devices_per_rack: 1,
    // Super-spine (5-stage CLOS)
    super_spine_enabled: false, super_spine_count: 4, super_spine_model: '', spine_to_super_spine_ratio: 2, pods: 2,
    // Physical spacing
    row_spacing_cm: 120,
    // Rack dimensions
    rack_width_cm: 60,
    rack_height_ru: 42,
    rack_depth_cm: 100,
    // Topology name
    topology_name: '',
    // GPU clusters
    gpu_cluster_count: 0, gpu_model: 'MI300X', gpus_per_node: 8, gpu_nodes_per_cluster: 8, gpu_interconnect: 'InfiniBand',
    gpu_vrf_ids: [] as string[],
    gpu_include_leaf_uplinks: true, gpu_include_fabric_cabling: true,
    // Management switch
    mgmt_switch_model: '',
    mgmt_switch_distribution: 'per-row' as 'per-row' | 'per-rack' | 'per-hall' | 'count-per-row',
    mgmt_switches_per_row: 1,
  });

  // Filter out patch panels from model dropdowns in topology builder
  const noPatchPanels = useCallback((m: DeviceModel) => !m.model.startsWith('PP-'), []);

  // Apply settings defaults when topology dialog opens
  useEffect(() => {
    if (showTopologyDialog && settings) {
      setTopologyConfig(prev => ({
        ...prev,
        tier1_model: prev.tier1_model || settings.default_spine_model || '',
        tier2_model: prev.tier2_model || settings.default_leaf_model || '',
        mgmt_switch_model: prev.mgmt_switch_model || settings.default_mgmt_switch_model || '',
        gpu_model: prev.gpu_model || settings.default_gpu_model || prev.gpu_model,
      }));
    }
  }, [showTopologyDialog, settings]);

  const [previewData, setPreviewData] = useState<TopologyPreviewResponse | null>(null);
  const [previewEdits, setPreviewEdits] = useState<TopologyPreviewDevice[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [previewRoleFilter, setPreviewRoleFilter] = useState<string | null>(null);
  const [showGpuLinks, setShowGpuLinks] = useState(false);

  const hasBuiltTopology = useMemo(
    () => devices.some(d => {
      const name = topologies.find(t => t.id === d.topology_id)?.name;
      return name === 'DC1 CLOS Fabric' || name === 'DC1 Hierarchical Fabric';
    }),
    [devices, topologies],
  );

  // Close add-menu popover on outside click
  useEffect(() => {
    if (!addMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [addMenuOpen]);

  // Unassigned devices (not in any topology)
  const unassignedDevices = useMemo(() => devices.filter(d => !d.topology_id), [devices]);

  // Build template lookup for display
  const templateMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const t of templates) map[t.id] = t.name;
    return map;
  }, [templates]);

  // Group devices by topology_id for expanded rows
  const devicesByTopology = useMemo(() => {
    const map: Record<number, Device[]> = {};
    for (const d of devices) {
      if (d.topology_id) {
        (map[d.topology_id] ??= []).push(d);
      }
    }
    return map;
  }, [devices]);

  // Connectivity test modal
  const connectModal = useConnectModal();

  // Config preview + deploy modal
  const previewModal = useAsyncModal<Device, ConfigPreviewResult>();
  const [deployJob, setDeployJob] = useState<Job | null>(null);
  const [deploying, setDeploying] = useState(false);

  const onJobUpdate = useCallback((job: Job) => {
    setDeployJob((prev) => {
      if (!prev || prev.id !== job.id) return prev;
      return job;
    });
    if (job.status === 'completed' || job.status === 'failed') {
      setDeploying(false);
    }
  }, []);
  useWebSocket({ onJobUpdate });

  const handlePreviewConfig = async (device: Device) => {
    previewModal.open(device);
    setDeployJob(null);
    await previewModal.execute(() => getServices().devices.previewConfig(device.id));
  };

  const handleDeployConfig = async () => {
    if (!previewModal.item) return;
    if (!(await confirm({ title: 'Deploy Configuration', message: `Deploy configuration to ${previewModal.item.hostname} (${previewModal.item.ip})? This will push the config via SSH.`, confirmText: 'Deploy', destructive: false }))) return;
    setDeploying(true);
    setDeployJob(null);
    try {
      const job = await getServices().devices.deployConfig(previewModal.item.id);
      setDeployJob(job);
    } catch (err) {
      setDeployJob({
        id: `error-${Date.now()}`,
        job_type: 'deploy',
        device_id: previewModal.item.id,
        command: '',
        status: 'failed',
        output: null,
        error: err instanceof Error ? err.message : 'Deploy failed',
        triggered_by: 'manual',
        created_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
      });
      setDeploying(false);
    }
  };

  const handleDiffConfig = async () => {
    if (!previewModal.item) return;
    const hostname = previewModal.item.hostname;
    previewModal.close();
    try {
      await getServices().devices.diffConfig(previewModal.item.id);
      addNotification('success', `Diff queued for ${hostname}`, navigateAction('View Jobs', 'jobs', 'history'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Diff failed';
      addNotification('error', `Diff failed for ${hostname}: ${msg}`, navigateAction('View Jobs', 'jobs', 'history'));
    }
  };

  const handleClosePreview = () => {
    previewModal.close();
    setDeployJob(null);
    setDeploying(false);
  };

  const [generatingCutsheet, setGeneratingCutsheet] = useState(false);
  const [generatingConnectionSheet, setGeneratingConnectionSheet] = useState(false);
  const [generatingBOM, setGeneratingBOM] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{
    title: string;
    sheets: CsvPreviewSheet[];
    filename: string;
    onDownload: () => void;
  } | null>(null);

  const buildCutsheetData = async (topology: Topology): Promise<(string | number)[][]> => {
    const topoDevices = devicesByTopology[topology.id] || [];
    const spines = topoDevices.filter(d => d.topology_role === 'spine' || d.topology_role === 'super-spine');
    const leaves = topoDevices.filter(d => d.topology_role === 'leaf');

    if (spines.length === 0 || leaves.length === 0) {
      throw new Error('Need at least one spine and one leaf to generate a cutsheet');
    }

    const assignmentsByDevice: Record<number, PortAssignment[]> = {};
    await Promise.all(
      topoDevices.map(async (d) => {
        try {
          assignmentsByDevice[d.id] = await getServices().portAssignments.list(d.id);
        } catch {
          assignmentsByDevice[d.id] = [];
        }
      })
    );

    const rows: (string | number)[][] = [
      ['Side A Hostname', 'Side A Interface', 'Side A Patch Panel', 'Side A PP Port', 'Side B Hostname', 'Side B Interface', 'Side B Patch Panel', 'Side B PP Port', 'Cable Length (m)'],
    ];

    const hasAssignments = Object.values(assignmentsByDevice).some(a => a.length > 0);

    if (hasAssignments) {
      const seen = new Set<string>();
      for (const device of topoDevices) {
        const assignments = assignmentsByDevice[device.id] || [];
        for (const pa of assignments) {
          if (!pa.remote_device_id) continue;
          const linkKey = [device.id, pa.port_name, pa.remote_device_id, pa.remote_port_name].sort().join('|');
          if (seen.has(linkKey)) continue;
          seen.add(linkKey);
          const remoteDevice = topoDevices.find(d => d.id === pa.remote_device_id);
          rows.push([
            device.hostname || device.mac || String(device.id),
            pa.port_name,
            pa.patch_panel_a_hostname || '',
            pa.patch_panel_a_port || '',
            pa.remote_device_hostname || (remoteDevice ? remoteDevice.hostname || remoteDevice.mac || String(remoteDevice.id) : String(pa.remote_device_id)),
            pa.remote_port_name || '',
            pa.patch_panel_b_hostname || '',
            pa.patch_panel_b_port || '',
            pa.cable_length_meters != null ? pa.cable_length_meters : '',
          ]);
        }
      }
    } else {
      const ifIndex: Record<number, number> = {};
      const nextIf = (d: Device) => {
        ifIndex[d.id] = (ifIndex[d.id] || 0) + 1;
        const prefix = d.vendor === 'FRR' ? 'eth' : 'Ethernet';
        return `${prefix}${ifIndex[d.id]}`;
      };
      const linksPerPair = 2;
      for (const spine of spines) {
        for (const leaf of leaves) {
          for (let link = 0; link < linksPerPair; link++) {
            rows.push([
              spine.hostname || spine.mac || String(spine.id),
              nextIf(spine),
              '', '', // Patch Panel A
              leaf.hostname || leaf.mac || String(leaf.id),
              nextIf(leaf),
              '', '', '', // Patch Panel B, Cable Length
            ]);
          }
        }
      }
    }

    return rows;
  };

  const handleGenerateCutsheet = async (topology: Topology) => {
    setGeneratingCutsheet(true);
    try {
      const rows = await buildCutsheetData(topology);
      const csvEscape = (v: string) => v.includes(',') ? `"${v}"` : v;
      const csvRows = rows.map(row => row.map(cell => csvEscape(String(cell))).join(','));
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${topology.id}-cutsheet.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to generate cutsheet: ${msg}`);
    } finally {
      setGeneratingCutsheet(false);
    }
  };

  const handlePreviewCutsheet = async (topology: Topology) => {
    setGeneratingCutsheet(true);
    try {
      const rows = await buildCutsheetData(topology);
      setCsvPreview({
        title: `Cutsheet — ${topology.name}`,
        sheets: [{ name: 'Cutsheet', rows }],
        filename: `${topology.id}-cutsheet.csv`,
        onDownload: () => handleGenerateCutsheet(topology),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to generate cutsheet: ${msg}`);
    } finally {
      setGeneratingCutsheet(false);
    }
  };

  const buildBomData = async (topology: Topology): Promise<(string | number)[][]> => {
    const topoDevices = devicesByTopology[topology.id] || [];
    if (topoDevices.length === 0) throw new Error('No devices in this topology');

    const allAssignments: PortAssignment[] = [];
    await Promise.all(
      topoDevices.map(async (d) => {
        try {
          const pas = await getServices().portAssignments.list(d.id);
          allAssignments.push(...pas);
        } catch { /* skip */ }
      })
    );

    const rows: (string | number)[][] = [['Category', 'Item', 'Specification', 'Quantity', 'Unit Length', 'Notes']];
    const excludedRoles = new Set(['patch panel']);

    const deviceGroups = new Map<string, { model: string; role: string; count: number }>();
    for (const dev of topoDevices) {
      if (excludedRoles.has(dev.topology_role || '') || dev.device_type === 'external') continue;
      const model = dev.model || 'Unknown';
      const role = dev.topology_role || 'unknown';
      const key = `${model}|${role}`;
      const existing = deviceGroups.get(key);
      if (existing) existing.count++;
      else deviceGroups.set(key, { model, role, count: 1 });
    }
    for (const { model, role, count } of deviceGroups.values()) {
      rows.push(['Device', model, role, count, '', '']);
    }

    const standardLengths = [0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50];
    const roundToStandard = (m: number) => standardLengths.find(l => l >= m) ?? Math.ceil(m);
    const seenLinks = new Set<string>();
    const fiberGroups = new Map<number, number>();
    let totalFabricLinks = 0;
    for (const pa of allAssignments) {
      if (!pa.remote_device_id) continue;
      const linkKey = [Math.min(pa.device_id, pa.remote_device_id), Math.max(pa.device_id, pa.remote_device_id), pa.port_name, pa.remote_port_name].join(':');
      if (seenLinks.has(linkKey)) continue;
      seenLinks.add(linkKey);
      const length = pa.cable_length_meters ?? 3;
      const rounded = roundToStandard(length);
      fiberGroups.set(rounded, (fiberGroups.get(rounded) || 0) + 1);
      totalFabricLinks++;
    }
    for (const [length, qty] of [...fiberGroups.entries()].sort((a, b) => a[0] - b[0])) {
      rows.push(['Fiber', 'DAC/AOC Cable', '100G', qty, `${length}m`, '']);
    }
    if (totalFabricLinks > 0) {
      rows.push(['Optic', 'QSFP28', '100G', totalFabricLinks * 2, '', '2 per fabric link']);
    }

    const managedDevices = topoDevices.filter(d =>
      !excludedRoles.has(d.topology_role || '') && d.device_type !== 'external' && d.topology_role !== 'mgmt-switch'
    );
    const hasMgmt = topoDevices.some(d => d.topology_role === 'mgmt-switch');
    if (hasMgmt && managedDevices.length > 0) {
      rows.push(['Mgmt Ethernet', 'Cat6 Ethernet Cable', '1G', managedDevices.length, '2m', 'OOB management per device']);
    }

    return rows;
  };

  const handleDownloadTopologyBOM = async (topology: Topology) => {
    setGeneratingBOM(true);
    try {
      const rows = await buildBomData(topology);
      const csvEscape = (v: string) => v.includes(',') ? `"${v}"` : v;
      const csvRows = rows.map(row => row.map(cell => csvEscape(String(cell))).join(','));
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${topology.name.replace(/\s+/g, '-')}-BOM.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to generate BOM: ${msg}`);
    } finally {
      setGeneratingBOM(false);
    }
  };

  const handlePreviewBOM = async (topology: Topology) => {
    setGeneratingBOM(true);
    try {
      const rows = await buildBomData(topology);
      setCsvPreview({
        title: `Bill of Materials — ${topology.name}`,
        sheets: [{ name: 'BOM', rows }],
        filename: `${topology.name.replace(/\s+/g, '-')}-BOM.csv`,
        onDownload: () => handleDownloadTopologyBOM(topology),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to generate BOM: ${msg}`);
    } finally {
      setGeneratingBOM(false);
    }
  };

  const buildConnectionSheetData = async (topology: Topology): Promise<CsvPreviewSheet[]> => {
    const topoDevices = devicesByTopology[topology.id] || [];
    if (topoDevices.length === 0) throw new Error('No devices in this topology');

    const assignmentsByDevice: Record<number, PortAssignment[]> = {};
    await Promise.all(
      topoDevices.map(async (d) => {
        try {
          assignmentsByDevice[d.id] = await getServices().portAssignments.list(d.id);
        } catch {
          assignmentsByDevice[d.id] = [];
        }
      })
    );

    const hallMap = new Map(halls.map(h => [h.id, h]));
    const rowMap = new Map(ipamRows.map(r => [r.id, r]));
    const rackMap = new Map(racks.map(r => [r.id, r]));
    const dcMap = new Map(datacenters.map(d => [d.id, d]));
    const campusMap = new Map(campuses.map(c => [c.id, c]));
    const regionMap = new Map(regions.map(r => [r.id, r]));

    const dc = topology.datacenter_id ? dcMap.get(topology.datacenter_id) : undefined;
    const campus = dc?.campus_id ? campusMap.get(dc.campus_id) : undefined;
    const region = campus?.region_id ? regionMap.get(campus.region_id) : undefined;
    const locationBreadcrumb = [region?.name, campus?.name, dc?.name].filter(Boolean).join(' > ') || '—';

    const devicesByRack: Record<number, Device[]> = {};
    const unrackedDevices: Device[] = [];
    for (const d of topoDevices) {
      if (d.rack_id) (devicesByRack[d.rack_id] ??= []).push(d);
      else unrackedDevices.push(d);
    }
    const rackIds = Object.keys(devicesByRack).map(Number).sort((a, b) => a - b);

    const sheets: CsvPreviewSheet[] = [];

    // Summary sheet
    const summaryRows: (string | number)[][] = [
      ['Topology', topology.name],
      ['Location', locationBreadcrumb],
      ['Total Devices', topoDevices.length],
      ['Racks', rackIds.length],
      [],
      ['Rack', 'Hall', 'Row', 'Devices', 'Spines', 'Leaves', 'Patch Panels'],
    ];
    for (const rackId of rackIds) {
      const rack = rackMap.get(rackId);
      const row = rack?.row_id ? rowMap.get(rack.row_id) : undefined;
      const hall = row?.hall_id ? hallMap.get(row.hall_id) : undefined;
      const rDevices = devicesByRack[rackId];
      summaryRows.push([
        rack?.name || String(rackId),
        hall?.name || '—',
        row?.name || '—',
        rDevices.length,
        rDevices.filter(d => d.topology_role === 'spine' || d.topology_role === 'super-spine').length,
        rDevices.filter(d => d.topology_role === 'leaf').length,
        rDevices.filter(d => d.vendor === 'Patch Panel').length,
      ]);
    }
    if (unrackedDevices.length > 0) {
      summaryRows.push(['Unracked', '—', '—', unrackedDevices.length, 0, 0, unrackedDevices.filter(d => d.vendor === 'Patch Panel').length]);
    }
    sheets.push({ name: 'Summary', rows: summaryRows });

    // Per-rack sheets
    const buildRackRows = (sheetDevices: Device[], rackName: string, hallName: string, rowName: string): (string | number)[][] => {
      const data: (string | number)[][] = [];
      data.push(['Topology:', topology.name]);
      data.push(['Location:', locationBreadcrumb]);
      data.push(['Hall:', hallName, 'Row:', rowName, 'Rack:', rackName]);
      data.push([]);
      data.push(['RU', '│', 'Device', 'Role', 'Model', '│']);
      const ruMap = new Map<number, Device>();
      for (const d of sheetDevices) {
        if (d.rack_position && d.rack_position > 0) ruMap.set(d.rack_position, d);
      }
      for (let ru = 42; ru >= 1; ru--) {
        const dev = ruMap.get(ru);
        if (dev) {
          const role = dev.vendor === 'Patch Panel' ? 'patch panel' : dev.topology_role || dev.device_type || '';
          data.push([ru, '│', dev.hostname || String(dev.id), role, dev.model || '', '│']);
        } else {
          data.push([ru, '│', '', '', '', '│']);
        }
      }
      data.push([]);
      data.push(['Device', 'Port', 'PP-A', 'PP-A Port', 'Remote Device', 'Remote Port', 'PP-B', 'PP-B Port', 'Cable (m)']);
      const seen = new Set<string>();
      for (const device of sheetDevices) {
        for (const pa of assignmentsByDevice[device.id] || []) {
          if (!pa.remote_device_id) continue;
          const linkKey = [device.id, pa.port_name, pa.remote_device_id, pa.remote_port_name].sort().join('|');
          if (seen.has(linkKey)) continue;
          seen.add(linkKey);
          const remoteDevice = topoDevices.find(d => d.id === pa.remote_device_id);
          data.push([
            device.hostname || String(device.id), pa.port_name,
            pa.patch_panel_a_hostname || '', pa.patch_panel_a_port || '',
            pa.remote_device_hostname || remoteDevice?.hostname || String(pa.remote_device_id),
            pa.remote_port_name || '',
            pa.patch_panel_b_hostname || '', pa.patch_panel_b_port || '',
            pa.cable_length_meters != null ? pa.cable_length_meters : '',
          ]);
        }
      }
      return data;
    };

    const usedNames = new Set<string>();
    for (const rackId of rackIds) {
      const rack = rackMap.get(rackId);
      const row = rack?.row_id ? rowMap.get(rack.row_id) : undefined;
      const hall = row?.hall_id ? hallMap.get(row.hall_id) : undefined;
      const rackName = rack?.name || String(rackId);
      const hallName = hall?.name || '—';
      const rowName = row?.name || '—';
      let sheetName = `${hallName}-${rowName}-${rackName}`.replace(/[[\]*?/\\:]/g, '-').slice(0, 31);
      if (usedNames.has(sheetName)) sheetName = sheetName.slice(0, 28) + `-${usedNames.size}`;
      usedNames.add(sheetName);
      sheets.push({ name: sheetName, rows: buildRackRows(devicesByRack[rackId], rackName, hallName, rowName) });
    }

    // Unracked sheet
    if (unrackedDevices.length > 0) {
      const byRow: Record<number, Device[]> = {};
      const noRow: Device[] = [];
      for (const d of unrackedDevices) {
        if (d.row_id) (byRow[d.row_id] ??= []).push(d);
        else noRow.push(d);
      }
      const data: (string | number)[][] = [
        ['Topology:', topology.name],
        ['Location:', locationBreadcrumb],
        ['', '', '', 'Unracked Devices'],
        [],
      ];
      const addDeviceRows = (devs: Device[], groupLabel: string) => {
        data.push([groupLabel]);
        data.push(['Device', 'Role', 'Model', 'Hall', 'Row']);
        for (const d of devs) {
          const hall = d.hall_id ? hallMap.get(d.hall_id) : undefined;
          const row = d.row_id ? rowMap.get(d.row_id) : undefined;
          const role = d.vendor === 'Patch Panel' ? 'patch panel' : d.topology_role || d.device_type || '';
          data.push([d.hostname || String(d.id), role, d.model || '', hall?.name || '—', row?.name || '—']);
        }
        data.push([]);
      };
      for (const rowId of Object.keys(byRow).map(Number).sort((a, b) => a - b)) {
        const row = rowMap.get(rowId);
        const hall = row?.hall_id ? hallMap.get(row.hall_id) : undefined;
        addDeviceRows(byRow[rowId], `${hall?.name || '—'} / ${row?.name || rowId}`);
      }
      if (noRow.length > 0) addDeviceRows(noRow, 'No Row Assignment');
      data.push(['Connections']);
      data.push(['Device', 'Port', 'PP-A', 'PP-A Port', 'Remote Device', 'Remote Port', 'PP-B', 'PP-B Port']);
      const seen = new Set<string>();
      for (const device of unrackedDevices) {
        for (const pa of assignmentsByDevice[device.id] || []) {
          if (!pa.remote_device_id) continue;
          const linkKey = [device.id, pa.port_name, pa.remote_device_id, pa.remote_port_name].sort().join('|');
          if (seen.has(linkKey)) continue;
          seen.add(linkKey);
          const remoteDevice = topoDevices.find(d => d.id === pa.remote_device_id);
          data.push([
            device.hostname || String(device.id), pa.port_name,
            pa.patch_panel_a_hostname || '', pa.patch_panel_a_port || '',
            pa.remote_device_hostname || remoteDevice?.hostname || String(pa.remote_device_id),
            pa.remote_port_name || '',
            pa.patch_panel_b_hostname || '', pa.patch_panel_b_port || '',
          ]);
        }
      }
      sheets.push({ name: 'Unracked', rows: data });
    }

    return sheets;
  };

  const handleGenerateConnectionSheet = async (topology: Topology) => {
    setGeneratingConnectionSheet(true);
    try {
      const sheets = await buildConnectionSheetData(topology);
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      for (const sheet of sheets) {
        const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
      }
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${topology.id}-rack-connections.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to generate connection sheet: ${msg}`);
    } finally {
      setGeneratingConnectionSheet(false);
    }
  };

  const handlePreviewConnectionSheet = async (topology: Topology) => {
    setGeneratingConnectionSheet(true);
    try {
      const sheets = await buildConnectionSheetData(topology);
      setCsvPreview({
        title: `Rack Sheet — ${topology.name}`,
        sheets,
        filename: `${topology.id}-rack-connections.xlsx`,
        onDownload: () => handleGenerateConnectionSheet(topology),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to generate connection sheet: ${msg}`);
    } finally {
      setGeneratingConnectionSheet(false);
    }
  };

  const handleSpawnNode = async (topologyId: number, role: string) => {
    const key = `${topologyId}:${role}`;
    setAddingNode(key);
    setAddMenuOpen(null);
    try {
      const roleLabel = role === 'super-spine' ? 'super-spine' : role;
      await getServices().testContainers.spawn({
        image: 'ceosimage:latest',
        topology_id: topologyId,
        topology_role: role,
        hostname: `${roleLabel}-${Date.now() % 10000}`,
      });
      addNotification('success', `Spawned ${roleLabel} and added to topology`, navigateAction('View Topology', 'topologies'));
      refreshTopologies();
      refreshDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to spawn node: ${msg}`);
    } finally {
      setAddingNode(null);
    }
  };

  const handleAssignDevice = async (device: Device) => {
    if (!assignTarget) return;
    try {
      await getServices().devices.update(device.id, {
        ...device,
        topology_id: assignTarget.topologyId,
        topology_role: assignTarget.role,
      });
      addNotification('success', `Assigned ${device.hostname || device.mac || String(device.id)} as ${assignTarget.role}`, navigateAction('View Topology', 'topologies'));
      setAssignTarget(null);
      refreshTopologies();
      refreshDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to assign device: ${msg}`);
    }
  };

  const handleSwapDevice = async (replacement: Device) => {
    if (!swapDevice || !swapDevice.topology_id || !swapDevice.topology_role) return;
    const topoId = swapDevice.topology_id;
    const role = swapDevice.topology_role;
    try {
      // Unassign old device
      await getServices().devices.update(swapDevice.id, {
        ...swapDevice,
        topology_id: undefined,
        topology_role: undefined,
      });
      // Assign replacement into same slot
      await getServices().devices.update(replacement.id, {
        ...replacement,
        topology_id: topoId,
        topology_role: role,
      });
      addNotification('success', `Swapped ${swapDevice.hostname || swapDevice.mac || String(swapDevice.id)} with ${replacement.hostname || replacement.mac || String(replacement.id)}`, navigateAction('View Topology', 'topologies'));
      setSwapDevice(null);
      refreshTopologies();
      refreshDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to swap device: ${msg}`);
    }
  };

  const buildConfigPayload = () => {
    const cfg = topologyConfig;
    return {
      architecture: cfg.architecture,
      external_count: cfg.architecture === 'clos' ? cfg.external_count : 0,
      external_to_tier1_ratio: cfg.architecture === 'clos' ? cfg.external_to_tier1_ratio : undefined,
      tier1_count: cfg.tier1_count,
      tier1_to_tier2_ratio: cfg.tier1_to_tier2_ratio,
      tier1_model: cfg.tier1_model || undefined,
      tier1_names: cfg.tier1_names.filter(n => n).length > 0 ? cfg.tier1_names.filter(n => n) : undefined,
      tier2_count: cfg.tier2_count,
      tier2_to_tier3_ratio: cfg.architecture === 'hierarchical' ? cfg.tier2_to_tier3_ratio : undefined,
      tier2_model: cfg.tier2_model || undefined,
      tier3_count: cfg.architecture === 'hierarchical' ? cfg.tier3_count : 0,
      tier3_model: cfg.architecture === 'hierarchical' && cfg.tier3_model ? cfg.tier3_model : undefined,
      spawn_containers: cfg.spawn_containers,
      ceos_image: cfg.ceos_image || undefined,
      tier1_placement: cfg.tier1_placement || undefined,
      tier2_placement: cfg.tier2_placement || undefined,
      tier3_placement: cfg.tier3_placement || undefined,
      region_id: cfg.region_id ? Number(cfg.region_id) : undefined,
      campus_id: cfg.campus_id ? Number(cfg.campus_id) : undefined,
      datacenter_id: cfg.datacenter_id ? Number(cfg.datacenter_id) : undefined,
      halls: cfg.datacenter_id ? cfg.halls : undefined,
      rows_per_hall: cfg.datacenter_id ? cfg.rows_per_hall : undefined,
      racks_per_row: cfg.datacenter_id ? cfg.racks_per_row : undefined,
      devices_per_rack: cfg.datacenter_id ? cfg.devices_per_rack : undefined,
      // Super-spine (CLOS only)
      super_spine_enabled: cfg.architecture === 'clos' ? cfg.super_spine_enabled : undefined,
      super_spine_count: cfg.architecture === 'clos' && cfg.super_spine_enabled ? cfg.super_spine_count : undefined,
      super_spine_model: cfg.architecture === 'clos' && cfg.super_spine_enabled && cfg.super_spine_model ? cfg.super_spine_model : undefined,
      spine_to_super_spine_ratio: cfg.architecture === 'clos' && cfg.super_spine_enabled ? cfg.spine_to_super_spine_ratio : undefined,
      pods: cfg.architecture === 'clos' && cfg.super_spine_enabled ? cfg.pods : undefined,
      // Physical spacing
      row_spacing_cm: cfg.datacenter_id ? cfg.row_spacing_cm : undefined,
      rack_width_cm: cfg.datacenter_id ? cfg.rack_width_cm : undefined,
      rack_height_ru: cfg.datacenter_id ? cfg.rack_height_ru : undefined,
      rack_depth_cm: cfg.datacenter_id ? cfg.rack_depth_cm : undefined,
      // Topology name
      topology_name: cfg.topology_name || undefined,
      // GPU clusters
      gpu_cluster_count: cfg.gpu_cluster_count > 0 ? cfg.gpu_cluster_count : undefined,
      gpu_model: cfg.gpu_cluster_count > 0 ? cfg.gpu_model : undefined,
      gpus_per_node: cfg.gpu_cluster_count > 0 ? cfg.gpus_per_node : undefined,
      gpu_nodes_per_cluster: cfg.gpu_cluster_count > 0 ? cfg.gpu_nodes_per_cluster : undefined,
      gpu_interconnect: cfg.gpu_cluster_count > 0 ? cfg.gpu_interconnect : undefined,
      gpu_vrf_ids: cfg.gpu_cluster_count > 0 && cfg.gpu_vrf_ids.some(v => v)
        ? cfg.gpu_vrf_ids.slice(0, cfg.gpu_cluster_count).map(v => v ? Number(v) : 0)
        : undefined,
      gpu_include_leaf_uplinks: cfg.gpu_cluster_count > 0 ? cfg.gpu_include_leaf_uplinks : undefined,
      gpu_include_fabric_cabling: cfg.gpu_cluster_count > 0 ? cfg.gpu_include_fabric_cabling : undefined,
      // Management switch
      mgmt_switch_model: cfg.mgmt_switch_model || undefined,
      mgmt_switch_distribution: cfg.mgmt_switch_distribution !== 'per-row' ? cfg.mgmt_switch_distribution : undefined,
      mgmt_switches_per_row: cfg.mgmt_switch_distribution === 'count-per-row' ? cfg.mgmt_switches_per_row : undefined,
    };
  };

  const handlePreviewTopology = async (e: React.FormEvent) => {
    e.preventDefault();
    setPreviewLoading(true);
    setShowTopologyDialog(false);
    try {
      const preview = await getServices().testContainers.previewTopology(buildConfigPayload());
      setPreviewData(preview);
      setPreviewEdits([...preview.devices]);
      setShowPreview(true);
      setShowLinks(false);
      setPreviewRoleFilter(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Preview failed: ${msg}`);
      setShowTopologyDialog(true);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmBuild = async () => {
    setBuildingTopology(true);
    setShowPreview(false);
    try {
      const payload = buildConfigPayload();
      const hasEdits = JSON.stringify(previewEdits) !== JSON.stringify(previewData?.devices);
      const result = await getServices().testContainers.buildTopology({
        ...payload,
        overrides: hasEdits ? { devices: previewEdits } : undefined,
      });
      const mode = topologyConfig.spawn_containers ? 'Container' : 'Template';
      addNotification('success', `${mode} Build complete: ${result.devices.length} devices in ${result.topology_name}`, navigateAction('View Topology', 'topologies'));
      refreshTopologies();
      refreshDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to build topology: ${msg}`);
    } finally {
      setBuildingTopology(false);
    }
  };

  const handlePreviewDeviceEdit = (index: number, field: keyof TopologyPreviewDevice, value: string | number | null) => {
    setPreviewEdits(prev => prev.map(d =>
      d.index === index ? { ...d, [field]: value } : d
    ));
  };

  const handleDownloadBOM = () => {
    if (!previewData) return;
    const csvRows: string[] = ['Category,Item,Specification,Quantity,Unit Length,Notes'];

    // Device BOM: group by model + role (exclude externals and patch panels)
    const excludedRoles = new Set(['patch panel']);
    const deviceGroups = new Map<string, { model: string; role: string; count: number }>();
    for (const dev of previewData.devices) {
      if (excludedRoles.has(dev.role) || dev.device_type === 'external') continue;
      const key = `${dev.model}|${dev.role}`;
      const existing = deviceGroups.get(key);
      if (existing) existing.count++;
      else deviceGroups.set(key, { model: dev.model, role: dev.role, count: 1 });
    }
    for (const { model, role, count } of deviceGroups.values()) {
      csvRows.push(`Device,${model},${role},${count},,`);
    }

    // Fiber BOM: group by rounded cable length
    const standardLengths = [0.5, 1, 2, 3, 5, 7, 10, 15, 20, 30, 50];
    const roundToStandard = (m: number) => standardLengths.find(l => l >= m) ?? Math.ceil(m);
    const fiberGroups = new Map<number, number>();
    let totalLinks = previewData.fabric_links.length;
    for (const link of previewData.fabric_links) {
      const length = link.cable_length_meters ?? 3; // default 3m if unknown
      const rounded = roundToStandard(length);
      fiberGroups.set(rounded, (fiberGroups.get(rounded) || 0) + 1);
    }
    const sortedLengths = [...fiberGroups.entries()].sort((a, b) => a[0] - b[0]);
    for (const [length, qty] of sortedLengths) {
      csvRows.push(`Fiber,DAC/AOC Cable,100G,${qty},${length}m,`);
    }

    // Optic BOM: 2 optics per link
    if (totalLinks > 0) {
      csvRows.push(`Optic,QSFP28,100G,${totalLinks * 2},,2 per fabric link`);
    }

    // GPU cluster BOM
    if (previewData.gpu_clusters && previewData.gpu_clusters.length > 0) {
      for (const cluster of previewData.gpu_clusters) {
        const isIB = cluster.interconnect === 'InfiniBand' || cluster.interconnect === 'InfinityFabric';

        // GPU Leaf Uplink Cables
        if ((cluster.leaf_uplink_links?.length ?? 0) > 0) {
          const uplinkFibers = new Map<number, number>();
          for (const link of cluster.leaf_uplink_links!) {
            const len = link.cable_length_meters ?? 3;
            const rounded = roundToStandard(len);
            uplinkFibers.set(rounded, (uplinkFibers.get(rounded) || 0) + 1);
          }
          for (const [length, qty] of [...uplinkFibers.entries()].sort((a, b) => a[0] - b[0])) {
            csvRows.push(`GPU Leaf Uplink,${isIB ? 'QSFP-DD DAC/AOC' : 'Ethernet DAC/AOC'},400G,${qty},${length}m,GPU node to leaf`);
          }
          csvRows.push(`GPU Leaf Optic,QSFP-DD,400G,${cluster.leaf_uplink_links!.length * 2},,2 per uplink`);
        }

        // GPU Fabric Cables
        if ((cluster.fabric_links?.length ?? 0) > 0) {
          const fabricType = isIB ? 'InfiniBand NDR Cable' : 'Ethernet DAC/AOC';
          const opticType = isIB ? 'OSFP 400G NDR' : 'QSFP-DD 400G';
          const fabricFibers = new Map<number, number>();
          for (const link of cluster.fabric_links!) {
            const len = link.cable_length_meters ?? 3;
            const rounded = roundToStandard(len);
            fabricFibers.set(rounded, (fabricFibers.get(rounded) || 0) + 1);
          }
          for (const [length, qty] of [...fabricFibers.entries()].sort((a, b) => a[0] - b[0])) {
            csvRows.push(`GPU Fabric,${fabricType},400G,${qty},${length}m,${cluster.name}`);
          }
          csvRows.push(`GPU Fabric Optic,${opticType},400G,${cluster.fabric_links!.length * 2},,2 per fabric link`);
        }
      }
    }

    // Management ethernet cables: one per managed device per mgmt switch
    const mgmtSwitches = previewData.devices.filter(d => d.role === 'mgmt-switch');
    const managedDevices = previewData.devices.filter(d =>
      !excludedRoles.has(d.role) && d.device_type !== 'external' && d.role !== 'mgmt-switch'
    );
    if (mgmtSwitches.length > 0 && managedDevices.length > 0) {
      csvRows.push(`Mgmt Ethernet,Cat6 Ethernet Cable,1G,${managedDevices.length},2m,OOB management per device`);
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${previewData.topology_name.replace(/\s+/g, '-')}-BOM.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTeardownTopology = async (architecture: 'clos' | 'hierarchical') => {
    try {
      await getServices().testContainers.teardownTopology(architecture);
      addNotification('success', `${architecture === 'clos' ? 'CLOS' : 'Hierarchical'} topology torn down`, navigateAction('View Topologies', 'topologies'));
      refreshTopologies();
      refreshDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to teardown topology: ${msg}`);
    }
  };

  // Auto-select region/campus/dc when only one option exists
  useEffect(() => {
    if (!showTopologyDialog) return;
    setTopologyConfig(c => {
      const updates: Partial<typeof c> = {};
      if (!c.region_id && regions.length === 1) {
        updates.region_id = String(regions[0].id);
      }
      const effectiveRegion = updates.region_id || c.region_id;
      if (effectiveRegion && !c.campus_id) {
        const filtered = campuses.filter(cp => String(cp.region_id) === effectiveRegion);
        if (filtered.length === 1) updates.campus_id = String(filtered[0].id);
      }
      const effectiveCampus = updates.campus_id || c.campus_id;
      if (effectiveCampus && !c.datacenter_id) {
        const filtered = datacenters.filter(d => String(d.campus_id) === effectiveCampus);
        if (filtered.length === 1) updates.datacenter_id = String(filtered[0].id);
      }
      return Object.keys(updates).length > 0 ? { ...c, ...updates } : c;
    });
  }, [showTopologyDialog, regions, campuses, datacenters]);

  // Validate rack capacity before allowing preview
  const capacityError = useMemo(() => {
    const c = topologyConfig;
    if (c.halls === 0 || c.rows_per_hall === 0 || c.racks_per_row === 0) return null;
    const totalLeafRacks = c.halls * c.rows_per_hall * c.racks_per_row;
    const leafCapacity = totalLeafRacks * c.devices_per_rack;
    const isClos = c.architecture === 'clos';
    const deviceCount = isClos ? c.tier2_count * (c.super_spine_enabled ? c.pods : 1) : c.tier3_count;
    const deviceLabel = isClos ? 'leaves' : 'access switches';
    if (deviceCount > leafCapacity) {
      return `Not enough racks for ${deviceCount} ${deviceLabel}: ${totalLeafRacks} racks × ${c.devices_per_rack} devices/rack = ${leafCapacity} capacity`;
    }
    return null;
  }, [topologyConfig]);

  const [deployingTopology, setDeployingTopology] = useState<number | null>(null);

  const handleDeployTopology = async (topology: Topology) => {
    const topoDevices = devicesByTopology[topology.id] || [];
    const deployable = topoDevices.filter(d => d.config_template || d.vendor);
    if (deployable.length === 0) {
      addNotification('error', 'No deployable devices in this topology (need config_template or vendor)');
      return;
    }
    if (!(await confirm({
      title: 'Deploy All Configs',
      message: `Deploy configuration to ${deployable.length} device(s) in "${topology.name}", then back up their running configs?`,
      confirmText: 'Deploy & Backup',
      destructive: false,
    }))) return;

    setDeployingTopology(topology.id);
    let deployed = 0;
    let failed = 0;
    try {
      // Deploy configs sequentially to avoid overwhelming the backend
      for (const device of deployable) {
        try {
          await getServices().devices.deployConfig(device.id);
          deployed++;
        } catch (err) {
          failed++;
          const msg = err instanceof Error ? err.message : String(err);
          addNotification('error', `Deploy failed for ${device.hostname}: ${msg}`, navigateAction('View Jobs', 'jobs', 'history'));
        }
      }
      addNotification('success', `Deploy complete: ${deployed} succeeded, ${failed} failed`, navigateAction('View Jobs', 'jobs', 'history'));

      // Trigger backups for all deployed devices
      let backedUp = 0;
      for (const device of deployable) {
        try {
          await getServices().devices.triggerBackup(device.id);
          backedUp++;
        } catch {
          // Backup failures are non-critical
        }
      }
      if (backedUp > 0) {
        addNotification('success', `Backup triggered for ${backedUp} device(s)`, navigateAction('View Jobs', 'jobs', 'history'));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Deploy topology failed: ${msg}`, navigateAction('View Jobs', 'jobs', 'history'));
    } finally {
      setDeployingTopology(null);
    }
  };


  const [rebuildingTopology, setRebuildingTopology] = useState<number | null>(null);

  const handleRebuildTopology = async (topology: Topology) => {
    const isClos = topology.name === 'DC1 CLOS Fabric';
    const isHier = topology.name === 'DC1 Hierarchical Fabric';
    if (!isClos && !isHier) return;
    if (!(await confirm({ title: 'Rebuild Topology', message: `Rebuild "${topology.name}"? This will teardown and recreate all devices, port assignments, and IPAM allocations.`, confirmText: 'Rebuild', destructive: true }))) return;
    setRebuildingTopology(topology.id);
    try {
      const cfg = topologyConfig;
      const result = await getServices().testContainers.buildTopology({
        architecture: isClos ? 'clos' : 'hierarchical',
        external_count: isClos ? cfg.external_count : 0,
        external_to_tier1_ratio: isClos ? cfg.external_to_tier1_ratio : undefined,
        tier1_count: cfg.tier1_count,
        tier1_to_tier2_ratio: cfg.tier1_to_tier2_ratio,
        tier1_model: cfg.tier1_model || undefined,
        tier2_count: cfg.tier2_count,
        tier2_to_tier3_ratio: isHier ? cfg.tier2_to_tier3_ratio : undefined,
        tier2_model: cfg.tier2_model || undefined,
        tier3_count: isHier ? cfg.tier3_count : 0,
        tier3_model: isHier && cfg.tier3_model ? cfg.tier3_model : undefined,
        spawn_containers: cfg.spawn_containers,
        ceos_image: cfg.ceos_image || undefined,
        tier1_placement: cfg.tier1_placement || undefined,
        tier2_placement: cfg.tier2_placement || undefined,
        tier3_placement: cfg.tier3_placement || undefined,
        region_id: cfg.region_id ? Number(cfg.region_id) : undefined,
        campus_id: cfg.campus_id ? Number(cfg.campus_id) : undefined,
        datacenter_id: cfg.datacenter_id ? Number(cfg.datacenter_id) : undefined,
        halls: cfg.datacenter_id ? cfg.halls : undefined,
        rows_per_hall: cfg.datacenter_id ? cfg.rows_per_hall : undefined,
        racks_per_row: cfg.datacenter_id ? cfg.racks_per_row : undefined,
        devices_per_rack: cfg.datacenter_id ? cfg.devices_per_rack : undefined,
      });
      addNotification('success', `Rebuilt: ${result.devices.length} devices in ${result.topology_name}`, navigateAction('View Topology', 'topologies'));
      refreshTopologies();
      refreshDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to rebuild: ${msg}`);
    } finally {
      setRebuildingTopology(null);
    }
  };

  const form = useModalForm<Topology, TopologyFormData>({
    emptyFormData: { ...EMPTY_TOPOLOGY_FORM },
    itemToFormData: (topology) => ({
      name: topology.name,
      description: topology.description || '',
      region_id: String(topology.region_id || ''),
      campus_id: String(topology.campus_id || ''),
      datacenter_id: String(topology.datacenter_id || ''),
    }),
    onCreate: (data) => createTopology({
      name: data.name,
      description: data.description,
      region_id: data.region_id ? Number(data.region_id) : undefined,
      campus_id: data.campus_id ? Number(data.campus_id) : undefined,
      datacenter_id: data.datacenter_id ? Number(data.datacenter_id) : undefined,
    }),
    onUpdate: (id, data) => updateTopology(Number(id), {
      name: data.name,
      description: data.description,
      region_id: data.region_id ? Number(data.region_id) : undefined,
      campus_id: data.campus_id ? Number(data.campus_id) : undefined,
      datacenter_id: data.datacenter_id ? Number(data.datacenter_id) : undefined,
    }),
    getItemId: (t) => String(t.id),
    modalName: 'topology-form',
  });

  // Wizard fabric configuration state
  const [fabricConfig, setFabricConfig] = useState({
    spines: 4,
    leaves: 16,
    externals: 0,
    firstHallLeaves: 8,
    additionalHallLeaves: 16,
    racksPerRow: 4,
  });
  const [wizardGenerating, setWizardGenerating] = useState(false);

  // "Create New..." inline state for region/campus/datacenter
  const [newRegionName, setNewRegionName] = useState('');
  const [creatingRegion, setCreatingRegion] = useState(false);
  const [newCampusName, setNewCampusName] = useState('');
  const [creatingCampus, setCreatingCampus] = useState(false);
  const [newDcName, setNewDcName] = useState('');
  const [creatingDc, setCreatingDc] = useState(false);

  // Filtered campuses/datacenters based on selection
  const filteredCampuses = useMemo(() =>
    campuses.filter(c => !form.formData.region_id || String(c.region_id) === form.formData.region_id),
    [campuses, form.formData.region_id]
  );
  const filteredDatacenters = useMemo(() =>
    datacenters.filter(d => !form.formData.campus_id || String(d.campus_id) === form.formData.campus_id),
    [datacenters, form.formData.campus_id]
  );

  // Select options for location dropdowns
  const regionOptions = useMemo(() => [
    { value: '', label: 'Select region...' },
    ...regions.map(r => ({ value: String(r.id), label: r.name })),
    { value: '__new__', label: '+ Create New...' },
  ], [regions]);

  const campusOptions = useMemo(() => [
    { value: '', label: 'Select campus...' },
    ...filteredCampuses.map(c => ({ value: String(c.id), label: c.name })),
    { value: '__new__', label: '+ Create New...' },
  ], [filteredCampuses]);

  const datacenterOptions = useMemo(() => [
    { value: '', label: 'Select datacenter...' },
    ...filteredDatacenters.map(d => ({ value: String(d.id), label: d.name })),
    { value: '__new__', label: '+ Create New...' },
  ], [filteredDatacenters]);

  // Topology builder location select options
  const vclosFilteredCampuses = useMemo(() =>
    campuses.filter(c => !topologyConfig.region_id || String(c.region_id) === topologyConfig.region_id),
    [campuses, topologyConfig.region_id]
  );
  const vclosFilteredDatacenters = useMemo(() =>
    datacenters.filter(d => !topologyConfig.campus_id || String(d.campus_id) === topologyConfig.campus_id),
    [datacenters, topologyConfig.campus_id]
  );
  const vclosRegionOptions = useMemo(() => [
    { value: '', label: 'Select region...' },
    ...regions.map(r => ({ value: String(r.id), label: r.name })),
  ], [regions]);
  const vclosCampusOptions = useMemo(() => [
    { value: '', label: 'Select campus...' },
    ...vclosFilteredCampuses.map(c => ({ value: String(c.id), label: c.name })),
  ], [vclosFilteredCampuses]);
  const vclosDatacenterOptions = useMemo(() => [
    { value: '', label: 'Select datacenter...' },
    ...vclosFilteredDatacenters.map(d => ({ value: String(d.id), label: d.name })),
  ], [vclosFilteredDatacenters]);

  // Handle "Create New..." inline creation
  const handleCreateNewRegion = useCallback(async () => {
    if (!newRegionName.trim()) return;
    const success = await ipam.createRegion({ name: newRegionName.trim(), description: '' });
    if (success) {
      // Find the newly created region by name after refresh
      const created = regions.find(r => r.name === newRegionName.trim());
      if (created) form.setFields({ region_id: String(created.id) });
      setNewRegionName('');
      setCreatingRegion(false);
    }
  }, [newRegionName, ipam, form, regions]);

  const handleCreateNewCampus = useCallback(async () => {
    if (!newCampusName.trim() || !form.formData.region_id) return;
    const success = await ipam.createCampus({ name: newCampusName.trim(), description: '', region_id: form.formData.region_id });
    if (success) {
      const created = campuses.find(c => c.name === newCampusName.trim());
      if (created) form.setFields({ campus_id: String(created.id) });
      setNewCampusName('');
      setCreatingCampus(false);
    }
  }, [newCampusName, form.formData.region_id, ipam, form, campuses]);

  const handleCreateNewDc = useCallback(async () => {
    if (!newDcName.trim() || !form.formData.campus_id) return;
    const success = await ipam.createDatacenter({ name: newDcName.trim(), description: '', campus_id: form.formData.campus_id });
    if (success) {
      const created = datacenters.find(d => d.name === newDcName.trim());
      if (created) form.setFields({ datacenter_id: String(created.id) });
      setNewDcName('');
      setCreatingDc(false);
    }
  }, [newDcName, form.formData.campus_id, ipam, form, datacenters]);

  const modalRoute = useModalRoute();

  // Restore form from URL hash
  useEffect(() => {
    if (modalRoute.isModal('topology-form') && !form.isOpen) {
      const id = modalRoute.getParam('id');
      if (id) {
        const topology = topologies.find(t => String(t.id) === id);
        if (topology) {
          form.openEdit(topology);
        } else if (topologies.length > 0) {
          modalRoute.closeModal();
        }
      } else {
        form.openAdd();
      }
    }
  }, [modalRoute.modal, topologies]);

  const handleDelete = async (topology: Topology) => {
    await deleteTopology(topology.id);
  };

  const handleDeleteWithDevices = async (topology: Topology) => {
    if (await confirm({
      title: 'Delete Topology & Devices',
      message: `This will permanently delete topology "${topology.name}" and all ${topology.device_count || 0} device(s) in it. This cannot be undone.`,
      confirmText: 'Delete All',
      destructive: true,
    })) {
      try {
        await getServices().topologies.removeWithDevices(topology.id);
        addNotification('success', `Deleted topology "${topology.name}" and ${topology.device_count || 0} device(s)`);
        refreshTopologies();
        refreshDevices();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addNotification('error', `Failed to delete: ${msg}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.isEditing) {
      await form.submit();
      return;
    }

    // New topology with wizard auto-generation
    const data = form.formData;
    const topoId = slugify(data.name);
    if (!data.name.trim()) {
      addNotification('error', 'Topology name is required');
      return;
    }

    setWizardGenerating(true);
    try {
      // 1. Create topology
      await createTopology({
        name: data.name,
        description: data.description,
        region_id: data.region_id ? Number(data.region_id) : undefined,
        campus_id: data.campus_id ? Number(data.campus_id) : undefined,
        datacenter_id: data.datacenter_id ? Number(data.datacenter_id) : undefined,
      });

      const { spines, leaves, externals, firstHallLeaves, additionalHallLeaves, racksPerRow } = fabricConfig;
      const dcId = data.datacenter_id;

      if (spines === 0 && leaves === 0) {
        // No fabric, just create empty topology
        form.close();
        addNotification('success', `Topology "${data.name}" created`, navigateAction('View Topologies', 'topologies'));
        return;
      }

      // 2. Distribute leaves across halls
      const hallAssignments: { hallNum: number; spineCount: number; leafCount: number; externalCount: number; hasMgmt: boolean }[] = [];
      let remainingLeaves = leaves;
      let hallNum = 1;

      // Hall 1: all spines + first batch of leaves + externals
      const hall1Leaves = Math.min(firstHallLeaves, remainingLeaves);
      remainingLeaves -= hall1Leaves;
      hallAssignments.push({ hallNum: 1, spineCount: spines, leafCount: hall1Leaves, externalCount: externals, hasMgmt: true });
      hallNum++;

      // Additional halls
      while (remainingLeaves > 0) {
        const batchLeaves = Math.min(additionalHallLeaves, remainingLeaves);
        remainingLeaves -= batchLeaves;
        hallAssignments.push({ hallNum, spineCount: 0, leafCount: batchLeaves, externalCount: 0, hasMgmt: true });
        hallNum++;
      }

      // Device model RU heights
      const ruHeight: Record<string, number> = {
        '7050CX3-32S': 1,
        '7050SX3-48YC8': 1,
        'PP-192-RJ45': 8,
      };

      let globalSpineIdx = 1;
      let globalLeafIdx = 1;
      let globalExtIdx = 1;
      const svc = getServices();

      // 3. For each hall, create hall/rows/racks/devices
      // Find the newly created topology to get its numeric ID
      const createdTopos = await svc.topologies.list();
      const createdTopo = createdTopos.find(t => t.name === data.name);
      const numericTopoId = createdTopo?.id;

      for (const hall of hallAssignments) {
        let hallNumericId: number | undefined;
        if (dcId) {
          try {
            const createdHall = await svc.ipam.createHall({ name: `Hall ${hall.hallNum}`, description: '', datacenter_id: dcId });
            hallNumericId = createdHall.id;
          } catch { /* hall may already exist */ }
        }

        // Collect all devices for this hall
        const hallDevices: { hostname: string; vendor: string; model: string; role: string; deviceType: string; ru: number }[] = [];

        // Spines
        for (let i = 0; i < hall.spineCount; i++) {
          hallDevices.push({
            hostname: `${topoId}-spine-${globalSpineIdx++}`,
            vendor: 'arista', model: '7050CX3-32S', role: 'spine', deviceType: 'internal', ru: 1,
          });
        }

        // Leaves
        for (let i = 0; i < hall.leafCount; i++) {
          hallDevices.push({
            hostname: `${topoId}-leaf-${globalLeafIdx++}`,
            vendor: 'arista', model: '7050SX3-48YC8', role: 'leaf', deviceType: 'internal', ru: 1,
          });
        }

        // Externals
        for (let i = 0; i < hall.externalCount; i++) {
          hallDevices.push({
            hostname: `${topoId}-ext-${globalExtIdx++}`,
            vendor: 'arista', model: '7050SX3-48YC8', role: '', deviceType: 'external', ru: 1,
          });
        }

        // Management switch (1 per hall)
        if (hall.hasMgmt) {
          hallDevices.push({
            hostname: `${topoId}-hall-${hall.hallNum}-mgmt`,
            vendor: 'arista', model: '7050SX3-48YC8', role: '', deviceType: 'external', ru: 1,
          });
        }

        // Distribute devices into rows, then racks
        const devicesPerRow = racksPerRow; // ~1 device per rack
        let deviceIdx = 0;
        let rowNum = 1;

        while (deviceIdx < hallDevices.length) {
          let rowNumericId: number | undefined;
          if (dcId && hallNumericId) {
            try {
              const createdRow = await svc.ipam.createRow({ name: `Row ${rowNum}`, description: '', hall_id: String(hallNumericId) });
              rowNumericId = createdRow.id;
            } catch { /* row may already exist */ }
          }

          // Patch panel for this row
          const ppHostname = `${topoId}-hall-${hall.hallNum}-row-${rowNum}-pp`;
          const ppMac = `02:pp:${String(hall.hallNum).padStart(2, '0')}:${String(rowNum).padStart(2, '0')}:00:00`;
          try {
            await svc.devices.create({
              mac: ppMac,
              ip: '',
              hostname: ppHostname,
              vendor: 'patch panel',
              model: 'PP-192-RJ45',
              device_type: 'external',
              topology_id: numericTopoId,
              topology_role: 'patch panel',
              hall_id: hallNumericId,
              row_id: rowNumericId,
              rack_id: undefined,
              rack_position: 1,
            });
          } catch { /* may already exist */ }

          // Create racks and assign devices
          const rowDevices = hallDevices.slice(deviceIdx, deviceIdx + devicesPerRow);
          for (let rackIdx = 0; rackIdx < rowDevices.length; rackIdx++) {
            let rackNumericId: number | undefined;
            if (dcId && rowNumericId) {
              try {
                const createdRack = await svc.ipam.createRack({ name: `Rack ${rackIdx + 1}`, description: '', row_id: String(rowNumericId), width_cm: 60, height_ru: 42, depth_cm: 100 });
                rackNumericId = createdRack.id;
              } catch { /* rack may already exist */ }
            }

            const dev = rowDevices[rackIdx];
            const mac = `02:${dev.role === 'spine' ? 'sp' : dev.role === 'leaf' ? 'lf' : 'ex'}:${String(hall.hallNum).padStart(2, '0')}:${String(rowNum).padStart(2, '0')}:${String(rackIdx + 1).padStart(2, '0')}:01`;
            try {
              await svc.devices.create({
                mac,
                ip: '',
                hostname: dev.hostname,
                vendor: dev.vendor,
                model: dev.model,
                device_type: dev.deviceType,
                topology_id: numericTopoId,
                topology_role: (dev.role || undefined) as TopologyRole | undefined,
                hall_id: hallNumericId,
                row_id: rowNumericId,
                rack_id: rackNumericId,
                rack_position: 1,
              });
            } catch { /* may already exist */ }
          }

          deviceIdx += devicesPerRow;
          rowNum++;
        }
      }

      form.close();
      refreshTopologies();
      refreshDevices();
      addNotification('success', `Topology "${data.name}" created with ${spines} spines, ${leaves} leaves, ${hallAssignments.length} hall(s)`, navigateAction('View Topologies', 'topologies'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to create topology: ${msg}`);
    } finally {
      setWizardGenerating(false);
    }
  };

  const roleCountCell = (count: number, topologyId: number, role: string) => {
    const key = `${topologyId}:${role}`;
    const isAdding = addingNode === key;
    const menuOpen = addMenuOpen === key;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
        {Cell.count(count)}
        <IconButton
          size="sm"
          variant="secondary"
          onClick={(e) => { e.stopPropagation(); setAddMenuOpen(menuOpen ? null : key); }}
          disabled={isAdding}
          title={`Add ${role}`}
        >
          {isAdding ? <SpinnerIcon size={12} /> : <PlusIcon size={12} />}
        </IconButton>
        {menuOpen && (
          <div ref={addMenuRef} className="add-node-menu" onClick={(e) => e.stopPropagation()}>
            <button className="add-node-menu-item" onClick={() => { setAddMenuOpen(null); setAssignTarget({ topologyId, role: role as TopologyRole }); }}>
              <Icon name="person_add" size={16} />
              Assign existing device
            </button>
            <button className="add-node-menu-item" onClick={() => handleSpawnNode(topologyId, role)}>
              <Icon name="add_circle" size={16} />
              Spawn new cEOS
            </button>
          </div>
        )}
      </span>
    );
  };

  const columns: TableColumn<Topology>[] = [
    { header: 'Name', accessor: (t) => <strong>{t.name}</strong>, searchValue: (t) => t.name },
    { header: 'ID', accessor: (t) => Cell.code(String(t.id)), searchValue: (t) => String(t.id) },
    { header: 'Description', accessor: (t) => Cell.truncate(t.description || '', 60), searchValue: (t) => t.description || '' },
    { header: 'Super-Spines', accessor: (t) => roleCountCell(t.super_spine_count || 0, t.id, 'super-spine'), searchable: false },
    { header: 'Spines', accessor: (t) => roleCountCell(t.spine_count || 0, t.id, 'spine'), searchable: false },
    { header: 'Leaves', accessor: (t) => roleCountCell(t.leaf_count || 0, t.id, 'leaf'), searchable: false },
    { header: 'Total', accessor: (t) => Cell.count(t.device_count || 0), searchable: false },
  ];

  // Track which expanded topology has its diagram visible
  // (expandedDiagram is the topology ID whose diagram is currently shown)

  return (
    <>
    <LoadingState loading={loading} error={error} loadingMessage="Loading topologies...">
      <Card
        title="Topologies"
        titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
        headerAction={
          <div style={{ display: 'flex', gap: 6 }}>
            {hasBuiltTopology && (
              <Button variant="danger" onClick={async () => {
                if (await confirm({ title: 'Teardown Built Topologies', message: 'This will remove all devices, IPAM allocations, and containers for built topologies (CLOS and/or Hierarchical).', confirmText: 'Teardown', destructive: true })) {
                  const closTopo = topologies.find(t => t.name === 'DC1 CLOS Fabric');
                  const hierTopo = topologies.find(t => t.name === 'DC1 Hierarchical Fabric');
                  if (closTopo) await handleTeardownTopology('clos');
                  if (hierTopo) await handleTeardownTopology('hierarchical');
                }
              }}>
                <TrashIcon size={16} />
                Teardown
              </Button>
            )}
            <Button onClick={() => setShowTopologyDialog(true)} disabled={buildingTopology}>
              <Icon name="lan" size={16} />
              {buildingTopology ? 'Building...' : 'Topology Builder'}
            </Button>
            <Button onClick={form.openAdd}>
              <PlusIcon size={16} />
              Add Topology
            </Button>
            <RefreshButton onClick={() => { refreshTopologies(); refreshDevices(); }} />
          </div>
        }
      >
        <InfoSection open={showInfo}>
          <div>
            <p>
              Topologies represent fabric designs. Each device can be assigned to a topology with a role:
              CLOS (<strong>spine</strong>, <strong>leaf</strong>, <strong>super-spine</strong>) or
              Hierarchical (<strong>core</strong>, <strong>distribution</strong>, <strong>access</strong>).
            </p>
            <ul>
              <li>Use the <strong>Topology Builder</strong> to create CLOS or Hierarchical fabrics with full IPAM and port wiring</li>
              <li>Toggle <strong>Spawn Containers</strong> to start cEOS/FRR Docker containers for each device</li>
              <li>Deleting a topology unassigns its devices (does not delete them)</li>
            </ul>
          </div>
        </InfoSection>
        <Table
          data={topologies}
          columns={columns}
          getRowKey={(t) => t.id}
          tableId="topologies"
          onEdit={form.openEdit}
          renderActions={(t) => {
            const hasDevices = !!(t.device_count && t.device_count > 0);
            const td = devicesByTopology[t.id] || [];
            const hasSpines = td.some(d => d.topology_role === 'spine' || d.topology_role === 'super-spine');
            const hasLeaves = td.some(d => d.topology_role === 'leaf');
            return (
              <>
                <Tooltip content="Deploy configs to all devices, then backup">
                  <IconButton
                    variant="primary"
                    onClick={(e) => { e.stopPropagation(); handleDeployTopology(t); }}
                    disabled={deployingTopology === t.id || !hasDevices}
                    isLoading={deployingTopology === t.id}
                  >
                    <Icon name="rocket_launch" size={14} />
                  </IconButton>
                </Tooltip>
                <Tooltip content="Teardown and rebuild topology">
                  <IconButton
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); handleRebuildTopology(t); }}
                    disabled={(t.name !== 'DC1 CLOS Fabric' && t.name !== 'DC1 Hierarchical Fabric') || rebuildingTopology === t.id}
                    isLoading={rebuildingTopology === t.id}
                  >
                    <Icon name="refresh" size={14} />
                  </IconButton>
                </Tooltip>
                <ActionMenu
                  icon={<Icon name="download" size={14} />}
                  tooltip="Downloads"
                  items={[
                    {
                      icon: <Icon name="download" size={14} />,
                      label: 'Cutsheet (CSV)',
                      onClick: () => handleGenerateCutsheet(t),
                      disabled: generatingCutsheet || !hasSpines || !hasLeaves,
                    },
                    {
                      icon: <Icon name="receipt_long" size={14} />,
                      label: 'Bill of Materials (CSV)',
                      onClick: () => handleDownloadTopologyBOM(t),
                      disabled: generatingBOM || !hasDevices,
                    },
                    {
                      icon: <Icon name="grid_on" size={14} />,
                      label: 'Rack Sheet (XLSX)',
                      onClick: () => handleGenerateConnectionSheet(t),
                      disabled: generatingConnectionSheet || !hasDevices,
                    },
                    {
                      icon: <Icon name="image" size={14} />,
                      label: 'Export SVG',
                      onClick: () => {
                        if (expandedDiagram !== t.id) setExpandedDiagram(t.id);
                        setTimeout(() => diagramRef.current?.exportSvg(), 100);
                      },
                      disabled: !hasSpines || !hasLeaves,
                    },
                  ]}
                />
                <ActionMenu
                  icon={<Icon name="visibility" size={14} />}
                  tooltip="Preview"
                  items={[
                    {
                      icon: <Icon name="table_view" size={14} />,
                      label: 'Preview Cutsheet',
                      onClick: () => handlePreviewCutsheet(t),
                      disabled: generatingCutsheet || !hasSpines || !hasLeaves,
                    },
                    {
                      icon: <Icon name="receipt_long" size={14} />,
                      label: 'Preview Bill of Materials',
                      onClick: () => handlePreviewBOM(t),
                      disabled: generatingBOM || !hasDevices,
                    },
                    {
                      icon: <Icon name="grid_on" size={14} />,
                      label: 'Preview Rack Sheet',
                      onClick: () => handlePreviewConnectionSheet(t),
                      disabled: generatingConnectionSheet || !hasDevices,
                    },
                  ]}
                />
                <ActionMenu
                  icon={<TrashIcon size={14} />}
                  variant="danger"
                  tooltip="Delete"
                  items={[
                    {
                      icon: <TrashIcon size={14} />,
                      label: 'Delete (unassign devices)',
                      onClick: () => handleDelete(t),
                      variant: 'danger',
                    },
                    {
                      icon: <TrashIcon size={14} />,
                      label: 'Delete with all devices',
                      onClick: () => handleDeleteWithDevices(t),
                      disabled: !hasDevices,
                      variant: 'danger',
                    },
                  ]}
                />
              </>
            );
          }}
          renderExpandedRow={(t) => {
            const topoDevices = devicesByTopology[t.id] || [];
            if (topoDevices.length === 0) {
              return (
                <div className="empty-state" style={{ padding: '16px' }}>
                  <p>No devices assigned to this topology.</p>
                </div>
              );
            }

            // Sort: super-spines first, then spines, then leaves, then unassigned
            const roleWeight = (r?: string) => r === 'external' ? 0 : r === 'super-spine' ? 1 : r === 'spine' || r === 'core' ? 2 : r === 'leaf' || r === 'distribution' ? 3 : r === 'access' ? 4 : 5;
            const sorted = [...topoDevices].sort((a, b) => roleWeight(a.topology_role) - roleWeight(b.topology_role) || (a.hostname || '').localeCompare(b.hostname || ''));

            const spines = topoDevices.filter(d => d.topology_role === 'spine' || d.topology_role === 'super-spine' || d.topology_role === 'distribution');
            const leaves = topoDevices.filter(d => d.topology_role === 'leaf' || d.topology_role === 'access');
            const ppDevices = topoDevices.filter(d => isPatchPanel(d));
            const extDevices = topoDevices.filter(d => (d.device_type === 'external' || d.topology_role === 'core') && !isPatchPanel(d));
            const gpuDevices = topoDevices.filter(d => d.topology_role === 'gpu-node');
            const mgmtDevices = topoDevices.filter(d => d.topology_role === 'mgmt-switch');
            const hasDiagram = spines.length > 0 && leaves.length > 0;
            const diagramOpen = expandedDiagram === t.id;

            return (
              <>
                <Table<Device>
                  data={sorted}
                  columns={[
                    { header: 'Role', accessor: (d) => Cell.status(isPatchPanel(d) ? 'patch panel' : d.topology_role || 'unassigned', getRoleVariant(d)), searchValue: (d) => d.topology_role || '' },
                    { header: 'Hostname', accessor: (d) => <strong>{d.hostname || '—'}</strong>, searchValue: (d) => d.hostname || '' },
                    { header: 'Vendor', accessor: (d) => d.vendor ? <VendorBadge vendor={d.vendor} /> : Cell.dash(''), searchValue: (d) => d.vendor || '' },
                    { header: 'IP Address', accessor: (d) => Cell.dash(d.ip), searchValue: (d) => d.ip || '' },
                    { header: 'MAC Address', accessor: (d) => Cell.code(d.mac || ''), searchValue: (d) => d.mac || '' },
                    { header: 'Status', accessor: (d) => d.device_type === 'external' || isPatchPanel(d) ? Cell.dash('') : Cell.status(d.status, d.status as 'online' | 'offline' | 'provisioning'), searchValue: (d) => d.status },
                    { header: 'Template', accessor: (d) => Cell.dash(d.config_template ? templateMap[d.config_template] || d.config_template : ''), searchValue: (d) => d.config_template || '' },
                  ] as TableColumn<Device>[]}
                  getRowKey={(d) => d.id}
                  tableId={`topo-${t.id}-devices`}
                  actions={[
                    {
                      icon: (d) => loadingIcon(connectModal.loading && connectModal.item?.ip === d.ip, 'cable'),
                      label: 'Test connectivity',
                      onClick: (d) => connectModal.open({ ip: d.ip, hostname: d.hostname, vendor: d.vendor }),
                      variant: 'secondary',
                      tooltip: 'Test connectivity',
                      loading: (d) => connectModal.loading && connectModal.item?.ip === d.ip,
                    },
                    {
                      icon: <Icon name="terminal" size={14} />,
                      label: 'Commands',
                      onClick: setCommandDevice,
                      variant: 'secondary',
                      tooltip: 'Run commands',
                    },
                    {
                      icon: (d) => loadingIcon(previewModal.item?.id === d.id && previewModal.loading, 'play_arrow'),
                      label: 'Deploy config',
                      onClick: handlePreviewConfig,
                      variant: 'secondary',
                      tooltip: 'Preview & deploy config',
                      loading: (d) => previewModal.item?.id === d.id && previewModal.loading,
                      disabled: (d) => !d.config_template && !d.vendor,
                    },
                    {
                      icon: <Icon name="settings_ethernet" size={14} />,
                      label: 'Ports',
                      onClick: setPortsDevice,
                      variant: 'secondary',
                      tooltip: 'Port assignments',
                    },
                    {
                      icon: <Icon name="swap_horiz" size={14} />,
                      label: 'Swap device',
                      onClick: setSwapDevice,
                      variant: 'secondary',
                      tooltip: 'Swap with another device',
                    },
                  ] as TableAction<Device>[]}
                  emptyMessage="No devices."
                />
                {hasDiagram && (
                  <div className="topo-diagram-section">
                    <button
                      className="topo-diagram-toggle"
                      onClick={(e) => { e.stopPropagation(); setExpandedDiagram(diagramOpen ? null : t.id); }}
                    >
                      <Icon name={diagramOpen ? 'expand_less' : 'expand_more'} size={18} />
                      <Icon name="hub" size={16} />
                      <span>Fabric Diagram</span>
                    </button>
                    {diagramOpen && (
                      <TopologyDiagramViewer ref={diagramRef} spines={spines} leaves={leaves} externals={extDevices} patchPanels={ppDevices} gpuNodes={gpuDevices} mgmtSwitches={mgmtDevices} />
                    )}
                  </div>
                )}
              </>
            );
          }}
          searchable
          searchPlaceholder="Search topologies..."
          emptyMessage="No topologies configured."
          emptyDescription='Click "Add Topology" to define a CLOS fabric.'
        />
      </Card>

      <FormDialog
        isOpen={form.isOpen}
        onClose={form.close}
        title={form.getTitle('Create Topology', 'Edit Topology')}
        onSubmit={handleSubmit}
        submitText={wizardGenerating ? 'Generating...' : form.getSubmitText('Create Topology', 'Update Topology')}
        variant="wide"
      >
        <div style={{ display: 'grid', gridTemplateColumns: form.isEditing ? '1fr' : '1fr 1fr', gap: '24px' }}>
          {/* Left column: Identity & Location */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Identity & Location
            </div>
            <FormField
              label="Topology Name *"
              name="name"
              type="text"
              value={form.formData.name}
              onChange={form.handleChange}
              placeholder="DC1-Fabric"
              required
              disabled={form.isEditing}
            />
            {/* Topology ID is auto-generated by the backend */}
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={form.formData.description}
                onChange={form.handleChange}
                placeholder="Primary datacenter CLOS fabric"
                rows={2}
              />
            </div>

            {/* Region select with inline create */}
            {creatingRegion ? (
              <div className="form-group">
                <label>New Region</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newRegionName}
                    onChange={(e) => setNewRegionName(e.target.value)}
                    placeholder="Region name..."
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateNewRegion(); } if (e.key === 'Escape') setCreatingRegion(false); }}
                    style={{ flex: 1 }}
                  />
                  <Button size="sm" onClick={handleCreateNewRegion}>Create</Button>
                  <Button size="sm" variant="secondary" onClick={() => setCreatingRegion(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <SelectField
                label="Region"
                name="region_id"
                value={form.formData.region_id}
                onChange={(e) => {
                  if (e.target.value === '__new__') { setCreatingRegion(true); return; }
                  form.setFields({ region_id: e.target.value, campus_id: '', datacenter_id: '' });
                }}
                options={regionOptions}
              />
            )}

            {/* Campus select with inline create */}
            {creatingCampus ? (
              <div className="form-group">
                <label>New Campus</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newCampusName}
                    onChange={(e) => setNewCampusName(e.target.value)}
                    placeholder="Campus name..."
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateNewCampus(); } if (e.key === 'Escape') setCreatingCampus(false); }}
                    style={{ flex: 1 }}
                  />
                  <Button size="sm" onClick={handleCreateNewCampus}>Create</Button>
                  <Button size="sm" variant="secondary" onClick={() => setCreatingCampus(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <SelectField
                label="Campus"
                name="campus_id"
                value={form.formData.campus_id}
                onChange={(e) => {
                  if (e.target.value === '__new__') { setCreatingCampus(true); return; }
                  form.setFields({ campus_id: e.target.value, datacenter_id: '' });
                }}
                options={campusOptions}
                disabled={!form.formData.region_id}
              />
            )}

            {/* Datacenter select with inline create */}
            {creatingDc ? (
              <div className="form-group">
                <label>New Datacenter</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newDcName}
                    onChange={(e) => setNewDcName(e.target.value)}
                    placeholder="Datacenter name..."
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateNewDc(); } if (e.key === 'Escape') setCreatingDc(false); }}
                    style={{ flex: 1 }}
                  />
                  <Button size="sm" onClick={handleCreateNewDc}>Create</Button>
                  <Button size="sm" variant="secondary" onClick={() => setCreatingDc(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <SelectField
                label="Datacenter"
                name="datacenter_id"
                value={form.formData.datacenter_id}
                onChange={(e) => {
                  if (e.target.value === '__new__') { setCreatingDc(true); return; }
                  form.setFields({ datacenter_id: e.target.value });
                }}
                options={datacenterOptions}
                disabled={!form.formData.campus_id}
              />
            )}
          </div>

          {/* Right column: Fabric Configuration (only for new topologies) */}
          {!form.isEditing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                Fabric Configuration
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <FormField
                  label="Spines"
                  name="spines"
                  type="number"
                  value={String(fabricConfig.spines)}
                  onChange={(e) => setFabricConfig(f => ({ ...f, spines: parseInt(e.target.value) || 0 }))}
                  placeholder="4"
                />
                <FormField
                  label="Leaves"
                  name="leaves"
                  type="number"
                  value={String(fabricConfig.leaves)}
                  onChange={(e) => setFabricConfig(f => ({ ...f, leaves: parseInt(e.target.value) || 0 }))}
                  placeholder="16"
                />
                <FormField
                  label="External Devices"
                  name="externals"
                  type="number"
                  value={String(fabricConfig.externals)}
                  onChange={(e) => setFabricConfig(f => ({ ...f, externals: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
                <FormField
                  label="Racks per Row"
                  name="racksPerRow"
                  type="number"
                  value={String(fabricConfig.racksPerRow)}
                  onChange={(e) => setFabricConfig(f => ({ ...f, racksPerRow: Math.max(1, parseInt(e.target.value) || 1) }))}
                  placeholder="4"
                />
                <FormField
                  label="Leaves (First Hall)"
                  name="firstHallLeaves"
                  type="number"
                  value={String(fabricConfig.firstHallLeaves)}
                  onChange={(e) => setFabricConfig(f => ({ ...f, firstHallLeaves: parseInt(e.target.value) || 0 }))}
                  placeholder="8"
                />
                <FormField
                  label="Leaves (Add'l Halls)"
                  name="additionalHallLeaves"
                  type="number"
                  value={String(fabricConfig.additionalHallLeaves)}
                  onChange={(e) => setFabricConfig(f => ({ ...f, additionalHallLeaves: parseInt(e.target.value) || 0 }))}
                  placeholder="16"
                />
              </div>

              {/* Summary preview */}
              {(fabricConfig.spines > 0 || fabricConfig.leaves > 0) && (
                <div style={{
                  padding: '12px',
                  background: 'var(--color-bg-secondary, #1a1a2e)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  marginTop: '4px',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px', opacity: 0.8 }}>Will generate:</div>
                  <div>{fabricConfig.spines} spine(s) (Arista 7050CX3-32S)</div>
                  <div>{fabricConfig.leaves} leaf/leaves (Arista 7050SX3-48YC8)</div>
                  {fabricConfig.externals > 0 && <div>{fabricConfig.externals} external device(s)</div>}
                  <div>{(() => {
                    let remaining = fabricConfig.leaves;
                    let halls = 0;
                    if (remaining > 0) {
                      remaining -= Math.min(fabricConfig.firstHallLeaves, remaining);
                      halls = 1;
                      while (remaining > 0) {
                        remaining -= Math.min(fabricConfig.additionalHallLeaves, remaining);
                        halls++;
                      }
                    } else if (fabricConfig.spines > 0) {
                      halls = 1;
                    }
                    return `${halls} hall(s), each with management switch + patch panel per row`;
                  })()}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </FormDialog>
    </LoadingState>

      <ConnectModal modal={connectModal} />
      <CommandDrawer device={commandDevice} onClose={() => setCommandDevice(null)} />
      {portsDevice && (
        <DevicePortAssignments device={portsDevice} onClose={() => setPortsDevice(null)} />
      )}

      {previewModal.isOpen && previewModal.item && (
        <Modal title={`Config Preview: ${previewModal.item.hostname}`} onClose={handleClosePreview} variant="extra-wide"
          footer={
            <DialogActions>
              {previewModal.result && (!deployJob || deployJob.status === 'queued' || deployJob.status === 'running') && (
                <>
                  <Button onClick={handleDiffConfig} disabled={deploying} variant="secondary">
                    {deploying ? <SpinnerIcon size={14} /> : <Icon name="compare_arrows" size={14} />}
                    {deploying ? 'Diffing...' : 'Diff'}
                  </Button>
                  <Button onClick={handleDeployConfig} disabled={deploying}>
                    {deploying ? <SpinnerIcon size={14} /> : <Icon name="send" size={14} />}
                    {deploying ? 'Deploying...' : 'Deploy to Device'}
                  </Button>
                </>
              )}
              <Button variant="secondary" onClick={handleClosePreview}>
                Close
              </Button>
            </DialogActions>
          }
        >
          {previewModal.loading ? (
            <ModalLoading message="Rendering configuration..." />
          ) : previewModal.error ? (
            <div className="config-empty">
              <Icon name="cancel" size={24} />
              <p>{previewModal.error}</p>
            </div>
          ) : previewModal.result ? (
            <>
              <ConfigViewer
                value={previewModal.result.content || ''}
                label={`Template: ${previewModal.result.template_name}`}
                lineNumbers
                copyable
              />
              {deployJob && (deployJob.status === 'completed' || deployJob.status === 'failed') && (
                <div className="connect-results" style={{ marginTop: '1rem' }}>
                  <ResultItem icon={deployJob.status === 'completed' ? 'check_circle' : 'cancel'} title="Deploy Result">
                    {deployJob.status === 'completed' ? (
                      <span className="status online">Config deployed successfully</span>
                    ) : (
                      <span className="status offline">{deployJob.error || 'Deploy failed'}</span>
                    )}
                    {deployJob.output && (
                      <pre className="pre-scrollable" style={{ marginTop: '0.5rem' }}>{deployJob.output}</pre>
                    )}
                  </ResultItem>
                </div>
              )}
            </>
          ) : null}
        </Modal>
      )}

      {assignTarget && (
        <Modal title={`Assign Device as ${assignTarget.role}`} onClose={() => setAssignTarget(null)}>
          {unassignedDevices.length === 0 ? (
            <div className="empty-state" style={{ padding: '16px' }}>
              <p>No unassigned devices available.</p>
            </div>
          ) : (
            <Table<Device>
              data={unassignedDevices}
              columns={[
                { header: 'Hostname', accessor: (d) => <strong>{d.hostname || '—'}</strong>, searchValue: (d) => d.hostname || '' },
                { header: 'IP Address', accessor: (d) => Cell.dash(d.ip), searchValue: (d) => d.ip || '' },
                { header: 'MAC', accessor: (d) => Cell.code(d.mac || ''), searchValue: (d) => d.mac || '' },
                { header: 'Vendor', accessor: (d) => d.vendor ? <VendorBadge vendor={d.vendor} /> : Cell.dash(''), searchValue: (d) => d.vendor || '' },
              ] as TableColumn<Device>[]}
              getRowKey={(d) => d.id}
              tableId="assign-device"
              actions={[{
                icon: () => 'add',
                label: 'Assign',
                onClick: handleAssignDevice,
                variant: 'primary',
                tooltip: `Assign as ${assignTarget.role}`,
              }] as TableAction<Device>[]}
              searchable
              searchPlaceholder="Search devices..."
              emptyMessage="No unassigned devices."
            />
          )}
        </Modal>
      )}

      {swapDevice && (
        <Modal title={`Swap ${swapDevice.hostname || swapDevice.mac || String(swapDevice.id)} (${swapDevice.topology_role})`} onClose={() => setSwapDevice(null)}>
          <p style={{ margin: '0 0 12px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Select a replacement device. The current device will be unassigned from the topology.
          </p>
          {unassignedDevices.length === 0 ? (
            <div className="empty-state" style={{ padding: '16px' }}>
              <p>No unassigned devices available.</p>
            </div>
          ) : (
            <Table<Device>
              data={unassignedDevices}
              columns={[
                { header: 'Hostname', accessor: (d) => <strong>{d.hostname || '—'}</strong>, searchValue: (d) => d.hostname || '' },
                { header: 'IP Address', accessor: (d) => Cell.dash(d.ip), searchValue: (d) => d.ip || '' },
                { header: 'MAC', accessor: (d) => Cell.code(d.mac || ''), searchValue: (d) => d.mac || '' },
                { header: 'Vendor', accessor: (d) => d.vendor ? <VendorBadge vendor={d.vendor} /> : Cell.dash(''), searchValue: (d) => d.vendor || '' },
                { header: 'Model', accessor: (d) => Cell.dash(d.model || ''), searchValue: (d) => d.model || '' },
              ] as TableColumn<Device>[]}
              getRowKey={(d) => d.id}
              tableId="swap-device"
              actions={[{
                icon: <Icon name="swap_horiz" size={14} />,
                label: 'Swap',
                onClick: handleSwapDevice,
                variant: 'primary',
                tooltip: `Replace ${swapDevice.hostname || swapDevice.mac || String(swapDevice.id)}`,
              }] as TableAction<Device>[]}
              searchable
              searchPlaceholder="Search devices..."
              emptyMessage="No unassigned devices."
            />
          )}
        </Modal>
      )}

      <FormDialog
        isOpen={showTopologyDialog}
        onClose={() => setShowTopologyDialog(false)}
        title={`${topologyConfig.spawn_containers ? 'Container' : 'Template'} Build — ${topologyConfig.architecture === 'clos' ? 'CLOS' : 'Hierarchical'}`}
        onSubmit={handlePreviewTopology}
        submitText={previewLoading ? 'Loading Preview...' : 'Preview Build'}
        submitDisabled={!!capacityError || previewLoading}
        variant="wide"
      >
        {/* Topology Name */}
        <div style={{ marginBottom: '16px' }}>
          <FormField
            label="Topology Name"
            name="topology_name"
            value={topologyConfig.topology_name}
            onChange={(e) => setTopologyConfig(c => ({ ...c, topology_name: e.target.value }))}
            placeholder={topologyConfig.architecture === 'clos' ? 'DC1 CLOS Fabric' : 'DC1 Hierarchical Fabric'}
          />
        </div>

        {/* Row 1: Architecture + Spawn Containers */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
          <SelectField
            label="Architecture"
            name="architecture"
            value={topologyConfig.architecture}
            onChange={(e) => {
              const arch = e.target.value as 'clos' | 'hierarchical';
              setTopologyConfig(c => ({
                ...c,
                architecture: arch,
                external_count: arch === 'clos' ? 2 : 0,
                tier2_count: arch === 'clos' ? 16 : 4,
                tier3_count: arch === 'clos' ? 0 : 8,
              }));
            }}
            options={[
              { value: 'clos', label: 'CLOS (Spine-Leaf)' },
              { value: 'hierarchical', label: 'Hierarchical (3-Tier)' },
            ]}
          />
          <div style={{ marginTop: '20px' }}>
            <Toggle
              label="Spawn Containers"
              checked={topologyConfig.spawn_containers}
              onChange={(checked) => setTopologyConfig(c => ({ ...c, spawn_containers: checked }))}
            />
          </div>
          {topologyConfig.spawn_containers && (
            <div style={{ flex: 1, marginTop: '20px' }}>
              <FormField
                label=""
                name="ceos_image"
                value={topologyConfig.ceos_image}
                onChange={(e) => setTopologyConfig(c => ({ ...c, ceos_image: e.target.value }))}
                placeholder="ceosimage:latest"
              />
            </div>
          )}
        </div>

        {/* Super-Spine Toggle (CLOS only) */}
        {topologyConfig.architecture === 'clos' && (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
            <Toggle
              label="Enable Super-Spine (5-Stage CLOS)"
              checked={topologyConfig.super_spine_enabled}
              onChange={(checked) => setTopologyConfig(c => ({ ...c, super_spine_enabled: checked }))}
            />
            {topologyConfig.super_spine_enabled && (
              <span style={{ fontSize: '12px', opacity: 0.6 }}>
                Spine and Leaf counts become per-pod
              </span>
            )}
          </div>
        )}

        {/* Row 2: Tier configuration columns */}
        <div style={{ display: 'grid', gridTemplateColumns: topologyConfig.architecture === 'clos' && topologyConfig.super_spine_enabled ? '1fr 1fr 1fr 1fr 1fr' : '1fr 1fr 1fr 1fr', gap: '24px' }}>
          {/* Column 1: External (CLOS) or Tier 1 Core (Hierarchical) */}
          {topologyConfig.architecture === 'clos' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                External
              </div>
              <FormField
                label="Count"
                name="external_count"
                type="number"
                value={String(topologyConfig.external_count)}
                onChange={(e) => {
                  const count = Math.max(0, parseInt(e.target.value) || 0);
                  setTopologyConfig(c => {
                    const names = [...c.tier1_names];
                    while (names.length < count) names.push('');
                    return { ...c, external_count: count, tier1_names: names.slice(0, count) };
                  });
                }}
              />
              <FormField
                label="Uplinks / Tier 1"
                name="external_to_tier1_ratio"
                type="number"
                value={String(topologyConfig.external_to_tier1_ratio)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, external_to_tier1_ratio: Math.max(1, parseInt(e.target.value) || 1) }))}
                disabled={!topologyConfig.external_count}
              />
              {topologyConfig.external_count > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Array.from({ length: topologyConfig.external_count }, (_, i) => (
                    <FormField
                      key={i}
                      label={`External ${i + 1} Name`}
                      name={`external_name_${i}`}
                      value={topologyConfig.tier1_names[i] || ''}
                      onChange={(e) => setTopologyConfig(c => {
                        const names = [...c.tier1_names];
                        names[i] = e.target.value;
                        return { ...c, tier1_names: names };
                      })}
                      placeholder={`wan-router-${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                Core (Tier 1)
              </div>
              <FormField
                label="Count"
                name="tier1_count"
                type="number"
                value={String(topologyConfig.tier1_count)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier1_count: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              <ModelSelector
                label="Model"
                name="tier1_model"
                value={topologyConfig.tier1_model}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier1_model: e.target.value }))}
                placeholder="Default"
                filter={noPatchPanels}
              />
              <FormField
                label="Links / Tier 2"
                name="tier1_to_tier2_ratio"
                type="number"
                value={String(topologyConfig.tier1_to_tier2_ratio)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier1_to_tier2_ratio: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              {topologyConfig.datacenter_id && (
                <>
                  <SelectField
                    label="Row Placement"
                    name="tier1_placement_hier"
                    value={topologyConfig.tier1_placement.match(/^\d+$/) ? 'rack' : topologyConfig.tier1_placement}
                    onChange={(e) => setTopologyConfig(c => ({ ...c, tier1_placement: e.target.value === 'rack' ? '1' : e.target.value }))}
                    options={[
                      { value: '', label: '(Default)' },
                      { value: 'end', label: 'End of Row' },
                      { value: 'middle', label: 'Middle of Row' },
                      { value: 'beginning', label: 'Beginning of Row' },
                      { value: 'rack', label: 'Specific Rack #' },
                    ]}
                  />
                  {topologyConfig.tier1_placement.match(/^\d+$/) && (
                    <FormField
                      label="Rack #"
                      name="tier1_rack_number_hier"
                      type="number"
                      value={topologyConfig.tier1_placement}
                      onChange={(e) => setTopologyConfig(c => ({ ...c, tier1_placement: e.target.value || '1' }))}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* Super-Spine Column (CLOS + SS enabled only) */}
          {topologyConfig.architecture === 'clos' && topologyConfig.super_spine_enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                Super-Spine
              </div>
              <FormField
                label="Count"
                name="super_spine_count"
                type="number"
                value={String(topologyConfig.super_spine_count)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, super_spine_count: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              <ModelSelector
                label="Model"
                name="super_spine_model"
                value={topologyConfig.super_spine_model}
                onChange={(e) => setTopologyConfig(c => ({ ...c, super_spine_model: e.target.value }))}
                placeholder="Default"
                filter={noPatchPanels}
              />
              <FormField
                label="Links / Spine"
                name="spine_to_super_spine_ratio"
                type="number"
                value={String(topologyConfig.spine_to_super_spine_ratio)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, spine_to_super_spine_ratio: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              <FormField
                label="Pods"
                name="pods"
                type="number"
                value={String(topologyConfig.pods)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, pods: Math.max(2, parseInt(e.target.value) || 2) }))}
              />
            </div>
          )}

          {/* Column 2: Spine/Tier 1 (CLOS) or Distribution/Tier 2 (Hierarchical) */}
          {topologyConfig.architecture === 'clos' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                Spine (Tier 1){topologyConfig.super_spine_enabled ? ' — Per Pod' : ''}
              </div>
              <FormField
                label="Count"
                name="tier1_count"
                type="number"
                value={String(topologyConfig.tier1_count)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier1_count: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              <ModelSelector
                label="Model"
                name="tier1_model"
                value={topologyConfig.tier1_model}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier1_model: e.target.value }))}
                placeholder="Default"
                filter={noPatchPanels}
              />
              <FormField
                label="Links / Tier 2"
                name="tier1_to_tier2_ratio"
                type="number"
                value={String(topologyConfig.tier1_to_tier2_ratio)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier1_to_tier2_ratio: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              {topologyConfig.datacenter_id && (
                <>
                  <SelectField
                    label="Row Placement"
                    name="tier1_placement"
                    value={topologyConfig.tier1_placement.match(/^\d+$/) ? 'rack' : topologyConfig.tier1_placement}
                    onChange={(e) => setTopologyConfig(c => ({ ...c, tier1_placement: e.target.value === 'rack' ? '1' : e.target.value }))}
                    options={[
                      { value: '', label: '(Default)' },
                      { value: 'end', label: 'End of Row' },
                      { value: 'middle', label: 'Middle of Row' },
                      { value: 'beginning', label: 'Beginning of Row' },
                      { value: 'rack', label: 'Specific Rack #' },
                    ]}
                  />
                  {topologyConfig.tier1_placement.match(/^\d+$/) && (
                    <FormField
                      label="Rack #"
                      name="tier1_rack_number"
                      type="number"
                      value={topologyConfig.tier1_placement}
                      onChange={(e) => setTopologyConfig(c => ({ ...c, tier1_placement: e.target.value || '1' }))}
                    />
                  )}
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                Distribution (Tier 2)
              </div>
              <FormField
                label="Count"
                name="tier2_count"
                type="number"
                value={String(topologyConfig.tier2_count)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier2_count: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              <ModelSelector
                label="Model"
                name="tier2_model"
                value={topologyConfig.tier2_model}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier2_model: e.target.value }))}
                placeholder="Default"
                filter={noPatchPanels}
              />
              <FormField
                label="Links / Tier 3"
                name="tier2_to_tier3_ratio"
                type="number"
                value={String(topologyConfig.tier2_to_tier3_ratio)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier2_to_tier3_ratio: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              {topologyConfig.datacenter_id && (
                <>
                  <SelectField
                    label="Row Placement"
                    name="tier2_placement_hier"
                    value={topologyConfig.tier2_placement.match(/^\d+$/) ? 'rack' : topologyConfig.tier2_placement}
                    onChange={(e) => setTopologyConfig(c => ({ ...c, tier2_placement: e.target.value === 'rack' ? '1' : e.target.value }))}
                    options={[
                      { value: '', label: '(Default)' },
                      { value: 'end', label: 'End of Row' },
                      { value: 'middle', label: 'Middle of Row' },
                      { value: 'beginning', label: 'Beginning of Row' },
                      { value: 'rack', label: 'Specific Rack #' },
                    ]}
                  />
                  {topologyConfig.tier2_placement.match(/^\d+$/) && (
                    <FormField
                      label="Rack #"
                      name="tier2_rack_number_hier"
                      type="number"
                      value={topologyConfig.tier2_placement}
                      onChange={(e) => setTopologyConfig(c => ({ ...c, tier2_placement: e.target.value || '1' }))}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* Column 3: Leaf/Tier 2 (CLOS) or Access/Tier 3 (Hierarchical) */}
          {topologyConfig.architecture === 'clos' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                Leaf (Tier 2){topologyConfig.super_spine_enabled ? ' — Per Pod' : ''}
              </div>
              <FormField
                label="Count"
                name="tier2_count"
                type="number"
                value={String(topologyConfig.tier2_count)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier2_count: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              <ModelSelector
                label="Model"
                name="tier2_model"
                value={topologyConfig.tier2_model}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier2_model: e.target.value }))}
                placeholder="Default"
                filter={noPatchPanels}
              />
              {topologyConfig.datacenter_id && (
                <>
                  <SelectField
                    label="Row Placement"
                    name="tier2_placement"
                    value={topologyConfig.tier2_placement.match(/^\d+$/) ? 'rack' : topologyConfig.tier2_placement}
                    onChange={(e) => setTopologyConfig(c => ({ ...c, tier2_placement: e.target.value === 'rack' ? '1' : e.target.value }))}
                    options={[
                      { value: '', label: '(Default)' },
                      { value: 'end', label: 'End of Row' },
                      { value: 'middle', label: 'Middle of Row' },
                      { value: 'beginning', label: 'Beginning of Row' },
                      { value: 'rack', label: 'Specific Rack #' },
                    ]}
                  />
                  {topologyConfig.tier2_placement.match(/^\d+$/) && (
                    <FormField
                      label="Rack #"
                      name="tier2_rack_number"
                      type="number"
                      value={topologyConfig.tier2_placement}
                      onChange={(e) => setTopologyConfig(c => ({ ...c, tier2_placement: e.target.value || '1' }))}
                    />
                  )}
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                Access (Tier 3)
              </div>
              <FormField
                label="Count"
                name="tier3_count"
                type="number"
                value={String(topologyConfig.tier3_count)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier3_count: Math.max(1, parseInt(e.target.value) || 1) }))}
              />
              <ModelSelector
                label="Model"
                name="tier3_model"
                value={topologyConfig.tier3_model}
                onChange={(e) => setTopologyConfig(c => ({ ...c, tier3_model: e.target.value }))}
                placeholder="Default"
                filter={noPatchPanels}
              />
              {topologyConfig.datacenter_id && (
                <>
                  <SelectField
                    label="Row Placement"
                    name="tier3_placement"
                    value={topologyConfig.tier3_placement.match(/^\d+$/) ? 'rack' : topologyConfig.tier3_placement}
                    onChange={(e) => setTopologyConfig(c => ({ ...c, tier3_placement: e.target.value === 'rack' ? '1' : e.target.value }))}
                    options={[
                      { value: '', label: '(Default)' },
                      { value: 'end', label: 'End of Row' },
                      { value: 'middle', label: 'Middle of Row' },
                      { value: 'beginning', label: 'Beginning of Row' },
                      { value: 'rack', label: 'Specific Rack #' },
                    ]}
                  />
                  {topologyConfig.tier3_placement.match(/^\d+$/) && (
                    <FormField
                      label="Rack #"
                      name="tier3_rack_number"
                      type="number"
                      value={topologyConfig.tier3_placement}
                      onChange={(e) => setTopologyConfig(c => ({ ...c, tier3_placement: e.target.value || '1' }))}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* Column 4: Location */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Location
            </div>
            <SelectField
              label="Region"
              name="region_id"
              value={topologyConfig.region_id}
              onChange={(e) => setTopologyConfig(c => ({ ...c, region_id: e.target.value, campus_id: '', datacenter_id: '' }))}
              options={vclosRegionOptions}
            />
            <SelectField
              label="Campus"
              name="campus_id"
              value={topologyConfig.campus_id}
              onChange={(e) => setTopologyConfig(c => ({ ...c, campus_id: e.target.value, datacenter_id: '' }))}
              options={vclosCampusOptions}
              disabled={!topologyConfig.region_id}
            />
            <SelectField
              label="Datacenter"
              name="datacenter_id"
              value={topologyConfig.datacenter_id}
              onChange={(e) => setTopologyConfig(c => ({ ...c, datacenter_id: e.target.value }))}
              options={vclosDatacenterOptions}
              disabled={!topologyConfig.campus_id}
            />
          </div>
        </div>

        {/* Row 3: Rack Layout (only when datacenter selected) */}
        {topologyConfig.datacenter_id && (
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '24px' }}>
            <FormField
              label="Halls"
              name="halls"
              type="number"
              value={String(topologyConfig.halls)}
              onChange={(e) => setTopologyConfig(c => ({ ...c, halls: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
            <FormField
              label="Rows / Hall"
              name="rows_per_hall"
              type="number"
              value={String(topologyConfig.rows_per_hall)}
              onChange={(e) => setTopologyConfig(c => ({ ...c, rows_per_hall: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
            <FormField
              label="Racks / Row"
              name="racks_per_row"
              type="number"
              value={String(topologyConfig.racks_per_row)}
              onChange={(e) => setTopologyConfig(c => ({ ...c, racks_per_row: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
            <FormField
              label="Devices / Rack"
              name="devices_per_rack"
              type="number"
              value={String(topologyConfig.devices_per_rack)}
              onChange={(e) => setTopologyConfig(c => ({ ...c, devices_per_rack: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
            <FormField
              label="Row Spacing (cm)"
              name="row_spacing_cm"
              type="number"
              value={String(topologyConfig.row_spacing_cm)}
              onChange={(e) => setTopologyConfig(c => ({ ...c, row_spacing_cm: Math.max(30, parseInt(e.target.value) || 120) }))}
            />
            <FormField
              label="Rack Width (cm)"
              name="rack_width_cm"
              type="number"
              value={String(topologyConfig.rack_width_cm)}
              onChange={(e) => setTopologyConfig(c => ({ ...c, rack_width_cm: Math.max(1, parseInt(e.target.value) || 60) }))}
            />
            <FormField
              label="Rack Height (RU)"
              name="rack_height_ru"
              type="number"
              value={String(topologyConfig.rack_height_ru)}
              onChange={(e) => setTopologyConfig(c => ({ ...c, rack_height_ru: Math.max(1, parseInt(e.target.value) || 42) }))}
            />
            <FormField
              label="Rack Depth (cm)"
              name="rack_depth_cm"
              type="number"
              value={String(topologyConfig.rack_depth_cm)}
              onChange={(e) => setTopologyConfig(c => ({ ...c, rack_depth_cm: Math.max(1, parseInt(e.target.value) || 100) }))}
            />
          </div>
        )}

        {/* Management Switch */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'end' }}>
            <SelectField
              label="Mgmt Switch Distribution"
              name="mgmt_switch_distribution"
              value={topologyConfig.mgmt_switch_distribution}
              onChange={(e) => setTopologyConfig(c => ({ ...c, mgmt_switch_distribution: e.target.value as typeof c.mgmt_switch_distribution }))}
              options={[
                { value: 'per-row', label: 'Per Row' },
                { value: 'per-rack', label: 'Per Rack' },
                { value: 'per-hall', label: 'Per Hall' },
                { value: 'count-per-row', label: 'Count per Row' },
              ]}
            />
            {topologyConfig.mgmt_switch_distribution === 'count-per-row' && (
              <FormField
                label="Switches / Row"
                name="mgmt_switches_per_row"
                type="number"
                value={String(topologyConfig.mgmt_switches_per_row)}
                onChange={(e) => setTopologyConfig(c => ({ ...c, mgmt_switches_per_row: Math.max(1, parseInt(e.target.value) || 1) }))}
                min={1}
              />
            )}
            <ModelSelector
              label="Mgmt Switch Model"
              name="mgmt_switch_model"
              value={topologyConfig.mgmt_switch_model}
              onChange={(e) => setTopologyConfig(c => ({ ...c, mgmt_switch_model: e.target.value }))}
              placeholder="CCS-720XP-48ZC2 (default)"
              filter={noPatchPanels}
            />
          </div>
        </div>

        {/* GPU Clusters */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'end' }}>
            <FormField
              label="GPU Clusters"
              name="gpu_cluster_count"
              type="number"
              value={String(topologyConfig.gpu_cluster_count)}
              onChange={(e) => setTopologyConfig(c => ({ ...c, gpu_cluster_count: Math.max(0, parseInt(e.target.value) || 0) }))}
              min={0}
            />
            {topologyConfig.gpu_cluster_count > 0 && (
              <>
                <ModelSelector
                  label="GPU Model"
                  name="gpu_model"
                  value={topologyConfig.gpu_model}
                  onChange={(e) => setTopologyConfig(c => ({ ...c, gpu_model: e.target.value }))}
                  variant="gpu"
                />
                <FormField
                  label="Nodes / Cluster"
                  name="gpu_nodes_per_cluster"
                  type="number"
                  value={String(topologyConfig.gpu_nodes_per_cluster)}
                  onChange={(e) => setTopologyConfig(c => ({ ...c, gpu_nodes_per_cluster: Math.max(1, parseInt(e.target.value) || 1) }))}
                  min={1}
                />
                <FormField
                  label="GPUs / Node"
                  name="gpus_per_node"
                  type="number"
                  value={String(topologyConfig.gpus_per_node)}
                  onChange={(e) => setTopologyConfig(c => ({ ...c, gpus_per_node: Math.max(1, parseInt(e.target.value) || 1) }))}
                  min={1}
                />
                <SelectField
                  label="Interconnect"
                  name="gpu_interconnect"
                  value={topologyConfig.gpu_interconnect}
                  onChange={(e) => setTopologyConfig(c => ({ ...c, gpu_interconnect: e.target.value }))}
                  options={[
                    { value: 'InfiniBand', label: 'InfiniBand' },
                    { value: 'InfinityFabric', label: 'Infinity Fabric' },
                    { value: 'RoCE', label: 'RoCE' },
                    { value: 'Ethernet', label: 'Ethernet' },
                  ]}
                />
              </>
            )}
          </div>
          {topologyConfig.gpu_cluster_count > 0 && (
            <>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'end', marginTop: '8px', flexWrap: 'wrap' }}>
                {Array.from({ length: topologyConfig.gpu_cluster_count }, (_, i) => (
                  <SelectField
                    key={i}
                    label={`Cluster ${i + 1} VRF`}
                    name={`gpu_vrf_${i}`}
                    value={topologyConfig.gpu_vrf_ids[i] || ''}
                    onChange={(e) => setTopologyConfig(c => {
                      const ids = [...c.gpu_vrf_ids];
                      while (ids.length <= i) ids.push('');
                      ids[i] = e.target.value;
                      return { ...c, gpu_vrf_ids: ids };
                    })}
                    options={ipam.vrfs.map(v => ({ value: String(v.id), label: v.name }))}
                    placeholder="None"
                  />
                ))}
                <Toggle
                  label="Include Leaf Uplinks"
                  checked={topologyConfig.gpu_include_leaf_uplinks}
                  onChange={(checked) => setTopologyConfig(c => ({ ...c, gpu_include_leaf_uplinks: checked }))}
                />
                <Toggle
                  label="Include Fabric Cabling"
                  checked={topologyConfig.gpu_include_fabric_cabling}
                  onChange={(checked) => setTopologyConfig(c => ({ ...c, gpu_include_fabric_cabling: checked }))}
                />
              </div>
              <p className="settings-hint" style={{ marginTop: '4px' }}>
                {topologyConfig.gpu_cluster_count} cluster(s) x {topologyConfig.gpu_nodes_per_cluster} nodes = {topologyConfig.gpu_cluster_count * topologyConfig.gpu_nodes_per_cluster} GPU nodes
                ({topologyConfig.gpu_cluster_count * topologyConfig.gpu_nodes_per_cluster * topologyConfig.gpus_per_node} total GPUs),
                striped across {topologyConfig.architecture === 'clos' ? 'leaf' : 'access'} switches
              </p>
            </>
          )}
        </div>

        {capacityError && (
          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
            {capacityError}
          </div>
        )}
      </FormDialog>

      {/* Build Preview Modal */}
      {showPreview && previewData && (
        <Modal
          title={`Build Preview — ${previewData.architecture === 'clos' ? 'CLOS' : 'Hierarchical'}`}
          onClose={() => setShowPreview(false)}
          variant="extra-wide"
          footer={
            <DialogActions>
              <Button variant="secondary" onClick={() => { setShowPreview(false); setShowTopologyDialog(true); }}>
                <Icon name="arrow_back" size={14} />
                Back to Config
              </Button>
              <Button variant="secondary" onClick={handleDownloadBOM}>
                <Icon name="download" size={14} />
                Download BOM
              </Button>
              <Button onClick={handleConfirmBuild} disabled={buildingTopology}>
                {buildingTopology ? <SpinnerIcon size={14} /> : <Icon name="build" size={14} />}
                {buildingTopology ? 'Building...' : topologyConfig.spawn_containers ? 'Build & Spawn' : 'Build Fabric'}
              </Button>
            </DialogActions>
          }
        >
          {/* Summary bar */}
          <div style={{
            display: 'flex', gap: '24px', padding: '12px 16px',
            background: 'var(--color-bg-secondary, #1a1a2e)', borderRadius: '6px', marginBottom: '16px',
            fontSize: '13px',
          }}>
            <div><strong>Topology:</strong> {previewData.topology_name}</div>
            <div><strong>Devices:</strong> {previewData.devices.length}</div>
            <div><strong>Fabric Links:</strong> {previewData.fabric_links.length}</div>
            {previewData.racks.length > 0 && <div><strong>Racks:</strong> {previewData.racks.length}</div>}
            {(previewData.tier1_placement || previewData.tier2_placement || previewData.tier3_placement) && (
              <div><strong>Placement:</strong> {[
                previewData.tier1_placement && `Tier 1: ${formatPlacement(previewData.tier1_placement)}`,
                previewData.tier2_placement && `Tier 2: ${formatPlacement(previewData.tier2_placement)}`,
                previewData.tier3_placement && `Tier 3: ${formatPlacement(previewData.tier3_placement)}`,
              ].filter(Boolean).join(' | ')}</div>
            )}
            {previewData.gpu_clusters && previewData.gpu_clusters.length > 0 && (
              <div><strong>GPU Clusters:</strong> {previewData.gpu_clusters.length} ({previewData.gpu_clusters.reduce((sum, c) => sum + c.node_count * c.gpus_per_node, 0)} GPUs)</div>
            )}
          </div>

          {/* Bandwidth ratios between tiers */}
          {(() => {
            const hostRoleMap = new Map<string, string>();
            for (const dev of previewData.devices) {
              hostRoleMap.set(dev.hostname, dev.device_type === 'external' ? 'external' : dev.role);
            }
            const pairCounts = new Map<string, number>();
            for (const link of previewData.fabric_links) {
              const rA = hostRoleMap.get(link.side_a_hostname) || 'unknown';
              const rB = hostRoleMap.get(link.side_b_hostname) || 'unknown';
              const p = [rA, rB].sort().join('|');
              pairCounts.set(p, (pairCounts.get(p) || 0) + 1);
            }
            if (previewData.gpu_clusters) {
              for (const cl of previewData.gpu_clusters) {
                for (const link of cl.leaf_uplink_links || []) {
                  const rA = hostRoleMap.get(link.side_a_hostname) || 'unknown';
                  const rB = hostRoleMap.get(link.side_b_hostname) || 'unknown';
                  const p = [rA, rB].sort().join('|');
                  pairCounts.set(p, (pairCounts.get(p) || 0) + 1);
                }
              }
            }
            if (pairCounts.size === 0) return null;
            const rLabel: Record<string, string> = {
              'external': 'External', 'super-spine': 'Super-Spine', 'spine': 'Spine',
              'leaf': 'Leaf', 'core': 'Core', 'distribution': 'Distribution', 'access': 'Access',
              'gpu-node': 'GPU Node',
            };
            const rOrder = ['external', 'super-spine', 'spine', 'core', 'distribution', 'leaf', 'access', 'gpu-node'];
            const rCounts = new Map<string, number>();
            for (const dev of previewData.devices) {
              const r = dev.device_type === 'external' ? 'external' : dev.role;
              rCounts.set(r, (rCounts.get(r) || 0) + 1);
            }
            const sorted = [...pairCounts.entries()].sort((a, b) => {
              const [a1, a2] = a[0].split('|');
              const [b1, b2] = b[0].split('|');
              return (rOrder.indexOf(a1) + rOrder.indexOf(a2)) - (rOrder.indexOf(b1) + rOrder.indexOf(b2));
            });
            return (
              <div style={{
                display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '8px 16px',
                background: 'var(--color-bg-secondary, #1a1a2e)', borderRadius: '6px', marginBottom: '16px',
                fontSize: '12px',
              }}>
                {sorted.map(([pair, count]) => {
                  const [r1, r2] = pair.split('|');
                  const lower = rOrder.indexOf(r1) > rOrder.indexOf(r2) ? r1 : r2;
                  const lowerCount = rCounts.get(lower) || 1;
                  const ratio = count / lowerCount;
                  const totalBw = count * 100;
                  return (
                    <div key={pair} style={{ whiteSpace: 'nowrap' }}>
                      <strong>{rLabel[r1] || r1}</strong>
                      <span style={{ opacity: 0.5, margin: '0 4px' }}>&harr;</span>
                      <strong>{rLabel[r2] || r2}</strong>
                      <span style={{ opacity: 0.7, marginLeft: '6px' }}>
                        {count} links &middot; {totalBw >= 1000 ? `${totalBw / 1000}T` : `${totalBw}G`} &middot; {ratio}:1/{rLabel[lower] || lower}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Editable devices table */}
          {(() => {
            const roles = [...new Set(previewEdits.map(d => d.role))];
            const filtered = previewRoleFilter ? previewEdits.filter(d => d.role === previewRoleFilter) : previewEdits;
            return (<>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <button
                  className={`btn btn-sm ${!previewRoleFilter ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPreviewRoleFilter(null)}
                  style={{ padding: '2px 10px', fontSize: '0.7rem' }}
                >All ({previewEdits.length})</button>
                {roles.map(role => {
                  const count = previewEdits.filter(d => d.role === role).length;
                  return (
                    <button
                      key={role}
                      className={`btn btn-sm ${previewRoleFilter === role ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setPreviewRoleFilter(previewRoleFilter === role ? null : role)}
                      style={{ padding: '2px 10px', fontSize: '0.7rem' }}
                    >{role} ({count})</button>
                  );
                })}
              </div>
          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table className="table" style={{ width: '100%', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Role</th>
                  <th>Hostname</th>
                  <th style={{ width: '120px' }}>Loopback</th>
                  <th style={{ width: '70px' }}>ASN</th>
                  <th style={{ width: '130px' }}>Model</th>
                  <th style={{ width: '120px' }}>Mgmt IP</th>
                  {previewData.racks.length > 0 && <th style={{ width: '180px' }}>Rack</th>}
                  {previewData.racks.length > 0 && <th style={{ width: '60px' }}>Pos</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((device) => (
                  <tr key={device.index}>
                    <td>
                      <span className={`status ${device.role === 'spine' || device.role === 'distribution' || device.role === 'super-spine' || device.role === 'core' ? 'online' : device.role === 'leaf' || device.role === 'access' ? 'provisioning' : device.role === 'gpu-node' ? 'accent' : device.role === 'patch panel' ? 'neutral' : 'offline'}`}>
                        {device.role}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={device.hostname}
                        onChange={(e) => handlePreviewDeviceEdit(device.index, 'hostname', e.target.value)}
                        style={{ width: '100%', padding: '2px 6px', fontSize: '12px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '3px', color: 'inherit' }}
                      />
                    </td>
                    <td>
                      {device.role === 'external' || device.role === 'gpu-node' || device.role === 'patch panel' ? (
                        <span style={{ opacity: 0.4 }}>—</span>
                      ) : (
                        <input
                          type="text"
                          value={device.loopback}
                          onChange={(e) => handlePreviewDeviceEdit(device.index, 'loopback', e.target.value)}
                          style={{ width: '100%', padding: '2px 6px', fontSize: '12px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '3px', color: 'inherit' }}
                        />
                      )}
                    </td>
                    <td>
                      {device.role === 'gpu-node' || device.role === 'patch panel' ? (
                        <span style={{ opacity: 0.4 }}>—</span>
                      ) : (
                        <NumberInput
                          value={device.asn}
                          onChange={(v) => handlePreviewDeviceEdit(device.index, 'asn', v)}
                          min={1}
                          max={4294967295}
                          size="sm"
                        />
                      )}
                    </td>
                    <td style={{ fontSize: '11px', opacity: 0.7 }}>{device.model}</td>
                    <td>
                      {device.role === 'external' || device.role === 'gpu-node' || device.role === 'patch panel' ? (
                        <span style={{ opacity: 0.4 }}>—</span>
                      ) : (
                        <input
                          type="text"
                          value={device.mgmt_ip}
                          onChange={(e) => handlePreviewDeviceEdit(device.index, 'mgmt_ip', e.target.value)}
                          style={{ width: '100%', padding: '2px 6px', fontSize: '12px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '3px', color: 'inherit' }}
                        />
                      )}
                    </td>
                    {previewData.racks.length > 0 && (
                      <td>
                        <SelectField
                          name="rack"
                          value={String(device.rack_index ?? '')}
                          options={[
                            { value: '', label: 'None' },
                            ...previewData.racks.map(r => ({ value: String(r.index), label: r.name })),
                          ]}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              handlePreviewDeviceEdit(device.index, 'rack_index', null);
                              handlePreviewDeviceEdit(device.index, 'rack_name', null);
                            } else {
                              const idx = parseInt(val);
                              const rack = previewData.racks.find(r => r.index === idx);
                              handlePreviewDeviceEdit(device.index, 'rack_index', idx);
                              if (rack) {
                                setPreviewEdits(prev => prev.map(d =>
                                  d.index === device.index ? { ...d, rack_index: idx, rack_name: rack.name } : d
                                ));
                              }
                            }
                          }}
                        />
                      </td>
                    )}
                    {previewData.racks.length > 0 && (
                      <td>
                        <NumberInput
                          value={device.rack_position ?? 0}
                          onChange={(v) => handlePreviewDeviceEdit(device.index, 'rack_position', v || null)}
                          min={0}
                          max={48}
                          size="sm"
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </>);
          })()}

          {/* Fabric links (collapsible) */}
          {previewData.fabric_links.length > 0 && (
            <div>
              <button
                onClick={() => setShowLinks(!showLinks)}
                style={{
                  background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer',
                  fontSize: '13px', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                <Icon name={showLinks ? 'expand_less' : 'expand_more'} size={16} />
                {showLinks ? 'Hide' : 'Show'} {previewData.fabric_links.length} fabric links
              </button>
              {showLinks && (
                <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="table" style={{ width: '100%', fontSize: '11px' }}>
                    <thead>
                      <tr>
                        <th>Side A</th>
                        <th>Interface</th>
                        <th>IP</th>
                        <th>Side B</th>
                        <th>Interface</th>
                        <th>IP</th>
                        <th>Subnet</th>
                        <th>Length</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.fabric_links.map((link, i) => (
                        <tr key={i}>
                          <td>{link.side_a_hostname}</td>
                          <td style={{ opacity: 0.7 }}>{link.side_a_interface}</td>
                          <td><code style={{ fontSize: '10px' }}>{link.side_a_ip}</code></td>
                          <td>{link.side_b_hostname}</td>
                          <td style={{ opacity: 0.7 }}>{link.side_b_interface}</td>
                          <td><code style={{ fontSize: '10px' }}>{link.side_b_ip}</code></td>
                          <td><code style={{ fontSize: '10px' }}>{link.subnet}</code></td>
                          <td style={{ opacity: 0.7 }}>{link.cable_length_meters != null ? `${link.cable_length_meters}m` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* GPU cluster links (collapsible) */}
          {previewData.gpu_clusters && previewData.gpu_clusters.length > 0 && (
            previewData.gpu_clusters.some(c => (c.leaf_uplink_links?.length ?? 0) > 0 || (c.fabric_links?.length ?? 0) > 0) && (
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={() => setShowGpuLinks(!showGpuLinks)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer',
                    fontSize: '13px', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  <Icon name={showGpuLinks ? 'expand_less' : 'expand_more'} size={16} />
                  {showGpuLinks ? 'Hide' : 'Show'} GPU cluster links ({previewData.gpu_clusters.reduce((s, c) => s + (c.leaf_uplink_links?.length ?? 0) + (c.fabric_links?.length ?? 0), 0)})
                </button>
                {showGpuLinks && previewData.gpu_clusters.map((cluster, ci) => (
                  <div key={ci} style={{ marginTop: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      {cluster.name} — {cluster.gpu_model} ({cluster.node_count} nodes, {cluster.interconnect})
                    </div>
                    {cluster.leaf_uplink_links.length > 0 && (
                      <div style={{ overflowX: 'auto', maxHeight: '200px', overflowY: 'auto', marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '2px' }}>Leaf Uplinks ({cluster.leaf_uplink_links.length})</div>
                        <table className="table" style={{ width: '100%', fontSize: '11px' }}>
                          <thead><tr><th>GPU Node</th><th>Port</th><th>IP</th><th>Leaf</th><th>Port</th><th>IP</th><th>Length</th></tr></thead>
                          <tbody>
                            {cluster.leaf_uplink_links.map((link, li) => (
                              <tr key={li}>
                                <td>{link.side_a_hostname}</td>
                                <td style={{ opacity: 0.7 }}>{link.side_a_interface}</td>
                                <td><code style={{ fontSize: '10px' }}>{link.side_a_ip}</code></td>
                                <td>{link.side_b_hostname}</td>
                                <td style={{ opacity: 0.7 }}>{link.side_b_interface}</td>
                                <td><code style={{ fontSize: '10px' }}>{link.side_b_ip}</code></td>
                                <td style={{ opacity: 0.7 }}>{link.cable_length_meters != null ? `${link.cable_length_meters}m` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {cluster.fabric_links.length > 0 && (
                      <div style={{ overflowX: 'auto', maxHeight: '200px', overflowY: 'auto', marginBottom: '8px' }}>
                        <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '2px' }}>Fabric Links ({cluster.fabric_links.length})</div>
                        <table className="table" style={{ width: '100%', fontSize: '11px' }}>
                          <thead><tr><th>Node A</th><th>Port</th><th>Node B</th><th>Port</th><th>Length</th></tr></thead>
                          <tbody>
                            {cluster.fabric_links.map((link, li) => (
                              <tr key={li}>
                                <td>{link.side_a_hostname}</td>
                                <td style={{ opacity: 0.7 }}>{link.side_a_interface}</td>
                                <td>{link.side_b_hostname}</td>
                                <td style={{ opacity: 0.7 }}>{link.side_b_interface}</td>
                                <td style={{ opacity: 0.7 }}>{link.cable_length_meters != null ? `${link.cable_length_meters}m` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </Modal>
      )}

      {csvPreview && (
        <CsvPreviewModal
          title={csvPreview.title}
          sheets={csvPreview.sheets}
          filename={csvPreview.filename}
          onClose={() => setCsvPreview(null)}
          onDownload={() => { csvPreview.onDownload(); setCsvPreview(null); }}
        />
      )}

      <ConfirmDialogRenderer />
    </>
  );
}

