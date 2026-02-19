import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { User, UserFormData, Settings } from '@core';
import { useUsers, useAuth, useSettings, useDhcpOptions, usePersistedTab, formatRelativeTime, createChangeHandler, getServices, addNotification, validators, useWebSocket, getServiceConfig, getTokenStorage } from '@core';
import { Button, RefreshButton } from './Button';
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
import { SelectField } from './SelectField';
import { Toggle } from './Toggle';
import { ValidatedInput } from './ValidatedInput';

type SystemTab = 'users' | 'branding' | 'naming' | 'topology' | 'dhcp' | 'ssh' | 'opengear' | 'broadcast';

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

  const { users, loading, error, createUser, updateUser, deleteUser } = useUsers();
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
          <Button variant="primary" onClick={openCreate}>
            <PlusIcon size={14} />
            Add User
          </Button>
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
  const [showInfo, setShowInfo] = useState(false);
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
      titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
      headerAction={
        <Button variant="primary" onClick={handleSave} disabled={saving || loading || !formData}>
          {saving ? <SpinnerIcon size={14} /> : <Icon name="save" size={14} />}
          {saving ? 'Saving...' : 'Save'}
        </Button>
      }
    >
      <InfoSection open={showInfo}>
        <p>Customize the application's name and logo shown in the header and login page.</p>
      </InfoSection>
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
  const [showInfo, setShowInfo] = useState(false);
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
      title="Slack % and Device Naming"
      titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
      headerAction={
        <Button variant="primary" onClick={handleSave} disabled={saving || loading || !formData}>
          {saving ? <SpinnerIcon size={14} /> : <Icon name="save" size={14} />}
          {saving ? 'Saving...' : 'Save'}
        </Button>
      }
    >
      <InfoSection open={showInfo}>
        <p>Configure the hostname pattern for auto-generated device names and the cable slack percentage added to estimated cable runs.</p>
      </InfoSection>
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
  const [showInfo, setShowInfo] = useState(false);
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
      titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
      headerAction={
        <Button variant="primary" onClick={handleSave} disabled={saving || loading || !formData}>
          {saving ? <SpinnerIcon size={14} /> : <Icon name="save" size={14} />}
          {saving ? 'Saving...' : 'Save'}
        </Button>
      }
    >
      <InfoSection open={showInfo}>
        <p>Default port counts and speeds used when building CLOS and hierarchical fabric topologies.</p>
      </InfoSection>
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

