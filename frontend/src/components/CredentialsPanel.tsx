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
import { Icon, PlusIcon, SpinnerIcon } from './Icon';

interface CredentialsPanelProps {
  credentials: Credential[];
  loading: boolean;
  onCreate: (data: CredentialFormData) => Promise<boolean>;
  onUpdate: (id: number | string, data: CredentialFormData) => Promise<boolean>;
  onDelete: (id: number | string) => Promise<boolean>;
}

function PasswordCell({ password }: { password: string }) {
  const [show, setShow] = useState(false);
  if (!password) return <span className="text-muted">-</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
        {show ? password : '••••••••'}
      </span>
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', opacity: 0.7 }}
        title={show ? 'Hide password' : 'Show password'}
      >
        <Icon name={show ? 'visibility_off' : 'visibility'} size={14} />
      </button>
    </div>
  );
}

export function CredentialsPanel({ credentials, loading, onCreate, onUpdate, onDelete }: CredentialsPanelProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCred, setEditingCred] = useState<Credential | null>(null);
  const [formData, setFormData] = useState<CredentialFormData>({ name: '', description: '', cred_type: 'ssh', username: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const openCreate = () => {
    setEditingCred(null);
    setFormData({ name: '', description: '', cred_type: 'ssh', username: '', password: '' });
    setShowPassword(false);
    setShowForm(true);
  };

  const openEdit = (cred: Credential) => {
    setEditingCred(cred);
    setFormData({
      name: cred.name,
      description: cred.description || '',
      cred_type: cred.cred_type,
      username: cred.username,
      password: cred.password,
    });
    setShowPassword(false);
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
      accessor: (c) => Cell.code(String(c.id)),
      searchValue: (c) => String(c.id),
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
      header: 'Password',
      accessor: (c) => <PasswordCell password={c.password} />,
      searchValue: (c) => c.password,
      width: '160px',
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
          <Button variant="primary" onClick={openCreate}>
            <PlusIcon size={14} />
            Add Credential
          </Button>
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
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="SSH password or API key"
              style={{ paddingRight: '36px', width: '100%', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(s => !s)}
              style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center' }}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={16} />
            </button>
          </div>
        </div>
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
