import { useState, useEffect } from 'react';
import type { JobTemplate, CreateJobTemplateRequest } from '@core';
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
}

export function EditTemplateDialog({ isOpen, onClose, template, onUpdate, credentialOptions }: EditTemplateDialogProps) {
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
      setCredentialId(template.credential_id || '');
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
        credential_id: credentialId,
      };
      const ok = await onUpdate(template.id, req);
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
