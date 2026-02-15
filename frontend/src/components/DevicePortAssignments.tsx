import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Device, DeviceModel, ChassisPort, ChassisRow, PortAssignment, SetPortAssignmentRequest } from '@core';
import {
  usePortAssignments,
  useDevices,
  useDeviceModels,
  useIpam,
  isPatchPanel as checkIsPatchPanel,
  buildPortAssignmentMap,
  buildDeviceOptions,
  buildPortOptionsFromModel,
  buildPatchPanelOptions,
  findDeviceModel,
  countModelPorts,
  countAssignedPorts,
  getConnectorWidth,
  getSpeedColorName,
  addNotification,
  CONNECTOR_WIDTHS,
  SPEED_COLOR_NAMES,
} from '@core';
import { Modal } from './Modal';
import { Button } from './Button';
import { DialogActions } from './DialogActions';
import { SelectField } from './SelectField';
import { FormField } from './FormField';
import { Tooltip } from './Tooltip';
import { Icon, SpinnerIcon } from './Icon';

interface Props {
  device: Device;
  onClose: () => void;
}

// Speed colors mapped to CSS variables for web rendering
const SPEED_COLORS: Record<number, string> = {
  1000: 'var(--color-success)',
  2500: '#4ade80',
  10000: 'var(--color-accent-blue)',
  25000: 'var(--color-accent-teal)',
  40000: '#f59e0b',
  50000: '#f97316',
  100000: '#f97316',
  400000: 'var(--color-accent-purple)',
};

interface PortWithAssignment {
  port: ChassisPort;
  assignment?: PortAssignment;
}

function AssignablePort({ port, assignment, selected, onClick, isPatchPanel, devices: allDevices }: {
  port: ChassisPort;
  assignment?: PortAssignment;
  selected: boolean;
  onClick: () => void;
  isPatchPanel?: boolean;
  devices?: Device[];
}) {
  const width = getConnectorWidth(port.connector);
  const speedColor = SPEED_COLORS[port.speed] || 'var(--color-text-muted)';
  const isAssigned = !!assignment?.remote_device_id;

  const borderColor = selected ? 'var(--color-accent-blue)' : isAssigned ? 'var(--color-success)' : speedColor;
  const bgColor = selected
    ? 'color-mix(in srgb, var(--color-accent-blue) 30%, transparent)'
    : isAssigned
      ? 'color-mix(in srgb, var(--color-success) 25%, transparent)'
      : `color-mix(in srgb, ${speedColor} 15%, transparent)`;

  let tooltipLines: string[];
  if (isPatchPanel && assignment) {
    // For patch panels, show the source device:port → remote device:port connection
    const srcDevice = allDevices?.find((d) => d.id === assignment.device_id);
    const srcName = srcDevice?.hostname || assignment.device_id;
    const dstName = assignment.remote_device_hostname || assignment.remote_device_id || '?';
    tooltipLines = [
      port.vendor_port_name,
      `${srcName}:${assignment.port_name} → ${dstName}:${assignment.remote_port_name}`,
      assignment.description || '',
    ].filter(Boolean);
  } else {
    tooltipLines = [
      port.vendor_port_name,
      isAssigned ? `→ ${assignment!.remote_device_hostname || assignment!.remote_device_id || '?'}` : 'Unassigned',
      isAssigned && assignment!.remote_port_name ? `  Port: ${assignment!.remote_port_name}` : null,
      assignment?.vrf_name ? `  VRF: ${assignment.vrf_name}` : null,
      assignment?.patch_panel_a_hostname ? `  via PP: ${assignment.patch_panel_a_hostname}:${assignment.patch_panel_a_port}` : null,
      assignment?.patch_panel_b_hostname ? `  via PP: ${assignment.patch_panel_b_hostname}:${assignment.patch_panel_b_port}` : null,
      assignment?.description ? `  ${assignment.description}` : null,
    ].filter((x): x is string => !!x);
  }

  return (
    <Tooltip content={tooltipLines.join('\n')}>
      <div
        className="chassis-port chassis-port-clickable"
        style={{
          width: `${width}px`,
          borderColor,
          backgroundColor: bgColor,
          cursor: 'pointer',
          outline: selected ? '2px solid var(--color-accent-blue)' : 'none',
          outlineOffset: '1px',
        }}
        onClick={onClick}
      >
        {isAssigned && <span className="chassis-port-role" style={{ color: 'var(--color-success)' }}>●</span>}
      </div>
    </Tooltip>
  );
}

