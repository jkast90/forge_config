import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { User, UserFormData, Settings } from '@core';
import { useUsers, useAuth, useSettings, usePersistedTab, formatRelativeTime, createChangeHandler, getServices, addNotification } from '@core';
import { Button } from './Button';
import { Card } from './Card';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { InfoSection } from './InfoSection';
import { LoadingState } from './LoadingState';
import { SideTabs } from './SideTabs';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { Icon, PlusIcon, RefreshIcon, SpinnerIcon } from './Icon';
import { ModelSelector } from './ModelSelector';
import { Toggle } from './Toggle';

type SystemTab = 'users' | 'branding' | 'naming' | 'topology';

const EMPTY_FORM: UserFormData = {
  username: '',
  password: '',
  enabled: true,
};

function UsersPanel() {
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
        ? await updateUser(String(editingUser.id), {
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
      onClick: (u: User) => deleteUser(String(u.id)),
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

function BrandingPanel() {
  const { settings, loading, load, save } = useSettings();
  const [formData, setFormData] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (settings) {
      setFormData({ ...settings });
    }
  }, [settings]);

  const handleChange = useMemo(() => createChangeHandler<Settings>(
    (name, value) => setFormData(prev => prev ? { ...prev, [name]: value } : prev)
  ), []);

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setUploadingLogo(true);
    try {
      await getServices().settings.uploadLogo(file);
      addNotification('success', 'Logo uploaded');
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Logo upload failed: ${msg}`);
      setLogoPreview(null);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await getServices().settings.deleteLogo();
      addNotification('success', 'Logo removed');
      setLogoPreview(null);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to remove logo: ${msg}`);
    }
  };

  const handleSave = async () => {
    if (!formData) return;
    setSaving(true);
    try {
      await save(formData);
    } finally {
      setSaving(false);
    }
  };

  const currentLogoSrc = logoPreview || formData?.logo_url || null;

  return (
    <Card
      title="Branding"
      headerAction={
        <Button variant="primary" onClick={handleSave} disabled={saving || loading || !formData}>
          {saving ? <SpinnerIcon size={14} /> : <Icon name="save" size={14} />}
          {saving ? 'Saving...' : 'Save'}
        </Button>
      }
    >
      {loading ? (
        <p>Loading settings...</p>
      ) : !formData ? (
        <p>Failed to load settings</p>
      ) : (
        <>
          <div className="settings-section">
            <h3>
              <Icon name="palette" size={18} />
              Application Name
            </h3>
            <div className="form-row">
              <FormField
                label="Application Name"
                name="app_name"
                type="text"
                value={formData.app_name || ''}
                onChange={handleChange}
                placeholder="ForgeConfig"
              />
            </div>
            <p className="settings-hint">
              Customize the application name shown in the header and login page.
            </p>
          </div>

          <div className="settings-section">
            <h3>
              <Icon name="image" size={18} />
              Logo
            </h3>
            <div className="branding-logo-row">
              <div className="branding-logo-preview">
                {currentLogoSrc ? (
                  <img src={currentLogoSrc} alt="Logo preview" className="branding-logo-img" />
                ) : (
                  <div className="branding-logo-placeholder">
                    <Icon name="image" size={32} />
                  </div>
                )}
              </div>
              <div className="branding-logo-actions">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  onChange={handleLogoSelect}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  <Icon name="upload" size={14} />
                  {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </button>
                {formData.logo_url && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleRemoveLogo}
                  >
                    <Icon name="delete" size={14} />
                    Remove
                  </button>
                )}
              </div>
            </div>
            <p className="settings-hint">
              PNG, JPG, GIF, WebP, or SVG under 2MB.
            </p>
          </div>
        </>
      )}
    </Card>
  );
}

