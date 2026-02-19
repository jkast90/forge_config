import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type {
  IpamPrefix,
  IpamIpAddress,
  IpamVrf,
  IpamRole,
  IpamPrefixFormData,
  IpamIpAddressFormData,
  IpamStatus,
} from '../core';
import {
  useIpam,
  EMPTY_IPAM_PREFIX_FORM,
  EMPTY_IPAM_IP_FORM,
  IPAM_STATUS_OPTIONS,
  IPAM_IP_STATUS_OPTIONS,
} from '../core';
import {
  Card,
  Button,
  EmptyState,
  LoadingState,
  ErrorState,
  CardActions,
  FormModal,
  FormInput,
  FormSelect,
} from '../components';
import { confirmDelete, showError } from '../utils';
import { useAppTheme } from '../context';

type Tab = 'prefixes' | 'ips' | 'vrfs' | 'roles';

const TABS: { key: Tab; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'prefixes', label: 'Prefixes', icon: 'account-tree' },
  { key: 'ips', label: 'IPs', icon: 'pin-drop' },
  { key: 'vrfs', label: 'VRFs', icon: 'layers' },
  { key: 'roles', label: 'Roles', icon: 'label' },
];

function StatusDot({ status }: { status: IpamStatus }) {
  const { colors } = useAppTheme();
  const dotColor = status === 'active' ? colors.success
    : status === 'reserved' ? colors.accentBlue
    : status === 'dhcp' ? colors.accentCyan
    : colors.textMuted;
  return <View style={[styles.statusDot, { backgroundColor: dotColor }]} />;
}

