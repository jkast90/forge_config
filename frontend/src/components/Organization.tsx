import { useState, useMemo, useCallback } from 'react';
import { useIpam, useDevices, addNotification, usePersistedTab } from '@core';
import type {
  IpamRegion, IpamRegionFormData,
  IpamCampus, IpamCampusFormData,
  IpamDatacenter, IpamDatacenterFormData,
  IpamHall, IpamHallFormData,
  IpamRow, IpamRowFormData,
  IpamRack, IpamRackFormData,
  Device,
} from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { Modal } from './Modal';
import { SelectField } from './SelectField';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { Tooltip } from './Tooltip';
import { PlusIcon, TrashIcon, EditIcon, Icon } from './Icon';
import { LoadingState } from './LoadingState';
import { SideTabs } from './SideTabs';
import type { SideTab } from './SideTabs';
import { useConfirm } from './ConfirmDialog';

type OrgTab = 'regions' | 'campuses' | 'datacenters' | 'halls' | 'rows' | 'racks';

const EMPTY_REGION_FORM: IpamRegionFormData = { name: '', description: '' };
const EMPTY_CAMPUS_FORM: IpamCampusFormData = { name: '', description: '', region_id: '' };
const EMPTY_DATACENTER_FORM: IpamDatacenterFormData = { name: '', description: '', campus_id: '' };
const EMPTY_HALL_FORM: IpamHallFormData = { name: '', description: '', datacenter_id: '' };
const EMPTY_ROW_FORM: IpamRowFormData = { name: '', description: '', hall_id: '' };
const EMPTY_RACK_FORM: IpamRackFormData = { name: '', description: '', row_id: '' };

export function Locations() {
  const [activeTab, setActiveTab] = usePersistedTab<OrgTab>('regions', ['regions', 'campuses', 'datacenters', 'halls', 'rows', 'racks'], 'tab_locations');
  const ipam = useIpam();
  const { regions, campuses, datacenters, halls, rows, racks, loading, error } = ipam;
  const { devices } = useDevices();

  const tabs: SideTab[] = [
    { id: 'regions', label: 'Regions', icon: 'public', count: regions.length },
    { id: 'campuses', label: 'Campuses', icon: 'location_city', count: campuses.length },
    { id: 'datacenters', label: 'Datacenters', icon: 'dns', count: datacenters.length },
    { id: 'halls', label: 'Halls', icon: 'meeting_room', count: halls.length },
    { id: 'rows', label: 'Rows', icon: 'view_column', count: rows.length },
    { id: 'racks', label: 'Racks', icon: 'inventory_2', count: racks.length },
  ];

  return (
    <LoadingState loading={loading} error={error} loadingMessage="Loading locations...">
      <ActionBar>
        <Button variant="secondary" onClick={ipam.refresh}>
          <Icon name="refresh" size={16} />
          Refresh
        </Button>
      </ActionBar>

      <Card title="Locations">
        <SideTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as OrgTab)}
        >
          {activeTab === 'regions' && <RegionsTab regions={regions} ipam={ipam} />}
          {activeTab === 'campuses' && <CampusesTab campuses={campuses} regions={regions} ipam={ipam} />}
          {activeTab === 'datacenters' && <DatacentersTab datacenters={datacenters} campuses={campuses} ipam={ipam} />}
          {activeTab === 'halls' && <HallsTab halls={halls} datacenters={datacenters} ipam={ipam} />}
          {activeTab === 'rows' && <RowsTab rows={rows} halls={halls} racks={racks} devices={devices} ipam={ipam} />}
          {activeTab === 'racks' && <RacksTab racks={racks} rows={rows} devices={devices} ipam={ipam} />}
        </SideTabs>
      </Card>
    </LoadingState>
  );
}

// ============================================================
// Regions Tab
// ============================================================

