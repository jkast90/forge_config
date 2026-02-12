import { useEffect, useCallback, useMemo } from 'react';
import type { Device } from '@core';
import { useForm, useTemplates, useVendors, validateDeviceForm, lookupVendorByMac, getDefaultTemplateForVendor } from '@core';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { SelectField } from './SelectField';

interface Props {
  isOpen: boolean;
  device?: Device | null;
  initialData?: Partial<DeviceFormData> | null;
  onSubmit: (device: Partial<Device>) => Promise<void>;
  onClose: () => void;
}

type DeviceFormData = {
  mac: string;
  ip: string;
  hostname: string;
  vendor: string;
  model: string;
  serial_number: string;
  config_template: string;
  ssh_user: string;
  ssh_pass: string;
};

const emptyFormData: DeviceFormData = {
  mac: '',
  ip: '',
  hostname: '',
  vendor: '',
  model: '',
  serial_number: '',
  config_template: '',
  ssh_user: '',
  ssh_pass: '',
};

export function DeviceForm({ isOpen, device, initialData, onSubmit, onClose }: Props) {
  const isEditing = !!device;
  const { templates } = useTemplates({ vendorFilter: 'all' });
  const { vendors } = useVendors();

  // Build vendor options for select dropdown
  const vendorOptions = useMemo(() => {
    const options = [{ value: '', label: 'Select Vendor...' }];
    vendors.forEach((v) => {
      options.push({ value: v.id, label: v.name });
    });
    return options;
  }, [vendors]);

  // Build template options for select dropdown
  const templateOptions = useMemo(() => {
    const options = [{ value: '', label: 'Select Template...' }];
    templates.forEach((t) => {
      const vendorSuffix = t.vendor_id ? ` (${t.vendor_id})` : ' (global)';
      options.push({ value: t.id, label: `${t.name}${vendorSuffix}` });
    });
    return options;
  }, [templates]);

  const {
    formData,
    errors,
    saving,
    handleChange,
    resetForm,
    handleSubmit,
  } = useForm<DeviceFormData>({
    initialData: emptyFormData,
    onSubmit: async (data) => {
      await onSubmit(data);
      onClose();
    },
    validate: validateDeviceForm,
  });

  // Reset form when dialog opens/closes or device changes
  useEffect(() => {
    if (isOpen) {
      if (device) {
        resetForm({
          mac: device.mac,
          ip: device.ip,
          hostname: device.hostname,
          vendor: device.vendor || '',
          model: device.model || '',
          serial_number: device.serial_number || '',
          config_template: device.config_template || '',
          ssh_user: device.ssh_user || '',
          ssh_pass: device.ssh_pass || '',
        });
      } else if (initialData) {
        // Pre-fill with initial data from discovery
        resetForm({
          ...emptyFormData,
          ...initialData,
        });
      } else {
        resetForm(emptyFormData);
      }
    }
  }, [device, initialData, isOpen, resetForm]);

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  // Auto-select vendor and template when MAC changes
  const handleMacChange = useCallback((mac: string) => {
    handleChange('mac', mac);
    // Only auto-select if vendor is empty and MAC looks complete (17 chars with separators)
    if (!formData.vendor && mac.replace(/[^a-fA-F0-9]/g, '').length >= 6) {
      const detectedVendor = lookupVendorByMac(mac);
      if (detectedVendor && detectedVendor !== 'Local') {
        handleChange('vendor', detectedVendor);
        // Also auto-select default template for this vendor
        if (!formData.config_template) {
          const defaultTemplate = getDefaultTemplateForVendor(detectedVendor);
          handleChange('config_template', defaultTemplate);
        }
      }
    }
  }, [formData.vendor, formData.config_template, handleChange]);

  // Auto-select template when vendor changes
  const handleVendorChange = useCallback((vendor: string) => {
    handleChange('vendor', vendor);
    // Auto-select default template for this vendor if template is empty
    if (vendor && !formData.config_template) {
      const defaultTemplate = getDefaultTemplateForVendor(vendor);
      handleChange('config_template', defaultTemplate);
    }
  }, [formData.config_template, handleChange]);

  // Adapter for web input onChange events
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'mac') {
      handleMacChange(value);
    } else if (name === 'vendor') {
      handleVendorChange(value);
    } else {
      handleChange(name as keyof DeviceFormData, value);
    }
  };

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Device' : 'Add Device'}
      onSubmit={onFormSubmit}
      submitText={isEditing ? 'Update Device' : 'Add Device'}
      saving={saving}
      variant="extra-wide"
    >
      <div className="form-columns">
        <div className="form-column">
          <FormField
            label="MAC Address *"
            name="mac"
            type="text"
            value={formData.mac}
            onChange={onInputChange}
            placeholder="aa:bb:cc:dd:ee:ff"
            required
            disabled={isEditing}
            error={errors.mac}
          />
          <FormField
            label="IP Address *"
            name="ip"
            type="text"
            value={formData.ip}
            onChange={onInputChange}
            placeholder="192.168.1.100"
            required
            error={errors.ip}
          />
          <FormField
            label="Hostname *"
            name="hostname"
            type="text"
            value={formData.hostname}
            onChange={onInputChange}
            placeholder="switch-01"
            required
            error={errors.hostname}
          />
          <SelectField
            label="Vendor"
            name="vendor"
            value={formData.vendor}
            onChange={onInputChange}
            options={vendorOptions}
          />
          <SelectField
            label="Config Template"
            name="config_template"
            value={formData.config_template}
            onChange={onInputChange}
            options={templateOptions}
          />
        </div>

        <div className="form-column">
          <FormField
            label="Model"
            name="model"
            type="text"
            value={formData.model}
            onChange={onInputChange}
            placeholder="WS-C3850-24T (optional)"
          />
          <FormField
            label="Serial Number"
            name="serial_number"
            type="text"
            value={formData.serial_number}
            onChange={onInputChange}
            placeholder="SN123456 (optional)"
          />
          <FormField
            label="SSH Username (override)"
            name="ssh_user"
            type="text"
            value={formData.ssh_user}
            onChange={onInputChange}
            placeholder="Leave empty for default"
          />
          <FormField
            label="SSH Password (override)"
            name="ssh_pass"
            type="password"
            value={formData.ssh_pass}
            onChange={onInputChange}
            placeholder="Leave empty for default"
          />
        </div>
      </div>
    </FormDialog>
  );
}