function SshDefaultsPanel() {
  const { settings, loading, load, save } = useSettings();
  const [showInfo, setShowInfo] = useState(false);
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
      title="SSH Defaults"
      titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
      headerAction={
        <Button variant="primary" onClick={handleSave} disabled={saving || loading || !formData}>
          {saving ? <SpinnerIcon size={14} /> : <Icon name="save" size={14} />}
          {saving ? 'Saving...' : 'Save'}
        </Button>
      }
    >
      <InfoSection open={showInfo}>
        <p>Default SSH credentials and backup command used when no vendor-specific settings are configured.</p>
      </InfoSection>
      {loading ? (
        <p>Loading settings...</p>
      ) : !formData ? (
        <p>Failed to load settings</p>
      ) : (
        <div className="settings-section">
          <div className="form-row">
            <FormField
              label="Default Username"
              name="default_ssh_user"
              type="text"
              value={formData.default_ssh_user}
              onChange={handleChange}
            />
            <FormField
              label="Default Password"
              name="default_ssh_pass"
              type="password"
              value={formData.default_ssh_pass}
              onChange={handleChange}
            />
          </div>
          <div className="form-row">
            <FormField
              label="Backup Command"
              name="backup_command"
              type="text"
              value={formData.backup_command}
              onChange={handleChange}
            />
            <FormField
              label="Backup Delay (seconds)"
              name="backup_delay"
              type="number"
              value={formData.backup_delay}
              onChange={handleChange}
              min={0}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function DhcpSettingsPanel() {
  const { settings, loading, load, save } = useSettings();
  const [showInfo, setShowInfo] = useState(false);
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
      title="DHCP Settings"
      titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
      headerAction={
        <Button variant="primary" onClick={handleSave} disabled={saving || loading || !formData}>
          {saving ? <SpinnerIcon size={14} /> : <Icon name="save" size={14} />}
          {saving ? 'Saving...' : 'Save'}
        </Button>
      }
    >
      <InfoSection open={showInfo}>
        <p>Configure the DHCP server settings used for ZTP device provisioning, including the server address and lease durations.</p>
      </InfoSection>
      {loading ? (
        <p>Loading settings...</p>
      ) : !formData ? (
        <p>Failed to load settings</p>
      ) : (
        <div className="settings-section">
          <div className="form-row">
            <ValidatedInput
              label="Range Start"
              name="dhcp_range_start"
              type="text"
              value={formData.dhcp_range_start}
              onChange={handleChange}
              validate={validators.ipv4}
            />
            <ValidatedInput
              label="Range End"
              name="dhcp_range_end"
              type="text"
              value={formData.dhcp_range_end}
              onChange={handleChange}
              validate={validators.ipv4}
            />
            <ValidatedInput
              label="Subnet Mask"
              name="dhcp_subnet"
              type="text"
              value={formData.dhcp_subnet}
              onChange={handleChange}
              validate={validators.ipv4}
            />
          </div>
          <div className="form-row">
            <ValidatedInput
              label="Gateway"
              name="dhcp_gateway"
              type="text"
              value={formData.dhcp_gateway}
              onChange={handleChange}
              validate={validators.ipv4}
            />
            <ValidatedInput
              label="TFTP Server IP"
              name="tftp_server_ip"
              type="text"
              value={formData.tftp_server_ip}
              onChange={handleChange}
              validate={validators.ipv4}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function OpenGearPanel() {
  const { settings, loading, load, save } = useSettings();
  const [showInfo, setShowInfo] = useState(false);
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
      title="OpenGear ZTP Enrollment"
      titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
      headerAction={
        <Button variant="primary" onClick={handleSave} disabled={saving || loading || !formData}>
          {saving ? <SpinnerIcon size={14} /> : <Icon name="save" size={14} />}
          {saving ? 'Saving...' : 'Save'}
        </Button>
      }
    >
      <InfoSection open={showInfo}>
        <p>Configure OpenGear console server settings for Zero Touch Provisioning enrollment of new devices.</p>
      </InfoSection>
      {loading ? (
        <p>Loading settings...</p>
      ) : !formData ? (
        <p>Failed to load settings</p>
      ) : (
        <div className="settings-section">
          <div className="form-row">
            <FormField
              label="Enrollment URL"
              name="opengear_enroll_url"
              type="text"
              value={formData.opengear_enroll_url || ''}
              onChange={handleChange}
              placeholder="e.g., 192.168.1.100 or lighthouse.example.com"
            />
            <FormField
              label="Bundle Name"
              name="opengear_enroll_bundle"
              type="text"
              value={formData.opengear_enroll_bundle || ''}
              onChange={handleChange}
              placeholder="Optional bundle name"
            />
            <FormField
              label="Enrollment Password"
              name="opengear_enroll_password"
              type="password"
              value={formData.opengear_enroll_password || ''}
              onChange={handleChange}
              placeholder="Enrollment password"
            />
          </div>
        </div>
      )}
    </Card>
  );
}

const WS_EVENT_TYPES = [
  'system_broadcast', 'message',
  'device_discovered', 'device_online', 'device_offline',
  'backup_started', 'backup_completed', 'backup_failed',
  'config_pulled', 'job_queued', 'job_started', 'job_completed', 'job_failed',
];

function BroadcastPanel() {
  const [showInfo, setShowInfo] = useState(false);
  const [eventType, setEventType] = useState('');
  const [payloadText, setPayloadText] = useState('{"message":""}');
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ clients: number; error?: string } | null>(null);
  const { isConnected } = useWebSocket({ autoConnect: false });

  const handleSend = async () => {
    if (!eventType.trim()) return;
    let payload: unknown;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      setLastResult({ clients: 0, error: 'Invalid JSON payload' });
      return;
    }
    setSending(true);
    setLastResult(null);
    try {
      const baseUrl = getServiceConfig().baseUrl || '/api';
      const token = await getTokenStorage().getToken();
      const response = await fetch(`${baseUrl}/ws/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type: eventType.trim(), payload }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      const result = await response.json() as { clients: number };
      setLastResult({ clients: result.clients });
      addNotification('success', `Broadcast sent to ${result.clients} client${result.clients !== 1 ? 's' : ''}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastResult({ clients: 0, error: msg });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card
      title="Broadcast"
      titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
    >
      <InfoSection open={showInfo}>
        <p>Send a WebSocket event to all connected browser clients. Useful for testing real-time event handling or triggering UI updates across sessions.</p>
        <ul>
          <li>Choose a known event type or enter a custom one</li>
          <li>Provide a JSON payload matching the event's expected shape</li>
          <li>All currently connected clients will receive the message instantly</li>
        </ul>
      </InfoSection>

      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span className={`status-dot status-${isConnected ? 'online' : 'offline'}`} />
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            {isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
          </span>
        </div>

        <SelectField
          label="Event Type"
          name="event_type"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          options={WS_EVENT_TYPES.map(t => ({ value: t, label: t }))}
          placeholder="Select event type..."
        />

        <div className="form-group">
          <label htmlFor="broadcast-payload">Payload (JSON)</label>
          <textarea
            id="broadcast-payload"
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            rows={6}
            style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.85rem' }}
            placeholder="{}"
          />
        </div>

        <Button
          variant="primary"
          onClick={handleSend}
          disabled={sending || !eventType.trim()}
        >
          {sending ? <SpinnerIcon size={14} /> : <Icon name="send" size={14} />}
          {sending ? 'Sending...' : 'Broadcast'}
        </Button>

        {lastResult && (
          <div style={{ marginTop: '12px' }}>
            {lastResult.error ? (
              <div className="form-error">{lastResult.error}</div>
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                Sent to <strong>{lastResult.clients}</strong> client{lastResult.clients !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export function SystemSettings() {
  const { users, refresh: refreshUsers } = useUsers();
  const { options } = useDhcpOptions();
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = usePersistedTab<SystemTab>(
    'users',
    ['users', 'branding', 'naming', 'topology', 'dhcp', 'ssh', 'opengear', 'broadcast'],
    'tab_system',
  );

  const tabs = useMemo(() => [
    { id: 'users', label: 'Users', icon: 'people', count: users.length },
    { id: 'ssh', label: 'SSH Defaults', icon: 'terminal' },
    { id: 'dhcp', label: 'DHCP Settings', icon: 'lan' },
    { id: 'opengear', label: 'OpenGear', icon: 'router' },
    { id: 'branding', label: 'Branding', icon: 'palette' },
    { id: 'naming', label: 'Slack % and Device Naming', icon: 'badge' },
    { id: 'topology', label: 'Topology Defaults', icon: 'hub' },
    { id: 'broadcast', label: 'Broadcast', icon: 'campaign' },
  ], [users.length]);

  return (
    <Card
      title="System"
      titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
      headerAction={<RefreshButton onClick={refreshUsers} />}
    >
      <InfoSection open={showInfo}>
        <p>System-wide settings including user accounts, branding, device naming, SSH defaults, DHCP, and ZTP enrollment configuration.</p>
      </InfoSection>
      <SideTabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as SystemTab)}>
        {activeTab === 'users' && <UsersPanel />}
        {activeTab === 'ssh' && <SshDefaultsPanel />}
        {activeTab === 'dhcp' && <DhcpSettingsPanel />}
        {activeTab === 'opengear' && <OpenGearPanel />}
        {activeTab === 'branding' && <BrandingPanel />}
        {activeTab === 'naming' && <DeviceNamingPanel />}
        {activeTab === 'topology' && <TopologyDefaultsPanel />}
        {activeTab === 'broadcast' && <BroadcastPanel />}
      </SideTabs>
    </Card>
  );
}
