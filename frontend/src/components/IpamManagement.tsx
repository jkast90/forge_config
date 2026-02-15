import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useIpam,
  useDevices,
  addNotification,
  slugify,
  validators,
} from '@core';
import type {
  IpamDatacenter,
  IpamPrefix, IpamPrefixFormData,
  IpamIpAddress, IpamIpAddressFormData,
  IpamRole, IpamVrf, IpamTag,
} from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { IconButton } from './IconButton';
import { InfoSection } from './InfoSection';
import { LoadingState } from './LoadingState';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { SelectField } from './SelectField';
import { Table } from './Table';
import type { TableColumn, TableAction } from './Table';
import { PlusIcon, TrashIcon, EditIcon, Icon } from './Icon';
import { ValidatedInput } from './ValidatedInput';
import { Toggle } from './Toggle';
import { SideTabs } from './SideTabs';
import type { SideTab } from './SideTabs';
import { useConfirm } from './ConfirmDialog';

type IpamTab = 'prefixes' | 'ips' | 'roles' | 'vrfs';

export function IpamManagement() {
  const [activeTab, setActiveTab] = useState<IpamTab>('prefixes');
  const [showInfo, setShowInfo] = useState(false);

  const ipam = useIpam();
  const { devices } = useDevices();

  const { datacenters, roles, vrfs, prefixes, ipAddresses, loading, error } = ipam;

  return (
    <LoadingState loading={loading} error={error} loadingMessage="Loading IPAM data...">
      <ActionBar>
        <Button variant="secondary" onClick={ipam.refresh}>
          <Icon name="refresh" size={16} />
          Refresh
        </Button>
      </ActionBar>

      <Card title="IP Address Management" headerAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}>
        <InfoSection open={showInfo}>
          <div>
            <p>
              IPAM manages your IP address space. Organize addresses into a hierarchy: Regions &rarr; Campuses &rarr; Datacenters &rarr; Halls &rarr; Rows &rarr; Racks.
              Network prefixes can be nested (supernets contain child prefixes), and individual IP addresses live within prefixes.
            </p>
            <p>
              Use <strong>next-available</strong> allocation to automatically carve out prefixes or IPs from a parent block.
              Tag any resource with arbitrary key-value pairs for flexible querying.
            </p>
          </div>
        </InfoSection>

        <SideTabs
          tabs={[
            { id: 'prefixes', label: 'Prefixes', icon: 'lan', count: prefixes.length },
            { id: 'ips', label: 'IP Addresses', icon: 'pin', count: ipAddresses.length },
            { id: 'vrfs', label: 'VRFs', icon: 'route', count: vrfs.length },
            { id: 'roles', label: 'Roles', icon: 'label', count: roles.length },
          ] as SideTab[]}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as IpamTab)}
        >
          {activeTab === 'prefixes' && (
            <PrefixesTab
              prefixes={prefixes}
              datacenters={datacenters}
              vrfs={vrfs}
              roles={roles}
              ipam={ipam}
            />
          )}

          {activeTab === 'ips' && (
            <IpAddressesTab
              ipAddresses={ipAddresses}
              prefixes={prefixes}
              roles={roles}
              vrfs={vrfs}
              devices={devices}
              ipam={ipam}
            />
          )}

          {activeTab === 'vrfs' && (
            <VrfsTab vrfs={vrfs} ipam={ipam} />
          )}

          {activeTab === 'roles' && (
            <RolesTab roles={roles} ipam={ipam} />
          )}
        </SideTabs>
      </Card>
    </LoadingState>
  );
}

// ============================================================
// Prefixes Tab
// ============================================================