function DeviceNamingPanel() {
  const { settings, loading, load, save } = useSettings();
  const [formData, setFormData] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (settings) {
      setFormData({ ...settings });
    }
  }, [settings]);

  const handleChange = useMemo(() => createChangeHandler<Settings>(
    (name, value) => setFormData(prev => prev ? { ...prev, [name]: value } : prev)
  ), []);

  const handleSave = async () => {
    if (!formData) return;
    setSaving(true);
    try {
      await save(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Device Naming"
      headerAction={
        <Button variant="primary" onClick={handleSave} disabled={saving || loading || !formData}>
          {saving ? <SpinnerIcon size={14} /> : <Icon name="save" size={14} />}
          {saving ? 'Saving...' : 'Save'}
        </Button>
      }
    >
      {loading ? (
        <p>Loading settings...</p>
      ) : !formData ? (
        <p>Failed to load settings</p>
      ) : (
        <div className="settings-section">
          <div className="form-row">
            <FormField
              label="Hostname Pattern"
              name="hostname_pattern"
              type="text"
              value={formData.hostname_pattern || '$datacenter-$role-#'}
              onChange={handleChange}
              placeholder="$datacenter-$role-#"
            />
          </div>
          <p className="settings-hint">
            Pattern for auto-generated device hostnames. Variables: <code>$region</code>, <code>$datacenter</code>, <code>$hall</code>, <code>$row</code>, <code>$role</code> (spine, leaf, external), <code>#</code> (auto-incrementing number). Hall, row, and # are zero-padded to 2 digits.
            Example: dc1-spine-01, dc1-r01-leaf-02
          </p>
          <div className="form-row" style={{ marginTop: 16 }}>
            <FormField
              label="Cable Slack %"
              name="cable_slack_percent"
              type="number"
              value={formData.cable_slack_percent ?? 20}
              onChange={handleChange}
              placeholder="20"
            />
          </div>
          <p className="settings-hint">
            Extra length added to estimated cable runs for service loops and routing slack. Applied during topology preview and build.
          </p>
        </div>
      )}
    </Card>
  );
}

function TopologyDefaultsPanel() {
  const { settings, loading, load, save } = useSettings();
  const [formData, setFormData] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (settings) {
      setFormData({ ...settings });
    }
  }, [settings]);

  const handleChange = useMemo(() => createChangeHandler<Settings>(
    (name, value) => setFormData(prev => prev ? { ...prev, [name]: value } : prev)
  ), []);

  const handleSave = async () => {
    if (!formData) return;
    setSaving(true);
    try {
      await save(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Topology Builder Defaults"
      headerAction={
        <Button variant="primary" onClick={handleSave} disabled={saving || loading || !formData}>
          {saving ? <SpinnerIcon size={14} /> : <Icon name="save" size={14} />}
          {saving ? 'Saving...' : 'Save'}
        </Button>
      }
    >
      {loading ? (
        <p>Loading settings...</p>
      ) : !formData ? (
        <p>Failed to load settings</p>
      ) : (
        <div className="settings-section">
          <div className="form-row">
            <ModelSelector
              label="Default Spine Model"
              name="default_spine_model"
              value={formData.default_spine_model || ''}
              onChange={handleChange}
              placeholder="None"
            />
            <ModelSelector
              label="Default Leaf Model"
              name="default_leaf_model"
              value={formData.default_leaf_model || ''}
              onChange={handleChange}
              placeholder="None"
            />
          </div>
          <div className="form-row">
            <ModelSelector
              label="Default Mgmt Switch Model"
              name="default_mgmt_switch_model"
              value={formData.default_mgmt_switch_model || ''}
              onChange={handleChange}
              placeholder="None"
            />
            <ModelSelector
              label="Default GPU Model"
              name="default_gpu_model"
              value={formData.default_gpu_model || ''}
              onChange={handleChange}
              variant="gpu"
              placeholder="None"
            />
          </div>
          <p className="settings-hint">
            Pre-populate model fields when opening the topology builder. Leave blank to choose each time.
          </p>
        </div>
      )}
    </Card>
  );
}

export function UserManagement() {
  const { users } = useUsers();
  const [activeTab, setActiveTab] = usePersistedTab<SystemTab>(
    'users',
    ['users', 'branding', 'naming', 'topology'],
    'tab_system',
  );

  const tabs = useMemo(() => [
    { id: 'users', label: 'Users', icon: 'people', count: users.length },
    { id: 'branding', label: 'Branding', icon: 'palette' },
    { id: 'naming', label: 'Device Naming', icon: 'badge' },
    { id: 'topology', label: 'Topology Defaults', icon: 'hub' },
  ], [users.length]);

  return (
    <Card title="System">
      <SideTabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as SystemTab)}>
        {activeTab === 'users' && <UsersPanel />}
        {activeTab === 'branding' && <BrandingPanel />}
        {activeTab === 'naming' && <DeviceNamingPanel />}
        {activeTab === 'topology' && <TopologyDefaultsPanel />}
      </SideTabs>
    </Card>
  );
}