const NEW_DEVICE_VALUE = '__new__';

export function DevicePortAssignments({ device, onClose }: Props) {
  const { assignments, loading, setAssignment, removeAssignment } = usePortAssignments(device.id);
  const { devices, createDevice } = useDevices();
  const { deviceModels } = useDeviceModels();
  const { vrfs } = useIpam();

  const [selectedPort, setSelectedPort] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showNewDevice, setShowNewDevice] = useState(false);
  const [newDeviceForm, setNewDeviceForm] = useState({ hostname: '', ip: '', device_type: 'external' as 'internal' | 'external' });
  const [creatingDevice, setCreatingDevice] = useState(false);
  const pendingNewHostname = useRef<string | null>(null);
  const [editForm, setEditForm] = useState<SetPortAssignmentRequest>({
    port_name: '',
    remote_device_id: undefined,
    remote_port_name: '',
    description: '',
    patch_panel_a_id: undefined,
    patch_panel_a_port: '',
    patch_panel_b_id: undefined,
    patch_panel_b_port: '',
    vrf_id: '',
  });

  const deviceModel = useMemo(() => findDeviceModel(device, deviceModels), [device.vendor, device.model, deviceModels]);

  const isPatchPanel = checkIsPatchPanel(device);

  const assignmentMap = useMemo(
    () => buildPortAssignmentMap(assignments, device.id, isPatchPanel),
    [assignments, isPatchPanel, device.id]
  );

  const deviceOptions = useMemo(() => {
    const opts = buildDeviceOptions(devices, device.id);
    opts.push({ value: NEW_DEVICE_VALUE, label: '+ New Device...' });
    return opts;
  }, [devices, device.id]);

  const vrfOptions = useMemo(() => {
    const opts = [{ value: '', label: '— None (default) —' }];
    vrfs.forEach((v) => opts.push({ value: v.id, label: `${v.name}${v.rd ? ` (${v.rd})` : ''}` }));
    return opts;
  }, [vrfs]);

  // Auto-select newly created device once devices list refreshes
  useEffect(() => {
    if (pendingNewHostname.current) {
      const newDev = devices.find(d => d.hostname === pendingNewHostname.current);
      if (newDev) {
        setEditForm(prev => ({ ...prev, remote_device_id: newDev.id, remote_port_name: '' }));
        pendingNewHostname.current = null;
      }
    }
  }, [devices]);

  const handleCreateDevice = async () => {
    const hostname = newDeviceForm.hostname.trim();
    if (!hostname) return;
    setCreatingDevice(true);
    try {
      const ok = await createDevice({
        hostname,
        ip: newDeviceForm.ip.trim(),
        device_type: newDeviceForm.device_type,
      });
      if (ok) {
        pendingNewHostname.current = hostname;
        setShowNewDevice(false);
        setNewDeviceForm({ hostname: '', ip: '', device_type: 'external' });
      }
    } catch (err: unknown) {
      addNotification('error', err instanceof Error ? err.message : 'Failed to create device');
    } finally {
      setCreatingDevice(false);
    }
  };

  // Remote device model for port picker
  const remoteDevice = useMemo(() => {
    if (editForm.remote_device_id == null) return undefined;
    return devices.find((d) => d.id === editForm.remote_device_id);
  }, [devices, editForm.remote_device_id]);

  const remoteDeviceModel = useMemo<DeviceModel | undefined>(() => {
    if (!remoteDevice?.vendor || !remoteDevice?.model) return undefined;
    return deviceModels.find(
      (dm) => dm.vendor_id === remoteDevice.vendor && dm.model === remoteDevice.model
    );
  }, [remoteDevice, deviceModels]);

  const remotePortOptions = useMemo(() => buildPortOptionsFromModel(remoteDeviceModel), [remoteDeviceModel]);

  const patchPanelOptions = useMemo(() => buildPatchPanelOptions(devices), [devices]);

  const getPatchPanelPortOptions = (ppDeviceId: number | undefined) => {
    if (ppDeviceId == null) return [{ value: '', label: '— Select Port —' }];
    const ppDevice = devices.find((d) => d.id === ppDeviceId);
    const ppModel = ppDevice ? findDeviceModel(ppDevice, deviceModels) : undefined;
    return buildPortOptionsFromModel(ppModel, '— Select Port —');
  };

  const ppAPortOptions = useMemo(() => getPatchPanelPortOptions(editForm.patch_panel_a_id), [editForm.patch_panel_a_id, devices, deviceModels]);
  const ppBPortOptions = useMemo(() => getPatchPanelPortOptions(editForm.patch_panel_b_id), [editForm.patch_panel_b_id, devices, deviceModels]);

  const handlePortClick = (portName: string) => {
    setSelectedPort(portName);
    const existing = assignmentMap.get(portName);
    setEditForm({
      port_name: portName,
      remote_device_id: existing?.remote_device_id,
      remote_port_name: existing?.remote_port_name || '',
      description: existing?.description || '',
      patch_panel_a_id: existing?.patch_panel_a_id,
      patch_panel_a_port: existing?.patch_panel_a_port || '',
      patch_panel_b_id: existing?.patch_panel_b_id,
      patch_panel_b_port: existing?.patch_panel_b_port || '',
      vrf_id: existing?.vrf_id || '',
    });
  };

  const handleSave = async () => {
    if (!selectedPort) return;
    setSaving(true);
    try {
      if (!editForm.remote_device_id) {
        // Clear assignment
        const existing = assignmentMap.get(selectedPort);
        if (existing) {
          await removeAssignment(selectedPort);
        }
      } else {
        await setAssignment(editForm);
      }
      setSelectedPort(null);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!selectedPort) return;
    setSaving(true);
    try {
      await removeAssignment(selectedPort);
      setSelectedPort(null);
    } finally {
      setSaving(false);
    }
  };

  const assignedCount = countAssignedPorts(assignments, device.id, isPatchPanel);
  const totalPorts = countModelPorts(deviceModel);

  return (
    <Modal
      title={`Port Assignments: ${device.hostname}`}
      onClose={onClose}
      variant="extra-wide"
      footer={
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </DialogActions>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '24px', justifyContent: 'center' }}>
          <SpinnerIcon size={16} /> Loading port assignments...
        </div>
      ) : !deviceModel ? (
        <div className="config-empty">
          <Icon name="info" size={24} />
          <p>No device model found for {device.vendor || '?'} / {device.model || '?'}.</p>
          <p className="helper-text-sm">Create a device model with matching vendor and model to assign ports.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Stats bar */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            <span><strong>{assignedCount}</strong> / {totalPorts} ports assigned</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }} />
              Assigned
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-text-muted)', opacity: 0.4 }} />
              Unassigned
            </span>
          </div>

          {/* Chassis layout with clickable ports */}
          <div className="chassis-preview">
            <div className="chassis-body">
              {deviceModel.layout.map((row) => (
                <div key={row.row} className="chassis-row">
                  {row.sections.map((section, si) => (
                    <div key={si} className="chassis-section">
                      {section.label && (
                        <span className="chassis-section-label">{section.label}</span>
                      )}
                      <div className="chassis-ports">
                        {section.ports.map((port, pi) => (
                          <AssignablePort
                            key={pi}
                            port={port}
                            assignment={assignmentMap.get(port.vendor_port_name)}
                            selected={selectedPort === port.vendor_port_name}
                            onClick={() => handlePortClick(port.vendor_port_name)}
                            isPatchPanel={isPatchPanel}
                            devices={devices}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Assignment editor panel */}
          {selectedPort && isPatchPanel && (() => {
            const ppAssignment = assignmentMap.get(selectedPort);
            const srcDevice = ppAssignment ? devices.find((d) => d.id === ppAssignment.device_id) : undefined;
            return (
              <div style={{
                padding: '16px',
                background: 'var(--color-bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px' }}>
                    <Icon name="settings_ethernet" size={16} /> {selectedPort}
                  </h4>
                  <button
                    onClick={() => setSelectedPort(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '18px' }}
                  >
                    ×
                  </button>
                </div>
                {ppAssignment ? (
                  <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div><strong>Source:</strong> {srcDevice?.hostname || ppAssignment.device_id}:{ppAssignment.port_name}</div>
                    <div><strong>Destination:</strong> {ppAssignment.remote_device_hostname || ppAssignment.remote_device_id || '—'}:{ppAssignment.remote_port_name || '—'}</div>
                    {ppAssignment.description && <div><strong>Description:</strong> {ppAssignment.description}</div>}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No connection on this port</div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <Button variant="secondary" onClick={() => setSelectedPort(null)}>Close</Button>
                </div>
              </div>
            );
          })()}
          {selectedPort && !isPatchPanel && (
            <div style={{
              padding: '16px',
              background: 'var(--color-bg-secondary)',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '14px' }}>
                  <Icon name="settings_ethernet" size={16} /> {selectedPort}
                </h4>
                <button
                  onClick={() => setSelectedPort(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '18px' }}
                >
                  ×
                </button>
              </div>
              <div className="form-columns">
                <div className="form-column">
                  <SelectField
                    label="Remote Device"
                    name="remote_device_id"
                    value={editForm.remote_device_id != null ? String(editForm.remote_device_id) : ''}
                    onChange={(e) => {
                      if (e.target.value === NEW_DEVICE_VALUE) {
                        setShowNewDevice(true);
                      } else {
                        setShowNewDevice(false);
                        setEditForm({ ...editForm, remote_device_id: e.target.value ? Number(e.target.value) : undefined, remote_port_name: '' });
                      }
                    }}
                    options={deviceOptions}
                  />
                  {showNewDevice && (
                    <div style={{
                      padding: '12px',
                      background: 'var(--color-bg-primary)',
                      borderRadius: '6px',
                      border: '1px solid var(--color-accent-blue)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Quick Create Device</span>
                      <FormField
                        label="Hostname *"
                        name="new_hostname"
                        type="text"
                        value={newDeviceForm.hostname}
                        onChange={(e) => setNewDeviceForm({ ...newDeviceForm, hostname: e.target.value })}
                        placeholder="e.g. wan-router-1"
                      />
                      <FormField
                        label="IP Address"
                        name="new_ip"
                        type="text"
                        value={newDeviceForm.ip}
                        onChange={(e) => setNewDeviceForm({ ...newDeviceForm, ip: e.target.value })}
                        placeholder="e.g. 10.0.0.1"
                      />
                      <SelectField
                        label="Type"
                        name="new_device_type"
                        value={newDeviceForm.device_type}
                        onChange={(e) => setNewDeviceForm({ ...newDeviceForm, device_type: e.target.value as 'internal' | 'external' })}
                        options={[
                          { value: 'external', label: 'External' },
                          { value: 'internal', label: 'Internal' },
                          { value: 'host', label: 'Host' },
                        ]}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Button onClick={handleCreateDevice} disabled={creatingDevice || !newDeviceForm.hostname.trim()}>
                          {creatingDevice ? <SpinnerIcon size={14} /> : <Icon name="add" size={14} />}
                          Create
                        </Button>
                        <Button variant="secondary" onClick={() => { setShowNewDevice(false); setEditForm({ ...editForm, remote_device_id: undefined }); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {editForm.remote_device_id && remotePortOptions.length > 1 ? (
                    <SelectField
                      label="Remote Port"
                      name="remote_port_name"
                      value={editForm.remote_port_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, remote_port_name: e.target.value })}
                      options={remotePortOptions}
                    />
                  ) : editForm.remote_device_id ? (
                    <FormField
                      label="Remote Port"
                      name="remote_port_name"
                      type="text"
                      value={editForm.remote_port_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, remote_port_name: e.target.value })}
                      placeholder="e.g. Ethernet1"
                    />
                  ) : null}
                </div>
                <div className="form-column">
                  <FormField
                    label="Description"
                    name="description"
                    type="text"
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Optional note"
                  />
                  {vrfOptions.length > 1 && (
                    <SelectField
                      label="VRF"
                      name="vrf_id"
                      value={editForm.vrf_id || ''}
                      onChange={(e) => setEditForm({ ...editForm, vrf_id: e.target.value || undefined })}
                      options={vrfOptions}
                    />
                  )}
                </div>
              </div>
              {/* Patch panel path (optional, shown when remote device is set) */}
              {editForm.remote_device_id && patchPanelOptions.length > 1 && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                  <h5 style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Patch Panel Path (optional)
                  </h5>
                  <div className="form-columns">
                    <div className="form-column">
                      <SelectField
                        label="Local Patch Panel"
                        name="patch_panel_a_id"
                        value={editForm.patch_panel_a_id != null ? String(editForm.patch_panel_a_id) : ''}
                        onChange={(e) => setEditForm({ ...editForm, patch_panel_a_id: e.target.value ? Number(e.target.value) : undefined, patch_panel_a_port: '' })}
                        options={patchPanelOptions}
                      />
                      {editForm.patch_panel_a_id && (
                        <SelectField
                          label="Local PP Port"
                          name="patch_panel_a_port"
                          value={editForm.patch_panel_a_port || ''}
                          onChange={(e) => setEditForm({ ...editForm, patch_panel_a_port: e.target.value })}
                          options={ppAPortOptions}
                        />
                      )}
                    </div>
                    <div className="form-column">
                      <SelectField
                        label="Remote Patch Panel"
                        name="patch_panel_b_id"
                        value={editForm.patch_panel_b_id != null ? String(editForm.patch_panel_b_id) : ''}
                        onChange={(e) => setEditForm({ ...editForm, patch_panel_b_id: e.target.value ? Number(e.target.value) : undefined, patch_panel_b_port: '' })}
                        options={patchPanelOptions}
                      />
                      {editForm.patch_panel_b_id && (
                        <SelectField
                          label="Remote PP Port"
                          name="patch_panel_b_port"
                          value={editForm.patch_panel_b_port || ''}
                          onChange={(e) => setEditForm({ ...editForm, patch_panel_b_port: e.target.value })}
                          options={ppBPortOptions}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <SpinnerIcon size={14} /> : <Icon name="save" size={14} />}
                  Save
                </Button>
                {assignmentMap.has(selectedPort) && (
                  <Button variant="danger" onClick={handleClear} disabled={saving}>
                    Clear
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setSelectedPort(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Assignment summary table */}
          {assignments.filter((a) => a.remote_device_id || (isPatchPanel && a.device_id !== device.id)).length > 0 && !selectedPort && (
            <div>
              <h4 style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                {isPatchPanel ? 'Connections Through This Panel' : 'Current Assignments'}
              </h4>
              {isPatchPanel ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '0.8fr 1.2fr 1fr 1.2fr 1fr 1.5fr',
                  gap: '1px',
                  background: 'var(--color-border)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  fontSize: '12px',
                }}>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>PP Port</div>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>Source Device</div>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>Source Port</div>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>Dest Device</div>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>Dest Port</div>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>Description</div>
                  {assignments.filter((a) => a.device_id !== device.id).map((a) => {
                    const srcDevice = devices.find((d) => d.id === a.device_id);
                    const ppPort = a.patch_panel_a_id === device.id ? a.patch_panel_a_port : a.patch_panel_b_port;
                    return (
                      <React.Fragment key={a.id}>
                        <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>
                          <button
                            onClick={() => ppPort && handlePortClick(ppPort)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-blue)', padding: 0, font: 'inherit' }}
                          >
                            {ppPort || '—'}
                          </button>
                        </div>
                        <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>{srcDevice?.hostname || a.device_id}</div>
                        <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>{a.port_name}</div>
                        <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>{a.remote_device_hostname || a.remote_device_id || '—'}</div>
                        <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>{a.remote_port_name || '—'}</div>
                        <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>{a.description || '—'}</div>
                      </React.Fragment>
                    );
                  })}
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 0.8fr 1fr 1fr 1fr',
                  gap: '1px',
                  background: 'var(--color-border)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  fontSize: '12px',
                }}>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>Port</div>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>Remote Device</div>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>Remote Port</div>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>VRF</div>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>Patch Panel A</div>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>Patch Panel B</div>
                  <div style={{ padding: '6px 8px', background: 'var(--color-bg-secondary)', fontWeight: 600 }}>Description</div>
                  {assignments.filter((a) => a.remote_device_id).map((a) => (
                    <React.Fragment key={a.id}>
                      <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>
                        <button
                          onClick={() => handlePortClick(a.port_name)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-blue)', padding: 0, font: 'inherit' }}
                        >
                          {a.port_name}
                        </button>
                      </div>
                      <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>
                        {a.remote_device_hostname || a.remote_device_id || '—'}
                        {a.remote_device_type && a.remote_device_type !== 'internal' && <span style={{ color: 'var(--color-text-muted)', marginLeft: '4px' }}>({a.remote_device_type === 'external' ? 'ext' : a.remote_device_type})</span>}
                      </div>
                      <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>{a.remote_port_name || '—'}</div>
                      <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>{a.vrf_name || '—'}</div>
                      <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>
                        {a.patch_panel_a_hostname ? `${a.patch_panel_a_hostname}:${a.patch_panel_a_port}` : '—'}
                      </div>
                      <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>
                        {a.patch_panel_b_hostname ? `${a.patch_panel_b_hostname}:${a.patch_panel_b_port}` : '—'}
                      </div>
                      <div style={{ padding: '6px 8px', background: 'var(--color-bg-primary)' }}>{a.description || '—'}</div>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
