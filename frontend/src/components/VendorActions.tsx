import { useState, useMemo } from 'react';
import type { VendorAction, VendorActionFormData } from '@core';
import {
  useVendorActions,
  useModalForm,
  getVendorFilterOptions,
  getVendorSelectOptions,
  getVendorName,
  filterByVendor,
  generateId,
  EMPTY_VENDOR_ACTION_FORM,
} from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { DropdownSelect } from './DropdownSelect';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { LoadingState } from './LoadingState';
import { SelectField } from './SelectField';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { PlusIcon, Icon } from './Icon';

export function VendorActions() {
  const [filterVendor, setFilterVendor] = useState('');
  const {
    actions,
    loading,
    error,
    createAction,
    updateAction,
    deleteAction,
  } = useVendorActions({ vendorFilter: filterVendor || 'all' });

  const form = useModalForm<VendorAction, VendorActionFormData>({
    emptyFormData: EMPTY_VENDOR_ACTION_FORM,
    itemToFormData: (action) => ({
      id: action.id,
      vendor_id: action.vendor_id,
      label: action.label,
      command: action.command,
      sort_order: action.sort_order,
    }),
    onCreate: (data) => createAction({
      ...data,
      id: data.id || generateId('action'),
    }),
    onUpdate: (id, data) => updateAction(id, data),
    getItemId: (a) => a.id,
    modalName: 'action-form',
  });

  const filterVendorOptions = useMemo(() => getVendorFilterOptions(), []);
  const vendorSelectOptions = useMemo(() => {
    // For actions, vendor is required — remove the "Global" option
    return getVendorSelectOptions().filter(o => o.value !== '');
  }, []);

  const filteredActions = useMemo(
    () => filterByVendor(actions, filterVendor, (a) => a.vendor_id),
    [actions, filterVendor]
  );

  const handleDelete = async (id: string) => {
    const action = actions.find((a) => a.id === id);
    if (action && confirm(`Delete action "${action.label}"?`)) {
      await deleteAction(id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await form.submit();
  };

  const actionColumns: TableColumn<VendorAction>[] = useMemo(() => [
    {
      header: 'Vendor',
      accessor: (a) => <span className="text-xs">{getVendorName(a.vendor_id)}</span>,
      searchValue: (a) => getVendorName(a.vendor_id),
    },
    { header: 'Label', accessor: 'label' },
    { header: 'Command', accessor: (a) => Cell.code(a.command), searchValue: (a) => a.command },
    { header: 'Order', accessor: (a) => String(a.sort_order), searchable: false },
  ], []);

  const tableActions: TableAction<VendorAction>[] = useMemo(() => [
    {
      icon: <Icon name="edit" size={14} />,
      label: 'Edit',
      onClick: form.openEdit,
      variant: 'secondary',
      tooltip: 'Edit action',
    },
    {
      icon: <Icon name="delete" size={14} />,
      label: 'Delete',
      onClick: (a) => handleDelete(a.id),
      variant: 'danger',
      tooltip: 'Delete action',
    },
  ], []);

  return (
    <LoadingState loading={loading} error={error} loadingMessage="Loading actions...">
      <ActionBar>
        <Button onClick={form.openAdd}>
          <PlusIcon size={16} />
          Add Action
        </Button>
        <DropdownSelect
          options={filterVendorOptions}
          value={filterVendor}
          onChange={setFilterVendor}
          placeholder="Filter: All Vendors"
          icon="filter_list"
          className="filter-dropdown"
        />
      </ActionBar>

      <Card title="Vendor Actions">
        <Table
          data={filteredActions}
          columns={actionColumns}
          getRowKey={(a) => a.id}
          actions={tableActions}
          tableId="vendor-actions"
          searchable
          searchPlaceholder="Search actions..."
          emptyMessage="No vendor actions configured."
          emptyDescription="Add actions using the button above."
        />
      </Card>

      <FormDialog
        isOpen={form.isOpen}
        onClose={form.close}
        title={form.getTitle('Add Action', 'Edit Action')}
        onSubmit={handleSubmit}
        submitText={form.getSubmitText('Add Action', 'Update Action')}
        variant="wide"
      >
        <div className="form-row">
          <SelectField
            label="Vendor *"
            name="vendor_id"
            value={form.formData.vendor_id}
            onChange={form.handleChange}
            options={vendorSelectOptions}
            required
          />
          <FormField
            label="Label *"
            name="label"
            type="text"
            value={form.formData.label}
            onChange={form.handleChange}
            placeholder="e.g., Show Version"
            required
          />
        </div>

        <FormField
          label="Command *"
          name="command"
          type="text"
          value={form.formData.command}
          onChange={form.handleChange}
          placeholder="e.g., show version"
          required
        />

        <FormField
          label="Sort Order"
          name="sort_order"
          type="number"
          value={form.formData.sort_order.toString()}
          onChange={form.handleChange}
          placeholder="0"
          min={0}
        />
      </FormDialog>
    </LoadingState>
  );
}
