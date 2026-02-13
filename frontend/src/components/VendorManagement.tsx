import { useState, useEffect, useMemo } from 'react';
import type { Vendor, VendorFormData } from '@core';
import {
  useDevices,
  useVendors,
  useModalForm,
  useModalRoute,
  EMPTY_VENDOR_FORM,
  slugify,
  formatListValue,
  parseListValue,
} from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { InfoSection } from './InfoSection';
import { LoadingState } from './LoadingState';

import { Table, Cell } from './Table';
import type { TableColumn } from './Table';
import { PlusIcon } from './Icon';

export function VendorManagement() {
  const [showInfo, setShowInfo] = useState(false);
  const { devices } = useDevices();
  const {
    vendors,
    loading,
    error,
    createVendor,
    updateVendor,
    deleteVendor,
    resetToDefaults,
  } = useVendors();

  const form = useModalForm<Vendor, VendorFormData>({
    emptyFormData: { ...EMPTY_VENDOR_FORM, mac_prefixes: [] },
    itemToFormData: (vendor) => ({
      id: vendor.id,
      name: vendor.name,
      backup_command: vendor.backup_command,
      deploy_command: vendor.deploy_command || '',
      ssh_port: vendor.ssh_port,
      ssh_user: vendor.ssh_user || '',
      ssh_pass: vendor.ssh_pass || '',
      mac_prefixes: vendor.mac_prefixes || [],
      vendor_class: vendor.vendor_class || '',
      default_template: vendor.default_template || '',
    }),
    onCreate: (data) => createVendor({ ...data, id: data.id || slugify(data.name) }),
    onUpdate: (id, data) => updateVendor(id, data),
    getItemId: (v) => v.id,
    modalName: 'vendor-form',
  });

  const modalRoute = useModalRoute();

  // Restore vendor form from URL hash
  useEffect(() => {
    if (modalRoute.isModal('vendor-form') && !form.isOpen) {
      const id = modalRoute.getParam('id');
      if (id) {
        const vendor = vendors.find(v => v.id === id);
        if (vendor) {
          form.openEdit(vendor);
        } else if (vendors.length > 0) {
          modalRoute.closeModal();
        }
      } else {
        form.openAdd();
      }
    }
  }, [modalRoute.modal, vendors]);

  // Calculate device counts per vendor
  const vendorStats = useMemo(() => {
    const stats: Record<string, number> = {};
    devices.forEach((device) => {
      const vendor = device.vendor || 'unassigned';
      stats[vendor] = (stats[vendor] || 0) + 1;
    });
    return stats;
  }, [devices]);

  const vendorsWithStats = useMemo(() => {
    return vendors.map((v) => ({
      ...v,
      device_count: v.device_count || vendorStats[v.id] || 0,
    }));
  }, [vendors, vendorStats]);

  const unassignedCount = vendorStats['unassigned'] || vendorStats[''] || 0;

  const handleDelete = async (vendor: Vendor) => {
    await deleteVendor(vendor.id);
  };

  const handleReset = async () => {
    if (confirm('Reset all vendors to defaults? This will restore default MAC prefixes.')) {
      await resetToDefaults();
    }
  };

  // Special handler for MAC prefixes (array field)
  const handleMacPrefixesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const prefixes = parseListValue(e.target.value).map((p) => p.toUpperCase());
    form.setField('mac_prefixes', prefixes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await form.submit();
  };

  return (
    <LoadingState loading={loading} error={error} loadingMessage="Loading vendors...">
      <ActionBar>
        <Button onClick={form.openAdd}>
          <PlusIcon size={16} />
          Add Vendor
        </Button>
        <Button variant="secondary" onClick={handleReset}>
          Reset to Defaults
        </Button>
      </ActionBar>

      {unassignedCount > 0 && (
        <Card>
          <div className="message error">
            {unassignedCount} device{unassignedCount !== 1 ? 's' : ''} without vendor assigned
          </div>
        </Card>
      )}

      <Card title="Configured Vendors" titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}>
        <InfoSection open={showInfo}>
          <div>
            <p>
              Vendors define network equipment manufacturers and their SSH/backup settings.
              MAC prefixes (OUI) are used for auto-detecting the vendor when devices are discovered.
            </p>
            <ul>
              <li>Backup command is run via SSH to retrieve the running configuration</li>
              <li>Deploy command wraps rendered config for push deployment</li>
              <li>Vendor class matches DHCP Option 60 for automatic identification</li>
            </ul>
          </div>
        </InfoSection>
        <Table
          data={vendorsWithStats}
          columns={[
            { header: 'Vendor', accessor: (v) => <strong>{v.name}</strong>, searchValue: (v) => v.name },
            { header: 'Backup Command', accessor: (v) => Cell.code(v.backup_command), searchValue: (v) => v.backup_command || '' },
            { header: 'SSH Port', accessor: 'ssh_port' },
            { header: 'MAC Prefixes', accessor: (v) => v.mac_prefixes?.length || 0, searchable: false },
            { header: 'Devices', accessor: (v) => Cell.count(v.device_count), searchable: false },
          ] as TableColumn<(typeof vendorsWithStats)[0]>[]}
          getRowKey={(v) => v.id}
          tableId="vendors"
          onEdit={form.openEdit}
          onDelete={handleDelete}
          deleteConfirmMessage={(v) => `Delete vendor "${v.name}"?`}
          deleteDisabled={(v) => v.device_count > 0}
          searchable
          searchPlaceholder="Search vendors..."
          emptyMessage="No vendors configured."
          emptyDescription='Click "Add Vendor" or "Reset to Defaults" to get started.'
        />
      </Card>

      <FormDialog
        isOpen={form.isOpen}
        onClose={form.close}
        title={form.getTitle('Add Vendor', 'Edit Vendor')}
        onSubmit={handleSubmit}
        submitText={form.getSubmitText('Add Vendor', 'Update Vendor')}
        variant="wide"
      >
        <div className="form-columns">
          <div className="form-column">
            <FormField
              label="Vendor Name *"
              name="name"
              type="text"
              value={form.formData.name}
              onChange={form.handleChange}
              placeholder="Acme Networks"
              required
              disabled={form.isEditing}
            />
            <FormField
              label="Vendor ID"
              name="id"
              type="text"
              value={form.formData.id}
              onChange={form.handleChange}
              placeholder="acme (auto-generated)"
              disabled={form.isEditing}
            />
            <FormField
              label="Backup Command *"
              name="backup_command"
              type="text"
              value={form.formData.backup_command}
              onChange={form.handleChange}
              placeholder="show running-config"
              required
            />
            <div className="form-group">
              <label htmlFor="deploy_command">Deploy Command Wrapper</label>
              <input
                id="deploy_command"
                name="deploy_command"
                type="text"
                value={form.formData.deploy_command}
                onChange={form.handleChange}
                placeholder="configure terminal | {CONFIG} | end"
              />
              <small className="form-help">
                Use {'{CONFIG}'} as placeholder for rendered config. Leave blank to send as-is.
              </small>
            </div>
            <FormField
              label="Vendor Class (DHCP Option 60)"
              name="vendor_class"
              type="text"
              value={form.formData.vendor_class}
              onChange={form.handleChange}
              placeholder="Cisco Systems, Inc."
            />
          </div>

          <div className="form-column">
            <FormField
              label="SSH Port"
              name="ssh_port"
              type="number"
              value={form.formData.ssh_port.toString()}
              onChange={form.handleChange}
              placeholder="22"
            />
            <FormField
              label="Default SSH Username"
              name="ssh_user"
              type="text"
              value={form.formData.ssh_user}
              onChange={form.handleChange}
              placeholder="Global default"
            />
            <FormField
              label="Default SSH Password"
              name="ssh_pass"
              type="password"
              value={form.formData.ssh_pass}
              onChange={form.handleChange}
              placeholder="Global default"
            />
            <div className="form-group">
              <label htmlFor="mac_prefixes">MAC Prefixes (OUI)</label>
              <textarea
                id="mac_prefixes"
                name="mac_prefixes"
                value={formatListValue(form.formData.mac_prefixes)}
                onChange={handleMacPrefixesChange}
                placeholder="00:1A:2F, 00:1B:0D, 2C:31:24"
                rows={3}
              />
              <small className="form-help">
                Comma or newline separated (first 3 octets)
              </small>
            </div>
            <FormField
              label="Default Template ID"
              name="default_template"
              type="text"
              value={form.formData.default_template}
              onChange={form.handleChange}
              placeholder="cisco-ios"
            />
          </div>
        </div>
      </FormDialog>
    </LoadingState>
  );
}
