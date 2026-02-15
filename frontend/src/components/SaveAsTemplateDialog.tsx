import { useState, useEffect } from 'react';
import type { Job, Device, CreateJobTemplateRequest } from '@core';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { SelectField } from './SelectField';
import { CronScheduleInput } from './CronScheduleInput';

interface SaveAsTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  deviceMap: Map<number, Device>;
  actionMap: Map<string, { label: string }>;
  onCreate: (req: CreateJobTemplateRequest) => Promise<boolean>;
  credentialOptions: { value: string; label: string }[];
}

export function SaveAsTemplateDialog({ isOpen, onClose, job, deviceMap, actionMap, onCreate, credentialOptions }: SaveAsTemplateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && job) {
      const device = job.device_id ? deviceMap.get(job.device_id) : undefined;
      const action = job.job_type === 'webhook' ? actionMap.get(job.command) : undefined;
      const label = action ? action.label : job.command;
      const prefix = device ? `${device.hostname} - ` : '';
      setName(`${prefix}${label}`.slice(0, 100));
      setDescription('');
      setSchedule('');
      setCredentialId('');
    }
  }, [isOpen, job, deviceMap, actionMap]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !name.trim()) return;
    setSaving(true);
    try {
      const req: CreateJobTemplateRequest = {
        name: name.trim(),
        description: description.trim(),
        job_type: job.job_type,
        command: job.job_type === 'webhook' ? '' : job.command,
        action_id: job.job_type === 'webhook' ? job.command : '',
        target_mode: 'device',
        target_device_ids: job.device_id ? [job.device_id] : [],
        schedule,
        enabled: true,
        credential_id: credentialId,
      };
      const ok = await onCreate(req);
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Save as Template"
      onSubmit={handleSubmit}
      submitText="Save Template"
      saving={saving}
      submitDisabled={!name.trim()}
    >
      <FormField
        label="Template Name"
        name="name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g., Show version on spine switches"
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
      {job && (
        <div className="form-group">
          <label className="form-label">Job Details</label>
          <div className="info-grid" style={{ fontSize: '13px' }}>
            <span className="label">Type</span>
            <span>{job.job_type}</span>
            <span className="label">Command</span>
            <span>{job.job_type === 'webhook' ? (actionMap.get(job.command)?.label || job.command) : job.command}</span>
            {job.device_id && (
              <>
                <span className="label">Device</span>
                <span>{deviceMap.get(job.device_id)?.hostname || job.device_id}</span>
              </>
            )}
          </div>
        </div>
      )}
    </FormDialog>
  );
}
