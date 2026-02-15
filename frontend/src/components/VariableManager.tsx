import { useState, useMemo, useCallback } from 'react';
import {
  useDeviceVariables,
  useDevices,
  addNotification,
} from '@core';
import type { DeviceVariable, VariableKeyInfo } from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { IconButton } from './IconButton';
import { InfoSection } from './InfoSection';
import { LoadingState } from './LoadingState';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { Toggle } from './Toggle';
import { Table } from './Table';
import type { TableColumn, TableAction } from './Table';
import { PlusIcon, TrashIcon, EditIcon, Icon } from './Icon';
import { useConfirm } from './ConfirmDialog';

export function VariableManager() {
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [showInfo, setShowInfo] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDefault, setNewKeyDefault] = useState('');
  const [addToAll, setAddToAll] = useState(true);
  const [editingCell, setEditingCell] = useState<{ device_id: number; key: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showBulkSet, setShowBulkSet] = useState(false);
  const [bulkValue, setBulkValue] = useState('');

  const {
    keys,
    byKey,
    selectedKey,
    loading,
    error,
    refresh,
    selectKey,
    addKey,
    deleteKey,
    setVariable,
    deleteVariable,
    bulkSet,
  } = useDeviceVariables();

  const { devices } = useDevices();

  // Build an id -> hostname lookup
  const deviceMap = useMemo(() => {
    const map: Record<number, string> = {};
    devices.forEach(d => {
      map[d.id] = d.hostname || d.mac || String(d.id);
    });
    return map;
  }, [devices]);

  const handleAddKey = useCallback(async () => {
    if (!newKeyName.trim()) {
      addNotification('error', 'Key name is required');
      return;
    }
    const ids = addToAll
      ? devices.map(d => d.id)
      : [];
    if (ids.length === 0 && addToAll) {
      addNotification('error', 'No devices found');
      return;
    }
    const success = await addKey(newKeyName.trim(), ids, newKeyDefault);
    if (success) {
      setShowAddKey(false);
      setNewKeyName('');
      setNewKeyDefault('');
      selectKey(newKeyName.trim());
    }
  }, [newKeyName, newKeyDefault, addToAll, devices, addKey, selectKey]);

  const handleStartEdit = useCallback((v: DeviceVariable) => {
    setEditingCell({ device_id: v.device_id, key: v.key });
    setEditValue(v.value);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingCell) return;
    await setVariable(editingCell.device_id, editingCell.key, editValue);
    setEditingCell(null);
  }, [editingCell, editValue, setVariable]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleBulkSetAll = useCallback(async () => {
    if (!selectedKey) return;
    const entries = devices.map(d => ({ device_id: d.id, key: selectedKey, value: bulkValue }));
    const success = await bulkSet(entries);
    if (success) {
      setShowBulkSet(false);
      setBulkValue('');
    }
  }, [selectedKey, bulkValue, devices, bulkSet]);

  const handleDeleteKey = useCallback(async (key: string) => {
    if (!(await confirm({ title: 'Delete Variable', message: `Delete key "${key}" from all devices?`, confirmText: 'Delete', destructive: true }))) return;
    await deleteKey(key);
  }, [deleteKey]);

  // Value table columns
  const valueColumns: TableColumn<DeviceVariable>[] = useMemo(() => [
    {
      header: 'Device',
      accessor: (row: DeviceVariable) => deviceMap[row.device_id] || String(row.device_id),
      searchValue: (row: DeviceVariable) => `${deviceMap[row.device_id] || ''} ${row.device_id}`,
    },
    {
      header: 'Device ID',
      accessor: 'device_id' as keyof DeviceVariable,
      hideOnMobile: true,
    },
    {
      header: 'Value',
      accessor: (row: DeviceVariable) => {
        const isEditing = editingCell?.device_id === row.device_id && editingCell?.key === row.key;
        if (isEditing) {
          return (
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                autoFocus
                className="form-input"
                style={{ flex: 1, minWidth: 0 }}
              />
              <Button size="sm" onClick={handleSaveEdit}>Save</Button>
              <Button size="sm" variant="secondary" onClick={handleCancelEdit}>Cancel</Button>
            </div>
          );
        }
        return (
          <span
            style={{ cursor: 'pointer', borderBottom: '1px dashed var(--border-color)' }}
            onClick={() => handleStartEdit(row)}
            title="Click to edit"
          >
            {row.value || <span style={{ opacity: 0.4 }}>(empty)</span>}
          </span>
        );
      },
    },
  ], [editingCell, editValue, handleSaveEdit, handleCancelEdit, handleStartEdit, deviceMap]);

  const valueActions: TableAction<DeviceVariable>[] = useMemo(() => [
    {
      icon: <EditIcon size={14} />,
      label: 'Edit',
      onClick: (row: DeviceVariable) => handleStartEdit(row),
    },
    {
      icon: <TrashIcon size={14} />,
      label: 'Delete',
      onClick: (row: DeviceVariable) => deleteVariable(row.device_id, row.key),
      variant: 'danger' as const,
    },
  ], [handleStartEdit, deleteVariable]);

  return (
    <LoadingState loading={loading} error={error} loadingMessage="Loading variables...">
      <ActionBar>
        <Button onClick={() => setShowAddKey(true)}>
          <PlusIcon size={16} />
          Add Key
        </Button>
        <Button variant="secondary" onClick={refresh}>
          <Icon name="refresh" size={16} />
          Refresh
        </Button>
      </ActionBar>

      <Card title="Device Variables" headerAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}>
        <InfoSection open={showInfo}>
          <div>
            <p>
              Device variables are key-value pairs assigned per device. They are available in templates
              as <code>{'{{vars.KeyName}}'}</code>. Use them for per-device values like loopback IPs, ASNs, or peer addresses.
            </p>
            <p>
              <strong>Add Key</strong> creates a new variable key across all (or selected) devices.
              Click a key name to view and edit values per device. Click a value to edit it inline.
            </p>
          </div>
        </InfoSection>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '0', minHeight: '400px' }}>
          {/* Left panel: Key list */}
          <div style={{ borderRight: '1px solid var(--border-color)' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: '13px', opacity: 0.7 }}>
              KEYS ({keys.length})
            </div>
            {keys.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', opacity: 0.6, fontSize: '13px' }}>
                No variable keys defined yet.
              </div>
            ) : (
              <div style={{ maxHeight: '600px', overflow: 'auto' }}>
                {keys.map(k => (
                  <div
                    key={k.key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 16px',
                      cursor: 'pointer',
                      background: selectedKey === k.key ? 'var(--selection-bg, rgba(100, 149, 237, 0.15))' : 'transparent',
                      borderLeft: selectedKey === k.key ? '3px solid var(--accent-color, #6495ed)' : '3px solid transparent',
                    }}
                    onClick={() => selectKey(k.key)}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>{k.key}</div>
                      <div style={{ fontSize: '12px', opacity: 0.6 }}>{k.device_count} device(s)</div>
                    </div>
                    <IconButton
                      variant="danger"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleDeleteKey(k.key); }}
                      title="Delete key"
                    >
                      <TrashIcon size={14} />
                    </IconButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right panel: Values for selected key */}
          <div>
            {selectedKey ? (
              <>
                <div style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{selectedKey}</span>
                    <span style={{ opacity: 0.6, marginLeft: '8px', fontSize: '13px' }}>
                      ({byKey.length} device{byKey.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setShowBulkSet(true)}>
                    Set All
                  </Button>
                </div>
                <Table
                  data={byKey}
                  columns={valueColumns}
                  actions={valueActions}
                  getRowKey={(row) => `${row.device_id}-${row.key}`}
                  tableId="device-variables"
                  emptyMessage="No devices have this variable set."
                  emptyDescription="Add the key to devices using the Add Key dialog."
                  searchable
                  searchPlaceholder="Filter by device..."
                />
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
                Select a key to view and edit values
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Add Key Modal */}
      <FormDialog isOpen={showAddKey} onClose={() => setShowAddKey(false)} title="Add Variable Key" onSubmit={(e) => { e.preventDefault(); handleAddKey(); }} submitText="Add Key">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Key Name" name="keyName" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g., Loopback, ASN, VLAN_ID" />
          <FormField label="Default Value" name="defaultValue" value={newKeyDefault} onChange={(e) => setNewKeyDefault(e.target.value)} placeholder="Leave empty or set a default" />
          <Toggle label={`Add to all devices (${devices.length})`} checked={addToAll} onChange={setAddToAll} />
        </div>
      </FormDialog>

      {/* Bulk Set Modal */}
      <FormDialog isOpen={showBulkSet} onClose={() => setShowBulkSet(false)} title={`Set "${selectedKey}" for All Devices`} onSubmit={(e) => { e.preventDefault(); handleBulkSetAll(); }} submitText="Set All">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <FormField label="Value" name="bulkValue" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="Value to set for all devices" />
          <p style={{ fontSize: '13px', opacity: 0.7 }}>
            This will set "{selectedKey}" to this value for all {devices.length} device(s).
          </p>
        </div>
      </FormDialog>
    </LoadingState>
  );
}
