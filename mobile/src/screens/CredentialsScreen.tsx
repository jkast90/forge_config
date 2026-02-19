import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
} from 'react-native';
import type { Credential, CredentialFormData } from '../core';
import { useCredentials } from '../core';
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

const EMPTY_FORM: CredentialFormData = {
  name: '',
  description: '',
  cred_type: 'ssh',
  username: '',
  password: '',
};

const CRED_TYPE_OPTIONS = [
  { value: 'ssh', label: 'SSH' },
  { value: 'api_key', label: 'API Key' },
];

export function CredentialsScreen() {
  const { colors } = useAppTheme();
  const {
    credentials, loading, error, refresh,
    createCredential, updateCredential, deleteCredential,
  } = useCredentials();

  const [showForm, setShowForm] = useState(false);
  const [editingCred, setEditingCred] = useState<Credential | null>(null);
  const [formData, setFormData] = useState<CredentialFormData>(EMPTY_FORM);

  const handleAdd = () => {
    setEditingCred(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  };

  const handleEdit = (cred: Credential) => {
    setEditingCred(cred);
    setFormData({
      id: cred.id,
      name: cred.name,
      description: cred.description || '',
      cred_type: cred.cred_type,
      username: cred.username,
      password: cred.password,
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showError('Name is required');
      return;
    }
    const success = editingCred
      ? await updateCredential(editingCred.id, formData)
      : await createCredential(formData);
    if (success) {
      setShowForm(false);
      setEditingCred(null);
    }
  };

  const handleDelete = (cred: Credential) => {
    confirmDelete({
      itemName: cred.name,
      itemType: 'credential',
      onConfirm: async () => { await deleteCredential(cred.id); },
    });
  };

  const renderCredential = ({ item }: { item: Credential }) => (
    <Card style={styles.itemCard}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.name}</Text>
          {item.description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
          ) : null}
        </View>
        <View style={[styles.typeBadge, { backgroundColor: item.cred_type === 'ssh' ? `${colors.accentBlue}20` : `${colors.accentCyan}20` }]}>
          <Text style={[styles.typeText, { color: item.cred_type === 'ssh' ? colors.accentBlue : colors.accentCyan }]}>
            {item.cred_type === 'ssh' ? 'SSH' : 'API Key'}
          </Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>ID: {item.id}</Text>
        {item.username ? (
          <Text style={[styles.metaText, { color: colors.textMuted }]}>User: {item.username}</Text>
        ) : null}
      </View>
      <CardActions
        onEdit={() => handleEdit(item)}
        onDelete={() => handleDelete(item)}
      />
    </Card>
  );

  if (loading && credentials.length === 0) return <LoadingState message="Loading credentials..." />;
  if (error) return <ErrorState title="Error" message={error} primaryAction={{ label: 'Retry', onPress: refresh }} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.actions}>
        <Button title="Add Credential" onPress={handleAdd} icon="add" />
      </View>

      <FlatList
        data={credentials}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCredential}
        ListEmptyComponent={<EmptyState message="No credentials" actionLabel="Add Credential" onAction={handleAdd} />}
        contentContainerStyle={credentials.length === 0 ? styles.emptyList : undefined}
      />

      <FormModal
        visible={showForm}
        onClose={() => { setShowForm(false); setEditingCred(null); }}
        onSubmit={handleSubmit}
        title={editingCred ? 'Edit Credential' : 'Add Credential'}
        isEditing={!!editingCred}
        size="medium"
      >
        <FormInput
          label="Name *"
          value={formData.name}
          onChangeText={t => setFormData(p => ({ ...p, name: t }))}
          placeholder="e.g., Lab SSH Credentials"
        />
        <FormSelect
          label="Type"
          value={formData.cred_type}
          options={CRED_TYPE_OPTIONS}
          onChange={v => setFormData(p => ({ ...p, cred_type: v }))}
        />
        <FormInput
          label="Username"
          value={formData.username}
          onChangeText={t => setFormData(p => ({ ...p, username: t }))}
          placeholder="SSH username"
        />
        <FormInput
          label="Password"
          value={formData.password}
          onChangeText={t => setFormData(p => ({ ...p, password: t }))}
          placeholder="SSH password or API key"
          secureTextEntry
        />
        <FormInput
          label="Description"
          value={formData.description}
          onChangeText={t => setFormData(p => ({ ...p, description: t }))}
          placeholder="Optional description"
        />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  actions: { flexDirection: 'row', gap: 12, padding: 16 },
  itemCard: { marginHorizontal: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  itemName: { fontSize: 16, fontWeight: 'bold' },
  description: { fontSize: 13, marginTop: 2 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  typeText: { fontSize: 12, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaText: { fontSize: 12 },
  emptyList: { flex: 1, justifyContent: 'center' },
});
