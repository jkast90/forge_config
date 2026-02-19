import { useState, useMemo } from 'react';
import type { DeviceRole, DeviceRoleFormData, Template, Group } from '@core';
import { Button } from './Button';
import { Card } from './Card';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { Icon, PlusIcon, SpinnerIcon } from './Icon';
import { InfoSection } from './InfoSection';
import { Toggle } from './Toggle';
import { useConfirm } from './ConfirmDialog';

interface DeviceRolesPanelProps {
  deviceRoles: DeviceRole[];
  templates: Template[];
  groups: Group[];
  loading: boolean;
  onCreate: (data: DeviceRoleFormData) => Promise<boolean>;
  onUpdate: (id: number | string, data: DeviceRoleFormData) => Promise<boolean>;
  onDelete: (id: number | string) => Promise<boolean>;
}

export function DeviceRolesPanel({ deviceRoles, templates, groups, loading, onCreate, onUpdate, onDelete }: DeviceRolesPanelProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<DeviceRole | null>(null);
  const [formData, setFormData] = useState<DeviceRoleFormData>({ name: '', description: '', template_ids: [], group_names: [] });
  const [saving, setSaving] = useState(false);
  const { confirm, ConfirmDialogRenderer } = useConfirm();

  const openCreate = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '', template_ids: [], group_names: [] });
    setShowForm(true);
  };

  const openEdit = (role: DeviceRole) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      template_ids: role.template_ids || [],
      group_names: role.group_names || [],
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

  const toggleTemplate = (templateId: number) => {
    setFormData(prev => {
      const ids = prev.template_ids.includes(templateId)
        ? prev.template_ids.filter(id => id !== templateId)
        : [...prev.template_ids, templateId];
      return { ...prev, template_ids: ids };
    });
  };

  const toggleGroup = (groupName: string) => {
    setFormData(prev => {
      const names = prev.group_names.includes(groupName)
        ? prev.group_names.filter(n => n !== groupName)
        : [...prev.group_names, groupName];
      return { ...prev, group_names: names };
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
            {names.map(name => <span key={name}>{Cell.badge(name, 'default')}</span>)}
          </div>
        );
      },
      searchValue: (r) => (r.template_names || []).join(' '),
    },
    {
      header: 'Groups',
      accessor: (r) => {
        const names = r.group_names || [];
        if (names.length === 0) return <span className="text-muted">None</span>;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {names.map(name => <span key={name}>{Cell.badge(name, 'default')}</span>)}
          </div>
        );
      },
      searchValue: (r) => (r.group_names || []).join(' '),
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
        titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
        headerAction={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="primary" onClick={openCreate}>
              <PlusIcon size={14} />
              Add Role
            </Button>
          </div>
        }
      >
        <InfoSection open={showInfo}>
          <div>
            <p>
              Device roles group templates and variable sets that are applied together to matching devices.
              Assign roles to devices or groups to control which configurations are deployed.
            </p>
            <ul>
              <li>Each role can reference one or more configuration templates</li>
              <li>Roles can be scoped to device groups for targeted deployment</li>
            </ul>
          </div>
        </InfoSection>
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
            padding: '4px 12px',
          }}>
            {templates.length === 0 ? (
              <div style={{ padding: '12px 0', color: 'var(--text-muted)' }}>No templates available</div>
            ) : (
              templates.map(t => (
                <Toggle
                  key={t.id}
                  label={t.name}
                  description={t.description || undefined}
                  checked={formData.template_ids.includes(t.id)}
                  onChange={() => toggleTemplate(t.id)}
                />
              ))
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {formData.template_ids.length} template{formData.template_ids.length !== 1 ? 's' : ''} selected
          </div>
        </div>
        <div className="form-field">
          <label className="form-field-label">Auto-assign Groups</label>
          <div style={{
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            maxHeight: '200px',
            overflow: 'auto',
            padding: '4px 12px',
          }}>
            {groups.length === 0 ? (
              <div style={{ padding: '12px 0', color: 'var(--text-muted)' }}>No groups available</div>
            ) : (
              groups.map(g => (
                <Toggle
                  key={g.id}
                  label={g.name}
                  description={g.description || undefined}
                  checked={formData.group_names.includes(g.name)}
                  onChange={() => toggleGroup(g.name)}
                />
              ))
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Devices with this role will be automatically added to the selected groups.
          </div>
        </div>
      </FormDialog>
      <ConfirmDialogRenderer />
    </>
  );
}