function RegionsTab({ regions, ipam }: {
  regions: IpamRegion[];
  ipam: ReturnType<typeof useIpam>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IpamRegion | null>(null);
  const [form, setForm] = useState<IpamRegionFormData>(EMPTY_REGION_FORM);
  const { confirm, ConfirmDialogRenderer } = useConfirm();

  const handleOpenCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_REGION_FORM);
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((r: IpamRegion) => {
    setEditing(r);
    setForm({ name: r.name, description: r.description || '' });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      addNotification('error', 'Name is required');
      return;
    }
    let success: boolean;
    if (editing) {
      success = await ipam.updateRegion(editing.id, form);
    } else {
      success = await ipam.createRegion(form);
    }
    if (success) setShowForm(false);
  }, [form, editing, ipam]);

  const handleDelete = useCallback(async (r: IpamRegion) => {
    if (!(await confirm({ title: 'Delete Region', message: `Delete region "${r.name}" and all its campuses/datacenters?`, confirmText: 'Delete', destructive: true }))) return;
    await ipam.deleteRegion(r.id);
  }, [ipam]);

  const columns: TableColumn<IpamRegion>[] = useMemo(() => [
    { header: 'ID', accessor: (row: IpamRegion) => row.id, searchValue: (row: IpamRegion) => String(row.id) },
    { header: 'Name', accessor: (row: IpamRegion) => row.name, searchValue: (row: IpamRegion) => row.name },
    { header: 'Description', accessor: (row: IpamRegion) => row.description || '', searchValue: (row: IpamRegion) => row.description || '' },
    { header: 'Campuses', accessor: (row: IpamRegion) => String(row.campus_count ?? 0) },
  ], []);

  const actions: TableAction<IpamRegion>[] = useMemo(() => [
    { icon: <EditIcon size={14} />, label: 'Edit', onClick: handleOpenEdit },
    { icon: <TrashIcon size={14} />, label: 'Delete', onClick: handleDelete, variant: 'danger' as const },
  ], [handleOpenEdit, handleDelete]);

  return (
    <>
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="sm" onClick={handleOpenCreate}><PlusIcon size={14} /> Add Region</Button>
      </div>
      <Table
        data={regions}
        columns={columns}
        actions={actions}
        getRowKey={(row) => row.id}
        tableId="org-regions"
        emptyMessage="No regions defined yet."
        emptyDescription="Add a region to start building your location hierarchy."
        searchable
        searchPlaceholder="Search regions..."
      />
      <FormDialog isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Region' : 'Create Region'} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} submitText={editing ? 'Update' : 'Create'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Name" name="name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., US East" />
          <FormField label="Description" name="desc" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
        </div>
      </FormDialog>
      <ConfirmDialogRenderer />
    </>
  );
}

// ============================================================
// Campuses Tab
// ============================================================

function CampusesTab({ campuses, regions, ipam }: {
  campuses: IpamCampus[];
  regions: IpamRegion[];
  ipam: ReturnType<typeof useIpam>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IpamCampus | null>(null);
  const [form, setForm] = useState<IpamCampusFormData>(EMPTY_CAMPUS_FORM);
  const { confirm, ConfirmDialogRenderer } = useConfirm();

  const regionOptions = useMemo(() => [
    { value: '', label: 'Select a region...' },
    ...regions.map(r => ({ value: String(r.id), label: r.name })),
  ], [regions]);

  const handleOpenCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_CAMPUS_FORM);
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((c: IpamCampus) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description || '', region_id: String(c.region_id) });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim() || !form.region_id) {
      addNotification('error', 'Name and Region are required');
      return;
    }
    let success: boolean;
    if (editing) {
      success = await ipam.updateCampus(editing.id, form);
    } else {
      success = await ipam.createCampus(form);
    }
    if (success) setShowForm(false);
  }, [form, editing, ipam]);

  const handleDelete = useCallback(async (c: IpamCampus) => {
    if (!(await confirm({ title: 'Delete Campus', message: `Delete campus "${c.name}" and all its datacenters?`, confirmText: 'Delete', destructive: true }))) return;
    await ipam.deleteCampus(c.id);
  }, [ipam]);

  const columns: TableColumn<IpamCampus>[] = useMemo(() => [
    { header: 'ID', accessor: (row: IpamCampus) => row.id, searchValue: (row: IpamCampus) => String(row.id) },
    { header: 'Name', accessor: (row: IpamCampus) => row.name, searchValue: (row: IpamCampus) => row.name },
    { header: 'Region', accessor: (row: IpamCampus) => row.region_name || String(row.region_id), searchValue: (row: IpamCampus) => `${row.region_name || ''} ${row.region_id}` },
    { header: 'Description', accessor: (row: IpamCampus) => row.description || '', searchValue: (row: IpamCampus) => row.description || '' },
    { header: 'Datacenters', accessor: (row: IpamCampus) => String(row.datacenter_count ?? 0) },
  ], []);

  const actions: TableAction<IpamCampus>[] = useMemo(() => [
    { icon: <EditIcon size={14} />, label: 'Edit', onClick: handleOpenEdit },
    { icon: <TrashIcon size={14} />, label: 'Delete', onClick: handleDelete, variant: 'danger' as const },
  ], [handleOpenEdit, handleDelete]);

  return (
    <>
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="sm" onClick={handleOpenCreate}><PlusIcon size={14} /> Add Campus</Button>
      </div>
      <Table
        data={campuses}
        columns={columns}
        actions={actions}
        getRowKey={(row) => row.id}
        tableId="org-campuses"
        emptyMessage="No campuses defined yet."
        emptyDescription="Add a campus to organize datacenters within a region."
        searchable
        searchPlaceholder="Search campuses..."
      />
      <FormDialog isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Campus' : 'Create Campus'} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} submitText={editing ? 'Update' : 'Create'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Name" name="name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., New York City" />
          <FormField label="Description" name="desc" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          <SelectField label="Region" name="region_id" value={form.region_id} onChange={(e) => setForm(f => ({ ...f, region_id: e.target.value }))} options={regionOptions} />
        </div>
      </FormDialog>
      <ConfirmDialogRenderer />
    </>
  );
}

