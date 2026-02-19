import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type {
  IpamRegion, IpamCampus, IpamDatacenter, IpamHall, IpamRow, IpamRack,
  IpamRegionFormData, IpamCampusFormData, IpamDatacenterFormData,
  IpamHallFormData, IpamRowFormData, IpamRackFormData,
} from '../core';
import { useIpam } from '../core';
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

type Tab = 'regions' | 'campuses' | 'datacenters' | 'halls' | 'rows' | 'racks';

const TABS: { key: Tab; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { key: 'regions', label: 'Regions', icon: 'public' },
  { key: 'campuses', label: 'Campuses', icon: 'location-city' },
  { key: 'datacenters', label: 'DCs', icon: 'dns' },
  { key: 'halls', label: 'Halls', icon: 'meeting-room' },
  { key: 'rows', label: 'Rows', icon: 'view-column' },
  { key: 'racks', label: 'Racks', icon: 'storage' },
];

export function LocationsScreen() {
  const { colors } = useAppTheme();
  const {
    regions, campuses, datacenters, halls, rows, racks,
    loading, error, refresh,
    createRegion, updateRegion, deleteRegion,
    createCampus, updateCampus, deleteCampus,
    createDatacenter, updateDatacenter, deleteDatacenter,
    createHall, updateHall, deleteHall,
    createRow, updateRow, deleteRow,
    createRack, updateRack, deleteRack,
  } = useIpam();

  const [activeTab, setActiveTab] = useState<Tab>('regions');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [regionForm, setRegionForm] = useState<IpamRegionFormData>({ id: '', name: '', description: '' });
  const [campusForm, setCampusForm] = useState<IpamCampusFormData>({ id: '', name: '', description: '', region_id: '' });
  const [dcForm, setDcForm] = useState<IpamDatacenterFormData>({ id: '', name: '', description: '', campus_id: '' });
  const [hallForm, setHallForm] = useState<IpamHallFormData>({ id: '', name: '', description: '', datacenter_id: '' });
  const [rowForm, setRowForm] = useState<IpamRowFormData>({ id: '', name: '', description: '', hall_id: '' });
  const [rackForm, setRackForm] = useState<IpamRackFormData>({ id: '', name: '', description: '', row_id: '' });

  const regionOptions = useMemo(() => regions.map(r => ({ value: String(r.id), label: r.name })), [regions]);
  const campusOptions = useMemo(() => campuses.map(c => ({ value: String(c.id), label: c.name })), [campuses]);
  const dcOptions = useMemo(() => datacenters.map(d => ({ value: String(d.id), label: d.name })), [datacenters]);
  const hallOptions = useMemo(() => halls.map(h => ({ value: String(h.id), label: h.name })), [halls]);
  const rowOptions = useMemo(() => rows.map(r => ({ value: String(r.id), label: r.name })), [rows]);

  const handleAdd = () => {
    setEditingId(null);
    switch (activeTab) {
      case 'regions': setRegionForm({ id: '', name: '', description: '' }); break;
      case 'campuses': setCampusForm({ id: '', name: '', description: '', region_id: '' }); break;
      case 'datacenters': setDcForm({ id: '', name: '', description: '', campus_id: '' }); break;
      case 'halls': setHallForm({ id: '', name: '', description: '', datacenter_id: '' }); break;
      case 'rows': setRowForm({ id: '', name: '', description: '', hall_id: '' }); break;
      case 'racks': setRackForm({ id: '', name: '', description: '', row_id: '' }); break;
    }
    setShowForm(true);
  };

  const handleClose = () => { setShowForm(false); setEditingId(null); };

  const autoId = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '-');

  const handleSubmit = async () => {
    let success = false;
    switch (activeTab) {
      case 'regions':
        if (!regionForm.name.trim()) { showError('Name is required'); return; }
        success = editingId
          ? await updateRegion(editingId, regionForm)
          : await createRegion({ ...regionForm, id: regionForm.id || autoId(regionForm.name) });
        break;
      case 'campuses':
        if (!campusForm.name.trim() || !campusForm.region_id) { showError('Name and region are required'); return; }
        success = editingId
          ? await updateCampus(editingId, campusForm)
          : await createCampus({ ...campusForm, id: campusForm.id || autoId(campusForm.name) });
        break;
      case 'datacenters':
        if (!dcForm.name.trim() || !dcForm.campus_id) { showError('Name and campus are required'); return; }
        success = editingId
          ? await updateDatacenter(editingId, dcForm)
          : await createDatacenter({ ...dcForm, id: dcForm.id || autoId(dcForm.name) });
        break;
      case 'halls':
        if (!hallForm.name.trim() || !hallForm.datacenter_id) { showError('Name and datacenter are required'); return; }
        success = editingId
          ? await updateHall(editingId, hallForm)
          : await createHall({ ...hallForm, id: hallForm.id || autoId(hallForm.name) });
        break;
      case 'rows':
        if (!rowForm.name.trim() || !rowForm.hall_id) { showError('Name and hall are required'); return; }
        success = editingId
          ? await updateRow(editingId, rowForm)
          : await createRow({ ...rowForm, id: rowForm.id || autoId(rowForm.name) });
        break;
      case 'racks':
        if (!rackForm.name.trim() || !rackForm.row_id) { showError('Name and row are required'); return; }
        success = editingId
          ? await updateRack(editingId, rackForm)
          : await createRack({ ...rackForm, id: rackForm.id || autoId(rackForm.name) });
        break;
    }
    if (success) handleClose();
  };

  const handleEdit = (item: any) => {
    setEditingId(String(item.id));
    switch (activeTab) {
      case 'regions': setRegionForm({ id: String(item.id), name: item.name, description: item.description || '' }); break;
      case 'campuses': setCampusForm({ id: String(item.id), name: item.name, description: item.description || '', region_id: String(item.region_id) }); break;
      case 'datacenters': setDcForm({ id: String(item.id), name: item.name, description: item.description || '', campus_id: String(item.campus_id) }); break;
      case 'halls': setHallForm({ id: String(item.id), name: item.name, description: item.description || '', datacenter_id: String(item.datacenter_id) }); break;
      case 'rows': setRowForm({ id: String(item.id), name: item.name, description: item.description || '', hall_id: String(item.hall_id) }); break;
      case 'racks': setRackForm({ id: String(item.id), name: item.name, description: item.description || '', row_id: String(item.row_id) }); break;
    }
    setShowForm(true);
  };

  const handleDelete = (item: any) => {
    const deleteFns: Record<Tab, (id: string) => Promise<boolean>> = {
      regions: deleteRegion, campuses: deleteCampus, datacenters: deleteDatacenter,
      halls: deleteHall, rows: deleteRow, racks: deleteRack,
    };
    confirmDelete({
      itemName: item.name,
      itemType: activeTab.slice(0, -1),
      onConfirm: async () => { await deleteFns[activeTab](item.id); },
    });
  };

  const DetailRow = ({ label, value }: { label: string; value?: string | number }) => {
    if (value == null || value === '') return null;
    return (
      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: colors.textSecondary }]}>{value}</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const childCount = item.campus_count ?? item.datacenter_count ?? item.hall_count ?? item.row_count ?? item.rack_count ?? item.device_count;
    const childLabel = activeTab === 'regions' ? 'campuses' : activeTab === 'campuses' ? 'datacenters' : activeTab === 'datacenters' ? 'halls' : activeTab === 'halls' ? 'rows' : activeTab === 'rows' ? 'racks' : 'devices';
    const parentName = item.region_name || item.campus_name || item.datacenter_name || item.hall_name || item.row_name;

    return (
      <Card style={styles.itemCard}>
        <View style={styles.cardHeader}>
          <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.name}</Text>
          {childCount != null && (
            <View style={[styles.countBadge, { backgroundColor: colors.bgSecondary }]}>
              <Text style={[styles.countText, { color: colors.accentBlue }]}>
                {childCount} {childLabel}
              </Text>
            </View>
          )}
        </View>
        {item.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
        )}
        {parentName && <DetailRow label="Parent" value={parentName} />}
        <DetailRow label="ID" value={item.id} />
        <CardActions
          onEdit={() => handleEdit(item)}
          onDelete={() => handleDelete(item)}
        />
      </Card>
    );
  };

  if (loading) return <LoadingState message="Loading locations..." />;
  if (error) return <ErrorState title="Error" message={error} primaryAction={{ label: 'Retry', onPress: refresh }} />;

  const dataMap: Record<Tab, any[]> = {
    regions, campuses, datacenters, halls, rows, racks,
  };

  const formTitle = editingId ? `Edit ${activeTab.slice(0, -1)}` : `Add ${activeTab.slice(0, -1)}`;

  const renderForm = () => {
    switch (activeTab) {
      case 'regions':
        return <>
          <FormInput label="Name *" value={regionForm.name} onChangeText={t => setRegionForm(p => ({ ...p, name: t }))} placeholder="US East" />
          <FormInput label="ID" value={regionForm.id} onChangeText={t => setRegionForm(p => ({ ...p, id: t }))} placeholder="Auto-generated" editable={!editingId} />
          <FormInput label="Description" value={regionForm.description} onChangeText={t => setRegionForm(p => ({ ...p, description: t }))} placeholder="Eastern US region" />
        </>;
      case 'campuses':
        return <>
          <FormInput label="Name *" value={campusForm.name} onChangeText={t => setCampusForm(p => ({ ...p, name: t }))} placeholder="Main Campus" />
          <FormSelect label="Region *" value={campusForm.region_id} options={regionOptions} onChange={v => setCampusForm(p => ({ ...p, region_id: v }))} />
          <FormInput label="ID" value={campusForm.id} onChangeText={t => setCampusForm(p => ({ ...p, id: t }))} placeholder="Auto-generated" editable={!editingId} />
          <FormInput label="Description" value={campusForm.description} onChangeText={t => setCampusForm(p => ({ ...p, description: t }))} />
        </>;
      case 'datacenters':
        return <>
          <FormInput label="Name *" value={dcForm.name} onChangeText={t => setDcForm(p => ({ ...p, name: t }))} placeholder="DC-1" />
          <FormSelect label="Campus *" value={dcForm.campus_id} options={campusOptions} onChange={v => setDcForm(p => ({ ...p, campus_id: v }))} />
          <FormInput label="ID" value={dcForm.id} onChangeText={t => setDcForm(p => ({ ...p, id: t }))} placeholder="Auto-generated" editable={!editingId} />
          <FormInput label="Description" value={dcForm.description} onChangeText={t => setDcForm(p => ({ ...p, description: t }))} />
        </>;
      case 'halls':
        return <>
          <FormInput label="Name *" value={hallForm.name} onChangeText={t => setHallForm(p => ({ ...p, name: t }))} placeholder="Hall A" />
          <FormSelect label="Datacenter *" value={hallForm.datacenter_id} options={dcOptions} onChange={v => setHallForm(p => ({ ...p, datacenter_id: v }))} />
          <FormInput label="ID" value={hallForm.id} onChangeText={t => setHallForm(p => ({ ...p, id: t }))} placeholder="Auto-generated" editable={!editingId} />
          <FormInput label="Description" value={hallForm.description} onChangeText={t => setHallForm(p => ({ ...p, description: t }))} />
        </>;
      case 'rows':
        return <>
          <FormInput label="Name *" value={rowForm.name} onChangeText={t => setRowForm(p => ({ ...p, name: t }))} placeholder="Row 1" />
          <FormSelect label="Hall *" value={rowForm.hall_id} options={hallOptions} onChange={v => setRowForm(p => ({ ...p, hall_id: v }))} />
          <FormInput label="ID" value={rowForm.id} onChangeText={t => setRowForm(p => ({ ...p, id: t }))} placeholder="Auto-generated" editable={!editingId} />
          <FormInput label="Description" value={rowForm.description} onChangeText={t => setRowForm(p => ({ ...p, description: t }))} />
        </>;
      case 'racks':
        return <>
          <FormInput label="Name *" value={rackForm.name} onChangeText={t => setRackForm(p => ({ ...p, name: t }))} placeholder="Rack A1" />
          <FormSelect label="Row *" value={rackForm.row_id} options={rowOptions} onChange={v => setRackForm(p => ({ ...p, row_id: v }))} />
          <FormInput label="ID" value={rackForm.id} onChangeText={t => setRackForm(p => ({ ...p, id: t }))} placeholder="Auto-generated" editable={!editingId} />
          <FormInput label="Description" value={rackForm.description} onChangeText={t => setRackForm(p => ({ ...p, description: t }))} />
        </>;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Tab bar - scrollable for 6 tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: colors.accentBlue, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <MaterialIcons name={tab.icon} size={16} color={activeTab === tab.key ? colors.accentBlue : colors.textMuted} />
            <Text style={[styles.tabLabel, { color: activeTab === tab.key ? colors.accentBlue : colors.textMuted }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Button title={`Add ${activeTab.slice(0, -1)}`} onPress={handleAdd} icon="add" />
      </View>

      <FlatList
        data={dataMap[activeTab]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            message={`No ${activeTab}`}
            actionLabel={`Add ${activeTab.slice(0, -1)}`}
            onAction={handleAdd}
          />
        }
        contentContainerStyle={dataMap[activeTab].length === 0 ? styles.emptyList : undefined}
      />

      <FormModal
        visible={showForm}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={formTitle}
        isEditing={!!editingId}
        size="medium"
      >
        {renderForm()}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, padding: 16 },
  itemCard: { marginHorizontal: 16, marginBottom: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  countText: { fontSize: 12 },
  description: { fontSize: 13, marginBottom: 8 },
  detailRow: { flexDirection: 'row', marginBottom: 4 },
  detailLabel: { fontSize: 12, width: 80 },
  detailValue: { fontSize: 12, flex: 1 },
  emptyList: { flex: 1, justifyContent: 'center' },
});
