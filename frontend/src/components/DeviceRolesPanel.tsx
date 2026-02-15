import { useState, useMemo } from 'react';
import type { DeviceRole, DeviceRoleFormData, Template } from '@core';
import { Button } from './Button';
import { Card } from './Card';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { Icon, PlusIcon, RefreshIcon, SpinnerIcon } from './Icon';
import { useConfirm } from './ConfirmDialog';

interface DeviceRolesPanelProps {
  deviceRoles: DeviceRole[];
  templates: Template[];
  loading: boolean;
  onCreate: (data: DeviceRoleFormData) => Promise<boolean>;
  onUpdate: (id: string, data: DeviceRoleFormData) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onRefresh: () => void;
}

export function DeviceRolesPanel({ deviceRoles, templates, loading, onCreate, onUpdate, onDelete, onRefresh }: DeviceRolesPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<DeviceRole | null>(null);
  const [formData, setFormData] = useState<DeviceRoleFormData>({ name: '', description: '', template_ids: [] });
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialogRenderer } = useConfirm();

  const openCreate = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '', template_ids: [] });
    setShowForm(true);
  };

  const openEdit = (role: DeviceRole) => {
    setEditingRole(role);
    setFormData({
      id: role.id,
      name: role.name,
      description: role.description || '',
      template_ids: role.template_ids || [],
    });
    setShowForm(true);
  };

  const handleDelete = async (role: DeviceRole) => {
    const ok = await confirm({
      title: 'Delete Device Role',
      message: `Are you sure you want to delete the role "${role.name}"?`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) await onDelete(role.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      const ok = editingRole
        ? await onUpdate(editingRole.id, formData)
        : await onCreate(formData);
      if (ok) setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleTemplate = (templateId: string) => {
    setFormData(prev => {
      const ids = prev.template_ids.includes(templateId)
        ? prev.template_ids.filter(id => id !== templateId)
        : [...prev.template_ids, templateId];
      return { ...prev, template_ids: ids };
    });
  };

  const columns: TableColumn<DeviceRole>[] = useMemo(() => [
    {
      header: 'Name',
      accessor: (r) => r.name,
      searchValue: (r) => r.name,
    },
    {
      header: 'Templates',
      accessor: (r) => {
        const names = r.template_names || [];
        if (names.length === 0) return <span className="text-muted">None</span>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {names.map(name => Cell.badge(name, 'default'))}
          </div>
        );
      },
      searchValue: (r) => (r.template_names || []).join(' '),
    },
    {
      header: 'Description',
      accessor: (r) => r.description || <span className="text-muted">-</span>,
      searchValue: (r) => r.description || '',
    },
  ], []);

  const tableActions: TableAction<DeviceRole>[] = [
    {
      icon: <Icon name="edit" size={14} />,
      label: 'Edit',
      onClick: (r: DeviceRole) => openEdit(r),
      variant: 'secondary',
      tooltip: 'Edit role',
    },
    {
      icon: <Icon name="delete" size={14} />,
      label: 'Delete',
      onClick: (r: DeviceRole) => handleDelete(r),
      variant: 'danger',
      tooltip: 'Delete role',
    },
  ];

  return (
    <>
      <Card
        title="Device Roles"
        headerAction={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="primary" onClick={openCreate}>
              <PlusIcon size={14} />
              Add Role
            </Button>
            <Button variant="secondary" onClick={onRefresh} disabled={loading}>
              <RefreshIcon size={14} />
            </Button>
          </div>
        }
      >
        {loading && deviceRoles.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '24px', justifyContent: 'center' }}>
            <SpinnerIcon size={16} /> Loading device roles...
          </div>
        ) : (
          <Table
            data={deviceRoles}
            columns={columns}
            getRowKey={(r) => r.id}
            actions={tableActions}
            tableId="device-roles"
            searchable
            searchPlaceholder="Search roles..."
            emptyMessage="No device roles configured."
            emptyDescription="Add roles to assign templates to devices based on their function in the network."
          />
        )}
      </Card>

      <FormDialog
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingRole ? 'Edit Device Role' : 'Add Device Role'}
        onSubmit={handleSubmit}
        submitText={editingRole ? 'Update' : 'Create'}
        saving={saving}
        submitDisabled={!formData.name.trim()}
      >
        <FormField
          label="Name"
          name="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., core-router, access-switch"
          required
        />
        <FormField
          label="Description"
          name="description"
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description of this role"
        />
        <div className="form-field">
          <label className="form-field-label">Templates</label>
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            maxHeight: '200px',
            overflow: 'auto',
          }}>
            {templates.length === 0 ? (
              <div style={{ padding: '12px', color: 'var(--text-muted)' }}>No templates available</div>
            ) : (
              templates.map(t => (
                <label
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.template_ids.includes(t.id)}
                    onChange={() => toggleTemplate(t.id)}
                  />
                  <span>{t.name}</span>
                  {t.description && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: 'auto' }}>
                      {t.description}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {formData.template_ids.length} template{formData.template_ids.length !== 1 ? 's' : ''} selected
          </div>
        </div>
      </FormDialog>
      <ConfirmDialogRenderer />
    </>
  );
}