// ============================================================
// Datacenters Tab
// ============================================================

function DatacentersTab({ datacenters, campuses, ipam }: {
  datacenters: IpamDatacenter[];
  campuses: IpamCampus[];
  ipam: ReturnType<typeof useIpam>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IpamDatacenter | null>(null);
  const [form, setForm] = useState<IpamDatacenterFormData>(EMPTY_DATACENTER_FORM);
  const { confirm, ConfirmDialogRenderer } = useConfirm();

  const campusOptions = useMemo(() => [
    { value: '', label: 'Select a campus...' },
    ...campuses.map(c => ({ value: String(c.id), label: `${c.name} (${c.region_name || c.region_id})` })),
  ], [campuses]);

  const handleOpenCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_DATACENTER_FORM);
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((d: IpamDatacenter) => {
    setEditing(d);
    setForm({ name: d.name, description: d.description || '', campus_id: String(d.campus_id) });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim() || !form.campus_id) {
      addNotification('error', 'Name and Campus are required');
      return;
    }
    let success: boolean;
    if (editing) {
      success = await ipam.updateDatacenter(editing.id, form);
    } else {
      success = await ipam.createDatacenter(form);
    }
    if (success) setShowForm(false);
  }, [form, editing, ipam]);

  const handleDelete = useCallback(async (d: IpamDatacenter) => {
    if (!(await confirm({ title: 'Delete Datacenter', message: `Delete datacenter "${d.name}"?`, confirmText: 'Delete', destructive: true }))) return;
    await ipam.deleteDatacenter(d.id);
  }, [ipam]);

  const columns: TableColumn<IpamDatacenter>[] = useMemo(() => [
    { header: 'ID', accessor: (row: IpamDatacenter) => row.id, searchValue: (row: IpamDatacenter) => String(row.id) },
    { header: 'Name', accessor: (row: IpamDatacenter) => row.name, searchValue: (row: IpamDatacenter) => row.name },
    { header: 'Campus', accessor: (row: IpamDatacenter) => row.campus_name || String(row.campus_id), searchValue: (row: IpamDatacenter) => `${row.campus_name || ''} ${row.campus_id}` },
    { header: 'Region', accessor: (row: IpamDatacenter) => row.region_name || '', searchValue: (row: IpamDatacenter) => row.region_name || '' },
    { header: 'Description', accessor: (row: IpamDatacenter) => row.description || '', searchValue: (row: IpamDatacenter) => row.description || '' },
    { header: 'Halls', accessor: (row: IpamDatacenter) => String(row.hall_count ?? 0) },
  ], []);

  const actions: TableAction<IpamDatacenter>[] = useMemo(() => [
    { icon: <EditIcon size={14} />, label: 'Edit', onClick: handleOpenEdit },
    { icon: <TrashIcon size={14} />, label: 'Delete', onClick: handleDelete, variant: 'danger' as const },
  ], [handleOpenEdit, handleDelete]);

  return (
    <>
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="sm" onClick={handleOpenCreate}><PlusIcon size={14} /> Add Datacenter</Button>
      </div>
      <Table
        data={datacenters}
        columns={columns}
        actions={actions}
        getRowKey={(row) => row.id}
        tableId="org-datacenters"
        emptyMessage="No datacenters defined yet."
        emptyDescription="Add a datacenter within a campus."
        searchable
        searchPlaceholder="Search datacenters..."
      />
      <FormDialog isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Datacenter' : 'Create Datacenter'} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} submitText={editing ? 'Update' : 'Create'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Name" name="name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., NYC DC1" />
          <FormField label="Description" name="desc" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          <SelectField label="Campus" name="campus_id" value={form.campus_id} onChange={(e) => setForm(f => ({ ...f, campus_id: e.target.value }))} options={campusOptions} />
        </div>
      </FormDialog>
      <ConfirmDialogRenderer />
    </>
  );
}

