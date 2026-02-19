import { useState, useEffect, useMemo } from 'react';
import type { DhcpOption, DhcpOptionFormData } from '@core';
import {
  COMMON_DHCP_OPTIONS,
  useDhcpOptions,
  useModalForm,
  useModalRoute,
  getVendorFilterOptions,
  getVendorSelectOptions,
  getVendorName,
  filterByVendor,
  generateId,
  DHCP_OPTION_TYPES,
  EMPTY_DHCP_OPTION_FORM,
} from '@core';
import { Button } from './Button';
import { Card } from './Card';
import { Toggle } from './Toggle';
import { useConfirm } from './ConfirmDialog';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { InfoSection } from './InfoSection';
import { LoadingState } from './LoadingState';

import { SelectField } from './SelectField';
import { Table, SimpleTable, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { PlusIcon, Icon } from './Icon';

export function DhcpOptions() {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [showInfo, setShowInfo] = useState(false);
  const [showTableInfo, setShowTableInfo] = useState(false);
  const [filterVendor, setFilterVendor] = useState('');
  const {
    options,
    loading,
    error,
    createOption,
    updateOption,
    deleteOption,
    resetToDefaults,
  } = useDhcpOptions({ vendorFilter: filterVendor || 'all' });

  const form = useModalForm<DhcpOption, DhcpOptionFormData>({
    emptyFormData: EMPTY_DHCP_OPTION_FORM,
    itemToFormData: (option) => ({
      option_number: option.option_number,
      name: option.name,
      value: option.value,
      type: option.type,
      vendor_id: String(option.vendor_id || ''),
      description: option.description || '',
      enabled: option.enabled,
    }),
    onCreate: (data) => createOption({
      ...data,
      vendor_id: Number(data.vendor_id) || undefined,
      description: data.description || undefined,
    }),
    onUpdate: (id, data) => updateOption(id, {
      ...data,
      vendor_id: Number(data.vendor_id) || undefined,
      description: data.description || undefined,
    }),
    getItemId: (o) => String(o.id),
    modalName: 'dhcp-form',
  });

  const modalRoute = useModalRoute();

  // Restore DHCP form from URL hash
  useEffect(() => {
    if (modalRoute.isModal('dhcp-form') && !form.isOpen) {
      const id = modalRoute.getParam('id');
      if (id) {
        const option = options.find(o => String(o.id) === id);
        if (option) {
          form.openEdit(option);
        } else if (options.length > 0) {
          modalRoute.closeModal();
        }
      } else {
        form.openAdd();
      }
    }
  }, [modalRoute.modal, options]);

  // Get vendor options from shared utility
  const filterVendorOptions = useMemo(() => getVendorFilterOptions().map(o => ({ value: o.id, label: o.label })), []);
  const vendorSelectOptions = useMemo(() => getVendorSelectOptions(), []);

  // Filter options by vendor (client-side for immediate UI response)
  const filteredOptions = useMemo(
    () => filterByVendor(options, filterVendor, (opt) => opt.vendor_id ? String(opt.vendor_id) : undefined),
    [options, filterVendor]
  );

  const handleAddCommon = (common: typeof COMMON_DHCP_OPTIONS[number]) => {
    form.openAdd();
    form.setFields({
      option_number: common.number,
      name: common.name,
      description: common.description,
    });
  };

  const handleDelete = async (id: number) => {
    const option = options.find((o) => o.id === id);
    if (option && await confirm({ title: 'Delete DHCP Option', message: `Delete DHCP option "${option.name}"?`, confirmText: 'Delete', destructive: true })) {
      await deleteOption(id);
    }
  };

  const handleToggle = async (id: number) => {
    const option = options.find((o) => o.id === id);
    if (option) {
      await updateOption(id, { ...option, enabled: !option.enabled });
    }
  };

  const handleReset = async () => {
    if (await confirm({ title: 'Reset DHCP Options', message: 'Reset all DHCP options to defaults? This will remove custom options and recreate defaults.', confirmText: 'Reset', destructive: true })) {
      await resetToDefaults();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await form.submit();
  };

  // Columns for DHCP option table
  const optionColumns: TableColumn<DhcpOption>[] = useMemo(() => [
    {
      header: 'Option',
      accessor: (opt) => (
        <>
          <strong>Option {opt.option_number}</strong>
          <br />
          <span className="text-xs text-secondary">
            {opt.name}
          </span>
        </>
      ),
      searchValue: (opt) => `${opt.option_number} ${opt.name}`,
    },
    { header: 'Value', accessor: (opt) => Cell.code(opt.value || '(empty)'), searchValue: (opt) => opt.value || '' },
    { header: 'Type', accessor: 'type' },
    {
      header: 'Vendor',
      accessor: (opt) => opt.vendor_id
        ? <span className="text-xs">{getVendorName(opt.vendor_id)}</span>
        : <span className="text-xs text-muted">Global</span>,
      searchValue: (opt) => opt.vendor_id ? getVendorName(opt.vendor_id) : 'Global',
    },
    {
      header: 'Status',
      accessor: (opt) => (
        <span
          className={`status clickable ${opt.enabled ? 'online' : 'offline'}`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(opt.id);
          }}
          title={opt.enabled ? 'Click to disable' : 'Click to enable'}
        >
          {opt.enabled ? 'Enabled' : 'Disabled'}
        </span>
      ),
      searchValue: (opt) => opt.enabled ? 'Enabled' : 'Disabled',
    },
  ], []);

  // Actions for DHCP option tables
  const optionActions: TableAction<DhcpOption>[] = useMemo(() => [
    {
      icon: <Icon name="edit" size={14} />,
      label: 'Edit',
      onClick: form.openEdit,
      variant: 'secondary',
      tooltip: 'Edit option',
    },
    {
      icon: <Icon name="delete" size={14} />,
      label: 'Delete',
      onClick: (opt) => handleDelete(opt.id),
      variant: 'danger',
      tooltip: 'Delete option',
    },
  ], []);

  return (
    <LoadingState loading={loading} error={error} loadingMessage="Loading DHCP options...">
      <Card
        title="Quick Add Common Options"
        titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
        headerAction={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <SelectField
              name="filter-vendor"
              options={filterVendorOptions}
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
              placeholder="Filter: All Vendors"
              icon="filter_list"
              className="filter-dropdown"
            />
            <Button variant="secondary" onClick={handleReset}>
              Reset to Defaults
            </Button>
            <Button onClick={form.openAdd}>
              <PlusIcon size={16} />
              Add Option
            </Button>
          </div>
        }
      >
        <InfoSection open={showInfo}>
          <div>
            <p>
              DHCP options are sent to devices during the DHCP handshake. Use variables in option values
              that get replaced with actual values when generating the DHCP config.
            </p>
            <SimpleTable
              headers={['Variable', 'Description']}
              rows={[
                [Cell.code('${tftp_server_ip}'), 'TFTP server IP from global settings'],
                [Cell.code('${dhcp_gateway}'), 'DHCP gateway IP from global settings'],
                [Cell.code('${hostname}'), 'Device hostname (per-device)'],
                [Cell.code('${mac}'), 'Device MAC address (per-device)'],
              ]}
            />
          </div>
        </InfoSection>
        <div className="actions flex-wrap gap-8">
          {COMMON_DHCP_OPTIONS.map((common, idx) => (
            <Button
              key={`${common.number}-${idx}`}
              variant="secondary"
              size="sm"
              onClick={() => handleAddCommon(common)}
              title={common.description}
            >
              <PlusIcon size={12} />
              Option {common.number}: {common.name}
            </Button>
          ))}
        </div>
      </Card>

      <Card title="DHCP Options" titleAction={<InfoSection.Toggle open={showTableInfo} onToggle={setShowTableInfo} />}>
        <InfoSection open={showTableInfo}>
          <p>All configured DHCP options. Options can be enabled or disabled per vendor class to control what is sent during ZTP provisioning.</p>
        </InfoSection>
        <Table
          data={filteredOptions}
          columns={optionColumns}
          getRowKey={(opt) => opt.id}
          actions={optionActions}
          rowClassName={(opt) => !opt.enabled ? 'disabled-row' : undefined}
          tableId="dhcp-options"
          searchable
          searchPlaceholder="Search options..."
          emptyMessage="No DHCP options configured."
          emptyDescription='Add options using the buttons above or click "Reset to Defaults".'
        />
      </Card>

      <FormDialog
        isOpen={form.isOpen}
        onClose={form.close}
        title={form.getTitle('Add DHCP Option', 'Edit DHCP Option')}
        onSubmit={handleSubmit}
        submitText={form.getSubmitText('Add Option', 'Update Option')}
        variant="wide"
      >
        <div className="form-row">
          <FormField
            label="Option Number *"
            name="option_number"
            type="number"
            value={form.formData.option_number.toString()}
            onChange={form.handleChange}
            placeholder="e.g., 66"
            required
            min={1}
            max={255}
          />
          <FormField
            label="Option Name *"
            name="name"
            type="text"
            value={form.formData.name}
            onChange={form.handleChange}
            placeholder="e.g., TFTP Server"
            required
          />
        </div>

        <div className="form-row">
          <SelectField
            label="Value Type"
            name="type"
            value={form.formData.type}
            onChange={form.handleChange}
            options={DHCP_OPTION_TYPES}
          />
          <SelectField
            label="Vendor"
            name="vendor_id"
            value={form.formData.vendor_id}
            onChange={form.handleChange}
            options={vendorSelectOptions}
          />
        </div>

        <FormField
          label="Value"
          name="value"
          type="text"
          value={form.formData.value}
          onChange={form.handleChange}
          placeholder="e.g., 192.168.1.100 or ${tftp_server_ip}"
        />

        <FormField
          label="Description"
          name="description"
          type="text"
          value={form.formData.description}
          onChange={form.handleChange}
          placeholder="Optional description"
        />

        <Toggle
          label="Enabled"
          name="enabled"
          checked={form.formData.enabled}
          onChange={(checked) => form.setField('enabled', checked)}
        />
      </FormDialog>

      <ConfirmDialogRenderer />
    </LoadingState>
  );
}
