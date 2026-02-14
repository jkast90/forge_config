import { useState, useEffect, useMemo } from 'react';
import { useSettings, useLocalSettings, useLocalAddresses, configureServices, createChangeHandler, clearTablePageSizeOverrides } from '@core';
import type { Settings, NetworkInterface } from '@core';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { LayoutSettings } from './LayoutSettings';
import { SelectField } from './SelectField';
import { ValidatedInput } from './ValidatedInput';
import { validators } from '@core';
import { Icon } from './Icon';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDialog({ isOpen, onClose }: Props) {
  const { settings, loading, saving, load, save } = useSettings();
  const { settings: localSettings, updateSettings: updateLocalSettings } = useLocalSettings();
  const { addresses, loading: addressesLoading, refresh: refreshAddresses } = useLocalAddresses();
  const [formData, setFormData] = useState<Settings | null>(null);
  const [localFormData, setLocalFormData] = useState({ apiUrl: '', defaultPageSize: 25 });

  useEffect(() => {
    if (isOpen) {
      load();
      refreshAddresses();
      setLocalFormData({ apiUrl: localSettings.apiUrl, defaultPageSize: localSettings.defaultPageSize });
    }
  }, [isOpen, load, refreshAddresses, localSettings.apiUrl]);

  useEffect(() => {
    if (settings) {
      setFormData({ ...settings });
    }
  }, [settings]);

  const handleChange = useMemo(() => createChangeHandler<Settings>(
    (name, value) => setFormData(prev => prev ? { ...prev, [name]: value } : prev)
  ), []);

  const handleLocalChange = useMemo(() => createChangeHandler<{ apiUrl: string; defaultPageSize: number }>(
    (name, value) => setLocalFormData(prev => ({ ...prev, [name]: value }))
  ), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    // Save local settings first (API URL change takes effect on next request)
    const localUpdates: Partial<typeof localSettings> = {};
    if (localFormData.apiUrl !== localSettings.apiUrl) {
      localUpdates.apiUrl = localFormData.apiUrl;
      configureServices({ baseUrl: localFormData.apiUrl });
    }
    if (localFormData.defaultPageSize !== localSettings.defaultPageSize) {
      localUpdates.defaultPageSize = localFormData.defaultPageSize;
      clearTablePageSizeOverrides();
    }
    if (Object.keys(localUpdates).length > 0) {
      updateLocalSettings(localUpdates);
    }

    const success = await save(formData);
    if (success) {
      setTimeout(() => onClose(), 1500);
    }
  };

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      onSubmit={handleSubmit}
      submitText="Save Settings"
      saving={saving}
      variant="wide"
    >
      {loading ? (
        <p>Loading settings...</p>
      ) : !formData ? (
        <p>Failed to load settings</p>
      ) : (
        <>
          <div className="settings-section">
            <h3>
              <Icon name="cloud" size={18} />
              Connection
            </h3>
            <div className="form-row">
              <FormField
                label="API URL"
                name="apiUrl"
                type="text"
                value={localFormData.apiUrl}
                onChange={handleLocalChange}
                placeholder="/api or http://server:8080/api"
              />
            </div>
            <p className="settings-hint">
              Base URL for API requests. Use "/api" for same-origin or full URL for remote server.
            </p>
          </div>

          <div className="settings-section">
            <h3>
              <Icon name="terminal" size={18} />
              SSH Defaults
            </h3>
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

          <div className="settings-section">
            <h3>
              <Icon name="lan" size={18} />
              DHCP Settings
            </h3>
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

          <div className="settings-section">
            <h3>
              <Icon name="router" size={18} />
              OpenGear ZTP Enrollment
            </h3>
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

          <div className="settings-section">
            <h3>
              <Icon name="wifi" size={18} />
              Server Network Interfaces
            </h3>
            {addressesLoading ? (
              <p className="settings-hint">Loading network interfaces...</p>
            ) : addresses.length === 0 ? (
              <p className="settings-hint">No network interfaces found</p>
            ) : (
              <div className="local-addresses">
                {addresses
                  .filter((iface: NetworkInterface) => !iface.is_loopback)
                  .map((iface: NetworkInterface) => (
                    <div key={iface.name} className="address-item">
                      <span className="address-name">{iface.name}</span>
                      <span className="address-ips">
                        {iface.addresses
                          .filter((addr: string) => !addr.includes(':')) // Filter out IPv6
                          .map((addr: string) => addr.split('/')[0]) // Remove CIDR
                          .join(', ') || 'No IPv4'}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            <p className="settings-hint">
              Use one of these addresses for the API URL when connecting from another device.
            </p>
          </div>

          <div className="settings-section">
            <h3>
              <Icon name="table_rows" size={18} />
              Tables
            </h3>
            <div className="form-row">
              <SelectField
                label="Rows per page"
                name="defaultPageSize"
                value={String(localFormData.defaultPageSize)}
                onChange={(e) => setLocalFormData(prev => ({ ...prev, defaultPageSize: Number(e.target.value) }))}
                options={[
                  { value: '10', label: '10' },
                  { value: '25', label: '25' },
                  { value: '50', label: '50' },
                  { value: '100', label: '100' },
                ]}
              />
            </div>
            <p className="settings-hint">
              Default number of rows shown per page in tables. Per-table overrides are cleared when this changes.
            </p>
          </div>

          <div className="settings-section">
            <h3>
              <Icon name="view_quilt" size={18} />
              Layout
            </h3>
            <LayoutSettings />
          </div>
        </>
      )}
    </FormDialog>
  );
}
