import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { DeviceModel, DeviceModelFormData } from '../core';
import { useDeviceModels, useVendors, getVendorName, EMPTY_DEVICE_MODEL_FORM } from '../core';
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

export function DeviceModelsScreen() {
  const { colors } = useAppTheme();
  const { deviceModels, loading, error, refresh, createDeviceModel, updateDeviceModel, deleteDeviceModel } = useDeviceModels();
  const { vendors } = useVendors();

  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState<DeviceModel | null>(null);
  const [formData, setFormData] = useState<DeviceModelFormData>(EMPTY_DEVICE_MODEL_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const vendorOptions = useMemo(() => [
    { value: '', label: 'Select vendor...' },
    ...vendors.map(v => ({ value: String(v.id), label: v.name })),
  ], [vendors]);

  const handleAdd = () => {
    setEditingModel(null);
    setFormData(EMPTY_DEVICE_MODEL_FORM);
    setShowForm(true);
  };

  const handleEdit = (model: DeviceModel) => {
    setEditingModel(model);
    setFormData({
      id: String(model.id),
      vendor_id: String(model.vendor_id),
      model: model.model,
      display_name: model.display_name,
      rack_units: model.rack_units,
      layout: model.layout || [],
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.model.trim()) { showError('Model name is required'); return; }
    if (!formData.vendor_id) { showError('Vendor is required'); return; }
    const success = editingModel
      ? await updateDeviceModel(editingModel.id, formData)
      : await createDeviceModel({
          ...formData,
          id: formData.id || `${formData.vendor_id}-${formData.model}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        });
    if (success) { setShowForm(false); setEditingModel(null); }
  };

  const handleDelete = (model: DeviceModel) => {
    confirmDelete({
      itemName: model.display_name || model.model,
      itemType: 'device model',
      onConfirm: async () => { await deleteDeviceModel(model.id); },
    });
  };

  const countPorts = (model: DeviceModel) => {
    let total = 0;
    (model.layout || []).forEach(row => {
      row.sections.forEach(section => {
        total += section.ports.length;
      });
    });
    return total;
  };

  const renderModel = ({ item }: { item: DeviceModel }) => {
    const isExpanded = expandedId === item.id;
    const portCount = countPorts(item);
    return (
      <Card style={styles.itemCard}>
        <Pressable onPress={() => setExpandedId(isExpanded ? null : item.id)}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modelName, { color: colors.textPrimary }]}>
                {item.display_name || item.model}
              </Text>
              <Text style={[styles.vendorText, { color: colors.textMuted }]}>
                {getVendorName(item.vendor_id)}
              </Text>
            </View>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: `${colors.accentBlue}20` }]}>
                <Text style={[styles.badgeText, { color: colors.accentBlue }]}>{item.rack_units}U</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: `${colors.accentCyan}20` }]}>
                <Text style={[styles.badgeText, { color: colors.accentCyan }]}>{portCount} ports</Text>
              </View>
              {(item.device_count ?? 0) > 0 && (
                <View style={[styles.badge, { backgroundColor: `${colors.success}20` }]}>
                  <Text style={[styles.badgeText, { color: colors.success }]}>{item.device_count} devices</Text>
                </View>
              )}
            </View>
          </View>

          {isExpanded && item.layout && item.layout.length > 0 && (
            <View style={[styles.layoutSection, { borderTopColor: colors.border }]}>
              <Text style={[styles.layoutTitle, { color: colors.textPrimary }]}>Port Layout</Text>
              {item.layout.map((row, ri) => (
                <View key={ri} style={styles.layoutRow}>
                  <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Row {row.row}:</Text>
                  {row.sections.map((section, si) => (
                    <View key={si} style={styles.sectionBlock}>
                      {section.label && (
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{section.label}</Text>
                      )}
                      <View style={styles.portsRow}>
                        {section.ports.map((port, pi) => (
                          <View key={pi} style={[styles.portChip, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                            <Text style={[styles.portName, { color: colors.textPrimary }]}>{port.vendor_port_name}</Text>
                            <Text style={[styles.portType, { color: colors.textMuted }]}>{port.connector}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </Pressable>
        <CardActions
          onEdit={() => handleEdit(item)}
          onDelete={() => handleDelete(item)}
        />
      </Card>
    );
  };

  if (loading) return <LoadingState message="Loading device models..." />;
  if (error) return <ErrorState title="Error" message={error} primaryAction={{ label: 'Retry', onPress: refresh }} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.actions}>
        <Button title="Add Model" onPress={handleAdd} icon="add" />
      </View>

      <FlatList
        data={deviceModels}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderModel}
        ListEmptyComponent={<EmptyState message="No device models" actionLabel="Add Model" onAction={handleAdd} />}
        contentContainerStyle={deviceModels.length === 0 ? styles.emptyList : undefined}
      />

      <FormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditingModel(null); }}
        onSubmit={handleSubmit}
        title={editingModel ? 'Edit Device Model' : 'Add Device Model'}
        isEditing={!!editingModel}
        size="medium"
      >
        <FormSelect label="Vendor *" value={formData.vendor_id} options={vendorOptions} onChange={v => setFormData(p => ({ ...p, vendor_id: v }))} />
        <FormInput label="Model *" value={formData.model} onChangeText={t => setFormData(p => ({ ...p, model: t }))} placeholder="CCS-720XP-48ZC2" />
        <FormInput label="Display Name" value={formData.display_name} onChangeText={t => setFormData(p => ({ ...p, display_name: t }))} placeholder="Arista 720XP-48ZC2" />
        <FormInput label="ID" value={formData.id} onChangeText={t => setFormData(p => ({ ...p, id: t }))} placeholder="Auto-generated" editable={!editingModel} />
        <FormInput label="Rack Units" value={formData.rack_units.toString()} onChangeText={t => setFormData(p => ({ ...p, rack_units: parseInt(t, 10) || 1 }))} placeholder="1" keyboardType="number-pad" />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  actions: { flexDirection: 'row', gap: 12, padding: 16 },
  itemCard: { marginHorizontal: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  modelName: { fontSize: 16, fontWeight: 'bold' },
  vendorText: { fontSize: 13, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '500' },
  layoutSection: { borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
  layoutTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  layoutRow: { marginBottom: 8 },
  rowLabel: { fontSize: 12, marginBottom: 4 },
  sectionBlock: { marginBottom: 4 },
  sectionLabel: { fontSize: 11, marginBottom: 2 },
  portsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  portChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  portName: { fontSize: 10, fontWeight: '500' },
  portType: { fontSize: 9 },
  emptyList: { flex: 1, justifyContent: 'center' },
});
