import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useGroups,
  useDevices,
  addNotification,
} from '@core';
import type { Group, GroupFormData, GroupVariable } from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { IconButton } from './IconButton';
import { InfoSection } from './InfoSection';
import { LoadingState } from './LoadingState';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { SelectField } from './SelectField';
import { Table } from './Table';
import type { TableColumn, TableAction } from './Table';
import { PlusIcon, TrashIcon, EditIcon, Icon } from './Icon';

const EMPTY_GROUP_FORM: GroupFormData = {
  id: '',
  name: '',
  description: '',
  parent_id: '',
  precedence: 1000,
};

export function GroupManagement() {
  const [showInfo, setShowInfo] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormData>(EMPTY_GROUP_FORM);
  const [activeTab, setActiveTab] = useState<'variables' | 'members'>('variables');

  // Variable editing
  const [showAddVar, setShowAddVar] = useState(false);
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [editingVar, setEditingVar] = useState<{ key: string } | null>(null);
  const [editVarValue, setEditVarValue] = useState('');

  // Member management
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const {
    groups,
    loading,
    error,
    refresh,
    createGroup,
    updateGroup,
    deleteGroup,
    groupVariables,
    groupVariablesLoading,
    fetchGroupVariables,
    setGroupVariable,
    deleteGroupVariable,
    members,
    membersLoading,
    fetchMembers,
    addMember,
    removeMember,
  } = useGroups();

  const { devices } = useDevices();

  const selectedGroup = useMemo(() => {
    return groups.find(g => g.id === selectedGroupId) || null;
  }, [groups, selectedGroupId]);

  // When selection changes, load variables and members
  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupVariables(selectedGroupId);
      fetchMembers(selectedGroupId);
    }
  }, [selectedGroupId, fetchGroupVariables, fetchMembers]);

  // Build tree structure
  const groupTree = useMemo(() => {
    const childrenMap: Record<string, Group[]> = {};
    groups.forEach(g => {
      const parentKey = g.parent_id || '__root__';
      if (!childrenMap[parentKey]) childrenMap[parentKey] = [];
      childrenMap[parentKey].push(g);
    });

    interface TreeNode {
      group: Group;
      depth: number;
    }

    const result: TreeNode[] = [];
    const buildTree = (parentId: string | null, depth: number) => {
      const key = parentId || '__root__';
      const children = childrenMap[key] || [];
      for (const child of children) {
        result.push({ group: child, depth });
        buildTree(child.id, depth + 1);
      }
    };

    // "all" group first (no parent)
    const allGroup = groups.find(g => g.id === 'all');
    if (allGroup) {
      result.push({ group: allGroup, depth: 0 });
      buildTree('all', 1);
    }
    // Any orphan groups (parent not in tree)
    const inTree = new Set(result.map(n => n.group.id));
    groups.filter(g => !inTree.has(g.id)).forEach(g => {
      result.push({ group: g, depth: 0 });
    });

    return result;
  }, [groups]);

  // Device lookup
  const deviceMap = useMemo(() => {
    const map: Record<string, string> = {};
    devices.forEach(d => { map[d.id] = d.hostname || d.mac; });
    return map;
  }, [devices]);

  // Devices not in current group (for add member dropdown)
  const availableDevices = useMemo(() => {
    const memberSet = new Set(members);
    return devices.filter(d => !memberSet.has(d.id));
  }, [devices, members]);

  // Parent options for group form (exclude self and descendants)
  const parentOptions = useMemo(() => {
    const opts = [{ value: '', label: '(none - root level)' }];
    groups
      .filter(g => g.id !== editingGroup?.id)
      .forEach(g => {
        opts.push({ value: g.id, label: `${g.name} (prec: ${g.precedence})` });
      });
    return opts;
  }, [groups, editingGroup]);

  // Handlers
  const handleSelectGroup = useCallback((id: string) => {
    setSelectedGroupId(id);
    setActiveTab('variables');
  }, []);

  const handleOpenCreate = useCallback(() => {
    setEditingGroup(null);
    setGroupForm(EMPTY_GROUP_FORM);
    setShowGroupForm(true);
  }, []);

  const handleOpenEdit = useCallback((group: Group) => {
    setEditingGroup(group);
    setGroupForm({
      id: group.id,
      name: group.name,
      description: group.description || '',
      parent_id: group.parent_id || '',
      precedence: group.precedence,
    });
    setShowGroupForm(true);
  }, []);

  const handleSubmitGroup = useCallback(async () => {
    if (!groupForm.id.trim() || !groupForm.name.trim()) {
      addNotification('error', 'ID and Name are required');
      return;
    }
    const data: Partial<GroupFormData> = {
      id: groupForm.id.trim(),
      name: groupForm.name.trim(),
      description: groupForm.description || undefined,
      parent_id: groupForm.parent_id || undefined,
      precedence: groupForm.precedence,
    };

    let success: boolean;
    if (editingGroup) {
      success = await updateGroup(editingGroup.id, data);
    } else {
      success = await createGroup(data);
    }
    if (success) {
      setShowGroupForm(false);
      if (!editingGroup) setSelectedGroupId(groupForm.id.trim());
    }
  }, [groupForm, editingGroup, createGroup, updateGroup]);

  const handleDeleteGroup = useCallback(async (id: string) => {
    if (id === 'all') {
      addNotification('error', 'Cannot delete the "all" group');
      return;
    }
    if (!confirm(`Delete group "${id}"? Variables will be lost and child groups will become root-level.`)) return;
    const success = await deleteGroup(id);
    if (success && selectedGroupId === id) {
      setSelectedGroupId(null);
    }
  }, [deleteGroup, selectedGroupId]);

  const handleAddVariable = useCallback(async () => {
    if (!selectedGroupId || !newVarKey.trim()) {
      addNotification('error', 'Key name is required');
      return;
    }
    const success = await setGroupVariable(selectedGroupId, newVarKey.trim(), newVarValue);
    if (success) {
      setShowAddVar(false);
      setNewVarKey('');
      setNewVarValue('');
    }
  }, [selectedGroupId, newVarKey, newVarValue, setGroupVariable]);

  const handleStartEditVar = useCallback((v: GroupVariable) => {
    setEditingVar({ key: v.key });
    setEditVarValue(v.value);
  }, []);

  const handleSaveEditVar = useCallback(async () => {
    if (!selectedGroupId || !editingVar) return;
    await setGroupVariable(selectedGroupId, editingVar.key, editVarValue);
    setEditingVar(null);
  }, [selectedGroupId, editingVar, editVarValue, setGroupVariable]);

  const handleAddMember = useCallback(async () => {
    if (!selectedGroupId || !selectedDeviceId) return;
    const success = await addMember(selectedGroupId, selectedDeviceId);
    if (success) {
      setShowAddMember(false);
      setSelectedDeviceId('');
    }
  }, [selectedGroupId, selectedDeviceId, addMember]);

  const handleRemoveMember = useCallback(async (deviceId: string) => {
    if (!selectedGroupId) return;
    await removeMember(selectedGroupId, deviceId);
  }, [selectedGroupId, removeMember]);

  // Variable table columns
  const varColumns: TableColumn<GroupVariable>[] = useMemo(() => [
    { header: 'Key', accessor: 'key' as keyof GroupVariable },
    {
      header: 'Value',
      accessor: (row: GroupVariable) => {
        const isEditing = editingVar?.key === row.key;
        if (isEditing) {
          return (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="text"
                value={editVarValue}
                onChange={(e) => setEditVarValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEditVar();
                  if (e.key === 'Escape') setEditingVar(null);
                }}
                autoFocus
                className="form-input"
                style={{ flex: 1, minWidth: 0 }}
              />
              <Button size="sm" onClick={handleSaveEditVar}>Save</Button>
              <Button size="sm" variant="secondary" onClick={() => setEditingVar(null)}>Cancel</Button>
            </div>
          );
        }
        return (
          <span
            style={{ cursor: 'pointer', borderBottom: '1px dashed var(--border-color)' }}
            onClick={() => handleStartEditVar(row)}
            title="Click to edit"
          >
            {row.value || <span style={{ opacity: 0.4 }}>(empty)</span>}
          </span>
        );
      },
    },
  ], [editingVar, editVarValue, handleSaveEditVar, handleStartEditVar]);

  const varActions: TableAction<GroupVariable>[] = useMemo(() => [
    {
      icon: <EditIcon size={14} />,
      label: 'Edit',
      onClick: (row: GroupVariable) => handleStartEditVar(row),
    },
    {
      icon: <TrashIcon size={14} />,
      label: 'Delete',
      onClick: (row: GroupVariable) => {
        if (selectedGroupId) deleteGroupVariable(selectedGroupId, row.key);
      },
      variant: 'danger' as const,
    },
  ], [handleStartEditVar, selectedGroupId, deleteGroupVariable]);

  // Member table columns
  interface MemberRow { id: string; hostname: string }
  const memberData: MemberRow[] = useMemo(() =>
    members.map(id => ({ id, hostname: deviceMap[id] || id })),
    [members, deviceMap]
  );

  const memberColumns: TableColumn<MemberRow>[] = useMemo(() => [
    { header: 'Hostname', accessor: 'hostname' as keyof MemberRow },
    { header: 'ID', accessor: 'id' as keyof MemberRow },
  ], []);

  const memberActions: TableAction<MemberRow>[] = useMemo(() => [
    {
      icon: <TrashIcon size={14} />,
      label: 'Remove',
      onClick: (row: MemberRow) => handleRemoveMember(row.id),
      variant: 'danger' as const,
    },
  ], [handleRemoveMember]);

  return (
    <LoadingState loading={loading} error={error} loadingMessage="Loading groups...">
      <ActionBar>
        <Button onClick={handleOpenCreate}>
          <PlusIcon size={16} />
          Add Group
        </Button>
        <Button variant="secondary" onClick={refresh}>
          <Icon name="refresh" size={16} />
          Refresh
        </Button>
      </ActionBar>

      <Card title="Device Groups" headerAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}>
        <InfoSection open={showInfo}>
          <div>
            <p>
              Groups enable Ansible-style variable inheritance. Variables set on a group are inherited by all
              devices in that group. Groups can be nested (parent/child), and a precedence value determines
              merge order when a device belongs to multiple groups.
            </p>
            <p>
              <strong>Resolution order</strong> (lowest to highest priority): <code>all</code> group &rarr; group vars
              (by depth, then precedence) &rarr; host vars (device variables). Host vars always win.
            </p>
          </div>
        </InfoSection>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '0', minHeight: '500px' }}>
          {/* Left panel: Group tree */}
          <div style={{ borderRight: '1px solid var(--border-color)' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: '13px', opacity: 0.7 }}>
              GROUPS ({groups.length})
            </div>
            {groups.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
                No groups defined yet.
              </div>
            ) : (
              <div style={{ maxHeight: '600px', overflow: 'auto' }}>
                {groupTree.map(({ group: g, depth }) => (
                  <div
                    key={g.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 16px',
                      paddingLeft: `${16 + depth * 20}px`,
                      cursor: 'pointer',
                      background: selectedGroupId === g.id ? 'var(--selection-bg, rgba(100, 149, 237, 0.15))' : 'transparent',
                      borderLeft: selectedGroupId === g.id ? '3px solid var(--accent-color, #6495ed)' : '3px solid transparent',
                    }}
                    onClick={() => handleSelectGroup(g.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon name={g.id === 'all' ? 'public' : depth > 0 ? 'subdirectory_arrow_right' : 'folder'} size={16} />
                        <span style={{ fontWeight: g.id === 'all' ? 600 : 500 }}>{g.name}</span>
                        <span style={{
                          fontSize: '11px',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          background: 'var(--border-color)',
                          opacity: 0.7,
                        }}>
                          {g.precedence}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.6, marginTop: '2px' }}>
                        {g.device_count ?? 0} device{(g.device_count ?? 0) !== 1 ? 's' : ''}
                        {(g.child_count ?? 0) > 0 && ` · ${g.child_count} child${(g.child_count ?? 0) !== 1 ? 'ren' : ''}`}
                      </div>
                    </div>
                    {g.id !== 'all' && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <IconButton
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleOpenEdit(g); }}
                          title="Edit group"
                        >
                          <EditIcon size={14} />
                        </IconButton>
                        <IconButton
                          variant="danger"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }}
                          title="Delete group"
                        >
                          <TrashIcon size={14} />
                        </IconButton>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel: Selected group detail */}
          <div>
            {selectedGroup ? (
              <>
                {/* Group header */}
                <div style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>{selectedGroup.name}</span>
                    {selectedGroup.description && (
                      <span style={{ opacity: 0.6, marginLeft: '8px', fontSize: '13px' }}>
                        &mdash; {selectedGroup.description}
                      </span>
                    )}
                    <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '2px' }}>
                      Precedence: {selectedGroup.precedence}
                      {selectedGroup.parent_id && ` · Parent: ${selectedGroup.parent_id}`}
                    </div>
                  </div>
                  {selectedGroup.id !== 'all' && (
                    <IconButton size="sm" onClick={() => handleOpenEdit(selectedGroup)} title="Edit group">
                      <EditIcon size={16} />
                    </IconButton>
                  )}
                </div>

                {/* Tabs */}
                <div style={{
                  display: 'flex',
                  borderBottom: '1px solid var(--border-color)',
                }}>
                  {(['variables', 'members'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        padding: '8px 20px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === tab ? '2px solid var(--accent-color, #6495ed)' : '2px solid transparent',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontWeight: activeTab === tab ? 600 : 400,
                        fontSize: '13px',
                        textTransform: 'capitalize',
                      }}
                    >
                      {tab} ({tab === 'variables' ? groupVariables.length : members.length})
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {activeTab === 'variables' && (
                  <div>
                    <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
                      <Button size="sm" onClick={() => setShowAddVar(true)}>
                        <PlusIcon size={14} />
                        Add Variable
                      </Button>
                    </div>
                    <LoadingState loading={groupVariablesLoading} loadingMessage="Loading variables...">
                      <Table
                        data={groupVariables}
                        columns={varColumns}
                        actions={varActions}
                        getRowKey={(row) => `${row.group_id}-${row.key}`}
                        tableId="group-variables"
                        emptyMessage="No variables set on this group."
                        emptyDescription="Add variables to configure group-level settings."
                        searchable
                        searchPlaceholder="Filter variables..."
                      />
                    </LoadingState>
                  </div>
                )}

                {activeTab === 'members' && (
                  <div>
                    <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end' }}>
                      <Button size="sm" onClick={() => setShowAddMember(true)}>
                        <PlusIcon size={14} />
                        Add Device
                      </Button>
                    </div>
                    <LoadingState loading={membersLoading} loadingMessage="Loading members...">
                      <Table
                        data={memberData}
                        columns={memberColumns}
                        actions={memberActions}
                        getRowKey={(row) => row.id}
                        tableId="group-members"
                        emptyMessage={selectedGroup.id === 'all' ?
                          'All devices implicitly belong to the "all" group.' :
                          'No devices in this group.'
                        }
                        emptyDescription={selectedGroup.id === 'all' ?
                          'No explicit membership needed for the "all" group.' :
                          'Add devices using the button above.'
                        }
                        searchable
                        searchPlaceholder="Filter devices..."
                      />
                    </LoadingState>
                  </div>
                )}
              </>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: '300px',
                opacity: 0.5,
                fontSize: '14px',
              }}>
                Select a group to view variables and members
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Create/Edit Group Modal */}
      <FormDialog isOpen={showGroupForm} onClose={() => setShowGroupForm(false)} title={editingGroup ? 'Edit Group' : 'Create Group'} onSubmit={(e) => { e.preventDefault(); handleSubmitGroup(); }} submitText={editingGroup ? 'Update' : 'Create'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="ID" name="id" value={groupForm.id} onChange={(e) => setGroupForm(f => ({ ...f, id: e.target.value }))} placeholder="e.g., spines, leafs, dc-east" disabled={!!editingGroup} />
          <FormField label="Name" name="name" value={groupForm.name} onChange={(e) => setGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="Display name" />
          <FormField label="Description" name="description" value={groupForm.description} onChange={(e) => setGroupForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
          <SelectField label="Parent Group" name="parent_id" value={groupForm.parent_id} onChange={(e) => setGroupForm(f => ({ ...f, parent_id: e.target.value }))} options={parentOptions} disabled={editingGroup?.id === 'all'} />
          <FormField label="Precedence" name="precedence" type="number" value={String(groupForm.precedence)} onChange={(e) => setGroupForm(f => ({ ...f, precedence: parseInt(e.target.value) || 1000 }))} disabled={editingGroup?.id === 'all'} />
        </div>
      </FormDialog>

      {/* Add Variable Modal */}
      <FormDialog isOpen={showAddVar} onClose={() => setShowAddVar(false)} title="Add Group Variable" onSubmit={(e) => { e.preventDefault(); handleAddVariable(); }} submitText="Add">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Key" name="varKey" value={newVarKey} onChange={(e) => setNewVarKey(e.target.value)} placeholder="e.g., DNS, NTP, VLAN" />
          <FormField label="Value" name="varValue" value={newVarValue} onChange={(e) => setNewVarValue(e.target.value)} placeholder="Variable value" />
        </div>
      </FormDialog>

      {/* Add Member Modal */}
      <FormDialog isOpen={showAddMember} onClose={() => setShowAddMember(false)} title="Add Device to Group" onSubmit={(e) => { e.preventDefault(); handleAddMember(); }} submitText="Add">
        <SelectField
          label="Device"
          name="device"
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          options={[
            { value: '', label: 'Select a device...' },
            ...availableDevices.map(d => ({
              value: d.id,
              label: `${d.hostname || d.mac} (${d.mac})`,
            })),
          ]}
        />
      </FormDialog>
    </LoadingState>
  );
}
