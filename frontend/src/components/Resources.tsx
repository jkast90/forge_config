import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Device, DeviceFormData, Tenant, TenantFormData, GpuCluster, GpuClusterFormData, IpamVrf } from '@core';
import {
  useTenants,
  useGpuClusters,
  useIpam,
  useTopologies,
  useDevices,
  useDiscovery,
  useTestContainers,
  usePersistedTab,
  useModalForm,
  useModalRoute,
  addNotification,
  EMPTY_TENANT_FORM,
  TENANT_STATUS_OPTIONS,
  EMPTY_GPU_CLUSTER_FORM,
  GPU_MODEL_OPTIONS,
  INTERCONNECT_OPTIONS,
  GPU_CLUSTER_STATUS_OPTIONS,
} from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { useConfirm } from './ConfirmDialog';
import { DeviceList } from './DeviceList';
import { Discovery } from './Discovery';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { LoadingState } from './LoadingState';
import { SelectField } from './SelectField';
import { SideTabs } from './SideTabs';
import type { SideTab } from './SideTabs';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { TestContainers } from './TestContainers';
import { PlusIcon, TrashIcon, RefreshIcon, Icon } from './Icon';

interface ResourcesProps {
  onEditDevice: (device: Device) => void;
  onDeleteDevice: (id: number) => Promise<boolean>;
  onBackupDevice: (id: number) => Promise<boolean>;
  onRefreshDevices: () => void;
  onAddDiscoveredDevice: (device: Partial<DeviceFormData>) => void;
}

type Tab = 'devices' | 'discovery' | 'containers' | 'tenants' | 'vrfs' | 'gpu-clusters';

export function Resources({ onEditDevice, onDeleteDevice, onBackupDevice, onRefreshDevices, onAddDiscoveredDevice }: ResourcesProps) {
  const [activeTab, setActiveTab] = usePersistedTab<Tab>('devices', ['devices', 'discovery', 'containers', 'tenants', 'vrfs', 'gpu-clusters'], 'tab_resources');

  const { devices } = useDevices();
  const { discovered } = useDiscovery();
  const { containers } = useTestContainers();
  const { tenants, loading: tenantsLoading, error: tenantsError, createTenant, updateTenant, deleteTenant } = useTenants();
  const { gpuClusters, loading: gpuLoading, error: gpuError, createGpuCluster, updateGpuCluster, deleteGpuCluster } = useGpuClusters();
  const ipam = useIpam();
  const { topologies } = useTopologies();

  const { vrfs } = ipam;

  const tabs: SideTab[] = [
    { id: 'devices', label: 'Devices', icon: 'devices', count: devices.length },
    { id: 'discovery', label: 'Discovery', icon: 'radar', count: discovered.length },
    { id: 'containers', label: 'Test Containers', icon: 'science', count: containers.length },
    { id: 'tenants', label: 'Tenants', icon: 'group', count: tenants.length },
    { id: 'vrfs', label: 'VRFs', icon: 'route', count: vrfs.length },
    { id: 'gpu-clusters', label: 'GPU Clusters', icon: 'memory', count: gpuClusters.length },
  ];

  return (
    <Card title="Devices & Tenants">
      <SideTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setActiveTab(id as Tab)}
      >
        {activeTab === 'devices' && (
          <>
            <div className="actions-bar">
              <Button onClick={onRefreshDevices}>
                <RefreshIcon size={16} />
                Refresh
              </Button>
            </div>
            <DeviceList
              onEdit={onEditDevice}
              onDelete={onDeleteDevice}
              onBackup={onBackupDevice}
              onRefresh={onRefreshDevices}
            />
          </>
        )}
        {activeTab === 'discovery' && <Discovery onAddDevice={onAddDiscoveredDevice} />}
        {activeTab === 'containers' && <TestContainers />}

        {activeTab === 'tenants' && (
          <TenantsTab
            tenants={tenants}
            createTenant={createTenant}
            updateTenant={updateTenant}
            deleteTenant={deleteTenant}
          />
        )}
        {activeTab === 'vrfs' && (
          <VrfsTab vrfs={vrfs} tenants={tenants} ipam={ipam} />
        )}
        {activeTab === 'gpu-clusters' && (
          <GpuClustersTab
            gpuClusters={gpuClusters}
            vrfs={vrfs}
            topologies={topologies}
            createGpuCluster={createGpuCluster}
            updateGpuCluster={updateGpuCluster}
            deleteGpuCluster={deleteGpuCluster}
          />
        )}
      </SideTabs>
    </Card>
  );
}

