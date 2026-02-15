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
import type { VariableKeyInfo, DeviceVariable } from '../core';
import { useDeviceVariables, useDevices } from '../core';
import {
  Card,
  Button,
  EmptyState,
  LoadingState,
  ErrorState,
  FormModal,
  FormInput,
} from '../components';
import { confirmDelete, showError } from '../utils';
import { useAppTheme } from '../context';

export function VariablesScreen() {
  const { colors } = useAppTheme();
  const {
    keys, byKey, selectedKey,
    loading, error, refresh,
    selectKey, clearSelection,
    addKey, deleteKey,
    setVariable, deleteVariable,
  } = useDeviceVariables();
  const { devices } = useDevices();

  const [showAddKey, setShowAddKey] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [defaultValue, setDefaultValue] = useState('');

  const [showEditVar, setShowEditVar] = useState(false);
  const [editDeviceId, setEditDeviceId] = useState<number>(0);
  const [editValue, setEditValue] = useState('');

  const deviceMap = useMemo(() => {
    const map: Record<number, string> = {};
    devices.forEach(d => { map[d.id] = d.hostname || d.ip || String(d.id); });
    return map;
  }, [devices]);

  const handleAddKey = async () => {
    if (!newKey.trim()) { showError('Key name is required'); return; }
    const deviceIds = devices.map(d => d.id);
    const success = await addKey(newKey, deviceIds, defaultValue);
    if (success) {
      setShowAddKey(false);
      setNewKey('');
      setDefaultValue('');
    }
  };

  const handleDeleteKey = (key: string) => {
    confirmDelete({
      itemName: key,
      itemType: 'variable key',
      onConfirm: async () => { await deleteKey(key); },
    });
  };

  const handleEditVariable = (dv: DeviceVariable) => {
    setEditDeviceId(dv.device_id);
    setEditValue(dv.value);
    setShowEditVar(true);
  };

  const handleSaveVariable = async () => {
    if (!selectedKey) return;
    const success = await setVariable(editDeviceId, selectedKey, editValue);
    if (success) {
      setShowEditVar(false);
      await selectKey(selectedKey);
    }
  };

  const handleDeleteVariable = (dv: DeviceVariable) => {
    confirmDelete({
      itemName: `${dv.key} for ${deviceMap[dv.device_id] || String(dv.device_id)}`,
      itemType: 'variable',
      onConfirm: async () => {
        await deleteVariable(dv.device_id, dv.key);
        if (selectedKey) await selectKey(selectedKey);
      },
    });
  };

  const renderKeyItem = ({ item }: { item: VariableKeyInfo }) => {
    const isSelected = selectedKey === item.key;
    return (
      <Pressable onPress={() => selectKey(item.key)}>
        <Card style={[styles.keyCard, isSelected && { borderColor: colors.accentBlue, borderWidth: 2 }]}>
          <View style={styles.keyHeader}>
            <Text style={[styles.keyName, { color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
              {item.key}
            </Text>
            <View style={[styles.countBadge, { backgroundColor: colors.bgSecondary }]}>
              <Text style={[styles.countText, { color: colors.accentBlue }]}>
                {item.device_count} devices
              </Text>
            </View>
          </View>
          <Pressable onPress={() => handleDeleteKey(item.key)} style={styles.deleteBtn}>
            <MaterialIcons name="delete-outline" size={18} color={colors.error} />
          </Pressable>
        </Card>
      </Pressable>
    );
  };

  if (loading) return <LoadingState message="Loading variables..." />;
  if (error) return <ErrorState title="Error" message={error} primaryAction={{ label: 'Retry', onPress: refresh }} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.actions}>
        <Button title="Add Key" onPress={() => { setNewKey(''); setDefaultValue(''); setShowAddKey(true); }} icon="add" />
        {selectedKey && (
          <Button title="Back to Keys" onPress={clearSelection} variant="secondary" icon="arrow-back" />
        )}
      </View>

      {!selectedKey ? (
        /* Key list */
        <FlatList
          data={keys}
          keyExtractor={(item) => item.key}
          renderItem={renderKeyItem}
          ListEmptyComponent={<EmptyState message="No variable keys" actionLabel="Add Key" onAction={() => setShowAddKey(true)} />}
          contentContainerStyle={keys.length === 0 ? styles.emptyList : undefined}
        />
      ) : (
        /* Values for selected key */
        <View style={styles.flex}>
          <View style={[styles.selectedHeader, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
            <MaterialIcons name="vpn-key" size={20} color={colors.accentCyan} />
            <Text style={[styles.selectedKeyText, { color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
              {selectedKey}
            </Text>
            <Text style={[styles.valueCount, { color: colors.textMuted }]}>{byKey.length} values</Text>
          </View>
          <FlatList
            data={byKey}
            keyExtractor={(item) => `${item.device_id}-${item.key}`}
            renderItem={({ item }) => (
              <Card style={styles.valueCard}>
                <View style={styles.valueRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.deviceName, { color: colors.textPrimary }]}>
                      {deviceMap[item.device_id] || item.device_id}
                    </Text>
                    <Text style={[styles.valueText, { color: colors.accentCyan, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                      {item.value}
                    </Text>
                  </View>
                  <View style={styles.valueActions}>
                    <Pressable onPress={() => handleEditVariable(item)}>
                      <MaterialIcons name="edit" size={18} color={colors.accentBlue} />
                    </Pressable>
                    <Pressable onPress={() => handleDeleteVariable(item)}>
                      <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </Card>
            )}
            ListEmptyComponent={<EmptyState message="No values for this key" />}
            contentContainerStyle={byKey.length === 0 ? styles.emptyList : undefined}
          />
        </View>
      )}

      {/* Add Key Form */}
      <FormModal
        visible={showAddKey}
        onClose={() => setShowAddKey(false)}
        onSubmit={handleAddKey}
        title="Add Variable Key"
        size="small"
      >
        <FormInput label="Key Name *" value={newKey} onChangeText={setNewKey} placeholder="ntp_server" />
        <FormInput label="Default Value" value={defaultValue} onChangeText={setDefaultValue} placeholder="10.0.0.1" />
      </FormModal>

      {/* Edit Variable */}
      <FormModal
        visible={showEditVar}
        onClose={() => setShowEditVar(false)}
        onSubmit={handleSaveVariable}
        title="Edit Variable"
        isEditing
        size="small"
      >
        <FormInput label="Device" value={deviceMap[editDeviceId] || String(editDeviceId)} editable={false} />
        <FormInput label="Value" value={editValue} onChangeText={setEditValue} placeholder="Value" />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 12, padding: 16 },
  keyCard: { marginHorizontal: 16, marginBottom: 12 },
  keyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  keyName: { fontSize: 15, fontWeight: '600' },
  countBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  countText: { fontSize: 12 },
  deleteBtn: { position: 'absolute', right: 0, top: 0, padding: 4 },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
  },
  selectedKeyText: { fontSize: 16, fontWeight: 'bold' },
  valueCount: { fontSize: 12, marginLeft: 'auto' },
  valueCard: { marginHorizontal: 16, marginBottom: 8 },
  valueRow: { flexDirection: 'row', alignItems: 'center' },
  deviceName: { fontSize: 14, fontWeight: '500' },
  valueText: { fontSize: 13, marginTop: 2 },
  valueActions: { flexDirection: 'row', gap: 12 },
  emptyList: { flex: 1, justifyContent: 'center' },
});
