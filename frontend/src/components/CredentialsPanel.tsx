import { useState, useMemo } from 'react';
import type { Credential, CredentialFormData } from '@core';
import { getCredTypeBadgeVariant } from '@core';
import { Button } from './Button';
import { Card } from './Card';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { InfoSection } from './InfoSection';
import { SelectField } from './SelectField';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { Icon, PlusIcon, RefreshIcon, SpinnerIcon } from './Icon';

interface CredentialsPanelProps {
  credentials: Credential[];
  loading: boolean;
  onCreate: (data: CredentialFormData) => Promise<boolean>;
  onUpdate: (id: string, data: CredentialFormData) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onRefresh: () => void;
}

export function CredentialsPanel({ credentials, loading, onCreate, onUpdate, onDelete, onRefresh }: CredentialsPanelProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCred, setEditingCred] = useState<Credential | null>(null);
  const [formData, setFormData] = useState<CredentialFormData>({ name: '', description: '', cred_type: 'ssh', username: '', password: '' });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingCred(null);
    setFormData({ name: '', description: '', cred_type: 'ssh', username: '', password: '' });
    setShowForm(true);
  };

  const openEdit = (cred: Credential) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      const ok = editingCred
        ? await onUpdate(editingCred.id, formData)
        : await onCreate(formData);
      if (ok) setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<Credential>[] = useMemo(() => [
    {
      header: 'ID',
      accessor: (c) => Cell.code(c.id),
      searchValue: (c) => c.id,
      width: '150px',
    },
    {
      header: 'Name',
      accessor: (c) => c.name,
      searchValue: (c) => c.name,
    },
    {
      header: 'Type',
      accessor: (c) => Cell.badge(c.cred_type, getCredTypeBadgeVariant(c.cred_type)),
      searchValue: (c) => c.cred_type,
      width: '80px',
    },
    {
      header: 'Username',
      accessor: (c) => c.username || <span className="text-muted">-</span>,
      searchValue: (c) => c.username,
      width: '140px',
    },
    {
      header: 'Description',
      accessor: (c) => c.description || <span className="text-muted">-</span>,
      searchValue: (c) => c.description || '',
    },
  ], []);

  const tableActions: TableAction<Credential>[] = [
    {
      icon: <Icon name="edit" size={14} />,
      label: 'Edit',
      onClick: (c: Credential) => openEdit(c),
      variant: 'secondary',
      tooltip: 'Edit credential',
    },
    {
      icon: <Icon name="delete" size={14} />,
      label: 'Delete',
      onClick: (c: Credential) => onDelete(c.id),
      variant: 'danger',
      tooltip: 'Delete credential',
    },
  ];

  const credTypeOptions = [
    { value: 'ssh', label: 'SSH' },
    { value: 'api_key', label: 'API Key' },
  ];

  return (
    <>
      <Card
        title="Credentials"
        titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
        headerAction={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="primary" onClick={openCreate}>
              <PlusIcon size={14} />
              Add Credential
            </Button>
            <Button variant="secondary" onClick={onRefresh} disabled={loading}>
              <RefreshIcon size={14} />
            </Button>
          </div>
        }
      >
        <InfoSection open={showInfo}>
          <div>
            <p>
              Named credentials for SSH and API key authentication. Credentials can be referenced by job templates
              to connect to devices without entering passwords each time.
            </p>
            <ul>
              <li>SSH credentials store username and password for device access</li>
              <li>API key credentials store keys for webhook integrations</li>
              <li>Credentials are encrypted at rest in the database</li>
            </ul>
          </div>
        </InfoSection>
        {loading && credentials.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '24px', justifyContent: 'center' }}>
            <SpinnerIcon size={16} /> Loading credentials...
          </div>
        ) : (
          <Table
            data={credentials}
            columns={columns}
            getRowKey={(c) => c.id}
            actions={tableActions}
            tableId="credentials"
            searchable
            searchPlaceholder="Search credentials..."
            emptyMessage="No credentials configured."
            emptyDescription="Add named credentials that can be referenced by job templates."
          />
        )}
      </Card>

      <FormDialog
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingCred ? 'Edit Credential' : 'Add Credential'}
        onSubmit={handleSubmit}
        submitText={editingCred ? 'Update' : 'Create'}
        saving={saving}
        submitDisabled={!formData.name.trim()}
      >
        <FormField
          label="Name"
          name="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Lab SSH Credentials"
          required
        />
        <SelectField
          label="Type"
          name="cred_type"
          value={formData.cred_type}
          onChange={(e) => setFormData({ ...formData, cred_type: e.target.value })}
          options={credTypeOptions}
        />
        <FormField
          label="Username"
          name="username"
          type="text"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          placeholder="SSH username"
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder="SSH password or API key"
        />
        <FormField
          label="Description"
          name="description"
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
        />
      </FormDialog>
    </>
  );
}
