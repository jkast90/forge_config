import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useIpam,
  useDevices,
  usePersistedTab,
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
import { Button, RefreshButton } from './Button';
import { Card } from './Card';
import { Toggle } from './Toggle';
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
import { SideTabs } from './SideTabs';
import type { SideTab } from './SideTabs';
import { useConfirm } from './ConfirmDialog';

type IpamTab = 'prefixes' | 'ips' | 'roles' | 'tags';

export function IpamManagement() {
  const [activeTab, setActiveTab] = usePersistedTab<IpamTab>('prefixes', ['prefixes', 'ips', 'roles', 'tags'], 'tab_ipam');
  const [showInfo, setShowInfo] = useState(false);

  const ipam = useIpam();
  const { devices } = useDevices();

  const { datacenters, roles, vrfs, prefixes, ipAddresses, loading, error } = ipam;

  return (
    <LoadingState loading={loading} error={error} loadingMessage="Loading IPAM data...">
      <Card
        title="IP Address Management"
        titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
        headerAction={
          <RefreshButton onClick={ipam.refresh} />
        }
      >
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
            { id: 'roles', label: 'Roles', icon: 'label', count: roles.length },
            { id: 'tags', label: 'Tags', icon: 'sell', count: ipam.allTags.length },
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

          {activeTab === 'roles' && (
            <RolesTab roles={roles} ipam={ipam} />
          )}

          {activeTab === 'tags' && (
            <TagsTab ipam={ipam} prefixes={prefixes} />
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
  const [showInfo, setShowInfo] = useState(false);
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
    ...datacenters.map(d => ({ value: String(d.id), label: d.name })),
  ], [datacenters]);

  const vrfOptions = useMemo(() => [
    { value: '', label: '(Global)' },
    ...vrfs.map(v => ({ value: String(v.id), label: `${v.name}${v.rd ? ' (' + v.rd + ')' : ''}` })),
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
    setPrefixForm({ prefix: '', description: '', status: 'active', is_supernet: false, role_ids: [], parent_id: String(parentId), datacenter_id: '', vlan_id: '', vrf_id: parent?.vrf_id != null ? String(parent.vrf_id) : '' });
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
      datacenter_id: p.datacenter_id != null ? String(p.datacenter_id) : '',
      vlan_id: p.vlan_id?.toString() || '',
      vrf_id: p.vrf_id != null ? String(p.vrf_id) : '',
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
      <Card
        title="Prefixes"
        titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
        headerAction={<Button onClick={handleOpenCreate}><PlusIcon size={14} />Add Prefix</Button>}
      >
        <InfoSection open={showInfo}>
          <p>Prefixes define your IP address space in CIDR notation. Organize them in a hierarchy of supernets and child subnets. Select a prefix to view details, allocate child prefixes or IPs, and manage tags.</p>
        </InfoSection>
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '0', minHeight: '500px' }}>
          {/* Left: prefix tree */}
          <div style={{ borderRight: '1px solid var(--color-border)' }}>
            <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--color-border)' }}>
              <input
                type="text"
                value={prefixSearch}
                onChange={(e) => setPrefixSearch(e.target.value)}
                placeholder="Filter prefixes..."
                style={{ width: '100%', padding: '5px 8px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-bg-input, transparent)', color: 'inherit' }}
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
      </Card>

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
                <Toggle
                  key={r.id}
                  label={r.name}
                  checked={prefixForm.role_ids.includes(r.id)}
                  onChange={(checked) => {
                    setPrefixForm(f => ({
                      ...f,
                      role_ids: checked
                        ? [...f.role_ids, r.id]
                        : f.role_ids.filter(id => id !== r.id),
                    }));
                  }}
                />
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
                <Toggle
                  key={r.id}
                  label={r.name}
                  checked={allocateIpRoles.includes(String(r.id))}
                  onChange={(checked) => {
                    setAllocateIpRoles(prev => checked
                      ? [...prev, String(r.id)]
                      : prev.filter(id => id !== String(r.id))
                    );
                  }}
                />
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
  const [showInfo, setShowInfo] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingIp, setEditingIp] = useState<IpamIpAddress | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<IpamIpAddressFormData>({ address: '', prefix_id: '', description: '', status: 'active', role_ids: [], dns_name: '', device_id: '', interface_name: '', vrf_id: '' });

  const prefixOptions = useMemo(() => [
    { value: '', label: 'Select a prefix...' },
    ...prefixes.map(p => ({ value: String(p.id), label: `${p.prefix} ${p.description ? '- ' + p.description : ''}` })),
  ], [prefixes]);

  const roleOptions = useMemo(() =>
    roles.map(r => ({ value: String(r.id), label: r.name })),
  [roles]);

  const deviceOptions = useMemo(() => [
    { value: '', label: '(none)' },
    ...devices.map(d => ({ value: String(d.id), label: `${d.hostname || d.mac || String(d.id)}` })),
  ], [devices]);

  const vrfOptions = useMemo(() => [
    { value: '', label: '(Global)' },
    ...vrfs.map(v => ({ value: String(v.id), label: `${v.name}${v.rd ? ' (' + v.rd + ')' : ''}` })),
  ], [vrfs]);

  const handleOpenCreate = useCallback(() => {
    setEditingIp(null);
    setEditingId(null);
    setForm({ address: '', prefix_id: '', description: '', status: 'active', role_ids: [], dns_name: '', device_id: '', interface_name: '', vrf_id: '' });
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((ip: IpamIpAddress) => {
    setEditingIp(ip);
    setEditingId(ip.id);
    setForm({
      address: ip.address,
      prefix_id: String(ip.prefix_id),
      description: ip.description || '',
      status: ip.status,
      role_ids: ip.role_ids || [],
      dns_name: ip.dns_name || '',
      device_id: ip.device_id != null ? String(ip.device_id) : '',
      interface_name: ip.interface_name || '',
      vrf_id: ip.vrf_id != null ? String(ip.vrf_id) : '',
    });
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.address.trim() || !form.prefix_id) {
      addNotification('error', 'Address and Prefix are required');
      return;
    }

    let success: boolean;
    if (editingIp) {
      success = await ipam.updateIpAddress(editingIp.id, form);
    } else {
      success = await ipam.createIpAddress(form);
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
        titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
        headerAction={
          <Button variant="primary" onClick={handleOpenCreate}>
            <PlusIcon size={14} />
            Add IP Address
          </Button>
        }
      >
        <InfoSection open={showInfo}>
          <p>Individual IP address allocations within prefixes. Each address can be assigned to a device, role, and VRF.</p>
        </InfoSection>
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
          {/* ID is auto-generated by the server */}
          <ValidatedInput label="Address" name="address" value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="e.g., 10.0.0.1" validate={validators.ip} />
          <SelectField label="Prefix" name="prefix_id" value={form.prefix_id} onChange={(e) => setForm(f => ({ ...f, prefix_id: e.target.value }))} options={prefixOptions} />
          <FormField label="Description" name="desc" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          <SelectField label="Status" name="status" value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value as IpamIpAddressFormData['status'] }))} options={[{ value: 'active', label: 'Active' }, { value: 'reserved', label: 'Reserved' }, { value: 'deprecated', label: 'Deprecated' }, { value: 'dhcp', label: 'DHCP' }]} />
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Roles</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {roleOptions.map(opt => {
                const numericId = Number(opt.value);
                return (
                  <Toggle
                    key={opt.value}
                    label={opt.label}
                    checked={form.role_ids.includes(numericId)}
                    onChange={(checked) => {
                      setForm(f => ({
                        ...f,
                        role_ids: checked
                          ? [...f.role_ids, numericId]
                          : f.role_ids.filter(id => id !== numericId),
                      }));
                    }}
                  />
                );
              })}
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
// Roles Tab
// ============================================================