// ============================================================
// Halls Tab
// ============================================================

function HallsTab({ halls, datacenters, ipam }: {
  halls: IpamHall[];
  datacenters: IpamDatacenter[];
  ipam: ReturnType<typeof useIpam>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IpamHall | null>(null);
  const [form, setForm] = useState<IpamHallFormData>(EMPTY_HALL_FORM);
  const { confirm, ConfirmDialogRenderer } = useConfirm();

  const dcOptions = useMemo(() => [
    { value: '', label: 'Select a datacenter...' },
    ...datacenters.map(d => ({ value: String(d.id), label: `${d.name} (${d.campus_name || d.campus_id})` })),
  ], [datacenters]);

  const handleOpenCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_HALL_FORM);
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((h: IpamHall) => {
    setEditing(h);
    setForm({ name: h.name, description: h.description || '', datacenter_id: String(h.datacenter_id) });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim() || !form.datacenter_id) {
      addNotification('error', 'Name and Datacenter are required');
      return;
    }
    let success: boolean;
    if (editing) {
      success = await ipam.updateHall(editing.id, form);
    } else {
      success = await ipam.createHall(form);
    }
    if (success) setShowForm(false);
  }, [form, editing, ipam]);

  const handleDelete = useCallback(async (h: IpamHall) => {
    if (!(await confirm({ title: 'Delete Hall', message: `Delete hall "${h.name}"?`, confirmText: 'Delete', destructive: true }))) return;
    await ipam.deleteHall(h.id);
  }, [ipam]);

  const columns: TableColumn<IpamHall>[] = useMemo(() => [
    { header: 'ID', accessor: (row: IpamHall) => row.id, searchValue: (row: IpamHall) => String(row.id) },
    { header: 'Name', accessor: (row: IpamHall) => row.name, searchValue: (row: IpamHall) => row.name },
    { header: 'Datacenter', accessor: (row: IpamHall) => row.datacenter_name || String(row.datacenter_id), searchValue: (row: IpamHall) => `${row.datacenter_name || ''} ${row.datacenter_id}` },
    { header: 'Description', accessor: (row: IpamHall) => row.description || '', searchValue: (row: IpamHall) => row.description || '' },
    { header: 'Rows', accessor: (row: IpamHall) => String(row.row_count ?? 0) },
  ], []);

  const actions: TableAction<IpamHall>[] = useMemo(() => [
    { icon: <EditIcon size={14} />, label: 'Edit', onClick: handleOpenEdit },
    { icon: <TrashIcon size={14} />, label: 'Delete', onClick: handleDelete, variant: 'danger' as const },
  ], [handleOpenEdit, handleDelete]);

  return (
    <>
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="sm" onClick={handleOpenCreate}><PlusIcon size={14} /> Add Hall</Button>
      </div>
      <Table
        data={halls}
        columns={columns}
        actions={actions}
        getRowKey={(row) => row.id}
        tableId="org-halls"
        emptyMessage="No halls defined yet."
        emptyDescription="Add a hall within a datacenter."
        searchable
        searchPlaceholder="Search halls..."
      />
      <FormDialog isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Hall' : 'Create Hall'} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} submitText={editing ? 'Update' : 'Create'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Name" name="name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Hall A" />
          <FormField label="Description" name="desc" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          <SelectField label="Datacenter" name="datacenter_id" value={form.datacenter_id} onChange={(e) => setForm(f => ({ ...f, datacenter_id: e.target.value }))} options={dcOptions} />
        </div>
      </FormDialog>
      <ConfirmDialogRenderer />
    </>
  );
}