function PrefixesTab({ prefixes, datacenters, vrfs, roles, ipam }: {
  prefixes: IpamPrefix[];
  datacenters: IpamDatacenter[];
  vrfs: IpamVrf[];
  roles: IpamRole[];
  ipam: ReturnType<typeof useIpam>;
}) {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [selectedPrefixId, setSelectedPrefixId] = useState<number | null>(null);
  const [showPrefixForm, setShowPrefixForm] = useState(false);
  const [editingPrefix, setEditingPrefix] = useState<IpamPrefix | null>(null);
  const [prefixForm, setPrefixForm] = useState<IpamPrefixFormData>({ prefix: '', description: '', status: 'active', is_supernet: false, role_ids: [], parent_id: '', datacenter_id: '', vlan_id: '', vrf_id: '' });
  const [showAllocatePrefix, setShowAllocatePrefix] = useState(false);
  const [allocatePrefixLength, setAllocatePrefixLength] = useState(24);
  const [allocateDescription, setAllocateDescription] = useState('');
  const [showAllocateIp, setShowAllocateIp] = useState(false);
  const [allocateIpRoles, setAllocateIpRoles] = useState<string[]>([]);
  const [allocateIpDescription, setAllocateIpDescription] = useState('');

  // Prefix tree search
  const [prefixSearch, setPrefixSearch] = useState('');

  // Tags
  const [showTagForm, setShowTagForm] = useState(false);
  const [tagKey, setTagKey] = useState('');
  const [tagValue, setTagValue] = useState('');

  const selectedPrefix = useMemo(() =>
    prefixes.find(p => p.id === selectedPrefixId) || null,
    [prefixes, selectedPrefixId]
  );

  useEffect(() => {
    if (selectedPrefixId != null) {
      ipam.fetchTags('prefix', String(selectedPrefixId));
    }
  }, [selectedPrefixId, ipam.fetchTags]);

  // Build prefix tree
  const prefixTree = useMemo(() => {
    interface TreeNode { prefix: IpamPrefix; depth: number }
    const childrenMap: Record<string, IpamPrefix[]> = {};
    prefixes.forEach(p => {
      const key = p.parent_id != null ? String(p.parent_id) : '__root__';
      if (!childrenMap[key]) childrenMap[key] = [];
      childrenMap[key].push(p);
    });

    const result: TreeNode[] = [];
    const buildTree = (parentId: number | null, depth: number) => {
      const key = parentId != null ? String(parentId) : '__root__';
      const children = childrenMap[key] || [];
      children.sort((a, b) => a.network_int - b.network_int);
      for (const child of children) {
        result.push({ prefix: child, depth });
        buildTree(child.id, depth + 1);
      }
    };
    buildTree(null, 0);
    return result;
  }, [prefixes]);

  // Filter prefix tree by search term (prefix, description, VRF, datacenter, status, VLAN)
  const filteredPrefixTree = useMemo(() => {
    if (!prefixSearch.trim()) return prefixTree;
    const term = prefixSearch.toLowerCase();
    const matchingIds = new Set<number>();
    // Find direct matches
    for (const { prefix: p } of prefixTree) {
      const searchText = [
        p.prefix, p.description, String(p.id), p.status,
        p.vrf_name, p.datacenter_name,
        p.vlan_id != null ? `vlan ${p.vlan_id}` : '',
        p.is_supernet ? 'supernet' : '',
        ...(p.role_names || []),
      ].filter(Boolean).join(' ').toLowerCase();
      if (searchText.includes(term)) matchingIds.add(p.id);
    }
    // Include ancestors of matches so the tree structure makes sense
    const visibleIds = new Set(matchingIds);
    for (const id of matchingIds) {
      let current = prefixes.find(p => p.id === id);
      while (current?.parent_id != null) {
        visibleIds.add(current.parent_id);
        current = prefixes.find(p => p.id === current!.parent_id);
      }
    }
    return prefixTree.filter(({ prefix: p }) => visibleIds.has(p.id));
  }, [prefixTree, prefixSearch, prefixes]);

  const dcOptions = useMemo(() => [
    { value: '', label: '(none)' },
    ...datacenters.map(d => ({ value: d.id, label: d.name })),
  ], [datacenters]);

  const vrfOptions = useMemo(() => [
    { value: '', label: '(Global)' },
    ...vrfs.map(v => ({ value: v.id, label: `${v.name}${v.rd ? ' (' + v.rd + ')' : ''}` })),
  ], [vrfs]);

  const parentOptions = useMemo(() => [
    { value: '', label: '(none - root/supernet)' },
    ...prefixes
      .filter(p => p.id !== editingPrefix?.id)
      .map(p => ({ value: String(p.id), label: `${p.prefix} ${p.description ? '- ' + p.description : ''}` })),
  ], [prefixes, editingPrefix]);

  const handleOpenCreate = useCallback(() => {
    setEditingPrefix(null);
    setPrefixForm({ prefix: '', description: '', status: 'active', is_supernet: false, role_ids: [], parent_id: '', datacenter_id: '', vlan_id: '', vrf_id: '' });
    setShowPrefixForm(true);
  }, []);

  const handleOpenCreateChild = useCallback((parentId: number) => {
    setEditingPrefix(null);
    const parent = prefixes.find(p => p.id === parentId);
    setPrefixForm({ prefix: '', description: '', status: 'active', is_supernet: false, role_ids: [], parent_id: String(parentId), datacenter_id: '', vlan_id: '', vrf_id: parent?.vrf_id || '' });
    setShowPrefixForm(true);
  }, [prefixes]);

  const handleOpenEdit = useCallback((p: IpamPrefix) => {
    setEditingPrefix(p);
    setPrefixForm({
      prefix: p.prefix,
      description: p.description || '',
      status: p.status,
      is_supernet: p.is_supernet,
      role_ids: p.role_ids || [],
      parent_id: p.parent_id != null ? String(p.parent_id) : '',
      datacenter_id: p.datacenter_id || '',
      vlan_id: p.vlan_id?.toString() || '',
      vrf_id: p.vrf_id || '',
    });
    setShowPrefixForm(true);
  }, []);

  const handleSubmitPrefix = useCallback(async () => {
    const form = prefixForm;
    if (!form.prefix.trim()) {
      addNotification('error', 'Prefix (CIDR) is required');
      return;
    }

    let success: boolean;
    if (editingPrefix) {
      success = await ipam.updatePrefix(editingPrefix.id, form);
    } else {
      success = await ipam.createPrefix(form);
    }
    if (success) {
      setShowPrefixForm(false);
      if (editingPrefix) {
        setSelectedPrefixId(editingPrefix.id);
      }
    }
  }, [prefixForm, editingPrefix, ipam]);

  const handleDeletePrefix = useCallback(async (id: number) => {
    if (!(await confirm({ title: 'Delete Prefix', message: 'Delete this prefix and all child IPs?', confirmText: 'Delete', destructive: true }))) return;
    const success = await ipam.deletePrefix(id);
    if (success && selectedPrefixId === id) setSelectedPrefixId(null);
  }, [ipam, selectedPrefixId]);

  const handleAllocatePrefix = useCallback(async () => {
    if (selectedPrefixId == null) return;
    const result = await ipam.nextAvailablePrefix(selectedPrefixId, allocatePrefixLength, {
      description: allocateDescription || undefined,
    });
    if (result) {
      setShowAllocatePrefix(false);
      setAllocateDescription('');
      setSelectedPrefixId(result.id);
    }
  }, [selectedPrefixId, allocatePrefixLength, allocateDescription, ipam]);

  const handleAllocateIp = useCallback(async () => {
    if (selectedPrefixId == null) return;
    const result = await ipam.nextAvailableIp(selectedPrefixId!, {
      description: allocateIpDescription || undefined,
      role_ids: allocateIpRoles.length > 0 ? allocateIpRoles : undefined,
    });
    if (result) {
      setShowAllocateIp(false);
      setAllocateIpDescription('');
      setAllocateIpRoles([]);
    }
  }, [selectedPrefixId, allocateIpDescription, allocateIpRoles, ipam]);

  const handleAddTag = useCallback(async () => {
    if (selectedPrefixId == null || !tagKey.trim()) {
      addNotification('error', 'Tag key is required');
      return;
    }
    const success = await ipam.setTag('prefix', String(selectedPrefixId), tagKey.trim(), tagValue);
    if (success) {
      setShowTagForm(false);
      setTagKey('');
      setTagValue('');
    }
  }, [selectedPrefixId, tagKey, tagValue, ipam]);

  // Child prefixes and IPs for selected
  const childPrefixes = useMemo(() =>
    prefixes.filter(p => p.parent_id === selectedPrefixId),
    [prefixes, selectedPrefixId]
  );

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '0', minHeight: '500px' }}>
        {/* Left: prefix tree */}
        <div style={{ borderRight: '1px solid var(--border-color)' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', opacity: 0.7 }}>PREFIXES ({prefixes.length})</span>
            <Button size="sm" onClick={handleOpenCreate}><PlusIcon size={14} /> Add</Button>
          </div>
          <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <input
              type="text"
              value={prefixSearch}
              onChange={(e) => setPrefixSearch(e.target.value)}
              placeholder="Filter prefixes..."
              style={{ width: '100%', padding: '5px 8px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'var(--input-bg, transparent)', color: 'inherit' }}
            />
          </div>
          {filteredPrefixTree.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
              {prefixSearch ? 'No matching prefixes.' : 'No prefixes defined yet.'}
            </div>
          ) : (
            <div style={{ maxHeight: '600px', overflow: 'auto' }}>
              {filteredPrefixTree.map(({ prefix: p, depth }) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 12px', paddingLeft: `${12 + depth * 20}px`, cursor: 'pointer',
                    background: selectedPrefixId === p.id ? 'var(--selection-bg, rgba(100, 149, 237, 0.15))' : 'transparent',
                    borderLeft: selectedPrefixId === p.id ? '3px solid var(--accent-color, #6495ed)' : '3px solid transparent',
                  }}
                  onClick={() => setSelectedPrefixId(p.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon name={p.is_supernet ? 'cloud' : depth > 0 ? 'subdirectory_arrow_right' : 'lan'} size={16} />
                      <span style={{ fontWeight: 500, fontFamily: 'monospace' }}>{p.prefix}</span>
                      <span style={{
                        fontSize: '10px', padding: '1px 5px', borderRadius: '6px',
                        background: p.status === 'active' ? 'rgba(76, 175, 80, 0.2)' :
                          p.status === 'reserved' ? 'rgba(255, 193, 7, 0.2)' : 'rgba(158, 158, 158, 0.2)',
                        color: p.status === 'active' ? '#4caf50' :
                          p.status === 'reserved' ? '#ff9800' : '#9e9e9e',
                      }}>
                        {p.status}
                      </span>
                      {p.vrf_name && (
                        <span style={{
                          fontSize: '10px', padding: '1px 5px', borderRadius: '6px',
                          background: 'rgba(100, 149, 237, 0.2)', color: 'var(--accent-color, #6495ed)',
                        }}>
                          {p.vrf_name}
                        </span>
                      )}
                      {(p.role_names || []).map(rn => (
                        <span key={rn} style={{
                          fontSize: '10px', padding: '1px 5px', borderRadius: '6px',
                          background: 'rgba(255, 152, 0, 0.2)', color: '#ff9800',
                        }}>
                          {rn}
                        </span>
                      ))}
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '1px' }}>
                      {p.description || p.id}
                      {(p.child_prefix_count ?? 0) > 0 && ` · ${p.child_prefix_count} children`}
                      {(p.ip_address_count ?? 0) > 0 && ` · ${p.ip_address_count} IPs`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <IconButton size="sm" onClick={(e) => { e.stopPropagation(); handleOpenEdit(p); }} title="Edit">
                      <EditIcon size={14} />
                    </IconButton>
                    <IconButton variant="danger" size="sm" onClick={(e) => { e.stopPropagation(); handleDeletePrefix(p.id); }} title="Delete">
                      <TrashIcon size={14} />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: selected prefix detail */}
        <div>
          {selectedPrefix ? (
            <PrefixDetail
              prefix={selectedPrefix}
              childPrefixes={childPrefixes}
              tags={ipam.tags}
              tagsLoading={ipam.tagsLoading}
              onAllocatePrefix={() => setShowAllocatePrefix(true)}
              onAllocateIp={() => setShowAllocateIp(true)}
              onAddChild={() => handleOpenCreateChild(selectedPrefix.id)}
              onAddTag={() => { ipam.fetchTagKeys(); setShowTagForm(true); }}
              onDeleteTag={(key) => ipam.deleteTag('prefix', String(selectedPrefix.id), key)}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '300px', opacity: 0.5, fontSize: '14px' }}>
              Select a prefix to view details
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Prefix Modal */}
      <FormDialog isOpen={showPrefixForm} onClose={() => setShowPrefixForm(false)} title={editingPrefix ? 'Edit Prefix' : 'Create Prefix'} onSubmit={(e) => { e.preventDefault(); handleSubmitPrefix(); }} submitText={editingPrefix ? 'Update' : 'Create'} variant="wide">
        <div className="form-grid-2col">
          <ValidatedInput label="Prefix (CIDR)" name="prefix" value={prefixForm.prefix} onChange={(e) => setPrefixForm(f => ({ ...f, prefix: e.target.value }))} placeholder="e.g., 10.0.0.0/8" validate={validators.prefix} />
          <SelectField label="Status" name="status" value={prefixForm.status} onChange={(e) => setPrefixForm(f => ({ ...f, status: e.target.value as IpamPrefixFormData['status'] }))} options={[{ value: 'active', label: 'Active' }, { value: 'reserved', label: 'Reserved' }, { value: 'deprecated', label: 'Deprecated' }]} />
          <FormField label="Description" name="description" value={prefixForm.description} onChange={(e) => setPrefixForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          <SelectField label="Parent Prefix" name="parent_id" value={prefixForm.parent_id} onChange={(e) => setPrefixForm(f => ({ ...f, parent_id: e.target.value }))} options={parentOptions} />
          <SelectField label="Datacenter" name="datacenter_id" value={prefixForm.datacenter_id} onChange={(e) => setPrefixForm(f => ({ ...f, datacenter_id: e.target.value }))} options={dcOptions} />
          <SelectField label="VRF" name="vrf_id" value={prefixForm.vrf_id} onChange={(e) => setPrefixForm(f => ({ ...f, vrf_id: e.target.value }))} options={vrfOptions} />
          <FormField label="VLAN ID" name="vlan_id" value={prefixForm.vlan_id} onChange={(e) => setPrefixForm(f => ({ ...f, vlan_id: e.target.value }))} placeholder="Optional" type="number" />
          <div className="form-grid-full">
            <Toggle label="Supernet" description="Top-level aggregate prefix" checked={prefixForm.is_supernet} onChange={(checked) => setPrefixForm(f => ({ ...f, is_supernet: checked }))} />
          </div>
          <div className="form-grid-full">
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Roles</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {roles.map(r => (
                <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={prefixForm.role_ids.includes(r.id)}
                    onChange={(e) => {
                      setPrefixForm(f => ({
                        ...f,
                        role_ids: e.target.checked
                          ? [...f.role_ids, r.id]
                          : f.role_ids.filter(id => id !== r.id),
                      }));
                    }}
                  />
                  {r.name}
                </label>
              ))}
            </div>
            {roles.length === 0 && <span style={{ fontSize: '12px', opacity: 0.5 }}>No roles defined</span>}
          </div>
        </div>
      </FormDialog>

      {/* Allocate Next Prefix */}
      <FormDialog isOpen={showAllocatePrefix} onClose={() => setShowAllocatePrefix(false)} title={`Allocate Prefix from ${selectedPrefix?.prefix || ''}`} onSubmit={(e) => { e.preventDefault(); handleAllocatePrefix(); }} submitText="Allocate">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Desired Prefix Length" name="prefixLen" type="number" value={String(allocatePrefixLength)} onChange={(e) => setAllocatePrefixLength(parseInt(e.target.value) || 24)} placeholder="e.g., 24" />
          <FormField label="Description" name="allocDesc" value={allocateDescription} onChange={(e) => setAllocateDescription(e.target.value)} placeholder="Optional" />
        </div>
      </FormDialog>

      {/* Allocate Next IP */}
      <FormDialog isOpen={showAllocateIp} onClose={() => setShowAllocateIp(false)} title={`Allocate IP from ${selectedPrefix?.prefix || ''}`} onSubmit={(e) => { e.preventDefault(); handleAllocateIp(); }} submitText="Allocate">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Description" name="ipAllocDesc" value={allocateIpDescription} onChange={(e) => setAllocateIpDescription(e.target.value)} placeholder="Optional" />
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Roles</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {roles.map(r => (
                <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={allocateIpRoles.includes(r.id)}
                    onChange={(e) => {
                      setAllocateIpRoles(prev => e.target.checked
                        ? [...prev, r.id]
                        : prev.filter(id => id !== r.id)
                      );
                    }}
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      </FormDialog>

      {/* Add Tag */}
      <FormDialog isOpen={showTagForm} onClose={() => setShowTagForm(false)} title="Add Tag" onSubmit={(e) => { e.preventDefault(); handleAddTag(); }} submitText="Add Tag">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Key</label>
            <input
              list="ipam-tag-keys"
              value={tagKey}
              onChange={(e) => setTagKey(e.target.value)}
              placeholder="e.g., env, team"
              style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--input-bg, inherit)', color: 'inherit' }}
            />
            <datalist id="ipam-tag-keys">
              {ipam.tagKeys.map(k => <option key={k} value={k} />)}
            </datalist>
          </div>
          <FormField label="Value" name="tagValue" value={tagValue} onChange={(e) => setTagValue(e.target.value)} placeholder="e.g., production" />
        </div>
      </FormDialog>

      <ConfirmDialogRenderer />
    </>
  );
}

function PrefixDetail({ prefix, childPrefixes, tags, tagsLoading, onAllocatePrefix, onAllocateIp, onAddChild, onAddTag, onDeleteTag }: {
  prefix: IpamPrefix;
  childPrefixes: IpamPrefix[];
  tags: IpamTag[];
  tagsLoading: boolean;
  onAllocatePrefix: () => void;
  onAllocateIp: () => void;
  onAddChild: () => void;
  onAddTag: () => void;
  onDeleteTag: (key: string) => void;
}) {
  const utilization = prefix.utilization ?? 0;

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: '16px', fontFamily: 'monospace' }}>{prefix.prefix}</span>
            {prefix.description && <span style={{ opacity: 0.6, marginLeft: '8px', fontSize: '13px' }}>&mdash; {prefix.description}</span>}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <Button size="sm" onClick={onAllocatePrefix}><Icon name="add_circle" size={14} /> Allocate /{'{n}'}</Button>
            <Button size="sm" onClick={onAllocateIp}><Icon name="add" size={14} /> Allocate IP</Button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', opacity: 0.6, marginTop: '4px', flexWrap: 'wrap' }}>
          <span>Status: {prefix.status}</span>
          {prefix.is_supernet && <span>Supernet</span>}
          {prefix.parent_prefix && <span>Parent: {prefix.parent_prefix}</span>}
          {prefix.datacenter_name && <span>DC: {prefix.datacenter_name}</span>}
          {prefix.vlan_id && <span>VLAN: {prefix.vlan_id}</span>}
          {prefix.vrf_name && <span>VRF: {prefix.vrf_name}</span>}
          {(prefix.role_names || prefix.role_ids || []).length > 0 && (
            <span>Roles: {(prefix.role_names || prefix.role_ids || []).join(', ')}</span>
          )}
        </div>
      </div>

      {/* Utilization bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
          <span>Utilization</span>
          <span>{utilization.toFixed(1)}%</span>
        </div>
        <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '3px', width: `${Math.min(utilization, 100)}%`,
            background: utilization > 90 ? '#f44336' : utilization > 70 ? '#ff9800' : '#4caf50',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.5, marginTop: '2px' }}>
          <span>{prefix.child_prefix_count ?? 0} child prefixes</span>
          <span>{prefix.ip_address_count ?? 0} IP addresses</span>
        </div>
      </div>

      {/* Child prefixes */}
      <div style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Child Prefixes ({childPrefixes.length})</span>
          <Button size="sm" onClick={onAddChild}><PlusIcon size={14} /> Add Child</Button>
        </div>
        {childPrefixes.length > 0 ? (
          <div style={{ maxHeight: '200px', overflow: 'auto' }}>
            {childPrefixes.map(cp => (
              <div key={cp.id} style={{ padding: '4px 16px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontFamily: 'monospace' }}>{cp.prefix}</span>
                <span style={{ opacity: 0.6 }}>{cp.description || cp.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '8px 16px', fontSize: '12px', opacity: 0.5 }}>No child prefixes</div>
        )}
      </div>

      {/* Tags */}
      <div>
        <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Tags ({tags.length})</span>
          <Button size="sm" onClick={onAddTag}><PlusIcon size={14} /> Add Tag</Button>
        </div>
        <LoadingState loading={tagsLoading} loadingMessage="Loading tags...">
          {tags.length > 0 ? (
            <div style={{ padding: '0 16px 8px' }}>
              {tags.map(t => (
                <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', fontSize: '13px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '4px',
                    background: 'var(--border-color)', fontWeight: 500,
                  }}>{t.key}</span>
                  <span style={{ opacity: 0.7 }}>{t.value || <i>(empty)</i>}</span>
                  <IconButton variant="danger" size="sm" onClick={() => onDeleteTag(t.key)} title="Remove tag">
                    <TrashIcon size={12} />
                  </IconButton>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '8px 16px', fontSize: '12px', opacity: 0.5 }}>No tags</div>
          )}
        </LoadingState>
      </div>
    </div>
  );
}


// ============================================================
// IP Addresses Tab
// ============================================================

function IpAddressesTab({ ipAddresses, prefixes, roles, vrfs, devices, ipam }: {
  ipAddresses: IpamIpAddress[];
  prefixes: IpamPrefix[];
  roles: IpamRole[];
  vrfs: IpamVrf[];
  devices: { id: number; mac: string | null; hostname: string }[];
  ipam: ReturnType<typeof useIpam>;
}) {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editingIp, setEditingIp] = useState<IpamIpAddress | null>(null);
  const [form, setForm] = useState<IpamIpAddressFormData>({ id: '', address: '', prefix_id: '', description: '', status: 'active', role_ids: [], dns_name: '', device_id: '', interface_name: '', vrf_id: '' });

  const prefixOptions = useMemo(() => [
    { value: '', label: 'Select a prefix...' },
    ...prefixes.map(p => ({ value: String(p.id), label: `${p.prefix} ${p.description ? '- ' + p.description : ''}` })),
  ], [prefixes]);

  const roleOptions = useMemo(() =>
    roles.map(r => ({ value: r.id, label: r.name })),
  [roles]);

  const deviceOptions = useMemo(() => [
    { value: '', label: '(none)' },
    ...devices.map(d => ({ value: String(d.id), label: `${d.hostname || d.mac || String(d.id)}` })),
  ], [devices]);

  const vrfOptions = useMemo(() => [
    { value: '', label: '(Global)' },
    ...vrfs.map(v => ({ value: v.id, label: `${v.name}${v.rd ? ' (' + v.rd + ')' : ''}` })),
  ], [vrfs]);

  const handleOpenCreate = useCallback(() => {
    setEditingIp(null);
    setForm({ id: '', address: '', prefix_id: '', description: '', status: 'active', role_ids: [], dns_name: '', device_id: '', interface_name: '', vrf_id: '' });
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((ip: IpamIpAddress) => {
    setEditingIp(ip);
    setForm({
      id: ip.id,
      address: ip.address,
      prefix_id: String(ip.prefix_id),
      description: ip.description || '',
      status: ip.status,
      role_ids: ip.role_ids || [],
      dns_name: ip.dns_name || '',
      device_id: ip.device_id != null ? String(ip.device_id) : '',
      interface_name: ip.interface_name || '',
      vrf_id: ip.vrf_id || '',
    });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.address.trim() || !form.prefix_id) {
      addNotification('error', 'Address and Prefix are required');
      return;
    }
    const id = form.id.trim() || `ip-${slugify(form.address)}`;
    const data: IpamIpAddressFormData = { ...form, id };

    let success: boolean;
    if (editingIp) {
      success = await ipam.updateIpAddress(editingIp.id, data);
    } else {
      success = await ipam.createIpAddress(data);
    }
    if (success) setShowForm(false);
  }, [form, editingIp, ipam]);

  const handleDelete = useCallback(async (ip: IpamIpAddress) => {
    if (!(await confirm({ title: 'Delete IP Address', message: `Delete IP ${ip.address}?`, confirmText: 'Delete', destructive: true }))) return;
    await ipam.deleteIpAddress(ip.id);
  }, [ipam]);

  const columns: TableColumn<IpamIpAddress>[] = useMemo(() => [
    { header: 'Address', accessor: (row: IpamIpAddress) => row.address, searchValue: (row: IpamIpAddress) => row.address },
    { header: 'Prefix', accessor: (row: IpamIpAddress) => row.prefix || String(row.prefix_id), searchValue: (row: IpamIpAddress) => `${row.prefix || ''} ${row.prefix_id}` },
    { header: 'Status', accessor: (row: IpamIpAddress) => row.status, searchValue: (row: IpamIpAddress) => row.status },
    { header: 'Roles', accessor: (row: IpamIpAddress) => (row.role_names || row.role_ids || []).join(', '), searchValue: (row: IpamIpAddress) => (row.role_names || row.role_ids || []).join(' ') },
    { header: 'DNS Name', accessor: (row: IpamIpAddress) => row.dns_name || '', searchValue: (row: IpamIpAddress) => row.dns_name || '' },
    { header: 'Device', accessor: (row: IpamIpAddress) => row.device_hostname || row.device_id || '', searchValue: (row: IpamIpAddress) => `${row.device_hostname || ''} ${row.device_id || ''}` },
    { header: 'Interface', accessor: (row: IpamIpAddress) => row.interface_name || '', searchValue: (row: IpamIpAddress) => row.interface_name || '' },
    { header: 'VRF', accessor: (row: IpamIpAddress) => row.vrf_name || '', searchValue: (row: IpamIpAddress) => row.vrf_name || '' },
    { header: 'Description', accessor: (row: IpamIpAddress) => row.description || '', searchValue: (row: IpamIpAddress) => row.description || '' },
  ], []);

  const actions: TableAction<IpamIpAddress>[] = useMemo(() => [
    { icon: <EditIcon size={14} />, label: 'Edit', onClick: handleOpenEdit },
    { icon: <TrashIcon size={14} />, label: 'Delete', onClick: handleDelete, variant: 'danger' as const },
  ], [handleOpenEdit, handleDelete]);

  return (
    <>
      <Card
        title="IP Addresses"
        headerAction={
          <Button variant="primary" onClick={handleOpenCreate}>
            <PlusIcon size={14} />
            Add IP Address
          </Button>
        }
      >
        <Table
          data={ipAddresses}
          columns={columns}
          actions={actions}
          getRowKey={(row) => row.id}
          tableId="ipam-ip-addresses"
          emptyMessage="No IP addresses allocated yet."
          emptyDescription="Allocate IPs from a prefix or add one manually."
          searchable
          searchPlaceholder="Search IP addresses..."
        />
      </Card>

      <FormDialog isOpen={showForm} onClose={() => setShowForm(false)} title={editingIp ? 'Edit IP Address' : 'Create IP Address'} onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} submitText={editingIp ? 'Update' : 'Create'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="ID" name="id" value={form.id} onChange={(e) => setForm(f => ({ ...f, id: e.target.value }))} disabled={!!editingIp} placeholder="Auto-generated if empty" />
          <ValidatedInput label="Address" name="address" value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g., 10.0.0.1" validate={validators.ip} />
          <SelectField label="Prefix" name="prefix_id" value={form.prefix_id} onChange={(e) => setForm(f => ({ ...f, prefix_id: e.target.value }))} options={prefixOptions} />
          <FormField label="Description" name="desc" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          <SelectField label="Status" name="status" value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as IpamIpAddressFormData['status'] }))} options={[{ value: 'active', label: 'Active' }, { value: 'reserved', label: 'Reserved' }, { value: 'deprecated', label: 'Deprecated' }, { value: 'dhcp', label: 'DHCP' }]} />
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Roles</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {roleOptions.map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.role_ids.includes(opt.value)}
                    onChange={(e) => {
                      setForm(f => ({
                        ...f,
                        role_ids: e.target.checked
                          ? [...f.role_ids, opt.value]
                          : f.role_ids.filter(id => id !== opt.value),
                      }));
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {roleOptions.length === 0 && <span style={{ fontSize: '12px', opacity: 0.5 }}>No roles defined</span>}
          </div>
          <FormField label="DNS Name" name="dns_name" value={form.dns_name} onChange={(e) => setForm(f => ({ ...f, dns_name: e.target.value }))} placeholder="Optional" />
          <SelectField label="Device" name="device_id" value={form.device_id} onChange={(e) => setForm(f => ({ ...f, device_id: e.target.value }))} options={deviceOptions} />
          <FormField label="Interface" name="interface_name" value={form.interface_name} onChange={(e) => setForm(f => ({ ...f, interface_name: e.target.value }))} placeholder="e.g., eth0, Loopback0" />
          <SelectField label="VRF" name="vrf_id" value={form.vrf_id} onChange={(e) => setForm(f => ({ ...f, vrf_id: e.target.value }))} options={vrfOptions} />
        </div>
      </FormDialog>

      <ConfirmDialogRenderer />
    </>
  );
}

// ============================================================
// VRFs Tab
// ============================================================

function VrfsTab({ vrfs, ipam }: {
  vrfs: IpamVrf[];
  ipam: ReturnType<typeof useIpam>;
}) {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [vrfId, setVrfId] = useState('');
  const [vrfName, setVrfName] = useState('');
  const [vrfRd, setVrfRd] = useState('');
  const [vrfDesc, setVrfDesc] = useState('');

  const handleCreate = useCallback(async () => {
    if (!vrfId.trim() || !vrfName.trim()) {
      addNotification('error', 'ID and Name are required');
      return;
    }
    const success = await ipam.createVrf({
      id: vrfId.trim(),
      name: vrfName.trim(),
      rd: vrfRd || undefined,
      description: vrfDesc || undefined,
    });
    if (success) {
      setShowForm(false);
      setVrfId('');
      setVrfName('');
      setVrfRd('');
      setVrfDesc('');
    }
  }, [vrfId, vrfName, vrfRd, vrfDesc, ipam]);

  const handleDelete = useCallback(async (vrf: IpamVrf) => {
    if (!(await confirm({ title: 'Delete VRF', message: `Delete VRF "${vrf.name}"? Prefixes in this VRF will become global.`, confirmText: 'Delete', destructive: true }))) return;
    await ipam.deleteVrf(vrf.id);
  }, [ipam]);

  const columns: TableColumn<IpamVrf>[] = useMemo(() => [
    { header: 'ID', accessor: 'id' as keyof IpamVrf },
    { header: 'Name', accessor: 'name' as keyof IpamVrf },
    { header: 'RD', accessor: (row: IpamVrf) => row.rd || '', searchValue: (row: IpamVrf) => row.rd || '' },
    { header: 'Description', accessor: (row: IpamVrf) => row.description || '', searchValue: (row: IpamVrf) => row.description || '' },
    { header: 'Prefixes', accessor: (row: IpamVrf) => String(row.prefix_count ?? 0), searchable: false },
  ], []);

  const actions: TableAction<IpamVrf>[] = useMemo(() => [
    { icon: <TrashIcon size={14} />, label: 'Delete', onClick: handleDelete, variant: 'danger' as const },
  ], [handleDelete]);

  return (
    <>
      <Card
        title="VRFs"
        headerAction={
          <Button variant="primary" onClick={() => setShowForm(true)}>
            <PlusIcon size={14} />
            Add VRF
          </Button>
        }
      >
        <Table
          data={vrfs}
          columns={columns}
          actions={actions}
          getRowKey={(row) => row.id}
          tableId="ipam-vrfs"
          emptyMessage="No VRFs defined."
          emptyDescription="All prefixes are in the global routing table."
          searchable
          searchPlaceholder="Search VRFs..."
        />
      </Card>

      <FormDialog isOpen={showForm} onClose={() => setShowForm(false)} title="Create VRF" onSubmit={(e) => { e.preventDefault(); handleCreate(); }} submitText="Create">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="ID" name="vrfId" value={vrfId} onChange={(e) => setVrfId(e.target.value)} placeholder="e.g., vrf-mgmt" />
          <FormField label="Name" name="vrfName" value={vrfName} onChange={(e) => setVrfName(e.target.value)} placeholder="e.g., Management" />
          <FormField label="Route Distinguisher" name="vrfRd" value={vrfRd} onChange={(e) => setVrfRd(e.target.value)} placeholder="e.g., 65000:100 (optional)" />
          <FormField label="Description" name="vrfDesc" value={vrfDesc} onChange={(e) => setVrfDesc(e.target.value)} placeholder="Optional description" />
        </div>
      </FormDialog>

      <ConfirmDialogRenderer />
    </>
  );
}

// ============================================================
// Roles Tab
// ============================================================

function RolesTab({ roles, ipam }: {
  roles: IpamRole[];
  ipam: ReturnType<typeof useIpam>;
}) {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [roleId, setRoleId] = useState('');
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');

  const handleCreate = useCallback(async () => {
    if (!roleId.trim() || !roleName.trim()) {
      addNotification('error', 'ID and Name are required');
      return;
    }
    const success = await ipam.createRole({ id: roleId.trim(), name: roleName.trim(), description: roleDesc || undefined });
    if (success) {
      setShowForm(false);
      setRoleId('');
      setRoleName('');
      setRoleDesc('');
    }
  }, [roleId, roleName, roleDesc, ipam]);

  const handleDelete = useCallback(async (role: IpamRole) => {
    if (!(await confirm({ title: 'Delete Role', message: `Delete role "${role.name}"?`, confirmText: 'Delete', destructive: true }))) return;
    await ipam.deleteRole(role.id);
  }, [ipam]);

  const columns: TableColumn<IpamRole>[] = useMemo(() => [
    { header: 'ID', accessor: 'id' as keyof IpamRole },
    { header: 'Name', accessor: 'name' as keyof IpamRole },
    { header: 'Description', accessor: (row: IpamRole) => row.description || '', searchValue: (row: IpamRole) => row.description || '' },
  ], []);

  const actions: TableAction<IpamRole>[] = useMemo(() => [
    { icon: <TrashIcon size={14} />, label: 'Delete', onClick: handleDelete, variant: 'danger' as const },
  ], [handleDelete]);

  return (
    <>
      <Card
        title="Roles"
        headerAction={
          <Button variant="primary" onClick={() => setShowForm(true)}>
            <PlusIcon size={14} />
            Add Role
          </Button>
        }
      >
        <Table
          data={roles}
          columns={columns}
          actions={actions}
          getRowKey={(row) => row.id}
          tableId="ipam-roles"
          emptyMessage="No roles defined."
          emptyDescription="Add roles to categorize IP address assignments."
          searchable
          searchPlaceholder="Search roles..."
        />
      </Card>

      <FormDialog isOpen={showForm} onClose={() => setShowForm(false)} title="Create Role" onSubmit={(e) => { e.preventDefault(); handleCreate(); }} submitText="Create">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="ID" name="roleId" value={roleId} onChange={(e) => setRoleId(e.target.value)} placeholder="e.g., transit_link" />
          <FormField label="Name" name="roleName" value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g., Transit Link" />
          <FormField label="Description" name="roleDesc" value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} placeholder="Optional description" />
        </div>
      </FormDialog>

      <ConfirmDialogRenderer />
    </>
  );
}