export function IpamScreen() {
  const { colors } = useAppTheme();
  const {
    prefixes, ipAddresses, vrfs, roles, datacenters,
    loading, error, refresh,
    createPrefix, updatePrefix, deletePrefix,
    nextAvailablePrefix, nextAvailableIp,
    createIpAddress, updateIpAddress, deleteIpAddress,
    createVrf, deleteVrf,
    createRole, deleteRole,
  } = useIpam();

  const [activeTab, setActiveTab] = useState<Tab>('prefixes');

  // Prefix form
  const [showPrefixForm, setShowPrefixForm] = useState(false);
  const [editingPrefix, setEditingPrefix] = useState<IpamPrefix | null>(null);
  const [prefixForm, setPrefixForm] = useState<IpamPrefixFormData>(EMPTY_IPAM_PREFIX_FORM);

  // IP form
  const [showIpForm, setShowIpForm] = useState(false);
  const [editingIp, setEditingIp] = useState<IpamIpAddress | null>(null);
  const [ipForm, setIpForm] = useState<IpamIpAddressFormData>(EMPTY_IPAM_IP_FORM);

  // VRF form
  const [showVrfForm, setShowVrfForm] = useState(false);
  const [vrfForm, setVrfForm] = useState({ name: '', rd: '', description: '' });

  // Role form
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [roleForm, setRoleForm] = useState({ id: '', name: '', description: '' });

  // Allocate form
  const [showAllocateForm, setShowAllocateForm] = useState(false);
  const [allocateMode, setAllocateMode] = useState<'prefix' | 'ip'>('prefix');
  const [allocateParentId, setAllocateParentId] = useState<number>(0);
  const [allocatePrefixLength, setAllocatePrefixLength] = useState('24');
  const [allocateDescription, setAllocateDescription] = useState('');

  const parentPrefixOptions = useMemo(() => [
    { value: '', label: 'None (top-level)' },
    ...prefixes.filter(p => p.is_supernet).map(p => ({ value: p.id.toString(), label: p.prefix })),
  ], [prefixes]);

  const dcOptions = useMemo(() => [
    { value: '', label: 'None' },
    ...datacenters.map(d => ({ value: String(d.id), label: d.name })),
  ], [datacenters]);

  const vrfOptions = useMemo(() => [
    { value: '', label: 'None' },
    ...vrfs.map(v => ({ value: String(v.id), label: v.name })),
  ], [vrfs]);

  const roleOptions = useMemo(() =>
    roles.map(r => ({ value: String(r.id), label: r.name })),
  [roles]);

  const prefixOptions = useMemo(() => [
    { value: '', label: 'Select prefix...' },
    ...prefixes.map(p => ({ value: p.id.toString(), label: p.prefix })),
  ], [prefixes]);

  // Prefix CRUD
  const handleAddPrefix = () => {
    setEditingPrefix(null);
    setPrefixForm(EMPTY_IPAM_PREFIX_FORM);
    setShowPrefixForm(true);
  };

  const handleEditPrefix = (p: IpamPrefix) => {
    setEditingPrefix(p);
    setPrefixForm({
      prefix: p.prefix,
      description: p.description || '',
      status: p.status,
      is_supernet: p.is_supernet,
      role_ids: p.role_ids || [],
      parent_id: p.parent_id?.toString() || '',
      datacenter_id: p.datacenter_id ? String(p.datacenter_id) : '',
      vlan_id: p.vlan_id?.toString() || '',
      vrf_id: p.vrf_id ? String(p.vrf_id) : '',
    });
    setShowPrefixForm(true);
  };

  const handleSubmitPrefix = async () => {
    if (!prefixForm.prefix.trim()) { showError('Prefix is required'); return; }
    const success = editingPrefix
      ? await updatePrefix(editingPrefix.id, prefixForm)
      : await createPrefix(prefixForm);
    if (success) { setShowPrefixForm(false); setEditingPrefix(null); }
  };

  const handleDeletePrefix = (p: IpamPrefix) => {
    confirmDelete({
      itemName: p.prefix,
      itemType: 'prefix',
      onConfirm: async () => { await deletePrefix(p.id); },
    });
  };

  const handleAllocatePrefix = (parentId: number) => {
    setAllocateMode('prefix');
    setAllocateParentId(parentId);
    setAllocatePrefixLength('24');
    setAllocateDescription('');
    setShowAllocateForm(true);
  };

  const handleAllocateIp = (prefixId: number) => {
    setAllocateMode('ip');
    setAllocateParentId(prefixId);
    setAllocateDescription('');
    setShowAllocateForm(true);
  };

  const handleSubmitAllocate = async () => {
    if (allocateMode === 'prefix') {
      const result = await nextAvailablePrefix(allocateParentId, parseInt(allocatePrefixLength, 10), {
        description: allocateDescription || undefined,
      });
      if (result) setShowAllocateForm(false);
    } else {
      const result = await nextAvailableIp(allocateParentId, {
        description: allocateDescription || undefined,
      });
      if (result) setShowAllocateForm(false);
    }
  };

  // IP CRUD
  const handleAddIp = () => {
    setEditingIp(null);
    setIpForm(EMPTY_IPAM_IP_FORM);
    setShowIpForm(true);
  };

  const handleEditIp = (ip: IpamIpAddress) => {
    setEditingIp(ip);
    setIpForm({
      id: ip.id,
      address: ip.address,
      prefix_id: ip.prefix_id.toString(),
      description: ip.description || '',
      status: ip.status,
      role_ids: ip.role_ids || [],
      dns_name: ip.dns_name || '',
      device_id: ip.device_id != null ? String(ip.device_id) : '',
      interface_name: ip.interface_name || '',
      vrf_id: ip.vrf_id ? String(ip.vrf_id) : '',
    });
    setShowIpForm(true);
  };

  const handleSubmitIp = async () => {
    if (!ipForm.address.trim()) { showError('Address is required'); return; }
    const success = editingIp
      ? await updateIpAddress(editingIp.id, ipForm)
      : await createIpAddress(ipForm);
    if (success) { setShowIpForm(false); setEditingIp(null); }
  };

  const handleDeleteIp = (ip: IpamIpAddress) => {
    confirmDelete({
      itemName: ip.address,
      itemType: 'IP address',
      onConfirm: async () => { await deleteIpAddress(ip.id); },
    });
  };

  // VRF CRUD
  const handleSubmitVrf = async () => {
    if (!vrfForm.name.trim()) { showError('VRF name is required'); return; }
    const success = await createVrf({
      name: vrfForm.name,
      rd: vrfForm.rd || undefined,
      description: vrfForm.description || undefined,
    });
    if (success) { setShowVrfForm(false); setVrfForm({ name: '', rd: '', description: '' }); }
  };

  // Role CRUD
  const handleSubmitRole = async () => {
    if (!roleForm.name.trim()) { showError('Role name is required'); return; }
    const success = await createRole({
      id: roleForm.id || roleForm.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      name: roleForm.name,
      description: roleForm.description || undefined,
    });
    if (success) { setShowRoleForm(false); setRoleForm({ id: '', name: '', description: '' }); }
  };

  // Utilization bar
  const UtilBar = ({ value }: { value?: number }) => {
    const pct = value ?? 0;
    const barColor = pct > 80 ? colors.error : pct > 50 ? '#f59e0b' : colors.success;
    return (
      <View style={[styles.utilBar, { backgroundColor: colors.bgSecondary }]}>
        <View style={[styles.utilFill, { width: `${pct}%`, backgroundColor: barColor }]} />
        <Text style={[styles.utilText, { color: colors.textMuted }]}>{pct}%</Text>
      </View>
    );
  };

  const renderPrefix = ({ item }: { item: IpamPrefix }) => (
    <Card style={styles.itemCard}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <StatusDot status={item.status} />
          <Text style={[styles.itemTitle, { color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
            {item.prefix}
          </Text>
          {item.is_supernet && (
            <View style={[styles.badge, { backgroundColor: `${colors.accentBlue}20` }]}>
              <Text style={[styles.badgeText, { color: colors.accentBlue }]}>Supernet</Text>
            </View>
          )}
        </View>
        <Text style={[styles.statusText, { color: colors.textMuted }]}>{item.status}</Text>
      </View>
      {item.description && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
      )}
      <View style={styles.metaRow}>
        {item.datacenter_name && (
          <Text style={[styles.metaText, { color: colors.textMuted }]}>DC: {item.datacenter_name}</Text>
        )}
        {item.vrf_name && (
          <Text style={[styles.metaText, { color: colors.textMuted }]}>VRF: {item.vrf_name}</Text>
        )}
        {item.vlan_id != null && (
          <Text style={[styles.metaText, { color: colors.textMuted }]}>VLAN: {item.vlan_id}</Text>
        )}
      </View>
      {item.role_names && item.role_names.length > 0 && (
        <View style={styles.rolesRow}>
          {item.role_names.map(r => (
            <View key={r} style={[styles.roleBadge, { backgroundColor: `${colors.accentCyan}20` }]}>
              <Text style={[styles.roleBadgeText, { color: colors.accentCyan }]}>{r}</Text>
            </View>
          ))}
        </View>
      )}
      <UtilBar value={item.utilization} />
      <View style={styles.statsRow}>
        <Text style={[styles.statText, { color: colors.textMuted }]}>
          {item.child_prefix_count || 0} children
        </Text>
        <Text style={[styles.statText, { color: colors.textMuted }]}>
          {item.ip_address_count || 0} IPs
        </Text>
      </View>
      <View style={styles.actionRow}>
        {item.is_supernet && (
          <Pressable
            style={[styles.actionBtn, { backgroundColor: `${colors.success}15` }]}
            onPress={() => handleAllocatePrefix(item.id)}
          >
            <MaterialIcons name="add-circle-outline" size={16} color={colors.success} />
            <Text style={[styles.actionBtnText, { color: colors.success }]}>Next Prefix</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.actionBtn, { backgroundColor: `${colors.accentBlue}15` }]}
          onPress={() => handleAllocateIp(item.id)}
        >
          <MaterialIcons name="add-circle-outline" size={16} color={colors.accentBlue} />
          <Text style={[styles.actionBtnText, { color: colors.accentBlue }]}>Next IP</Text>
        </Pressable>
      </View>
      <CardActions
        onEdit={() => handleEditPrefix(item)}
        onDelete={() => handleDeletePrefix(item)}
      />
    </Card>
  );

  const renderIp = ({ item }: { item: IpamIpAddress }) => (
    <Card style={styles.itemCard}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <StatusDot status={item.status} />
          <Text style={[styles.itemTitle, { color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
            {item.address}
          </Text>
        </View>
        <Text style={[styles.statusText, { color: colors.textMuted }]}>{item.status}</Text>
      </View>
      {item.description && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
      )}
      <View style={styles.metaRow}>
        {item.prefix && <Text style={[styles.metaText, { color: colors.textMuted }]}>Prefix: {item.prefix}</Text>}
        {item.dns_name && <Text style={[styles.metaText, { color: colors.textMuted }]}>DNS: {item.dns_name}</Text>}
        {item.device_hostname && <Text style={[styles.metaText, { color: colors.textMuted }]}>Device: {item.device_hostname}</Text>}
        {item.interface_name && <Text style={[styles.metaText, { color: colors.textMuted }]}>Interface: {item.interface_name}</Text>}
        {item.vrf_name && <Text style={[styles.metaText, { color: colors.textMuted }]}>VRF: {item.vrf_name}</Text>}
      </View>
      <CardActions
        onEdit={() => handleEditIp(item)}
        onDelete={() => handleDeleteIp(item)}
      />
    </Card>
  );

  const renderVrf = ({ item }: { item: IpamVrf }) => (
    <Card style={styles.itemCard}>
      <View style={styles.cardHeader}>
        <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.name}</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.bgSecondary }]}>
          <Text style={[styles.countText, { color: colors.accentBlue }]}>{item.prefix_count || 0} prefixes</Text>
        </View>
      </View>
      {item.rd && <Text style={[styles.metaText, { color: colors.textMuted }]}>RD: {item.rd}</Text>}
      {item.description && <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>}
      <CardActions
        onDelete={() => confirmDelete({ itemName: item.name, itemType: 'VRF', onConfirm: async () => { await deleteVrf(item.id); } })}
      />
    </Card>
  );

  const renderRole = ({ item }: { item: IpamRole }) => (
    <Card style={styles.itemCard}>
      <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.name}</Text>
      {item.description && <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>}
      <CardActions
        onDelete={() => confirmDelete({ itemName: item.name, itemType: 'role', onConfirm: async () => { await deleteRole(item.id); } })}
      />
    </Card>
  );

  if (loading) return <LoadingState message="Loading IPAM data..." />;
  if (error) return <ErrorState title="Error" message={error} primaryAction={{ label: 'Retry', onPress: refresh }} />;

  const tabData = {
    prefixes: { data: prefixes, render: renderPrefix, empty: 'No prefixes', add: handleAddPrefix, addLabel: 'Add Prefix' },
    ips: { data: ipAddresses, render: renderIp, empty: 'No IP addresses', add: handleAddIp, addLabel: 'Add IP' },
    vrfs: { data: vrfs, render: renderVrf, empty: 'No VRFs', add: () => { setVrfForm({ name: '', rd: '', description: '' }); setShowVrfForm(true); }, addLabel: 'Add VRF' },
    roles: { data: roles, render: renderRole, empty: 'No roles', add: () => { setRoleForm({ id: '', name: '', description: '' }); setShowRoleForm(true); }, addLabel: 'Add Role' },
  };

  const current = tabData[activeTab];

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: colors.accentBlue, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <MaterialIcons name={tab.icon} size={18} color={activeTab === tab.key ? colors.accentBlue : colors.textMuted} />
            <Text style={[styles.tabLabel, { color: activeTab === tab.key ? colors.accentBlue : colors.textMuted }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button title={current.addLabel} onPress={current.add} icon="add" />
      </View>

      {/* List */}
      <FlatList
        data={current.data as any[]}
        keyExtractor={(item) => (item.id ?? '').toString()}
        renderItem={current.render as any}
        ListEmptyComponent={<EmptyState message={current.empty} actionLabel={current.addLabel} onAction={current.add} />}
        contentContainerStyle={current.data.length === 0 ? styles.emptyList : undefined}
      />

      {/* Prefix Form */}
      <FormModal
        visible={showPrefixForm}
        onClose={() => { setShowPrefixForm(false); setEditingPrefix(null); }}
        onSubmit={handleSubmitPrefix}
        title={editingPrefix ? 'Edit Prefix' : 'Add Prefix'}
        isEditing={!!editingPrefix}
        size="large"
      >
        <FormInput label="Prefix *" value={prefixForm.prefix} onChangeText={t => setPrefixForm(p => ({ ...p, prefix: t }))} placeholder="10.0.0.0/24" />
        <FormInput label="Description" value={prefixForm.description} onChangeText={t => setPrefixForm(p => ({ ...p, description: t }))} placeholder="Management network" />
        <FormSelect label="Status" value={prefixForm.status} options={IPAM_STATUS_OPTIONS as any} onChange={v => setPrefixForm(p => ({ ...p, status: v as IpamStatus }))} />
        <FormSelect label="Parent Prefix" value={prefixForm.parent_id} options={parentPrefixOptions} onChange={v => setPrefixForm(p => ({ ...p, parent_id: v }))} />
        <FormSelect label="Datacenter" value={prefixForm.datacenter_id} options={dcOptions} onChange={v => setPrefixForm(p => ({ ...p, datacenter_id: v }))} />
        <FormSelect label="VRF" value={prefixForm.vrf_id} options={vrfOptions} onChange={v => setPrefixForm(p => ({ ...p, vrf_id: v }))} />
        <FormInput label="VLAN ID" value={prefixForm.vlan_id} onChangeText={t => setPrefixForm(p => ({ ...p, vlan_id: t }))} placeholder="100" keyboardType="number-pad" />
      </FormModal>

      {/* IP Address Form */}
      <FormModal
        visible={showIpForm}
        onClose={() => { setShowIpForm(false); setEditingIp(null); }}
        onSubmit={handleSubmitIp}
        title={editingIp ? 'Edit IP Address' : 'Add IP Address'}
        isEditing={!!editingIp}
        size="large"
      >
        <FormInput label="Address *" value={ipForm.address} onChangeText={t => setIpForm(p => ({ ...p, address: t }))} placeholder="10.0.0.1" />
        <FormSelect label="Prefix" value={ipForm.prefix_id} options={prefixOptions} onChange={v => setIpForm(p => ({ ...p, prefix_id: v }))} />
        <FormSelect label="Status" value={ipForm.status} options={IPAM_IP_STATUS_OPTIONS as any} onChange={v => setIpForm(p => ({ ...p, status: v as IpamStatus }))} />
        <FormInput label="Description" value={ipForm.description} onChangeText={t => setIpForm(p => ({ ...p, description: t }))} placeholder="Loopback" />
        <FormInput label="DNS Name" value={ipForm.dns_name} onChangeText={t => setIpForm(p => ({ ...p, dns_name: t }))} placeholder="host.example.com" />
        <FormInput label="Device ID" value={ipForm.device_id} onChangeText={t => setIpForm(p => ({ ...p, device_id: t }))} placeholder="Device MAC" />
        <FormInput label="Interface" value={ipForm.interface_name} onChangeText={t => setIpForm(p => ({ ...p, interface_name: t }))} placeholder="eth0" />
        <FormSelect label="VRF" value={ipForm.vrf_id} options={vrfOptions} onChange={v => setIpForm(p => ({ ...p, vrf_id: v }))} />
      </FormModal>

      {/* VRF Form */}
      <FormModal
        visible={showVrfForm}
        onClose={() => setShowVrfForm(false)}
        onSubmit={handleSubmitVrf}
        title="Add VRF"
        size="medium"
      >
        <FormInput label="Name *" value={vrfForm.name} onChangeText={t => setVrfForm(p => ({ ...p, name: t }))} placeholder="MGMT" />
        <FormInput label="Route Distinguisher" value={vrfForm.rd} onChangeText={t => setVrfForm(p => ({ ...p, rd: t }))} placeholder="65000:1" />
        <FormInput label="Description" value={vrfForm.description} onChangeText={t => setVrfForm(p => ({ ...p, description: t }))} placeholder="Management VRF" />
      </FormModal>

      {/* Role Form */}
      <FormModal
        visible={showRoleForm}
        onClose={() => setShowRoleForm(false)}
        onSubmit={handleSubmitRole}
        title="Add Role"
        size="medium"
      >
        <FormInput label="Name *" value={roleForm.name} onChangeText={t => setRoleForm(p => ({ ...p, name: t }))} placeholder="Loopback" />
        <FormInput label="ID" value={roleForm.id} onChangeText={t => setRoleForm(p => ({ ...p, id: t }))} placeholder="Auto-generated" />
        <FormInput label="Description" value={roleForm.description} onChangeText={t => setRoleForm(p => ({ ...p, description: t }))} placeholder="Loopback addresses" />
      </FormModal>

      {/* Allocate Form */}
      <FormModal
        visible={showAllocateForm}
        onClose={() => setShowAllocateForm(false)}
        onSubmit={handleSubmitAllocate}
        title={allocateMode === 'prefix' ? 'Allocate Next Prefix' : 'Allocate Next IP'}
        submitText="Allocate"
        size="small"
      >
        {allocateMode === 'prefix' && (
          <FormInput
            label="Prefix Length"
            value={allocatePrefixLength}
            onChangeText={setAllocatePrefixLength}
            placeholder="24"
            keyboardType="number-pad"
          />
        )}
        <FormInput
          label="Description"
          value={allocateDescription}
          onChangeText={setAllocateDescription}
          placeholder="Optional description"
        />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, padding: 16 },
  itemCard: { marginHorizontal: 16, marginBottom: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },
  statusText: { fontSize: 12, textTransform: 'capitalize' },
  description: { fontSize: 13, marginBottom: 8 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  metaText: { fontSize: 12 },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  roleBadgeText: { fontSize: 11, fontWeight: '500' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '500' },
  countBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  countText: { fontSize: 12 },
  utilBar: { height: 6, borderRadius: 3, marginBottom: 8, overflow: 'hidden', flexDirection: 'row', alignItems: 'center' },
  utilFill: { height: '100%', borderRadius: 3 },
  utilText: { fontSize: 10, marginLeft: 4, position: 'absolute', right: 0 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  statText: { fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionBtnText: { fontSize: 12, fontWeight: '500' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  emptyList: { flex: 1, justifyContent: 'center' },
});
