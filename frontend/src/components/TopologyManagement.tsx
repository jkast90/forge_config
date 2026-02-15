import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Topology, TopologyFormData, Device, ConfigPreviewResult, Job, TopologyRole, PortAssignment } from '@core';
import {
  useTopologies,
  useDevices,
  useTemplates,
  useIpam,
  useAsyncModal,
  useModalForm,
  useModalRoute,
  useWebSocket,
  getServices,
  addNotification,
  navigateAction,
  EMPTY_TOPOLOGY_FORM,
  slugify,
} from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { CommandDrawer } from './CommandDrawer';
import { DevicePortAssignments } from './DevicePortAssignments';
import { IconButton } from './IconButton';
import { ConnectModal, useConnectModal } from './ConnectModal';
import { ConfigViewer } from './ConfigViewer';
import { DialogActions } from './DialogActions';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
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
import { useConfirm } from './ConfirmDialog';

export function TopologyManagement() {
  const [showInfo, setShowInfo] = useState(false);
  const {
    topologies,
    loading,
    error,
    createTopology,
    updateTopology,
    deleteTopology,
  } = useTopologies();
  const { devices, refresh: refreshDevices } = useDevices();
  const { templates } = useTemplates();
  const ipam = useIpam();
  const { regions, campuses, datacenters } = ipam;
  const [addingNode, setAddingNode] = useState<string | null>(null); // "topologyId:role" while spawning
  const [addMenuOpen, setAddMenuOpen] = useState<string | null>(null); // "topologyId:role" for popover
  const [commandDevice, setCommandDevice] = useState<Device | null>(null);
  const [expandedDiagram, setExpandedDiagram] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ topologyId: string; role: TopologyRole } | null>(null);
  const [swapDevice, setSwapDevice] = useState<Device | null>(null); // device being replaced
  const [portsDevice, setPortsDevice] = useState<Device | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [buildingVirtualClos, setBuildingVirtualClos] = useState(false);
  const [showVirtualClosDialog, setShowVirtualClosDialog] = useState(false);
  const [virtualClosConfig, setVirtualClosConfig] = useState({ spines: 2, leaves: 16, region_id: '', campus_id: '', datacenter_id: '', halls: 1, rows_per_hall: 4, racks_per_row: 8, leaves_per_rack: 1, external_devices: 2, uplinks_per_spine: 2, external_names: [] as string[] });

  const hasVirtualClos = useMemo(
    () => devices.some(d => d.topology_id === 'dc1-virtual'),
    [devices],
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
    const map: Record<string, string> = {};
    for (const t of templates) map[t.id] = t.name;
    return map;
  }, [templates]);

  // Group devices by topology_id for expanded rows
  const devicesByTopology = useMemo(() => {
    const map: Record<string, Device[]> = {};
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
        created_at: new Date().toISOString(),
        started_at: null,
        completed_at: null,
      });
      setDeploying(false);
    }
  };

  const handleClosePreview = () => {
    previewModal.close();
    setDeployJob(null);
    setDeploying(false);
  };

  const [generatingCutsheet, setGeneratingCutsheet] = useState(false);

  const handleGenerateCutsheet = async (topology: Topology) => {
    const topoDevices = devicesByTopology[topology.id] || [];
    const spines = topoDevices.filter(d => d.topology_role === 'spine' || d.topology_role === 'super-spine');
    const leaves = topoDevices.filter(d => d.topology_role === 'leaf');

    if (spines.length === 0 || leaves.length === 0) {
      addNotification('error', 'Need at least one spine and one leaf to generate a cutsheet');
      return;
    }

    setGeneratingCutsheet(true);
    try {
      // Fetch port assignments for all topology devices
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

      const csvEscape = (v: string) => v.includes(',') ? `"${v}"` : v;

      const rows: string[] = [
        'Side A Hostname,Side A Interface,Side A Role,Side A Patch Panel,Side A PP Port,Side B Hostname,Side B Interface,Side B Role,Side B Patch Panel,Side B PP Port',
      ];

      // Check if any device has port assignments
      const hasAssignments = Object.values(assignmentsByDevice).some(a => a.length > 0);

      if (hasAssignments) {
        // Use actual port assignment data
        const seen = new Set<string>(); // avoid duplicate rows for bidirectional links
        for (const device of topoDevices) {
          const assignments = assignmentsByDevice[device.id] || [];
          for (const pa of assignments) {
            if (!pa.remote_device_id) continue;
            // Deduplicate: sort device IDs to create a canonical key
            const linkKey = [device.id, pa.port_name, pa.remote_device_id, pa.remote_port_name]
              .sort()
              .join('|');
            if (seen.has(linkKey)) continue;
            seen.add(linkKey);

            const remoteDevice = topoDevices.find(d => d.id === pa.remote_device_id);
            rows.push([
              csvEscape(device.hostname || device.mac || String(device.id)),
              csvEscape(pa.port_name),
              device.topology_role || '',
              pa.patch_panel_a_hostname ? csvEscape(`${pa.patch_panel_a_hostname}`) : '',
              pa.patch_panel_a_port || '',
              csvEscape(pa.remote_device_hostname || (remoteDevice ? remoteDevice.hostname || remoteDevice.mac || String(remoteDevice.id) : String(pa.remote_device_id))),
              csvEscape(pa.remote_port_name || ''),
              remoteDevice?.topology_role || '',
              pa.patch_panel_b_hostname ? csvEscape(`${pa.patch_panel_b_hostname}`) : '',
              pa.patch_panel_b_port || '',
            ].join(','));
          }
        }
      } else {
        // Fallback: auto-generate interface numbers (legacy behavior)
        const ifIndex: Record<number, number> = {};
        const nextIf = (d: Device) => {
          ifIndex[d.id] = (ifIndex[d.id] || 0) + 1;
          const prefix = d.vendor === 'frr' ? 'eth' : 'Ethernet';
          return `${prefix}${ifIndex[d.id]}`;
        };

        const linksPerPair = 2;
        for (const spine of spines) {
          for (const leaf of leaves) {
            for (let link = 0; link < linksPerPair; link++) {
              rows.push([
                csvEscape(spine.hostname || spine.mac || String(spine.id)),
                nextIf(spine),
                spine.topology_role || 'spine',
                '', // Side A Patch Panel
                '', // Side A PP Port
                csvEscape(leaf.hostname || leaf.mac || String(leaf.id)),
                nextIf(leaf),
                leaf.topology_role || 'leaf',
                '', // Side B Patch Panel
                '', // Side B PP Port
              ].join(','));
            }
          }
        }
      }

      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
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

  const handleSpawnNode = async (topologyId: string, role: string) => {
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
      addNotification('success', `Spawned ${roleLabel} and added to topology`);
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
      addNotification('success', `Assigned ${device.hostname || device.mac || String(device.id)} as ${assignTarget.role}`);
      setAssignTarget(null);
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
        topology_id: '',
        topology_role: undefined,
      });
      // Assign replacement into same slot
      await getServices().devices.update(replacement.id, {
        ...replacement,
        topology_id: topoId,
        topology_role: role,
      });
      addNotification('success', `Swapped ${swapDevice.hostname || swapDevice.mac || String(swapDevice.id)} with ${replacement.hostname || replacement.mac || String(replacement.id)}`);
      setSwapDevice(null);
      refreshDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to swap device: ${msg}`);
    }
  };

  const handleBuildVirtualClos = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuildingVirtualClos(true);
    setShowVirtualClosDialog(false);
    try {
      const result = await getServices().testContainers.buildVirtualClos({
        spines: virtualClosConfig.spines,
        leaves: virtualClosConfig.leaves,
        region_id: virtualClosConfig.region_id || undefined,
        campus_id: virtualClosConfig.campus_id || undefined,
        datacenter_id: virtualClosConfig.datacenter_id || undefined,
        halls: virtualClosConfig.datacenter_id ? virtualClosConfig.halls : undefined,
        rows_per_hall: virtualClosConfig.datacenter_id ? virtualClosConfig.rows_per_hall : undefined,
        racks_per_row: virtualClosConfig.datacenter_id ? virtualClosConfig.racks_per_row : undefined,
        leaves_per_rack: virtualClosConfig.datacenter_id ? virtualClosConfig.leaves_per_rack : undefined,
        external_devices: virtualClosConfig.external_devices || undefined,
        uplinks_per_spine: virtualClosConfig.external_devices ? virtualClosConfig.uplinks_per_spine : undefined,
        external_names: virtualClosConfig.external_devices ? virtualClosConfig.external_names.filter(n => n) : undefined,
      });
      addNotification('success', `Virtual CLOS ready: ${result.devices.length} Arista switches in ${result.topology_name}`);
      refreshDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to build virtual CLOS: ${msg}`);
    } finally {
      setBuildingVirtualClos(false);
    }
  };

  const handleTeardownVirtualClos = async () => {
    try {
      await getServices().testContainers.teardownVirtualClos();
      addNotification('success', 'Virtual CLOS topology torn down');
      refreshDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to teardown virtual CLOS: ${msg}`);
    }
  };

  // Auto-select region/campus/dc when only one option exists
  useEffect(() => {
    if (!showVirtualClosDialog) return;
    setVirtualClosConfig(c => {
      const updates: Partial<typeof c> = {};
      // Auto-select region if exactly 1
      if (!c.region_id && regions.length === 1) {
        updates.region_id = regions[0].id;
      }
      const effectiveRegion = updates.region_id || c.region_id;
      // Auto-select campus if exactly 1 for selected region
      if (effectiveRegion && !c.campus_id) {
        const filtered = campuses.filter(cp => cp.region_id === effectiveRegion);
        if (filtered.length === 1) updates.campus_id = filtered[0].id;
      }
      const effectiveCampus = updates.campus_id || c.campus_id;
      // Auto-select datacenter if exactly 1 for selected campus
      if (effectiveCampus && !c.datacenter_id) {
        const filtered = datacenters.filter(d => d.campus_id === effectiveCampus);
        if (filtered.length === 1) updates.datacenter_id = filtered[0].id;
      }
      return Object.keys(updates).length > 0 ? { ...c, ...updates } : c;
    });
  }, [showVirtualClosDialog, regions, campuses, datacenters]);

  const [deployingTopology, setDeployingTopology] = useState<string | null>(null);

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

  const [buildingLabClos, setBuildingLabClos] = useState(false);

  const handleBuildLabClos = async () => {
    if (!(await confirm({ title: 'Build Lab CLOS', message: 'Build a lab CLOS with cEOS containers? (2 spines, 2 leaves). This will spawn Docker containers for each device.', confirmText: 'Build', destructive: false }))) return;
    setBuildingLabClos(true);
    try {
      const result = await getServices().testContainers.buildVirtualClos({
        spines: 2,
        leaves: 2,
        external_devices: 0,
        spawn_containers: true,
      });
      addNotification('success', `Lab CLOS ready: ${result.devices.length} devices with cEOS containers`);
      refreshDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to build lab CLOS: ${msg}`);
    } finally {
      setBuildingLabClos(false);
    }
  };

  const [rebuildingTopology, setRebuildingTopology] = useState<string | null>(null);

  const handleRebuildTopology = async (topology: Topology) => {
    if (topology.id !== 'dc1-virtual') return;
    if (!(await confirm({ title: 'Rebuild Topology', message: `Rebuild "${topology.name}"? This will teardown and recreate all devices, port assignments, and IPAM allocations.`, confirmText: 'Rebuild', destructive: true }))) return;
    setRebuildingTopology(topology.id);
    try {
      const result = await getServices().testContainers.buildVirtualClos({
        spines: virtualClosConfig.spines,
        leaves: virtualClosConfig.leaves,
        region_id: virtualClosConfig.region_id || undefined,
        campus_id: virtualClosConfig.campus_id || undefined,
        datacenter_id: virtualClosConfig.datacenter_id || undefined,
        halls: virtualClosConfig.datacenter_id ? virtualClosConfig.halls : undefined,
        rows_per_hall: virtualClosConfig.datacenter_id ? virtualClosConfig.rows_per_hall : undefined,
        racks_per_row: virtualClosConfig.datacenter_id ? virtualClosConfig.racks_per_row : undefined,
        leaves_per_rack: virtualClosConfig.datacenter_id ? virtualClosConfig.leaves_per_rack : undefined,
        external_devices: virtualClosConfig.external_devices || undefined,
        uplinks_per_spine: virtualClosConfig.external_devices ? virtualClosConfig.uplinks_per_spine : undefined,
        external_names: virtualClosConfig.external_devices ? virtualClosConfig.external_names.filter(n => n) : undefined,
      });
      addNotification('success', `Rebuilt: ${result.devices.length} devices in ${result.topology_name}`);
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
      id: topology.id,
      name: topology.name,
      description: topology.description || '',
      region_id: topology.region_id || '',
      campus_id: topology.campus_id || '',
      datacenter_id: topology.datacenter_id || '',
    }),
    onCreate: (data) => createTopology({ ...data, id: data.id || slugify(data.name) }),
    onUpdate: (id, data) => updateTopology(id, data),
    getItemId: (t) => t.id,
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
    campuses.filter(c => !form.formData.region_id || c.region_id === form.formData.region_id),
    [campuses, form.formData.region_id]
  );
  const filteredDatacenters = useMemo(() =>
    datacenters.filter(d => !form.formData.campus_id || d.campus_id === form.formData.campus_id),
    [datacenters, form.formData.campus_id]
  );

  // Select options for location dropdowns
  const regionOptions = useMemo(() => [
    { value: '', label: 'Select region...' },
    ...regions.map(r => ({ value: r.id, label: r.name })),
    { value: '__new__', label: '+ Create New...' },
  ], [regions]);

  const campusOptions = useMemo(() => [
    { value: '', label: 'Select campus...' },
    ...filteredCampuses.map(c => ({ value: c.id, label: c.name })),
    { value: '__new__', label: '+ Create New...' },
  ], [filteredCampuses]);

  const datacenterOptions = useMemo(() => [
    { value: '', label: 'Select datacenter...' },
    ...filteredDatacenters.map(d => ({ value: d.id, label: d.name })),
    { value: '__new__', label: '+ Create New...' },
  ], [filteredDatacenters]);

  // Virtual CLOS location select options
  const vclosFilteredCampuses = useMemo(() =>
    campuses.filter(c => !virtualClosConfig.region_id || c.region_id === virtualClosConfig.region_id),
    [campuses, virtualClosConfig.region_id]
  );
  const vclosFilteredDatacenters = useMemo(() =>
    datacenters.filter(d => !virtualClosConfig.campus_id || d.campus_id === virtualClosConfig.campus_id),
    [datacenters, virtualClosConfig.campus_id]
  );
  const vclosRegionOptions = useMemo(() => [
    { value: '', label: 'Select region...' },
    ...regions.map(r => ({ value: r.id, label: r.name })),
  ], [regions]);
  const vclosCampusOptions = useMemo(() => [
    { value: '', label: 'Select campus...' },
    ...vclosFilteredCampuses.map(c => ({ value: c.id, label: c.name })),
  ], [vclosFilteredCampuses]);
  const vclosDatacenterOptions = useMemo(() => [
    { value: '', label: 'Select datacenter...' },
    ...vclosFilteredDatacenters.map(d => ({ value: d.id, label: d.name })),
  ], [vclosFilteredDatacenters]);

  // Handle "Create New..." inline creation
  const handleCreateNewRegion = useCallback(async () => {
    if (!newRegionName.trim()) return;
    const id = slugify(newRegionName);
    const success = await ipam.createRegion({ id, name: newRegionName.trim(), description: '' });
    if (success) {
      form.setFields({ region_id: id });
      setNewRegionName('');
      setCreatingRegion(false);
    }
  }, [newRegionName, ipam, form]);

  const handleCreateNewCampus = useCallback(async () => {
    if (!newCampusName.trim() || !form.formData.region_id) return;
    const id = slugify(newCampusName);
    const success = await ipam.createCampus({ id, name: newCampusName.trim(), description: '', region_id: form.formData.region_id });
    if (success) {
      form.setFields({ campus_id: id });
      setNewCampusName('');
      setCreatingCampus(false);
    }
  }, [newCampusName, form.formData.region_id, ipam, form]);

  const handleCreateNewDc = useCallback(async () => {
    if (!newDcName.trim() || !form.formData.campus_id) return;
    const id = slugify(newDcName);
    const success = await ipam.createDatacenter({ id, name: newDcName.trim(), description: '', campus_id: form.formData.campus_id });
    if (success) {
      form.setFields({ datacenter_id: id });
      setNewDcName('');
      setCreatingDc(false);
    }
  }, [newDcName, form.formData.campus_id, ipam, form]);

  const modalRoute = useModalRoute();

  // Restore form from URL hash
  useEffect(() => {
    if (modalRoute.isModal('topology-form') && !form.isOpen) {
      const id = modalRoute.getParam('id');
      if (id) {
        const topology = topologies.find(t => t.id === id);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.isEditing) {
      await form.submit();
      return;
    }

    // New topology with wizard auto-generation
    const data = form.formData;
    const topoId = data.id || slugify(data.name);
    if (!data.name.trim()) {
      addNotification('error', 'Topology name is required');
      return;
    }

    setWizardGenerating(true);
    try {
      // 1. Create topology
      await createTopology({
        id: topoId,
        name: data.name,
        description: data.description,
        region_id: data.region_id,
        campus_id: data.campus_id,
        datacenter_id: data.datacenter_id,
      });

      const { spines, leaves, externals, firstHallLeaves, additionalHallLeaves, racksPerRow } = fabricConfig;
      const dcId = data.datacenter_id;

      if (spines === 0 && leaves === 0) {
        // No fabric, just create empty topology
        form.close();
        addNotification('success', `Topology "${data.name}" created`);
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
      for (const hall of hallAssignments) {
        const hallId = `${dcId || topoId}-hall-${hall.hallNum}`;
        if (dcId) {
          try {
            await svc.ipam.createHall({ id: hallId, name: `Hall ${hall.hallNum}`, description: '', datacenter_id: dcId });
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
          const rowId = `${hallId}-row-${rowNum}`;
          if (dcId) {
            try {
              await svc.ipam.createRow({ id: rowId, name: `Row ${rowNum}`, description: '', hall_id: hallId });
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
              vendor: 'patch-panel',
              model: 'PP-192-RJ45',
              device_type: 'external',
              topology_id: topoId,
              hall_id: hallId,
              row_id: rowId,
              rack_id: '',
              rack_position: 1,
            });
          } catch { /* may already exist */ }

          // Create racks and assign devices
          const rowDevices = hallDevices.slice(deviceIdx, deviceIdx + devicesPerRow);
          for (let rackIdx = 0; rackIdx < rowDevices.length; rackIdx++) {
            const rackId = `${rowId}-rack-${rackIdx + 1}`;
            if (dcId) {
              try {
                await svc.ipam.createRack({ id: rackId, name: `Rack ${rackIdx + 1}`, description: '', row_id: rowId });
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
                topology_id: topoId,
                topology_role: (dev.role || undefined) as TopologyRole | undefined,
                hall_id: hallId,
                row_id: rowId,
                rack_id: rackId,
                rack_position: 1,
              });
            } catch { /* may already exist */ }
          }

          deviceIdx += devicesPerRow;
          rowNum++;
        }
      }

      form.close();
      refreshDevices();
      addNotification('success', `Topology "${data.name}" created with ${spines} spines, ${leaves} leaves, ${hallAssignments.length} hall(s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to create topology: ${msg}`);
    } finally {
      setWizardGenerating(false);
    }
  };

  const roleCountCell = (count: number, topologyId: string, role: string) => {
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
    { header: 'ID', accessor: (t) => Cell.code(t.id), searchValue: (t) => t.id },
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
      <ActionBar>
        <Button onClick={form.openAdd}>
          <PlusIcon size={16} />
          Add Topology
        </Button>
        <Button onClick={() => setShowVirtualClosDialog(true)} disabled={buildingVirtualClos}>
          <Icon name="lan" size={16} />
          {buildingVirtualClos ? 'Building...' : 'Virtual CLOS'}
        </Button>
        <Button onClick={handleBuildLabClos} disabled={buildingLabClos} variant="secondary">
          <Icon name="science" size={16} />
          {buildingLabClos ? 'Spawning...' : 'Lab CLOS'}
        </Button>
        {hasVirtualClos && (
          <Button variant="danger" onClick={handleTeardownVirtualClos}>
            <TrashIcon size={16} />
            Teardown Virtual
          </Button>
        )}
      </ActionBar>

      <Card title="CLOS Topologies" titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}>
        <InfoSection open={showInfo}>
          <div>
            <p>
              Topologies represent CLOS fabric designs (e.g. "DC1-Fabric"). Each device
              can be assigned to a topology with a role: <strong>super-spine</strong>,
              <strong> spine</strong>, or <strong>leaf</strong>.
            </p>
            <ul>
              <li>Assign devices to topologies via the device edit form</li>
              <li>Deleting a topology unassigns its devices (does not delete them)</li>
              <li>Use <code>{'{{TopologyId}}'}</code> and <code>{'{{TopologyRole}}'}</code> in config templates</li>
            </ul>
          </div>
        </InfoSection>
        <Table
          data={topologies}
          columns={columns}
          getRowKey={(t) => t.id}
          tableId="topologies"
          onEdit={form.openEdit}
          onDelete={handleDelete}
          deleteConfirmMessage={(t) =>
            `Delete topology "${t.name}"? ${(t.device_count || 0) > 0 ? `${t.device_count} device(s) will be unassigned.` : ''}`
          }
          actions={[
            {
              icon: (t) => deployingTopology === t.id ? <SpinnerIcon size={14} /> : <Icon name="rocket_launch" size={14} />,
              label: 'Deploy',
              onClick: handleDeployTopology,
              variant: 'primary',
              tooltip: 'Deploy configs to all devices, then backup',
              disabled: (t) => deployingTopology === t.id || !(t.device_count && t.device_count > 0),
              loading: (t) => deployingTopology === t.id,
            },
            {
              icon: (t) => rebuildingTopology === t.id ? <SpinnerIcon size={14} /> : <Icon name="refresh" size={14} />,
              label: 'Rebuild',
              onClick: handleRebuildTopology,
              variant: 'secondary',
              tooltip: 'Teardown and rebuild topology (devices, port assignments, IPAM)',
              disabled: (t) => t.id !== 'dc1-virtual' || rebuildingTopology === t.id,
              loading: (t) => rebuildingTopology === t.id,
            },
            {
              icon: generatingCutsheet ? <SpinnerIcon size={14} /> : <Icon name="download" size={14} />,
              label: 'Cutsheet',
              onClick: handleGenerateCutsheet,
              variant: 'secondary',
              tooltip: 'Download connection cutsheet (CSV)',
              disabled: (t) => generatingCutsheet || !t.spine_count || !t.leaf_count,
            },
          ] as TableAction<Topology>[]}
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
            const roleWeight = (r?: string) => r === 'external' ? 0 : r === 'super-spine' ? 1 : r === 'spine' ? 2 : r === 'leaf' ? 3 : 4;
            const sorted = [...topoDevices].sort((a, b) => roleWeight(a.topology_role) - roleWeight(b.topology_role) || (a.hostname || '').localeCompare(b.hostname || ''));

            const spines = topoDevices.filter(d => d.topology_role === 'spine' || d.topology_role === 'super-spine');
            const leaves = topoDevices.filter(d => d.topology_role === 'leaf');
            const extDevices = topoDevices.filter(d => d.device_type === 'external');
            const hasDiagram = spines.length > 0 && leaves.length > 0;
            const diagramOpen = expandedDiagram === t.id;

            return (
              <>
                <Table<Device>
                  data={sorted}
                  columns={[
                    { header: 'Role', accessor: (d) => Cell.status(d.topology_role || 'unassigned', d.topology_role === 'spine' || d.topology_role === 'super-spine' ? 'online' : d.topology_role === 'leaf' ? 'provisioning' : 'offline'), searchValue: (d) => d.topology_role || '' },
                    { header: 'Hostname', accessor: (d) => <strong>{d.hostname || '—'}</strong>, searchValue: (d) => d.hostname || '' },
                    { header: 'Vendor', accessor: (d) => d.vendor ? <VendorBadge vendor={d.vendor} /> : Cell.dash(''), searchValue: (d) => d.vendor || '' },
                    { header: 'IP Address', accessor: (d) => Cell.dash(d.ip), searchValue: (d) => d.ip || '' },
                    { header: 'MAC Address', accessor: (d) => Cell.code(d.mac || ''), searchValue: (d) => d.mac || '' },
                    { header: 'Status', accessor: (d) => Cell.status(d.status, d.status as 'online' | 'offline' | 'provisioning'), searchValue: (d) => d.status },
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
                      <TopologyDiagramViewer spines={spines} leaves={leaves} externals={extDevices} />
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
            <FormField
              label="Topology ID"
              name="id"
              type="text"
              value={form.formData.id}
              onChange={form.handleChange}
              placeholder="dc1-fabric (auto-generated)"
              disabled={form.isEditing}
            />
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
                <Button onClick={handleDeployConfig} disabled={deploying}>
                  {deploying ? <SpinnerIcon size={14} /> : <Icon name="send" size={14} />}
                  {deploying ? 'Deploying...' : 'Deploy to Device'}
                </Button>
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
        isOpen={showVirtualClosDialog}
        onClose={() => setShowVirtualClosDialog(false)}
        title="Virtual CLOS Fabric"
        onSubmit={handleBuildVirtualClos}
        submitText="Build Fabric"
        variant="wide"
      >
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
          Creates virtual Arista device records in a CLOS topology with port assignments and IPAM allocations. No containers are started.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
          {/* Column 1: Fabric */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Fabric
            </div>
            <FormField
              label="Spines"
              name="spines"
              type="number"
              value={String(virtualClosConfig.spines)}
              onChange={(e) => setVirtualClosConfig(c => ({ ...c, spines: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
            <FormField
              label="Leaves"
              name="leaves"
              type="number"
              value={String(virtualClosConfig.leaves)}
              onChange={(e) => setVirtualClosConfig(c => ({ ...c, leaves: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
            <FormField
              label="External Devices"
              name="external_devices"
              type="number"
              value={String(virtualClosConfig.external_devices)}
              onChange={(e) => {
                const count = Math.max(0, parseInt(e.target.value) || 0);
                setVirtualClosConfig(c => {
                  const names = [...c.external_names];
                  while (names.length < count) names.push('');
                  return { ...c, external_devices: count, external_names: names.slice(0, count) };
                });
              }}
            />
            <FormField
              label="Uplinks / Spine"
              name="uplinks_per_spine"
              type="number"
              value={String(virtualClosConfig.uplinks_per_spine)}
              onChange={(e) => setVirtualClosConfig(c => ({ ...c, uplinks_per_spine: Math.max(1, parseInt(e.target.value) || 1) }))}
              disabled={!virtualClosConfig.external_devices}
            />
            {virtualClosConfig.external_devices > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Array.from({ length: virtualClosConfig.external_devices }, (_, i) => (
                  <FormField
                    key={i}
                    label={`External ${i + 1} Name`}
                    name={`external_name_${i}`}
                    value={virtualClosConfig.external_names[i] || ''}
                    onChange={(e) => setVirtualClosConfig(c => {
                      const names = [...c.external_names];
                      names[i] = e.target.value;
                      return { ...c, external_names: names };
                    })}
                    placeholder={`wan-router-${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Location */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Location
            </div>
            <SelectField
              label="Region"
              name="region_id"
              value={virtualClosConfig.region_id}
              onChange={(e) => setVirtualClosConfig(c => ({ ...c, region_id: e.target.value, campus_id: '', datacenter_id: '' }))}
              options={vclosRegionOptions}
            />
            <SelectField
              label="Campus"
              name="campus_id"
              value={virtualClosConfig.campus_id}
              onChange={(e) => setVirtualClosConfig(c => ({ ...c, campus_id: e.target.value, datacenter_id: '' }))}
              options={vclosCampusOptions}
              disabled={!virtualClosConfig.region_id}
            />
            <SelectField
              label="Datacenter"
              name="datacenter_id"
              value={virtualClosConfig.datacenter_id}
              onChange={(e) => setVirtualClosConfig(c => ({ ...c, datacenter_id: e.target.value }))}
              options={vclosDatacenterOptions}
              disabled={!virtualClosConfig.campus_id}
            />
          </div>

          {/* Column 3: Rack Layout */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: virtualClosConfig.datacenter_id ? 1 : 0.5 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Rack Layout
            </div>
            {!virtualClosConfig.datacenter_id && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '0', fontStyle: 'italic' }}>Select a datacenter to configure</p>
            )}
            <FormField
              label="Halls"
              name="halls"
              type="number"
              value={String(virtualClosConfig.halls)}
              onChange={(e) => setVirtualClosConfig(c => ({ ...c, halls: Math.max(1, parseInt(e.target.value) || 1) }))}
              disabled={!virtualClosConfig.datacenter_id}
            />
            <FormField
              label="Rows / Hall"
              name="rows_per_hall"
              type="number"
              value={String(virtualClosConfig.rows_per_hall)}
              onChange={(e) => setVirtualClosConfig(c => ({ ...c, rows_per_hall: Math.max(1, parseInt(e.target.value) || 1) }))}
              disabled={!virtualClosConfig.datacenter_id}
            />
            <FormField
              label="Racks / Row"
              name="racks_per_row"
              type="number"
              value={String(virtualClosConfig.racks_per_row)}
              onChange={(e) => setVirtualClosConfig(c => ({ ...c, racks_per_row: Math.max(1, parseInt(e.target.value) || 1) }))}
              disabled={!virtualClosConfig.datacenter_id}
            />
            <FormField
              label="Leaves / Rack"
              name="leaves_per_rack"
              type="number"
              value={String(virtualClosConfig.leaves_per_rack)}
              onChange={(e) => setVirtualClosConfig(c => ({ ...c, leaves_per_rack: Math.max(1, parseInt(e.target.value) || 1) }))}
              disabled={!virtualClosConfig.datacenter_id}
            />
          </div>
        </div>
      </FormDialog>
      <ConfirmDialogRenderer />
    </>
  );
}

