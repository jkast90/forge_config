import { useState, useEffect } from 'react';
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && template) {
      setName(template.name);
      setDescription(template.description);
      setSchedule(template.schedule);
      setEnabled(template.enabled);
      setCredentialId(template.credential_id != null ? String(template.credential_id) : '');
    }
  }, [isOpen, template]);

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
        target_device_ids: template.target_device_ids,
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
              {template.target_device_ids.length > 0 && (
                <>
                  <span className="label">Target</span>
                  <span>
                    {template.target_device_ids
                      .map((id) => deviceMap?.get(id)?.hostname || String(id))
                      .join(', ')}
                  </span>
                </>
              )}
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