function RolesTab({ roles, ipam }: {
  roles: IpamRole[];
  ipam: ReturnType<typeof useIpam>;
}) {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [showInfo, setShowInfo] = useState(false);
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
        titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
        headerAction={
          <Button variant="primary" onClick={() => setShowForm(true)}>
            <PlusIcon size={14} />
            Add Role
          </Button>
        }
      >
        <InfoSection open={showInfo}>
          <p>Roles categorize IP address assignments by function (e.g., loopback, management, transit). Roles can be assigned to individual IP addresses.</p>
        </InfoSection>
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

// ============================================================
// Tags Tab
// ============================================================

function TagsTab({ ipam, prefixes }: {
  ipam: ReturnType<typeof useIpam>;
  prefixes: IpamPrefix[];
}) {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [showInfo, setShowInfo] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [tagResourceType, setTagResourceType] = useState('prefix');
  const [tagResourceId, setTagResourceId] = useState('');
  const [tagKey, setTagKey] = useState('');
  const [tagValue, setTagValue] = useState('');

  useEffect(() => {
    ipam.fetchAllTags();
  }, [ipam.fetchAllTags]);

  const handleCreate = useCallback(async () => {
    if (!tagKey.trim()) {
      addNotification('error', 'Tag key is required');
      return;
    }
    if (!tagResourceId.trim()) {
      addNotification('error', 'Resource ID is required');
      return;
    }
    const success = await ipam.setTag(tagResourceType, tagResourceId, tagKey.trim(), tagValue);
    if (success) {
      setShowForm(false);
      setTagKey('');
      setTagValue('');
      setTagResourceId('');
      ipam.fetchAllTags();
    }
  }, [tagKey, tagValue, tagResourceType, tagResourceId, ipam]);

  const handleDelete = useCallback(async (tag: IpamTag) => {
    if (!(await confirm({ title: 'Delete Tag', message: `Delete tag "${tag.key}" from ${tag.resource_type} ${tag.resource_id}?`, confirmText: 'Delete', destructive: true }))) return;
    const success = await ipam.deleteTag(tag.resource_type, tag.resource_id, tag.key);
    if (success) ipam.fetchAllTags();
  }, [ipam, confirm]);

  const prefixOptions = useMemo(() =>
    prefixes.map(p => ({ value: String(p.id), label: `${p.prefix} ${p.description ? '- ' + p.description : ''}` })),
  [prefixes]);

  const columns: TableColumn<IpamTag>[] = useMemo(() => [
    { header: 'Key', accessor: 'key' as keyof IpamTag, searchValue: (row: IpamTag) => row.key },
    { header: 'Value', accessor: 'value' as keyof IpamTag, searchValue: (row: IpamTag) => row.value },
    { header: 'Resource Type', accessor: 'resource_type' as keyof IpamTag, searchValue: (row: IpamTag) => row.resource_type },
    { header: 'Resource ID', accessor: (row: IpamTag) => {
      if (row.resource_type === 'prefix') {
        const p = prefixes.find(px => String(px.id) === row.resource_id);
        return p ? p.prefix : row.resource_id;
      }
      return row.resource_id;
    }, searchValue: (row: IpamTag) => {
      if (row.resource_type === 'prefix') {
        const p = prefixes.find(px => String(px.id) === row.resource_id);
        return `${row.resource_id} ${p?.prefix || ''}`;
      }
      return row.resource_id;
    }},
  ], [prefixes]);

  const actions: TableAction<IpamTag>[] = useMemo(() => [
    { icon: <TrashIcon size={14} />, label: 'Delete', onClick: handleDelete, variant: 'danger' as const },
  ], [handleDelete]);

  return (
    <>
      <Card
        title="Tags"
        titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
        headerAction={
          <Button variant="primary" onClick={() => { ipam.fetchTagKeys(); setShowForm(true); }}>
            <PlusIcon size={14} />
            Add Tag
          </Button>
        }
      >
        <InfoSection open={showInfo}>
          <p>Tags are key-value pairs attached to IPAM resources for flexible querying and filtering. Tags can be applied to prefixes and other IPAM objects.</p>
        </InfoSection>
        <LoadingState loading={ipam.allTagsLoading} loadingMessage="Loading tags...">
          <Table
            data={ipam.allTags}
            columns={columns}
            actions={actions}
            getRowKey={(row) => `${row.resource_type}-${row.resource_id}-${row.key}`}
            tableId="ipam-all-tags"
            emptyMessage="No tags defined."
            emptyDescription="Add tags to prefixes and other IPAM resources for flexible querying."
            searchable
            searchPlaceholder="Search tags..."
          />
        </LoadingState>
      </Card>

      <FormDialog isOpen={showForm} onClose={() => setShowForm(false)} title="Add Tag" onSubmit={(e) => { e.preventDefault(); handleCreate(); }} submitText="Add Tag">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SelectField label="Resource Type" name="resourceType" value={tagResourceType} onChange={(e) => { setTagResourceType(e.target.value); setTagResourceId(''); }} options={[{ value: 'prefix', label: 'Prefix' }]} />
          {tagResourceType === 'prefix' && (
            <SelectField label="Prefix" name="resourceId" value={tagResourceId} onChange={(e) => setTagResourceId(e.target.value)} options={[{ value: '', label: 'Select a prefix...' }, ...prefixOptions]} />
          )}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Key</label>
            <input
              list="ipam-all-tag-keys"
              value={tagKey}
              onChange={(e) => setTagKey(e.target.value)}
              placeholder="e.g., env, team"
              style={{ width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--input-bg, inherit)', color: 'inherit' }}
            />
            <datalist id="ipam-all-tag-keys">
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