// ============================================================
// Tenants Tab
// ============================================================

function TenantsTab({ tenants, createTenant, updateTenant, deleteTenant }: {
  tenants: Tenant[];
  createTenant: (data: Partial<Tenant>) => Promise<boolean>;
  updateTenant: (id: string, data: Partial<Tenant>) => Promise<boolean>;
  deleteTenant: (id: string) => Promise<boolean>;
}) {
  const { confirm, ConfirmDialogRenderer } = useConfirm();

  const form = useModalForm<Tenant, TenantFormData>({
    emptyFormData: EMPTY_TENANT_FORM,
    itemToFormData: (t) => ({
      name: t.name,
      description: t.description || '',
      status: t.status,
    }),
    onCreate: (data) => createTenant({
      name: data.name,
      description: data.description || undefined,
      status: data.status as Tenant['status'],
    }),
    onUpdate: (id, data) => updateTenant(id, {
      name: data.name,
      description: data.description || undefined,
      status: data.status as Tenant['status'],
    }),
    getItemId: (t) => String(t.id),
    modalName: 'tenant-form',
  });

  const handleDelete = useCallback(async (t: Tenant) => {
    if (!(await confirm({ title: 'Delete Tenant', message: `Delete tenant "${t.name}"?`, confirmText: 'Delete', destructive: true }))) return;
    await deleteTenant(String(t.id));
  }, [confirm, deleteTenant]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await form.submit();
  }, [form]);

  const columns: TableColumn<Tenant>[] = useMemo(() => [
    {
      header: 'Name',
      accessor: (t) => (
        <>
          <strong>{t.name}</strong>
          {t.description && (
            <>
              <br />
              <span className="text-xs text-secondary">{t.description}</span>
            </>
          )}
        </>
      ),
      searchValue: (t) => `${t.name} ${t.description || ''}`,
    },
    {
      header: 'Status',
      accessor: (t) => (
        <span className={`status ${t.status === 'active' ? 'online' : 'offline'}`}>
          {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
        </span>
      ),
      searchValue: (t) => t.status,
    },
  ], []);

  const actions: TableAction<Tenant>[] = useMemo(() => [
    { icon: <Icon name="edit" size={14} />, label: 'Edit', onClick: form.openEdit, variant: 'secondary' as const, tooltip: 'Edit tenant' },
    { icon: <TrashIcon size={14} />, label: 'Delete', onClick: handleDelete, variant: 'danger' as const, tooltip: 'Delete tenant' },
  ], [form.openEdit, handleDelete]);

  return (
    <>
      <ActionBar>
        <Button onClick={form.openAdd}>
          <PlusIcon size={16} />
          Add Tenant
        </Button>
      </ActionBar>

      <Table
        data={tenants}
        columns={columns}
        actions={actions}
        getRowKey={(t) => t.id}
        searchable
        searchPlaceholder="Search tenants..."
        onRowClick={form.openEdit}
        emptyMessage="No tenants configured"
      />

      <FormDialog
        isOpen={form.isOpen}
        onClose={form.close}
        title={form.editingItem ? 'Edit Tenant' : 'Add Tenant'}
        onSubmit={handleSubmit}
        submitDisabled={!form.formData.name.trim()}
      >
        <FormField label="Name" name="name" required value={form.formData.name} onChange={form.handleChange} placeholder="e.g. Acme Corp" />
        <FormField label="Description" name="description" value={form.formData.description} onChange={form.handleChange} placeholder="Optional description" />
        <SelectField label="Status" name="status" options={TENANT_STATUS_OPTIONS} value={form.formData.status} onChange={form.handleChange} />
      </FormDialog>

      <ConfirmDialogRenderer />
    </>
  );
}

// ============================================================
// VRFs Tab
// ============================================================

