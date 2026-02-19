import { useState, useEffect, useMemo } from 'react';
import type { JobTemplate, CreateJobTemplateRequest, Device } from '@core';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { SelectField } from './SelectField';
import { CronScheduleInput } from './CronScheduleInput';
import { Toggle } from './Toggle';

interface EditTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: JobTemplate | null;
  onUpdate: (id: string, req: CreateJobTemplateRequest) => Promise<boolean>;
  credentialOptions: { value: string; label: string }[];
  deviceMap?: Map<number, Device>;
  actionMap?: Map<string, { label: string; action_type?: string; command?: string; webhook_url?: string; webhook_method?: string }>;
}

export function EditTemplateDialog({ isOpen, onClose, template, onUpdate, credentialOptions, deviceMap, actionMap }: EditTemplateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [credentialId, setCredentialId] = useState('');
  const [targetDeviceIds, setTargetDeviceIds] = useState<number[]>([]);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && template) {
      setName(template.name);
      setDescription(template.description);
      setSchedule(template.schedule);
      setEnabled(template.enabled);
      setCredentialId(template.credential_id != null ? String(template.credential_id) : '');
      setTargetDeviceIds(template.target_device_ids ?? []);
      setDeviceSearch('');
    }
  }, [isOpen, template]);

  const allDevices = useMemo(() => {
    if (!deviceMap) return [];
    return Array.from(deviceMap.values()).sort((a, b) =>
      (a.hostname || '').localeCompare(b.hostname || '')
    );
  }, [deviceMap]);

  const filteredDevices = useMemo(() => {
    if (!deviceSearch.trim()) return allDevices;
    const q = deviceSearch.toLowerCase();
    return allDevices.filter(d =>
      (d.hostname || '').toLowerCase().includes(q) || d.ip.toLowerCase().includes(q)
    );
  }, [allDevices, deviceSearch]);

  const toggleDevice = (id: number) => {
    setTargetDeviceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template || !name.trim()) return;
    setSaving(true);
    try {
      const req: CreateJobTemplateRequest = {
        name: name.trim(),
        description: description.trim(),
        job_type: template.job_type,
        command: template.command,
        action_id: template.action_id,
        target_mode: template.target_mode,
        target_device_ids: targetDeviceIds,
        target_group_id: template.target_group_id,
        schedule,
        enabled,
        credential_id: credentialId ? Number(credentialId) : undefined,
      };
      const ok = await onUpdate(String(template.id), req);
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  const showDevicePicker = template?.target_mode === 'device';

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Template"
      onSubmit={handleSubmit}
      submitText="Update"
      saving={saving}
      submitDisabled={!name.trim()}
    >
      <FormField
        label="Template Name"
        name="name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <FormField
        label="Description"
        name="description"
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Optional description"
      />
      {template && (() => {
        const action = template.action_id ? actionMap?.get(String(template.action_id)) : undefined;
        return (
          <div className="form-group">
            <label className="form-label">Job Details</label>
            <div className="info-grid" style={{ fontSize: '13px' }}>
              <span className="label">Type</span>
              <span>{template.job_type}</span>
              {template.job_type === 'webhook' && action ? (
                <>
                  <span className="label">Action</span>
                  <span>{action.label}</span>
                  <span className="label">URL</span>
                  <span><code className="text-xs">{action.webhook_method} {action.webhook_url}</code></span>
                </>
              ) : template.command ? (
                <>
                  <span className="label">Command</span>
                  <span><code className="text-xs">{template.command}</code></span>
                </>
              ) : null}
              {template.target_mode === 'group' && template.target_group_id > 0 && (
                <>
                  <span className="label">Target</span>
                  <span>Group #{template.target_group_id}</span>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {showDevicePicker && (
        <div className="form-group">
          <label className="form-label">
            Target Devices
            {targetDeviceIds.length > 0 && (
              <span style={{ marginLeft: 6, fontWeight: 400, opacity: 0.6 }}>
                ({targetDeviceIds.length} selected)
              </span>
            )}
          </label>
          <input
            type="text"
            placeholder="Search devices..."
            value={deviceSearch}
            onChange={e => setDeviceSearch(e.target.value)}
            style={{ marginBottom: 6, fontSize: 13 }}
          />
          <div style={{
            maxHeight: 180,
            overflowY: 'auto',
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            background: 'var(--bg-secondary)',
          }}>
            {filteredDevices.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: 12, opacity: 0.5 }}>No devices found</div>
            ) : filteredDevices.map(d => (
              <div
                key={d.id}
                onClick={() => toggleDevice(d.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  borderBottom: '1px solid var(--border-color)',
                }}
                className="hover-highlight"
              >
                <input
                  type="checkbox"
                  checked={targetDeviceIds.includes(d.id)}
                  onChange={() => toggleDevice(d.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ flexShrink: 0, flex: '0 0 auto', width: 14, height: 14 }}
                />
                <span style={{ fontWeight: 500 }}>{d.hostname || d.mac || String(d.id)}</span>
                <span style={{ opacity: 0.5, fontFamily: 'monospace', fontSize: 11 }}>{d.ip}</span>
              </div>
            ))}
          </div>
          {targetDeviceIds.length > 0 && (
            <button
              type="button"
              onClick={() => setTargetDeviceIds([])}
              style={{ marginTop: 4, fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, padding: 0 }}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      <CronScheduleInput value={schedule} onChange={setSchedule} />
      <SelectField
        label="Credential"
        name="credential_id"
        value={credentialId}
        onChange={(e) => setCredentialId(e.target.value)}
        options={credentialOptions}
      />
      <Toggle
        label="Enabled"
        checked={enabled}
        onChange={setEnabled}
        description="When enabled, scheduled templates run automatically"
      />
    </FormDialog>
  );
}