// ============================================================
// Rows Tab
// ============================================================

function RowsTab({ rows, halls, racks, devices, ipam }: {
  rows: IpamRow[];
  halls: IpamHall[];
  racks: IpamRack[];
  devices: Device[];
  ipam: ReturnType<typeof useIpam>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IpamRow | null>(null);
  const [form, setForm] = useState<IpamRowFormData>(EMPTY_ROW_FORM);
  const [viewingRow, setViewingRow] = useState<IpamRow | null>(null);
  const { confirm, ConfirmDialogRenderer } = useConfirm();

  const hallOptions = useMemo(() => [
    { value: '', label: 'Select a hall...' },
    ...halls.map(h => ({ value: String(h.id), label: `${h.name} (${h.datacenter_name || h.datacenter_id})` })),
  ], [halls]);

  // Racks belonging to the viewed row, sorted by name
  const rowRacks = useMemo(() =>
    viewingRow ? racks.filter(rk => rk.row_id === viewingRow.id).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : [],
    [viewingRow, racks]
  );

  // Devices grouped by rack_id for the viewed row's racks
  const devicesByRack = useMemo(() => {
    if (!viewingRow) return new Map<number, Device[]>();
    const rackIds = new Set(rowRacks.map(rk => rk.id));
    const map = new Map<number, Device[]>();
    for (const d of devices) {
      if (d.rack_id != null && rackIds.has(d.rack_id)) {
        const arr = map.get(d.rack_id) || [];
        arr.push(d);
        map.set(d.rack_id, arr);
      }
    }
    // Sort each rack's devices by position
    for (const [, arr] of map) {
      arr.sort((a, b) => (a.rack_position ?? 999) - (b.rack_position ?? 999));
    }
    return map;
  }, [viewingRow, rowRacks, devices]);

  const handleOpenCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_ROW_FORM);
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((r: IpamRow) => {
    setEditing(r);
    setForm({ name: r.name, description: r.description || '', hall_id: String(r.hall_id) });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim() || !form.hall_id) {
      addNotification('error', 'Name and Hall are required');
      return;
    }
    let success: boolean;
    if (editing) {
      success = await ipam.updateRow(editing.id, form);
    } else {
      success = await ipam.createRow(form);
    }
    if (success) setShowForm(false);
  }, [form, editing, ipam]);

  const handleDelete = useCallback(async (r: IpamRow) => {
    if (!(await confirm({ title: 'Delete Row', message: `Delete row "${r.name}"?`, confirmText: 'Delete', destructive: true }))) return;
    await ipam.deleteRow(r.id);
  }, [ipam]);

  const columns: TableColumn<IpamRow>[] = useMemo(() => [
    { header: 'ID', accessor: (row: IpamRow) => row.id, searchValue: (row: IpamRow) => String(row.id) },
    { header: 'Name', accessor: (row: IpamRow) => row.name, searchValue: (row: IpamRow) => row.name },
    { header: 'Hall', accessor: (row: IpamRow) => row.hall_name || String(row.hall_id), searchValue: (row: IpamRow) => `${row.hall_name || ''} ${row.hall_id}` },
    { header: 'Description', accessor: (row: IpamRow) => row.description || '', searchValue: (row: IpamRow) => row.description || '' },
    { header: 'Racks', accessor: (row: IpamRow) => String(row.rack_count ?? 0) },
  ], []);

  const actions: TableAction<IpamRow>[] = useMemo(() => [
    { icon: <Icon name="visibility" size={14} />, label: 'View Row', onClick: setViewingRow, variant: 'secondary' as const, tooltip: 'View rack elevations' },
    { icon: <EditIcon size={14} />, label: 'Edit', onClick: handleOpenEdit },
    { icon: <TrashIcon size={14} />, label: 'Delete', onClick: handleDelete, variant: 'danger' as const },
  ], [handleOpenEdit, handleDelete]);

  const totalDevices = useMemo(() => {
    let count = 0;
    for (const [, arr] of devicesByRack) count += arr.length;
    return count;
  }, [devicesByRack]);

  return (
    <>
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="sm" onClick={handleOpenCreate}><PlusIcon size={14} /> Add Row</Button>
      </div>
      <Table
        data={rows}
        columns={columns}
        actions={actions}
        getRowKey={(row) => row.id}
        tableId="org-rows"
        emptyMessage="No rows defined yet."
        emptyDescription="Add a row within a hall."
        searchable
        searchPlaceholder="Search rows..."
      />
      <FormDialog isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Row' : 'Create Row'} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} submitText={editing ? 'Update' : 'Create'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Name" name="name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Row 1" />
          <FormField label="Description" name="desc" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          <SelectField label="Hall" name="hall_id" value={form.hall_id} onChange={(e) => setForm(f => ({ ...f, hall_id: e.target.value }))} options={hallOptions} />
        </div>
      </FormDialog>

      <Modal isOpen={!!viewingRow} title={`Row: ${viewingRow?.name || ''}`} onClose={() => setViewingRow(null)} variant="extra-wide">
        <div style={{ marginBottom: '12px', display: 'flex', gap: '16px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          <span><strong>Hall:</strong> {viewingRow?.hall_name || viewingRow?.hall_id}</span>
          {viewingRow?.description && <span><strong>Description:</strong> {viewingRow.description}</span>}
          <span><strong>Racks:</strong> {rowRacks.length}</span>
          <span><strong>Devices:</strong> {totalDevices}</span>
        </div>
        {rowRacks.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
            No racks in this row.
          </div>
        ) : (
          <div className="row-elevation-layout">
            {rowRacks.map(rk => (
              <div key={rk.id} className="row-elevation-rack">
                <div className="row-elevation-rack-label">{rk.name}</div>
                <RackElevation devices={devicesByRack.get(rk.id) || []} />
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialogRenderer />
    </>
  );
}

// ============================================================
// Racks Tab
// ============================================================

function RacksTab({ racks, rows, devices, ipam }: {
  racks: IpamRack[];
  rows: IpamRow[];
  devices: Device[];
  ipam: ReturnType<typeof useIpam>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IpamRack | null>(null);
  const [form, setForm] = useState<IpamRackFormData>(EMPTY_RACK_FORM);
  const [viewingRack, setViewingRack] = useState<IpamRack | null>(null);
  const { confirm, ConfirmDialogRenderer } = useConfirm();

  const rowOptions = useMemo(() => [
    { value: '', label: 'Select a row...' },
    ...rows.map(r => ({ value: String(r.id), label: `${r.name} (${r.hall_name || r.hall_id})` })),
  ], [rows]);

  const rackDevices = useMemo(() =>
    viewingRack ? devices.filter(d => d.rack_id === viewingRack.id).sort((a, b) => (a.rack_position ?? 999) - (b.rack_position ?? 999)) : [],
    [viewingRack, devices]
  );

  const handleOpenCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_RACK_FORM);
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((rk: IpamRack) => {
    setEditing(rk);
    setForm({ name: rk.name, description: rk.description || '', row_id: String(rk.row_id) });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim() || !form.row_id) {
      addNotification('error', 'Name and Row are required');
      return;
    }
    let success: boolean;
    if (editing) {
      success = await ipam.updateRack(editing.id, form);
    } else {
      success = await ipam.createRack(form);
    }
    if (success) setShowForm(false);
  }, [form, editing, ipam]);

  const handleDelete = useCallback(async (rk: IpamRack) => {
    if (!(await confirm({ title: 'Delete Rack', message: `Delete rack "${rk.name}"?`, confirmText: 'Delete', destructive: true }))) return;
    await ipam.deleteRack(rk.id);
  }, [ipam]);

  const columns: TableColumn<IpamRack>[] = useMemo(() => [
    { header: 'ID', accessor: (row: IpamRack) => row.id, searchValue: (row: IpamRack) => String(row.id) },
    { header: 'Name', accessor: (row: IpamRack) => row.name, searchValue: (row: IpamRack) => row.name },
    { header: 'Row', accessor: (row: IpamRack) => row.row_name || String(row.row_id), searchValue: (row: IpamRack) => `${row.row_name || ''} ${row.row_id}` },
    { header: 'Description', accessor: (row: IpamRack) => row.description || '', searchValue: (row: IpamRack) => row.description || '' },
    { header: 'Devices', accessor: (row: IpamRack) => String(row.device_count ?? 0) },
  ], []);

  const deviceColumns: TableColumn<Device>[] = useMemo(() => [
    { header: 'Position', accessor: (d: Device) => d.rack_position != null ? `U${d.rack_position}` : '—' },
    { header: 'Hostname', accessor: 'hostname' },
    { header: 'IP Address', accessor: 'ip' },
    { header: 'Vendor', accessor: (d: Device) => Cell.dash(d.vendor), searchValue: (d: Device) => d.vendor || '' },
    { header: 'Model', accessor: (d: Device) => Cell.dash(d.model), searchValue: (d: Device) => d.model || '' },
    { header: 'Role', accessor: (d: Device) => Cell.dash(d.topology_role), searchValue: (d: Device) => d.topology_role || '' },
    { header: 'Status', accessor: (d: Device) => Cell.status(d.status, d.status as 'online' | 'offline' | 'provisioning'), searchValue: (d: Device) => d.status },
  ], []);

  const actions: TableAction<IpamRack>[] = useMemo(() => [
    { icon: <Icon name="visibility" size={14} />, label: 'View Rack', onClick: setViewingRack, variant: 'secondary' as const, tooltip: 'View devices in rack' },
    { icon: <EditIcon size={14} />, label: 'Edit', onClick: handleOpenEdit },
    { icon: <TrashIcon size={14} />, label: 'Delete', onClick: handleDelete, variant: 'danger' as const },
  ], [handleOpenEdit, handleDelete]);

  return (
    <>
      <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Button size="sm" onClick={handleOpenCreate}><PlusIcon size={14} /> Add Rack</Button>
      </div>
      <Table
        data={racks}
        columns={columns}
        actions={actions}
        getRowKey={(row) => row.id}
        tableId="org-racks"
        emptyMessage="No racks defined yet."
        emptyDescription="Add a rack within a row."
        searchable
        searchPlaceholder="Search racks..."
      />
      <FormDialog isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Rack' : 'Create Rack'} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} submitText={editing ? 'Update' : 'Create'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Name" name="name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Rack 01" />
          <FormField label="Description" name="desc" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          <SelectField label="Row" name="row_id" value={form.row_id} onChange={(e) => setForm(f => ({ ...f, row_id: e.target.value }))} options={rowOptions} />
        </div>
      </FormDialog>

      <Modal isOpen={!!viewingRack} title={`Rack: ${viewingRack?.name || ''}`} onClose={() => setViewingRack(null)} variant="extra-wide">
        <div style={{ marginBottom: '12px', display: 'flex', gap: '16px', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          <span><strong>ID:</strong> {viewingRack?.id}</span>
          <span><strong>Row:</strong> {viewingRack?.row_name || viewingRack?.row_id}</span>
          {viewingRack?.description && <span><strong>Description:</strong> {viewingRack.description}</span>}
          <span><strong>Devices:</strong> {rackDevices.length}</span>
        </div>
        <div className="rack-view-layout">
          <RackElevation devices={rackDevices} />
          <div className="rack-view-table">
            <Table
              data={rackDevices}
              columns={deviceColumns}
              getRowKey={(d) => d.id}
              tableId="rack-devices"
              emptyMessage="No devices in this rack."
              emptyDescription="Assign devices to this rack by editing the device and setting its rack."
              searchable={rackDevices.length > 5}
              searchPlaceholder="Search devices..."
            />
          </div>
        </div>
      </Modal>
      <ConfirmDialogRenderer />
    </>
  );
}

// ============================================================
// Rack Elevation Visual
// ============================================================

const ROLE_COLORS: Record<string, string> = {
  'super-spine': 'var(--color-accent-purple)',
  spine: 'var(--color-accent-blue)',
  leaf: 'var(--color-success)',
};

const STATUS_INDICATOR: Record<string, string> = {
  online: 'var(--color-success)',
  offline: 'var(--color-error)',
  provisioning: 'var(--color-warning)',
  unknown: 'var(--color-text-muted)',
};

function RackElevation({ devices }: { devices: Device[] }) {
  // Build a map of position -> device
  const positionMap = useMemo(() => {
    const map = new Map<number, Device>();
    for (const d of devices) {
      if (d.rack_position != null) {
        map.set(d.rack_position, d);
      }
    }
    return map;
  }, [devices]);

  // Determine rack height: max position or default 42U
  const maxPos = useMemo(() => {
    if (positionMap.size === 0) return 42;
    return Math.max(42, ...positionMap.keys());
  }, [positionMap]);

  // Devices without a position
  const unpositioned = useMemo(() => devices.filter(d => d.rack_position == null), [devices]);

  // Build U slots top-down (highest U at top)
  const slots = useMemo(() => {
    const arr: number[] = [];
    for (let u = maxPos; u >= 1; u--) {
      arr.push(u);
    }
    return arr;
  }, [maxPos]);

  return (
    <div className="rack-elevation">
      <div className="rack-elevation-frame">
        <div className="rack-elevation-header">
          <span className="rack-elevation-u-label">U</span>
          <span className="rack-elevation-slot-label">Equipment</span>
        </div>
        <div className="rack-elevation-body">
          {slots.map(u => {
            const device = positionMap.get(u);
            const roleColor = device?.topology_role ? ROLE_COLORS[device.topology_role] || 'var(--color-primary)' : 'var(--color-primary)';
            const statusColor = device ? STATUS_INDICATOR[device.status] || STATUS_INDICATOR.unknown : undefined;
            return (
              <div key={u} className={`rack-elevation-slot ${device ? 'rack-elevation-slot-occupied' : ''}`}>
                <span className="rack-elevation-u-number">{u}</span>
                {device ? (
                  <Tooltip content={`${device.hostname}\n${device.ip}\n${device.vendor || ''} ${device.model || ''}\nStatus: ${device.status}${device.topology_role ? `\nRole: ${device.topology_role}` : ''}`} position="right">
                    <div className="rack-elevation-device" style={{ borderLeftColor: roleColor }}>
                      <span className="rack-elevation-device-status" style={{ backgroundColor: statusColor }} />
                      <span className="rack-elevation-device-name">{device.hostname}</span>
                      <span className="rack-elevation-device-ip">{device.ip}</span>
                    </div>
                  </Tooltip>
                ) : (
                  <div className="rack-elevation-empty" />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {unpositioned.length > 0 && (
        <div className="rack-elevation-unpositioned">
          <span className="rack-elevation-unpositioned-label">No position assigned ({unpositioned.length})</span>
          {unpositioned.map(d => (
            <Tooltip key={d.id} content={`${d.hostname}\n${d.ip}\nStatus: ${d.status}`} position="right">
              <div className="rack-elevation-device rack-elevation-device-unpositioned" style={{ borderLeftColor: d.topology_role ? ROLE_COLORS[d.topology_role] || 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                <span className="rack-elevation-device-status" style={{ backgroundColor: STATUS_INDICATOR[d.status] || STATUS_INDICATOR.unknown }} />
                <span className="rack-elevation-device-name">{d.hostname}</span>
                <span className="rack-elevation-device-ip">{d.ip}</span>
              </div>
            </Tooltip>
          ))}
        </div>
      )}
      <div className="rack-elevation-legend">
        <span className="rack-elevation-legend-item">
          <span className="rack-elevation-legend-dot" style={{ background: ROLE_COLORS.spine }} />Spine
        </span>
        <span className="rack-elevation-legend-item">
          <span className="rack-elevation-legend-dot" style={{ background: ROLE_COLORS.leaf }} />Leaf
        </span>
        <span className="rack-elevation-legend-item">
          <span className="rack-elevation-legend-dot" style={{ background: STATUS_INDICATOR.online }} />Online
        </span>
        <span className="rack-elevation-legend-item">
          <span className="rack-elevation-legend-dot" style={{ background: STATUS_INDICATOR.offline }} />Offline
        </span>
      </div>
    </div>
  );
}
