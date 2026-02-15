import { useState, useMemo } from 'react';
import type { User, UserFormData } from '@core';
import { useUsers, useAuth, formatRelativeTime } from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { InfoSection } from './InfoSection';
import { LoadingState } from './LoadingState';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { Icon, PlusIcon, RefreshIcon } from './Icon';
import { Toggle } from './Toggle';

const EMPTY_FORM: UserFormData = {
  username: '',
  password: '',
  enabled: true,
};

export function UserManagement() {
  const [showInfo, setShowInfo] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { users, loading, error, refresh, createUser, updateUser, deleteUser } = useUsers();
  const { username: currentUsername } = useAuth();

  const openCreate = () => {
    setEditingUser(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      enabled: user.enabled,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) return;
    if (!editingUser && !formData.password.trim()) return;
    setSaving(true);
    try {
      const ok = editingUser
        ? await updateUser(editingUser.id, {
            username: formData.username,
            password: formData.password || undefined,
            enabled: formData.enabled,
          })
        : await createUser(formData);
      if (ok) setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<User>[] = useMemo(() => [
    {
      header: 'Username',
      accessor: (u) => u.username,
      searchValue: (u) => u.username,
    },
    {
      header: 'Enabled',
      accessor: (u) => Cell.status(u.enabled ? 'Enabled' : 'Disabled', u.enabled ? 'online' : 'offline'),
      searchable: false,
      width: '100px',
    },
    {
      header: 'Created',
      accessor: (u) => formatRelativeTime(u.created_at),
      searchable: false,
      width: '140px',
    },
  ], []);

  const tableActions: TableAction<User>[] = [
    {
      icon: <Icon name="edit" size={14} />,
      label: 'Edit',
      onClick: (u: User) => openEdit(u),
      variant: 'secondary',
      tooltip: 'Edit user',
    },
    {
      icon: <Icon name="delete" size={14} />,
      label: 'Delete',
      onClick: (u: User) => deleteUser(u.id),
      variant: 'danger',
      tooltip: 'Delete user',
      show: (u: User) => u.username !== currentUsername,
    },
  ];

  return (
    <LoadingState loading={loading} error={error} loadingMessage="Loading users...">
      <Card
        title="Users"
        titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
        headerAction={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="primary" onClick={openCreate}>
              <PlusIcon size={14} />
              Add User
            </Button>
            <Button variant="secondary" onClick={refresh}>
              <RefreshIcon size={14} />
            </Button>
          </div>
        }
      >
        <InfoSection open={showInfo}>
          <div>
            <p>
              Manage user accounts for accessing the application. Each user has a username, password,
              and enabled status.
            </p>
            <ul>
              <li>Create new users with username and password</li>
              <li>Disable accounts without deleting them</li>
              <li>You cannot delete your own account</li>
            </ul>
          </div>
        </InfoSection>
        <Table
          data={users}
          columns={columns}
          getRowKey={(u) => u.id}
          actions={tableActions}
          tableId="users"
          searchable
          searchPlaceholder="Search users..."
          emptyMessage="No users found."
          emptyDescription="Add a user using the button above."
        />
      </Card>

      <FormDialog
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingUser ? 'Edit User' : 'Add User'}
        onSubmit={handleSubmit}
        submitText={editingUser ? 'Update' : 'Create'}
        saving={saving}
        submitDisabled={!formData.username.trim() || (!editingUser && !formData.password.trim())}
      >
        <FormField
          label="Username"
          name="username"
          type="text"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          placeholder="e.g., admin"
          required
        />
        <FormField
          label={editingUser ? 'Password (leave blank to keep current)' : 'Password'}
          name="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder={editingUser ? 'Leave blank to keep current password' : 'Enter password'}
          required={!editingUser}
        />
        <Toggle
          label="Enabled"
          checked={formData.enabled}
          onChange={(checked) => setFormData({ ...formData, enabled: checked })}
        />
      </FormDialog>
    </LoadingState>
  );
}