function VrfsTab({ vrfs, tenants, ipam }: {
  vrfs: IpamVrf[];
  tenants: Tenant[];
  ipam: ReturnType<typeof useIpam>;
}) {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [vrfName, setVrfName] = useState('');
  const [vrfRd, setVrfRd] = useState('');
  const [vrfDesc, setVrfDesc] = useState('');
  const [vrfTenantId, setVrfTenantId] = useState('');

  const tenantOptions = useMemo(() =>
    tenants.map(t => ({ value: String(t.id), label: t.name })),
    [tenants]
  );

  const tenantLookup = useMemo(() => {
    const map = new Map<number, string>();
    tenants.forEach(t => map.set(t.id, t.name));
    return map;
  }, [tenants]);

  const handleCreate = useCallback(async () => {
    if (!vrfName.trim()) {
      addNotification('error', 'Name is required');
      return;
    }
    const success = await ipam.createVrf({
      name: vrfName.trim(),
      rd: vrfRd || undefined,
      description: vrfDesc || undefined,
      tenant_id: vrfTenantId ? Number(vrfTenantId) : undefined,
    });
    if (success) {
      setShowForm(false);
      setVrfName('');
      setVrfRd('');
      setVrfDesc('');
      setVrfTenantId('');
    }
  }, [vrfName, vrfRd, vrfDesc, vrfTenantId, ipam]);

  const handleDelete = useCallback(async (vrf: IpamVrf) => {
    if (!(await confirm({ title: 'Delete VRF', message: `Delete VRF "${vrf.name}"? Prefixes in this VRF will become global.`, confirmText: 'Delete', destructive: true }))) return;
    await ipam.deleteVrf(String(vrf.id));
  }, [confirm, ipam]);

  const columns: TableColumn<IpamVrf>[] = useMemo(() => [
    { header: 'ID', accessor: 'id' as keyof IpamVrf },
    { header: 'Name', accessor: 'name' as keyof IpamVrf },
    { header: 'RD', accessor: (row: IpamVrf) => row.rd || '', searchValue: (row: IpamVrf) => row.rd || '' },
    {
      header: 'Tenant',
      accessor: (row: IpamVrf) => row.tenant_id
        ? <span className="text-xs">{tenantLookup.get(row.tenant_id) || `#${row.tenant_id}`}</span>
        : <span className="text-xs text-muted">None</span>,
      searchValue: (row: IpamVrf) => row.tenant_id ? (tenantLookup.get(row.tenant_id) || '') : '',
    },
    { header: 'Description', accessor: (row: IpamVrf) => row.description || '', searchValue: (row: IpamVrf) => row.description || '' },
    { header: 'Prefixes', accessor: (row: IpamVrf) => String(row.prefix_count ?? 0), searchable: false },
  ], [tenantLookup]);

  const actions: TableAction<IpamVrf>[] = useMemo(() => [
    { icon: <TrashIcon size={14} />, label: 'Delete', onClick: handleDelete, variant: 'danger' as const },
  ], [handleDelete]);

  return (
    <>
      <ActionBar>
        <Button onClick={() => setShowForm(true)}>
          <PlusIcon size={16} />
          Add VRF
        </Button>
      </ActionBar>

      <Table
        data={vrfs}
        columns={columns}
        actions={actions}
        getRowKey={(row) => row.id}
        tableId="resources-vrfs"
        emptyMessage="No VRFs defined."
        emptyDescription="All prefixes are in the global routing table."
        searchable
        searchPlaceholder="Search VRFs..."
      />

      <FormDialog isOpen={showForm} onClose={() => setShowForm(false)} title="Create VRF" onSubmit={(e) => { e.preventDefault(); handleCreate(); }} submitText="Create">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Name" name="vrfName" value={vrfName} onChange={(e) => setVrfName(e.target.value)} placeholder="e.g., Management" />
          <FormField label="Route Distinguisher" name="vrfRd" value={vrfRd} onChange={(e) => setVrfRd(e.target.value)} placeholder="e.g., 65000:100 (optional)" />
          <FormField label="Description" name="vrfDesc" value={vrfDesc} onChange={(e) => setVrfDesc(e.target.value)} placeholder="Optional description" />
          <SelectField label="Tenant" name="vrfTenantId" options={tenantOptions} value={vrfTenantId} onChange={(e) => setVrfTenantId(e.target.value)} placeholder="None" />
        </div>
      </FormDialog>

      <ConfirmDialogRenderer />
    </>
  );
}

// ============================================================
// GPU Clusters Tab
// ============================================================

