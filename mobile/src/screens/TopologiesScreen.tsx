import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { Topology, TopologyFormData, Device } from '../core';
import { useTopologies, useDevices, useIpam, EMPTY_TOPOLOGY_FORM, TOPOLOGY_ROLE_OPTIONS } from '../core';
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

export function TopologiesScreen() {
  const { colors } = useAppTheme();
  const { topologies, loading, error, refresh, createTopology, updateTopology, deleteTopology } = useTopologies();
  const { devices } = useDevices();
  const { regions, campuses, datacenters } = useIpam();

  const [showForm, setShowForm] = useState(false);
  const [editingTopo, setEditingTopo] = useState<Topology | null>(null);
  const [formData, setFormData] = useState<TopologyFormData>(EMPTY_TOPOLOGY_FORM);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const regionOptions = useMemo(() => [
    { value: '', label: 'None' },
    ...regions.map(r => ({ value: r.id, label: r.name })),
  ], [regions]);

  const campusOptions = useMemo(() => [
    { value: '', label: 'None' },
    ...campuses.filter(c => !formData.region_id || c.region_id === Number(formData.region_id)).map(c => ({ value: c.id, label: c.name })),
  ], [campuses, formData.region_id]);

  const dcOptions = useMemo(() => [
    { value: '', label: 'None' },
    ...datacenters.filter(d => !formData.campus_id || d.campus_id === Number(formData.campus_id)).map(d => ({ value: d.id, label: d.name })),
  ], [datacenters, formData.campus_id]);

  // Group devices by topology
  const topoDevices = useMemo(() => {
    const map: Record<string, Device[]> = {};
    devices.forEach(d => {
      if (d.topology_id) {
        if (!map[d.topology_id]) map[d.topology_id] = [];
        map[d.topology_id].push(d);
      }
    });
    return map;
  }, [devices]);

  const handleAdd = () => {
    setEditingTopo(null);
    setFormData(EMPTY_TOPOLOGY_FORM);
    setShowForm(true);
  };

  const handleEdit = (topo: Topology) => {
    setEditingTopo(topo);
    setFormData({
      id: topo.id,
      name: topo.name,
      description: topo.description || '',
      region_id: topo.region_id ?? '',
      campus_id: topo.campus_id ?? '',
      datacenter_id: topo.datacenter_id ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) { showError('Topology name is required'); return; }
    const { id, region_id, campus_id, datacenter_id, ...rest } = formData;
    const payload = {
      ...rest,
      region_id: region_id ? Number(region_id) : undefined,
      campus_id: campus_id ? Number(campus_id) : undefined,
      datacenter_id: datacenter_id ? Number(datacenter_id) : undefined,
    };
    const success = editingTopo
      ? await updateTopology(editingTopo.id, payload)
      : await createTopology({
          ...payload,
          id: id || formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        } as Partial<Topology>);
    if (success) { setShowForm(false); setEditingTopo(null); }
  };

  const handleDelete = (topo: Topology) => {
    confirmDelete({
      itemName: topo.name,
      itemType: 'topology',
      onConfirm: async () => { await deleteTopology(topo.id); },
    });
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'super-spine': return '#a855f7';
      case 'spine': return colors.accentBlue;
      case 'leaf': return colors.success;
      default: return colors.textMuted;
    }
  };

  const renderDevice = (device: Device) => (
    <View key={device.id} style={[styles.deviceRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.roleDot, { backgroundColor: getRoleColor(device.topology_role) }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.deviceName, { color: colors.textPrimary }]}>{device.hostname}</Text>
        <Text style={[styles.deviceMeta, { color: colors.textMuted }]}>{device.ip} - {device.vendor}</Text>
      </View>
      <View style={[styles.roleBadge, { backgroundColor: `${getRoleColor(device.topology_role)}20` }]}>
        <Text style={[styles.roleBadgeText, { color: getRoleColor(device.topology_role) }]}>
          {device.topology_role || 'unassigned'}
        </Text>
      </View>
    </View>
  );

  const renderTopology = ({ item }: { item: Topology }) => {
    const isExpanded = expandedId === item.id;
    const devs = topoDevices[item.id] || [];
    const spines = devs.filter(d => d.topology_role === 'spine').length;
    const leaves = devs.filter(d => d.topology_role === 'leaf').length;
    const superSpines = devs.filter(d => d.topology_role === 'super-spine').length;

    return (
      <Card style={styles.itemCard}>
        <Pressable onPress={() => setExpandedId(isExpanded ? null : item.id)}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.topoName, { color: colors.textPrimary }]}>{item.name}</Text>
              {item.description && (
                <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
              )}
            </View>
            <MaterialIcons
              name={isExpanded ? 'expand-less' : 'expand-more'}
              size={24}
              color={colors.textMuted}
            />
          </View>
          <View style={styles.countRow}>
            {superSpines > 0 && (
              <View style={[styles.countChip, { backgroundColor: '#a855f720' }]}>
                <Text style={[styles.countChipText, { color: '#a855f7' }]}>{superSpines} super-spine</Text>
              </View>
            )}
            <View style={[styles.countChip, { backgroundColor: `${colors.accentBlue}20` }]}>
              <Text style={[styles.countChipText, { color: colors.accentBlue }]}>{item.spine_count || spines} spine</Text>
            </View>
            <View style={[styles.countChip, { backgroundColor: `${colors.success}20` }]}>
              <Text style={[styles.countChipText, { color: colors.success }]}>{item.leaf_count || leaves} leaf</Text>
            </View>
            <View style={[styles.countChip, { backgroundColor: colors.bgSecondary }]}>
              <Text style={[styles.countChipText, { color: colors.textMuted }]}>{item.device_count || devs.length} total</Text>
            </View>
          </View>
        </Pressable>

        {isExpanded && (
          <View style={[styles.devicesSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Devices</Text>
            {devs.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No devices assigned</Text>
            ) : (
              devs.map(renderDevice)
            )}
          </View>
        )}

        <CardActions
          onEdit={() => handleEdit(item)}
          onDelete={() => handleDelete(item)}
        />
      </Card>
    );
  };

  if (loading) return <LoadingState message="Loading topologies..." />;
  if (error) return <ErrorState title="Error" message={error} primaryAction={{ label: 'Retry', onPress: refresh }} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.actions}>
        <Button title="Add Topology" onPress={handleAdd} icon="add" />
      </View>

      <FlatList
        data={topologies}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderTopology}
        ListEmptyComponent={<EmptyState message="No topologies" actionLabel="Add Topology" onAction={handleAdd} />}
        contentContainerStyle={topologies.length === 0 ? styles.emptyList : undefined}
      />

      <FormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditingTopo(null); }}
        onSubmit={handleSubmit}
        title={editingTopo ? 'Edit Topology' : 'Add Topology'}
        isEditing={!!editingTopo}
        size="medium"
      >
        <FormInput label="Name *" value={formData.name} onChangeText={t => setFormData(p => ({ ...p, name: t }))} placeholder="DC1 Fabric" />
        <FormInput label="ID" value={formData.id != null ? String(formData.id) : ''} onChangeText={t => setFormData(p => ({ ...p, id: t }))} placeholder="Auto-generated" editable={!editingTopo} />
        <FormInput label="Description" value={formData.description} onChangeText={t => setFormData(p => ({ ...p, description: t }))} placeholder="Datacenter 1 CLOS fabric" />
        <FormSelect label="Region" value={formData.region_id} options={regionOptions} onChange={v => setFormData(p => ({ ...p, region_id: v }))} />
        <FormSelect label="Campus" value={formData.campus_id} options={campusOptions} onChange={v => setFormData(p => ({ ...p, campus_id: v }))} />
        <FormSelect label="Datacenter" value={formData.datacenter_id} options={dcOptions} onChange={v => setFormData(p => ({ ...p, datacenter_id: v }))} />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  actions: { flexDirection: 'row', gap: 12, padding: 16 },
  itemCard: { marginHorizontal: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  topoName: { fontSize: 16, fontWeight: 'bold' },
  description: { fontSize: 13, marginTop: 2 },
  countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  countChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  countChipText: { fontSize: 11, fontWeight: '500' },
  devicesSection: { borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, gap: 8 },
  roleDot: { width: 8, height: 8, borderRadius: 4 },
  deviceName: { fontSize: 14, fontWeight: '500' },
  deviceMeta: { fontSize: 12 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  roleBadgeText: { fontSize: 11, fontWeight: '500' },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  emptyList: { flex: 1, justifyContent: 'center' },
});
