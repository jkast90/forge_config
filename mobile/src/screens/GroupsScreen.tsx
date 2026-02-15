import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { Group, GroupFormData } from '../core';
import { useGroups, useDevices } from '../core';
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

export function GroupsScreen() {
  const { colors } = useAppTheme();
  const {
    groups, loading, error, refresh,
    createGroup, updateGroup, deleteGroup,
    groupVariables, groupVariablesLoading,
    fetchGroupVariables, setGroupVariable, deleteGroupVariable,
    members, membersLoading,
    fetchMembers, addMember, removeMember,
  } = useGroups();
  const { devices } = useDevices();

  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formData, setFormData] = useState<GroupFormData>({ name: '', description: '', parent_id: null, precedence: 0 });

  // Detail view state
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [detailTab, setDetailTab] = useState<'variables' | 'members'>('variables');
  const [showVarForm, setShowVarForm] = useState(false);
  const [varKey, setVarKey] = useState('');
  const [varValue, setVarValue] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);

  const parentOptions = useMemo(() => [
    { value: '', label: 'None (top-level)' },
    ...groups.filter(g => !editingGroup || g.id !== editingGroup.id).map(g => ({ value: String(g.id), label: g.name })),
  ], [groups, editingGroup]);

  const nonMembers = useMemo(() =>
    devices.filter(d => !members.includes(d.id)),
  [devices, members]);

  const memberDevices = useMemo(() =>
    devices.filter(d => members.includes(d.id)),
  [devices, members]);

  const handleAdd = () => {
    setEditingGroup(null);
    setFormData({ name: '', description: '', parent_id: null, precedence: groups.length });
    setShowForm(true);
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || '',
      parent_id: group.parent_id ?? null,
      precedence: group.precedence,
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) { showError('Group name is required'); return; }
    const success = editingGroup
      ? await updateGroup(editingGroup.id, formData)
      : await createGroup(formData);
    if (success) { setShowForm(false); setEditingGroup(null); }
  };

  const handleDelete = (group: Group) => {
    confirmDelete({
      itemName: group.name,
      itemType: 'group',
      onConfirm: async () => { await deleteGroup(group.id); },
    });
  };

  const handleSelectGroup = useCallback(async (group: Group) => {
    setSelectedGroup(group);
    setDetailTab('variables');
    await fetchGroupVariables(group.id);
    await fetchMembers(group.id);
  }, [fetchGroupVariables, fetchMembers]);

  const handleAddVariable = async () => {
    if (!varKey.trim() || !selectedGroup) { showError('Variable key is required'); return; }
    const success = await setGroupVariable(selectedGroup.id, varKey, varValue);
    if (success) {
      setShowVarForm(false);
      setVarKey('');
      setVarValue('');
      await fetchGroupVariables(selectedGroup.id);
    }
  };

  const handleDeleteVariable = (key: string) => {
    if (!selectedGroup) return;
    confirmDelete({
      itemName: key,
      itemType: 'variable',
      onConfirm: async () => {
        await deleteGroupVariable(selectedGroup.id, key);
        await fetchGroupVariables(selectedGroup.id);
      },
    });
  };

  const handleAddMemberDevice = async (deviceId: number) => {
    if (!selectedGroup) return;
    const success = await addMember(selectedGroup.id, deviceId);
    if (success) {
      await fetchMembers(selectedGroup.id);
      setShowAddMember(false);
    }
  };

  const handleRemoveMember = (deviceId: number) => {
    if (!selectedGroup) return;
    const device = devices.find(d => d.id === deviceId);
    confirmDelete({
      itemName: device?.hostname || String(deviceId),
      itemType: 'member',
      onConfirm: async () => {
        await removeMember(selectedGroup.id, deviceId);
        await fetchMembers(selectedGroup.id);
      },
    });
  };

  const renderGroup = ({ item }: { item: Group }) => {
    const isSelected = selectedGroup?.id === item.id;
    return (
      <Card style={[styles.itemCard, isSelected && { borderColor: colors.accentBlue, borderWidth: 2 }]}>
        <Pressable onPress={() => handleSelectGroup(item)}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.name}</Text>
              {item.description && (
                <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
              )}
            </View>
            <View style={styles.headerRight}>
              <View style={[styles.countBadge, { backgroundColor: colors.bgSecondary }]}>
                <Text style={[styles.countText, { color: colors.accentBlue }]}>{item.device_count || 0} devices</Text>
              </View>
            </View>
          </View>
          <View style={styles.metaRow}>
            {item.parent_id != null && (
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                Parent: {groups.find(g => g.id === item.parent_id)?.name || String(item.parent_id)}
              </Text>
            )}
            <Text style={[styles.metaText, { color: colors.textMuted }]}>Precedence: {item.precedence}</Text>
          </View>
        </Pressable>
        <CardActions
          onEdit={() => handleEdit(item)}
          onDelete={() => handleDelete(item)}
        />
      </Card>
    );
  };

  if (loading) return <LoadingState message="Loading groups..." />;
  if (error) return <ErrorState title="Error" message={error} primaryAction={{ label: 'Retry', onPress: refresh }} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.actions}>
        <Button title="Add Group" onPress={handleAdd} icon="add" />
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderGroup}
        ListEmptyComponent={<EmptyState message="No groups" actionLabel="Add Group" onAction={handleAdd} />}
        contentContainerStyle={groups.length === 0 ? styles.emptyList : undefined}
        ListFooterComponent={selectedGroup ? (
          <View style={[styles.detailPanel, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>{selectedGroup.name}</Text>

            {/* Detail tabs */}
            <View style={[styles.detailTabs, { borderBottomColor: colors.border }]}>
              <Pressable
                style={[styles.detailTab, detailTab === 'variables' && { borderBottomColor: colors.accentBlue, borderBottomWidth: 2 }]}
                onPress={() => setDetailTab('variables')}
              >
                <Text style={[styles.detailTabText, { color: detailTab === 'variables' ? colors.accentBlue : colors.textMuted }]}>
                  Variables ({groupVariables.length})
                </Text>
              </Pressable>
              <Pressable
                style={[styles.detailTab, detailTab === 'members' && { borderBottomColor: colors.accentBlue, borderBottomWidth: 2 }]}
                onPress={() => setDetailTab('members')}
              >
                <Text style={[styles.detailTabText, { color: detailTab === 'members' ? colors.accentBlue : colors.textMuted }]}>
                  Members ({members.length})
                </Text>
              </Pressable>
            </View>

            {detailTab === 'variables' ? (
              <View style={styles.detailContent}>
                <Button title="Add Variable" onPress={() => { setVarKey(''); setVarValue(''); setShowVarForm(true); }} icon="add" size="sm" />
                {groupVariablesLoading ? (
                  <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text>
                ) : groupVariables.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No variables</Text>
                ) : (
                  groupVariables.map(v => (
                    <View key={v.key} style={[styles.varRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.varKey, { color: colors.accentCyan, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>{v.key}</Text>
                      <Text style={[styles.varValue, { color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>{v.value}</Text>
                      <Pressable onPress={() => handleDeleteVariable(v.key)}>
                        <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            ) : (
              <View style={styles.detailContent}>
                <Button title="Add Member" onPress={() => setShowAddMember(true)} icon="person-add" size="sm" />
                {membersLoading ? (
                  <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text>
                ) : memberDevices.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No members</Text>
                ) : (
                  memberDevices.map(d => (
                    <View key={d.id} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.memberName, { color: colors.textPrimary }]}>{d.hostname}</Text>
                        <Text style={[styles.memberIp, { color: colors.textMuted }]}>{d.ip}</Text>
                      </View>
                      <Pressable onPress={() => handleRemoveMember(d.id)}>
                        <MaterialIcons name="remove-circle-outline" size={18} color={colors.error} />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        ) : null}
      />

      {/* Group Form */}
      <FormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditingGroup(null); }}
        onSubmit={handleSubmit}
        title={editingGroup ? 'Edit Group' : 'Add Group'}
        isEditing={!!editingGroup}
        size="medium"
      >
        <FormInput label="Name *" value={formData.name} onChangeText={t => setFormData(p => ({ ...p, name: t }))} placeholder="datacenter-switches" />
        <FormInput label="Description" value={formData.description} onChangeText={t => setFormData(p => ({ ...p, description: t }))} placeholder="All switches in datacenter" />
        <FormSelect label="Parent Group" value={formData.parent_id != null ? String(formData.parent_id) : ''} options={parentOptions} onChange={v => setFormData(p => ({ ...p, parent_id: v ? Number(v) : null }))} />
        <FormInput label="Precedence" value={formData.precedence.toString()} onChangeText={t => setFormData(p => ({ ...p, precedence: parseInt(t, 10) || 0 }))} placeholder="0" keyboardType="number-pad" />
      </FormModal>

      {/* Variable Form */}
      <FormModal
        visible={showVarForm}
        onClose={() => setShowVarForm(false)}
        onSubmit={handleAddVariable}
        title="Add Variable"
        size="small"
      >
        <FormInput label="Key *" value={varKey} onChangeText={setVarKey} placeholder="ntp_server" />
        <FormInput label="Value" value={varValue} onChangeText={setVarValue} placeholder="10.0.0.1" />
      </FormModal>

      {/* Add Member */}
      <FormModal
        visible={showAddMember}
        onClose={() => setShowAddMember(false)}
        onSubmit={() => setShowAddMember(false)}
        title="Add Member"
        submitText="Done"
        size="large"
      >
        {nonMembers.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>All devices are already members</Text>
        ) : (
          nonMembers.map(d => (
            <Pressable
              key={d.id}
              style={[styles.deviceOption, { borderBottomColor: colors.border }]}
              onPress={() => handleAddMemberDevice(d.id)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: colors.textPrimary }]}>{d.hostname}</Text>
                <Text style={[styles.memberIp, { color: colors.textMuted }]}>{d.ip} - {d.vendor}</Text>
              </View>
              <MaterialIcons name="add-circle-outline" size={20} color={colors.success} />
            </Pressable>
          ))
        )}
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  actions: { flexDirection: 'row', gap: 12, padding: 16 },
  itemCard: { marginHorizontal: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  headerRight: { flexDirection: 'row', gap: 8 },
  itemName: { fontSize: 16, fontWeight: 'bold' },
  description: { fontSize: 13, marginTop: 2 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  countText: { fontSize: 12 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaText: { fontSize: 12 },
  detailPanel: { margin: 16, borderRadius: 12, padding: 16, borderWidth: 1 },
  detailTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  detailTabs: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 12 },
  detailTab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  detailTabText: { fontSize: 14, fontWeight: '500' },
  detailContent: { gap: 8 },
  loadingText: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  varRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, gap: 8 },
  varKey: { fontSize: 13, width: 120 },
  varValue: { fontSize: 13, flex: 1 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  memberName: { fontSize: 14, fontWeight: '500' },
  memberIp: { fontSize: 12 },
  deviceOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  emptyList: { flex: 1, justifyContent: 'center' },
});