function GpuClustersTab({ gpuClusters, vrfs, topologies, createGpuCluster, updateGpuCluster, deleteGpuCluster }: {
  gpuClusters: GpuCluster[];
  vrfs: IpamVrf[];
  topologies: { id: number; name: string }[];
  createGpuCluster: (data: Partial<GpuCluster>) => Promise<boolean>;
  updateGpuCluster: (id: string, data: Partial<GpuCluster>) => Promise<boolean>;
  deleteGpuCluster: (id: string) => Promise<boolean>;
}) {
  const { confirm, ConfirmDialogRenderer } = useConfirm();

  const form = useModalForm<GpuCluster, GpuClusterFormData>({
    emptyFormData: EMPTY_GPU_CLUSTER_FORM,
    itemToFormData: (cluster) => ({
      name: cluster.name,
      description: cluster.description || '',
      gpu_model: cluster.gpu_model,
      node_count: String(cluster.node_count),
      gpus_per_node: String(cluster.gpus_per_node),
      interconnect_type: cluster.interconnect_type,
      status: cluster.status,
      topology_id: cluster.topology_id ? String(cluster.topology_id) : '',
      vrf_id: cluster.vrf_id ? String(cluster.vrf_id) : '',
    }),
    onCreate: (data) => createGpuCluster({
      name: data.name,
      description: data.description || undefined,
      gpu_model: data.gpu_model as GpuCluster['gpu_model'],
      node_count: Number(data.node_count) || 1,
      gpus_per_node: Number(data.gpus_per_node) || 8,
      interconnect_type: data.interconnect_type as GpuCluster['interconnect_type'],
      status: data.status as GpuCluster['status'],
      topology_id: data.topology_id ? Number(data.topology_id) : undefined,
      vrf_id: data.vrf_id ? Number(data.vrf_id) : undefined,
    }),
    onUpdate: (id, data) => updateGpuCluster(id, {
      name: data.name,
      description: data.description || undefined,
      gpu_model: data.gpu_model as GpuCluster['gpu_model'],
      node_count: Number(data.node_count) || 1,
      gpus_per_node: Number(data.gpus_per_node) || 8,
      interconnect_type: data.interconnect_type as GpuCluster['interconnect_type'],
      status: data.status as GpuCluster['status'],
      topology_id: data.topology_id ? Number(data.topology_id) : undefined,
      vrf_id: data.vrf_id ? Number(data.vrf_id) : undefined,
    }),
    getItemId: (c) => String(c.id),
    modalName: 'gpu-cluster-form',
  });

  const modalRoute = useModalRoute();

  useEffect(() => {
    if (modalRoute.isModal('gpu-cluster-form') && !form.isOpen) {
      const id = modalRoute.getParam('id');
      if (id) {
        const cluster = gpuClusters.find(c => String(c.id) === id);
        if (cluster) {
          form.openEdit(cluster);
        } else if (gpuClusters.length > 0) {
          modalRoute.closeModal();
        }
      } else {
        form.openAdd();
      }
    }
  }, [modalRoute.modal, gpuClusters]);

  const topologyOptions = useMemo(() =>
    topologies.map(t => ({ value: String(t.id), label: t.name })),
    [topologies]
  );

  const topologyLookup = useMemo(() => {
    const map = new Map<number, string>();
    topologies.forEach(t => map.set(t.id, t.name));
    return map;
  }, [topologies]);

  const vrfOptions = useMemo(() =>
    vrfs.map(v => ({ value: String(v.id), label: v.name })),
    [vrfs]
  );

  const vrfLookup = useMemo(() => {
    const map = new Map<number, string>();
    vrfs.forEach(v => map.set(v.id, v.name));
    return map;
  }, [vrfs]);

  const handleDelete = useCallback(async (id: number) => {
    const cluster = gpuClusters.find(c => c.id === id);
    if (cluster && await confirm({
      title: 'Delete GPU Cluster',
      message: `Delete GPU cluster "${cluster.name}"?`,
      confirmText: 'Delete',
      destructive: true,
    })) {
      await deleteGpuCluster(String(id));
    }
  }, [confirm, gpuClusters, deleteGpuCluster]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await form.submit();
  }, [form]);

  const statusClass = (status: string) => {
    switch (status) {
      case 'active': return 'online';
      case 'provisioning': return 'provisioning';
      case 'offline': return 'offline';
      case 'decommissioned': return 'unknown';
      default: return '';
    }
  };

  const columns: TableColumn<GpuCluster>[] = useMemo(() => [
    {
      header: 'Name',
      accessor: (c) => (
        <>
          <strong>{c.name}</strong>
          {c.description && (
            <>
              <br />
              <span className="text-xs text-secondary">{c.description}</span>
            </>
          )}
        </>
      ),
      searchValue: (c) => `${c.name} ${c.description || ''}`,
    },
    {
      header: 'GPU Model',
      accessor: (c) => Cell.code(c.gpu_model),
      searchValue: (c) => c.gpu_model,
    },
    {
      header: 'Nodes',
      accessor: (c) => String(c.node_count),
    },
    {
      header: 'GPUs/Node',
      accessor: (c) => String(c.gpus_per_node),
    },
    {
      header: 'Total GPUs',
      accessor: (c) => Cell.code(String(c.node_count * c.gpus_per_node)),
    },
    {
      header: 'Interconnect',
      accessor: 'interconnect_type',
    },
    {
      header: 'Status',
      accessor: (c) => (
        <span className={`status ${statusClass(c.status)}`}>
          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
        </span>
      ),
      searchValue: (c) => c.status,
    },
    {
      header: 'VRF',
      accessor: (c) => c.vrf_id
        ? <span className="text-xs">{vrfLookup.get(c.vrf_id) || `#${c.vrf_id}`}</span>
        : <span className="text-xs text-muted">None</span>,
      searchValue: (c) => c.vrf_id ? (vrfLookup.get(c.vrf_id) || '') : '',
    },
    {
      header: 'Topology',
      accessor: (c) => c.topology_id
        ? <span className="text-xs">{topologyLookup.get(c.topology_id) || `#${c.topology_id}`}</span>
        : <span className="text-xs text-muted">None</span>,
      searchValue: (c) => c.topology_id ? (topologyLookup.get(c.topology_id) || '') : '',
    },
  ], [vrfLookup, topologyLookup]);

  const actions: TableAction<GpuCluster>[] = useMemo(() => [
    { icon: <Icon name="edit" size={14} />, label: 'Edit', onClick: form.openEdit, variant: 'secondary' as const, tooltip: 'Edit cluster' },
    { icon: <Icon name="delete" size={14} />, label: 'Delete', onClick: (c) => handleDelete(c.id), variant: 'danger' as const, tooltip: 'Delete cluster' },
  ], [form.openEdit, handleDelete]);

  return (
    <>
      <ActionBar>
        <Button onClick={form.openAdd}>
          <PlusIcon size={16} />
          Add GPU Cluster
        </Button>
      </ActionBar>

      <Table
        data={gpuClusters}
        columns={columns}
        actions={actions}
        getRowKey={(c) => c.id}
        searchable
        searchPlaceholder="Search GPU clusters..."
        onRowClick={form.openEdit}
        emptyMessage="No GPU clusters configured"
      />

      <FormDialog
        isOpen={form.isOpen}
        onClose={form.close}
        title={form.editingItem ? 'Edit GPU Cluster' : 'Add GPU Cluster'}
        onSubmit={handleSubmit}
        submitDisabled={!form.formData.name.trim()}
      >
        <FormField label="Name" name="name" required value={form.formData.name} onChange={form.handleChange} placeholder="e.g. GPU Cluster A" />
        <FormField label="Description" name="description" value={form.formData.description} onChange={form.handleChange} placeholder="Optional description" />
        <SelectField label="VRF" name="vrf_id" options={vrfOptions} value={form.formData.vrf_id} onChange={form.handleChange} placeholder="None" />
        <SelectField label="GPU Model" name="gpu_model" options={GPU_MODEL_OPTIONS} value={form.formData.gpu_model} onChange={form.handleChange} />
        <FormField label="Node Count" name="node_count" type="number" value={form.formData.node_count} onChange={form.handleChange} min={1} />
        <FormField label="GPUs per Node" name="gpus_per_node" type="number" value={form.formData.gpus_per_node} onChange={form.handleChange} min={1} />
        <SelectField label="Interconnect" name="interconnect_type" options={INTERCONNECT_OPTIONS} value={form.formData.interconnect_type} onChange={form.handleChange} />
        <SelectField label="Status" name="status" options={GPU_CLUSTER_STATUS_OPTIONS} value={form.formData.status} onChange={form.handleChange} />
        <SelectField label="Topology" name="topology_id" options={topologyOptions} value={form.formData.topology_id} onChange={form.handleChange} placeholder="None" />
      </FormDialog>

      <ConfirmDialogRenderer />
    </>
  );
}
