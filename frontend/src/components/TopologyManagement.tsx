import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Topology, TopologyFormData, Device, ConfigPreviewResult, Job, TopologyRole } from '@core';
import {
  useTopologies,
  useDevices,
  useTemplates,
  useAsyncModal,
  useModalForm,
  useModalRoute,
  useWebSocket,
  getServices,
  addNotification,
  EMPTY_TOPOLOGY_FORM,
  slugify,
} from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { CommandDrawer } from './CommandDrawer';
import { IconButton } from './IconButton';
import { ConnectModal, useConnectModal } from './ConnectModal';
import { ConfigViewer } from './ConfigViewer';
import { DialogActions } from './DialogActions';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { InfoSection } from './InfoSection';
import { LoadingState, ModalLoading } from './LoadingState';
import { Modal } from './Modal';
import { ResultItem } from './ResultItem';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { VendorBadge } from './VendorBadge';
import { Icon, PlusIcon, SpinnerIcon, loadingIcon } from './Icon';

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
  const [addingNode, setAddingNode] = useState<string | null>(null); // "topologyId:role" while spawning
  const [addMenuOpen, setAddMenuOpen] = useState<string | null>(null); // "topologyId:role" for popover
  const [commandDevice, setCommandDevice] = useState<Device | null>(null);
  const [diagramTopology, setDiagramTopology] = useState<string | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ topologyId: string; role: TopologyRole } | null>(null);
  const [swapDevice, setSwapDevice] = useState<Device | null>(null); // device being replaced
  const addMenuRef = useRef<HTMLDivElement>(null);

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
    if (!confirm(`Deploy configuration to ${previewModal.item.hostname} (${previewModal.item.ip})? This will push the config via SSH.`)) return;
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

  const handleGenerateCutsheet = (topology: Topology) => {
    const topoDevices = devicesByTopology[topology.id] || [];
    const spines = topoDevices.filter(d => d.topology_role === 'spine' || d.topology_role === 'super-spine');
    const leaves = topoDevices.filter(d => d.topology_role === 'leaf');

    if (spines.length === 0 || leaves.length === 0) {
      addNotification('error', 'Need at least one spine and one leaf to generate a cutsheet');
      return;
    }

    // Track interface counters per device
    // FRR uses eth1, eth2, ... (eth0 is management)
    // cEOS/Arista uses Ethernet1, Ethernet2, ...
    const ifIndex: Record<string, number> = {};
    const nextIf = (d: Device) => {
      ifIndex[d.id] = (ifIndex[d.id] || 0) + 1;
      const prefix = d.vendor === 'frr' ? 'eth' : 'Ethernet';
      return `${prefix}${ifIndex[d.id]}`;
    };

    const rows: string[] = [
      'Side A Hostname,Side A Interface,Side A Role,Side B Hostname,Side B Interface,Side B Role',
    ];

    const linksPerPair = 2;
    for (const spine of spines) {
      for (const leaf of leaves) {
        for (let link = 0; link < linksPerPair; link++) {
          rows.push([
            spine.hostname || spine.mac,
            nextIf(spine),
            spine.topology_role || 'spine',
            leaf.hostname || leaf.mac,
            nextIf(leaf),
            leaf.topology_role || 'leaf',
          ].join(','));
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
      addNotification('success', `Assigned ${device.hostname || device.mac} as ${assignTarget.role}`);
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
      addNotification('success', `Swapped ${swapDevice.hostname || swapDevice.mac} with ${replacement.hostname || replacement.mac}`);
      setSwapDevice(null);
      refreshDevices();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to swap device: ${msg}`);
    }
  };

  const form = useModalForm<Topology, TopologyFormData>({
    emptyFormData: { ...EMPTY_TOPOLOGY_FORM },
    itemToFormData: (topology) => ({
      id: topology.id,
      name: topology.name,
      description: topology.description || '',
    }),
    onCreate: (data) => createTopology({ ...data, id: data.id || slugify(data.name) }),
    onUpdate: (id, data) => updateTopology(id, data),
    getItemId: (t) => t.id,
    modalName: 'topology-form',
  });

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
    await form.submit();
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

  return (
    <>
    <LoadingState loading={loading} error={error} loadingMessage="Loading topologies...">
      <ActionBar>
        <Button onClick={form.openAdd}>
          <PlusIcon size={16} />
          Add Topology
        </Button>
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
              icon: <Icon name="download" size={14} />,
              label: 'Cutsheet',
              onClick: handleGenerateCutsheet,
              variant: 'secondary',
              tooltip: 'Download connection cutsheet (CSV)',
              disabled: (t) => !t.spine_count || !t.leaf_count,
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
            const roleWeight = (r?: string) => r === 'super-spine' ? 0 : r === 'spine' ? 1 : r === 'leaf' ? 2 : 3;
            const sorted = [...topoDevices].sort((a, b) => roleWeight(a.topology_role) - roleWeight(b.topology_role) || (a.hostname || '').localeCompare(b.hostname || ''));

            const spines = topoDevices.filter(d => d.topology_role === 'spine' || d.topology_role === 'super-spine');
            const leaves = topoDevices.filter(d => d.topology_role === 'leaf');

            return (
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {/* Device Table */}
                <div style={{ flex: '1 1 400px', minWidth: 0, maxWidth: '70%' }}>
                  <Table<Device>
                    data={sorted}
                    columns={[
                      { header: 'Role', accessor: (d) => Cell.status(d.topology_role || 'unassigned', d.topology_role === 'spine' || d.topology_role === 'super-spine' ? 'online' : d.topology_role === 'leaf' ? 'provisioning' : 'offline'), searchValue: (d) => d.topology_role || '' },
                      { header: 'Hostname', accessor: (d) => <strong>{d.hostname || '—'}</strong>, searchValue: (d) => d.hostname || '' },
                      { header: 'Vendor', accessor: (d) => d.vendor ? <VendorBadge vendor={d.vendor} /> : Cell.dash(''), searchValue: (d) => d.vendor || '' },
                      { header: 'IP Address', accessor: (d) => Cell.dash(d.ip), searchValue: (d) => d.ip || '' },
                      { header: 'MAC Address', accessor: (d) => Cell.code(d.mac), searchValue: (d) => d.mac },
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
                        icon: <Icon name="swap_horiz" size={14} />,
                        label: 'Swap device',
                        onClick: setSwapDevice,
                        variant: 'secondary',
                        tooltip: 'Swap with another device',
                      },
                    ] as TableAction<Device>[]}
                    emptyMessage="No devices."
                  />
                </div>

                {/* Network Diagram (click to expand) */}
                {spines.length > 0 && leaves.length > 0 && (
                  <div
                    style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setDiagramTopology(t.id)}
                    title="Click to enlarge"
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Fabric Links
                      <Icon name="open_in_full" size={12} />
                    </div>
                    <TopologyDiagram spines={spines} leaves={leaves} />
                  </div>
                )}
              </div>
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
        title={form.getTitle('Add Topology', 'Edit Topology')}
        onSubmit={handleSubmit}
        submitText={form.getSubmitText('Add Topology', 'Update Topology')}
      >
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
            rows={3}
          />
        </div>
      </FormDialog>
    </LoadingState>

      <ConnectModal modal={connectModal} />
      <CommandDrawer device={commandDevice} onClose={() => setCommandDevice(null)} />

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
                { header: 'MAC', accessor: (d) => Cell.code(d.mac), searchValue: (d) => d.mac },
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
        <Modal title={`Swap ${swapDevice.hostname || swapDevice.mac} (${swapDevice.topology_role})`} onClose={() => setSwapDevice(null)}>
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
                { header: 'MAC', accessor: (d) => Cell.code(d.mac), searchValue: (d) => d.mac },
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
                tooltip: `Replace ${swapDevice.hostname || swapDevice.mac}`,
              }] as TableAction<Device>[]}
              searchable
              searchPlaceholder="Search devices..."
              emptyMessage="No unassigned devices."
            />
          )}
        </Modal>
      )}

      {/* Diagram popout modal */}
      {diagramTopology && (() => {
        const topoDevices = devicesByTopology[diagramTopology] || [];
        const popSpines = topoDevices.filter(d => d.topology_role === 'spine' || d.topology_role === 'super-spine');
        const popLeaves = topoDevices.filter(d => d.topology_role === 'leaf');
        const topoName = topologies.find(t => t.id === diagramTopology)?.name || diagramTopology;
        return popSpines.length > 0 && popLeaves.length > 0 ? (
          <Modal title={`${topoName} — Fabric Diagram`} onClose={() => setDiagramTopology(null)} variant="wide">
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px', overflow: 'auto' }}>
              <TopologyDiagram spines={popSpines} leaves={popLeaves} scale={1.6} />
            </div>
          </Modal>
        ) : null;
      })()}
    </>
  );
}

/** SVG network diagram showing CLOS spine-leaf topology with dual links */
function TopologyDiagram({ spines, leaves, scale = 1 }: { spines: Device[]; leaves: Device[]; scale?: number }) {
  const nodeW = 140;
  const nodeH = 48;
  const hGap = 20;
  const linksPerPair = 2;
  const linkSpacing = 6;
  const ifLabelH = 9; // height per interface label line
  const ifBlockPad = 4; // padding between node and interface labels
  // Total interfaces per device = leaves.length * linksPerPair (for spines), spines.length * linksPerPair (for leaves)
  const spineIfCount = leaves.length * linksPerPair;
  const leafIfCount = spines.length * linksPerPair;
  const spineIfBlockH = spineIfCount * ifLabelH + ifBlockPad;
  const leafIfBlockH = leafIfCount * ifLabelH + ifBlockPad;
  const vGap = 40 + spineIfBlockH + leafIfBlockH; // space between nodes includes both label blocks
  const padX = 20;
  const padY = 20;

  const maxCount = Math.max(spines.length, leaves.length);
  const totalW = maxCount * (nodeW + hGap) - hGap + padX * 2;
  const totalH = nodeH * 2 + vGap + padY * 2;

  const spineStartX = padX + (totalW - padX * 2 - (spines.length * (nodeW + hGap) - hGap)) / 2;
  const leafStartX = padX + (totalW - padX * 2 - (leaves.length * (nodeW + hGap) - hGap)) / 2;
  const spineY = padY;
  const leafY = padY + nodeH + vGap;

  const spinePositions = spines.map((_, i) => ({ x: spineStartX + i * (nodeW + hGap), y: spineY }));
  const leafPositions = leaves.map((_, i) => ({ x: leafStartX + i * (nodeW + hGap), y: leafY }));

  const statusColor = (d: Device) =>
    d.status === 'online' ? 'var(--color-success, #22c55e)' : d.status === 'provisioning' ? 'var(--color-warning, #f59e0b)' : 'var(--color-text-muted, #888)';

  // Build interface names per device
  const ifPrefix = (d: Device) => d.vendor === 'frr' ? 'eth' : 'Eth';
  const ifIndex: Record<string, number> = {};
  const nextIf = (d: Device) => {
    ifIndex[d.id] = (ifIndex[d.id] || 0) + 1;
    return `${ifPrefix(d)}${ifIndex[d.id]}`;
  };

  // Pre-compute link data and collect interface names + peer info per device
  type IfLabel = { name: string; peer: string };
  const spineIfs: IfLabel[][] = spines.map(() => []);
  const leafIfs: IfLabel[][] = leaves.map(() => []);
  const linkData: { si: number; li: number; link: number }[] = [];
  for (let si = 0; si < spines.length; si++) {
    for (let li = 0; li < leaves.length; li++) {
      for (let link = 0; link < linksPerPair; link++) {
        spineIfs[si].push({ name: nextIf(spines[si]), peer: leaves[li].hostname || leaves[li].mac.slice(-8) });
        leafIfs[li].push({ name: nextIf(leaves[li]), peer: spines[si].hostname || spines[si].mac.slice(-8) });
        linkData.push({ si, li, link });
      }
    }
  }

  return (
    <svg width={totalW * scale} height={totalH * scale} viewBox={`0 0 ${totalW} ${totalH}`} style={{ backgroundColor: 'var(--color-bg-secondary)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
      {/* Dual links */}
      {linkData.map(({ si, li, link }) => {
        const sp = spinePositions[si];
        const lp = leafPositions[li];
        const offset = (link - (linksPerPair - 1) / 2) * linkSpacing;
        return (
          <line
            key={`link-${si}-${li}-${link}`}
            x1={sp.x + nodeW / 2 + offset} y1={sp.y + nodeH}
            x2={lp.x + nodeW / 2 + offset} y2={lp.y}
            stroke="var(--color-border, #444)"
            strokeWidth={1.5}
            opacity={0.4}
          />
        );
      })}

      {/* Spine nodes + interface labels below */}
      {spines.map((d, i) => {
        const pos = spinePositions[i];
        return (
          <g key={d.id}>
            <rect x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx={6} fill="var(--color-bg-primary, #1a1a2e)" stroke={statusColor(d)} strokeWidth={2} />
            <text x={pos.x + nodeW / 2} y={pos.y + 18} textAnchor="middle" fill="var(--color-text, #e0e0e0)" fontSize={12} fontWeight={600}>
              {d.hostname || d.mac.slice(-8)}
            </text>
            <text x={pos.x + nodeW / 2} y={pos.y + 34} textAnchor="middle" fill="var(--color-text-muted, #888)" fontSize={10}>
              {d.ip || '—'}
            </text>
            <circle cx={pos.x + 10} cy={pos.y + 10} r={4} fill={statusColor(d)} />
            {/* Interface labels below spine */}
            {spineIfs[i].map((ifl, j) => (
              <text
                key={j}
                x={pos.x + nodeW / 2}
                y={pos.y + nodeH + ifBlockPad + (j + 1) * ifLabelH}
                textAnchor="middle"
                fill="var(--color-text-muted, #888)"
                fontSize={7}
                opacity={0.7}
              >
                {ifl.name} → {ifl.peer}
              </text>
            ))}
          </g>
        );
      })}

      {/* Leaf nodes + interface labels above */}
      {leaves.map((d, i) => {
        const pos = leafPositions[i];
        return (
          <g key={d.id}>
            <rect x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx={6} fill="var(--color-bg-primary, #1a1a2e)" stroke={statusColor(d)} strokeWidth={2} />
            <text x={pos.x + nodeW / 2} y={pos.y + 18} textAnchor="middle" fill="var(--color-text, #e0e0e0)" fontSize={12} fontWeight={600}>
              {d.hostname || d.mac.slice(-8)}
            </text>
            <text x={pos.x + nodeW / 2} y={pos.y + 34} textAnchor="middle" fill="var(--color-text-muted, #888)" fontSize={10}>
              {d.ip || '—'}
            </text>
            <circle cx={pos.x + 10} cy={pos.y + 10} r={4} fill={statusColor(d)} />
            {/* Interface labels above leaf */}
            {leafIfs[i].map((ifl, j) => (
              <text
                key={j}
                x={pos.x + nodeW / 2}
                y={pos.y - ifBlockPad - (leafIfs[i].length - 1 - j) * ifLabelH}
                textAnchor="middle"
                fill="var(--color-text-muted, #888)"
                fontSize={7}
                opacity={0.7}
              >
                {ifl.name} → {ifl.peer}
              </text>
            ))}
          </g>
        );
      })}

      {/* Tier labels */}
      <text x={8} y={spineY + nodeH / 2 + 4} fill="var(--color-text-muted, #888)" fontSize={9} fontWeight={600} transform={`rotate(-90, 8, ${spineY + nodeH / 2})`} textAnchor="middle">
        SPINE
      </text>
      <text x={8} y={leafY + nodeH / 2 + 4} fill="var(--color-text-muted, #888)" fontSize={9} fontWeight={600} transform={`rotate(-90, 8, ${leafY + nodeH / 2})`} textAnchor="middle">
        LEAF
      </text>
    </svg>
  );
}
