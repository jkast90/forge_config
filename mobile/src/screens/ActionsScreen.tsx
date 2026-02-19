import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { VendorAction, VendorActionFormData, ActionType, WebhookMethod } from '../core';
import {
  useVendorActions,
  useVendors,
  getVendorName,
  getVendorFilterOptions,
  EMPTY_VENDOR_ACTION_FORM,
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

const ACTION_TYPE_OPTIONS = [
  { value: 'ssh', label: 'SSH Command' },
  { value: 'webhook', label: 'Webhook' },
] as const;

const WEBHOOK_METHOD_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
] as const;

export function ActionsScreen() {
  const { colors } = useAppTheme();
  const { vendors } = useVendors();
  const [vendorFilter, setVendorFilter] = useState('');
  const { actions, filteredActions, loading, error, refresh, createAction, updateAction, deleteAction } = useVendorActions({ vendorFilter: vendorFilter || undefined });

  const [showForm, setShowForm] = useState(false);
  const [editingAction, setEditingAction] = useState<VendorAction | null>(null);
  const [formData, setFormData] = useState<VendorActionFormData>(EMPTY_VENDOR_ACTION_FORM);

  const vendorFilterOptions = useMemo(() => [
    { value: '', label: 'All Vendors' },
    ...vendors.map(v => ({ value: v.id, label: v.name })),
  ], [vendors]);

  const vendorOptions = useMemo(() =>
    vendors.map(v => ({ value: v.id, label: v.name })),
  [vendors]);

  const handleAdd = () => {
    setEditingAction(null);
    setFormData(EMPTY_VENDOR_ACTION_FORM);
    setShowForm(true);
  };

  const handleEdit = (action: VendorAction) => {
    setEditingAction(action);
    setFormData({
      id: action.id,
      vendor_id: action.vendor_id,
      label: action.label,
      command: action.command,
      sort_order: action.sort_order,
      action_type: action.action_type,
      webhook_url: action.webhook_url,
      webhook_method: action.webhook_method,
      webhook_headers: action.webhook_headers,
      webhook_body: action.webhook_body,
      output_parser_id: action.output_parser_id ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.label.trim()) { showError('Label is required'); return; }
    if (!formData.vendor_id) { showError('Vendor is required'); return; }
    if (formData.action_type === 'ssh' && !formData.command.trim()) { showError('Command is required'); return; }
    if (formData.action_type === 'webhook' && !formData.webhook_url.trim()) { showError('Webhook URL is required'); return; }

    const { output_parser_id, id: _id, ...rest } = formData;
    const payload = {
      ...rest,
      vendor_id: Number(rest.vendor_id),
      output_parser_id: output_parser_id ? Number(output_parser_id) : undefined,
    };
    const success = editingAction
      ? await updateAction(editingAction.id, payload)
      : await createAction(payload);
    if (success) { setShowForm(false); setEditingAction(null); }
  };

  const handleDelete = (action: VendorAction) => {
    confirmDelete({
      itemName: action.label,
      itemType: 'action',
      onConfirm: async () => { await deleteAction(action.id); },
    });
  };

  const renderAction = ({ item }: { item: VendorAction }) => {
    const isSSH = item.action_type === 'ssh';
    return (
      <Card style={styles.itemCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>{item.label}</Text>
            <Text style={[styles.vendorText, { color: colors.textMuted }]}>{getVendorName(item.vendor_id)}</Text>
          </View>
          <View style={styles.badges}>
            <View style={[styles.typeBadge, { backgroundColor: isSSH ? `${colors.success}20` : `${colors.accentBlue}20` }]}>
              <MaterialIcons name={isSSH ? 'terminal' : 'webhook'} size={12} color={isSSH ? colors.success : colors.accentBlue} />
              <Text style={[styles.typeBadgeText, { color: isSSH ? colors.success : colors.accentBlue }]}>
                {isSSH ? 'SSH' : 'Webhook'}
              </Text>
            </View>
          </View>
        </View>

        {isSSH ? (
          <View style={[styles.commandBox, { backgroundColor: colors.bgSecondary }]}>
            <Text style={[styles.commandText, { color: colors.accentCyan, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
              {item.command}
            </Text>
          </View>
        ) : (
          <View style={styles.webhookInfo}>
            <View style={[styles.methodBadge, { backgroundColor: colors.bgSecondary }]}>
              <Text style={[styles.methodText, { color: colors.textPrimary }]}>{item.webhook_method}</Text>
            </View>
            <Text style={[styles.urlText, { color: colors.accentBlue, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]} numberOfLines={1}>
              {item.webhook_url}
            </Text>
          </View>
        )}

        <Text style={[styles.sortOrder, { color: colors.textMuted }]}>Sort: {item.sort_order}</Text>

        <CardActions
          onEdit={() => handleEdit(item)}
          onDelete={() => handleDelete(item)}
        />
      </Card>
    );
  };

  if (loading) return <LoadingState message="Loading actions..." />;
  if (error) return <ErrorState title="Error" message={error} primaryAction={{ label: 'Retry', onPress: refresh }} />;

  const displayActions = vendorFilter ? filteredActions : actions;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <FormSelect
            label="Filter by Vendor"
            value={vendorFilter}
            options={vendorFilterOptions}
            onChange={(v) => setVendorFilter(String(v))}
          />
        </View>
      </View>

      <View style={styles.actions}>
        <Button title="Add Action" onPress={handleAdd} icon="add" />
      </View>

      <FlatList
        data={displayActions}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderAction}
        ListEmptyComponent={<EmptyState message="No actions" actionLabel="Add Action" onAction={handleAdd} />}
        contentContainerStyle={displayActions.length === 0 ? styles.emptyList : undefined}
      />

      <FormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditingAction(null); }}
        onSubmit={handleSubmit}
        title={editingAction ? 'Edit Action' : 'Add Action'}
        isEditing={!!editingAction}
        size="large"
      >
        <FormSelect label="Vendor *" value={formData.vendor_id} options={vendorOptions} onChange={v => setFormData(p => ({ ...p, vendor_id: v }))} />
        <FormInput label="Label *" value={formData.label} onChangeText={t => setFormData(p => ({ ...p, label: t }))} placeholder="Show Version" />
        <FormInput label="Sort Order" value={formData.sort_order.toString()} onChangeText={t => setFormData(p => ({ ...p, sort_order: parseInt(t, 10) || 0 }))} placeholder="0" keyboardType="number-pad" />
        <FormSelect label="Action Type" value={formData.action_type} options={ACTION_TYPE_OPTIONS as any} onChange={v => setFormData(p => ({ ...p, action_type: v as ActionType }))} />

        {formData.action_type === 'ssh' ? (
          <FormInput label="Command *" value={formData.command} onChangeText={t => setFormData(p => ({ ...p, command: t }))} placeholder="show version" multiline />
        ) : (
          <>
            <FormSelect label="Method" value={formData.webhook_method} options={WEBHOOK_METHOD_OPTIONS as any} onChange={v => setFormData(p => ({ ...p, webhook_method: v as WebhookMethod }))} />
            <FormInput label="URL *" value={formData.webhook_url} onChangeText={t => setFormData(p => ({ ...p, webhook_url: t }))} placeholder="https://api.example.com/action" />
            <FormInput label="Headers (JSON)" value={formData.webhook_headers} onChangeText={t => setFormData(p => ({ ...p, webhook_headers: t }))} placeholder='{"Authorization": "Bearer ..."}' multiline />
            <FormInput label="Body" value={formData.webhook_body} onChangeText={t => setFormData(p => ({ ...p, webhook_body: t }))} placeholder='{"device": "{{hostname}}"}' multiline />
          </>
        )}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { paddingHorizontal: 16, paddingTop: 16 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  itemCard: { marginHorizontal: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  actionLabel: { fontSize: 16, fontWeight: 'bold' },
  vendorText: { fontSize: 13, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typeBadgeText: { fontSize: 11, fontWeight: '500' },
  commandBox: { padding: 10, borderRadius: 8, marginBottom: 8 },
  commandText: { fontSize: 13 },
  webhookInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  methodBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  methodText: { fontSize: 12, fontWeight: '600' },
  urlText: { fontSize: 12, flex: 1 },
  sortOrder: { fontSize: 11, marginBottom: 8 },
  emptyList: { flex: 1, justifyContent: 'center' },
});
