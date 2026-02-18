import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Job, Device, JobTemplate, OutputParser, VendorAction, VendorActionFormData, ActionType } from '@core';
import {
  useJobs,
  useDevices,
  useGroups,
  useVendorActions,
  useJobTemplates,
  useCredentials,
  useOutputParsers,
  useWebSocket,
  useModalForm,
  getServices,
  addNotification,
  navigateAction,
  usePersistedTab,
  formatRelativeTime,
  getJobTypeBadgeVariant,
  getHttpMethodBadgeVariant,
  getVendorFilterOptions,
  getVendorSelectOptions,
  getVendorName,
  filterByVendor,
  generateId,
  getActionTypeBadgeVariant,
  EMPTY_VENDOR_ACTION_FORM,
} from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { Checkbox } from './Checkbox';
import { FormDialog } from './FormDialog';
import { FormField } from './FormField';
import { InfoSection } from './InfoSection';
import { SelectField } from './SelectField';
import { SideTabs } from './SideTabs';
import type { SideTab } from './SideTabs';
import { LoadingState } from './LoadingState';
import { Modal } from './Modal';
import { OutputParsersPanel } from './OutputParsersPanel';
import { Table, SimpleTable, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { Icon, RefreshIcon, PlusIcon } from './Icon';
import { SaveAsTemplateDialog } from './SaveAsTemplateDialog';
import { EditTemplateDialog } from './EditTemplateDialog';
import { JobTemplatesPanel } from './JobTemplatesPanel';
import { CopyButton } from './CopyButton';
import { CredentialsPanel } from './CredentialsPanel';

const ACTION_TYPE_OPTIONS = [
  { value: 'ssh', label: 'SSH Command' },
  { value: 'webhook', label: 'Webhook / API' },
];

const WEBHOOK_METHOD_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
];

function formatDuration(job: Job): string {
  if (!job.started_at) return '-';
  const start = new Date(job.started_at).getTime();
  const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

function statusVariant(status: string): 'online' | 'offline' | 'warning' | 'provisioning' {
  switch (status) {
    case 'completed': return 'online';
    case 'failed': return 'offline';
    case 'running': return 'provisioning';
    case 'queued': return 'warning';
    default: return 'warning';
  }
}

// ---------------------------------------------------------------------------
// Run Job Dialog
// ---------------------------------------------------------------------------

type TargetMode = 'device' | 'group';

interface RunJobDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  initialActionId?: string;
}

export function RunJobDialog({ isOpen, onClose, onSubmitted, initialActionId }: RunJobDialogProps) {
  const { devices } = useDevices();
  const { groups } = useGroups();
  const { actions: vendorActions } = useVendorActions();
  const { templates } = useJobTemplates();

  const [targetMode, setTargetMode] = useState<TargetMode>('device');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupMembers, setGroupMembers] = useState<number[]>([]);
  const [groupMembersLoading, setGroupMembersLoading] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState('');
  const [customCommand, setCustomCommand] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setTargetMode('device');
      setSelectedDeviceIds([]);
      setSelectedGroupId(null);
      setGroupMembers([]);
      setSelectedActionId(initialActionId || '');
      setCustomCommand('');
      setDeviceSearch('');
    }
  }, [isOpen, initialActionId]);

  // Load template into form
  const handleLoadTemplate = (templateId: string) => {
    const tmpl = templates.find((t) => String(t.id) === templateId);
    if (!tmpl) return;
    setTargetMode(tmpl.target_mode);
    if (tmpl.target_mode === 'device') {
      setSelectedDeviceIds(tmpl.target_device_ids);
      setSelectedGroupId(null);
    } else {
      setSelectedGroupId(tmpl.target_group_id || null);
      setSelectedDeviceIds([]);
    }
    if (tmpl.action_id) {
      setSelectedActionId(String(tmpl.action_id));
      setCustomCommand('');
    } else {
      setSelectedActionId('');
      setCustomCommand(tmpl.command);
    }
  };

  const templateOptions = useMemo(() => [
    { value: '', label: 'Load from template...' },
    ...templates.map((t) => ({ value: String(t.id), label: t.name })),
  ], [templates]);

  // Fetch group members when group selection changes
  useEffect(() => {
    if (targetMode !== 'group' || selectedGroupId == null) {
      setGroupMembers([]);
      return;
    }
    setGroupMembersLoading(true);
    const services = getServices();
    services.groups.listMembers(selectedGroupId)
      .then(setGroupMembers)
      .catch(() => setGroupMembers([]))
      .finally(() => setGroupMembersLoading(false));
  }, [selectedGroupId, targetMode]);

  // Resolve target device IDs
  const targetDeviceIds = targetMode === 'device' ? selectedDeviceIds : groupMembers;

  // When launched with an initial action, filter devices to matching vendor
  const initialAction = initialActionId ? vendorActions.find((a) => String(a.id) === initialActionId) : undefined;
  const filteredDevices = useMemo(() => {
    if (!initialAction) return devices;
    return devices.filter((d) => d.vendor_id === String(initialAction.vendor_id));
  }, [devices, initialAction]);

  // Resolve command from action or custom
  const selectedAction = vendorActions.find((a) => String(a.id) === selectedActionId);
  const isWebhookAction = selectedAction?.action_type === 'webhook';
  const command = selectedAction ? (isWebhookAction ? '' : selectedAction.command) : customCommand;

  // Static webhook = no device variable placeholders in URL or body
  const isStaticWebhook = isWebhookAction && selectedAction &&
    !selectedAction.webhook_url.includes('{{') &&
    !selectedAction.webhook_body.includes('{{');

  // Filter actions by vendor of selected devices
  const relevantActions = useMemo(() => {
    if (targetDeviceIds.length === 0) {
      // When no devices selected but we have an initial action, show it
      if (initialActionId) {
        return vendorActions.filter((a) => String(a.id) === initialActionId);
      }
      return [];
    }
    const targetDevices = devices.filter((d) => targetDeviceIds.includes(d.id));
    const vendorIds = new Set(targetDevices.map((d) => d.vendor).filter(Boolean));
    if (vendorIds.size === 0) return vendorActions;
    return vendorActions.filter((a) => vendorIds.has(String(a.vendor_id)));
  }, [vendorActions, targetDeviceIds, devices, initialActionId]);

  // Clear selected action if it's no longer in the filtered list
  useEffect(() => {
    if (selectedActionId && !relevantActions.some((a) => String(a.id) === selectedActionId)) {
      setSelectedActionId('');
    }
  }, [relevantActions, selectedActionId]);

  const actionOptions = useMemo(() => [
    { value: '', label: 'Custom command...' },
    ...relevantActions.map((a) => ({
      value: String(a.id),
      label: a.action_type === 'webhook' ? `${a.label} (webhook)` : a.label,
    })),
  ], [relevantActions]);

  const deviceOptions = useMemo(() => [
    { value: '', label: 'Select device...' },
    ...devices.map((d) => ({
      value: String(d.id),
      label: `${d.hostname} (${d.ip})`,
    })),
  ], [devices]);

  const groupOptions = useMemo(() => [
    { value: '', label: 'Select group...' },
    ...groups.map((g) => ({
      value: String(g.id),
      label: `${g.name}${g.device_count ? ` (${g.device_count} devices)` : ''}`,
    })),
  ], [groups]);

  const canSubmit = !submitting && (
    isStaticWebhook
      ? true
      : targetDeviceIds.length > 0 && (isWebhookAction || command.trim().length > 0)
  );

  const handleToggleDevice = (deviceId: number) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const services = getServices();

      if (isStaticWebhook && selectedAction) {
        // Static webhook — run without device target
        await services.vendors.runAction(selectedAction.id);
        addNotification('success', 'Queued webhook job', navigateAction('View Jobs', 'jobs', 'history'));
      } else {
        const cmd = command.trim();
        let succeeded = 0;
        let failed = 0;

        for (const deviceId of targetDeviceIds) {
          try {
            if (isWebhookAction && selectedAction) {
              await services.devices.exec(deviceId, '', String(selectedAction.id));
            } else {
              await services.devices.exec(deviceId, cmd);
            }
            succeeded++;
          } catch {
            failed++;
          }
        }

        if (failed === 0) {
          addNotification('success', `Queued ${succeeded} job${succeeded !== 1 ? 's' : ''}`, navigateAction('View Jobs', 'jobs', 'history'));
        } else {
          addNotification('warning', `Queued ${succeeded}, failed ${failed} job${failed !== 1 ? 's' : ''}`, navigateAction('View Jobs', 'jobs', 'history'));
        }
      }

      onSubmitted();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to run jobs: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Run Job"
      onSubmit={handleSubmit}
      submitText={submitting ? 'Running...' : isStaticWebhook ? 'Run Webhook' : `Run on ${targetDeviceIds.length} device${targetDeviceIds.length !== 1 ? 's' : ''}`}
      submitDisabled={!canSubmit}
      variant="wide"
    >
      {/* Load from Template */}
      {templates.length > 0 && (
        <SelectField
          label="From Template"
          name="template"
          value=""
          onChange={(e) => handleLoadTemplate(e.target.value)}
          options={templateOptions}
        />
      )}

      {/* Target Mode — hidden for static webhooks */}
      {!isStaticWebhook && (
        <div className="form-group">
          <label className="form-label">Target</label>
          <div className="run-job-target-tabs">
            <button
              type="button"
              className={`run-job-target-tab${targetMode === 'device' ? ' active' : ''}`}
              onClick={() => { setTargetMode('device'); setSelectedGroupId(null); }}
            >
              <Icon name="devices" size={16} />
              Devices
            </button>
            <button
              type="button"
              className={`run-job-target-tab${targetMode === 'group' ? ' active' : ''}`}
              onClick={() => { setTargetMode('group'); setSelectedDeviceIds([]); }}
            >
              <Icon name="account_tree" size={16} />
              Group
            </button>
          </div>
        </div>
      )}

      {/* Device Selection */}
      {!isStaticWebhook && targetMode === 'device' && (() => {
        const q = deviceSearch.toLowerCase();
        const searchedDevices = q
          ? filteredDevices.filter((d) =>
              d.hostname?.toLowerCase().includes(q) ||
              d.ip?.toLowerCase().includes(q) ||
              d.vendor?.toLowerCase().includes(q) ||
              d.mac?.toLowerCase().includes(q))
          : filteredDevices;

        return (
          <div className="form-group">
            <label className="form-label">
              Select Devices
              {selectedDeviceIds.length > 0 && (
                <span className="form-label-count">{selectedDeviceIds.length} selected</span>
              )}
            </label>
            {filteredDevices.length >= 8 && (
              <div className="select-field-search" style={{ borderRadius: '10px', border: '1px solid var(--color-border)', marginBottom: '8px' }}>
                <Icon name="search" size={14} />
                <input
                  type="text"
                  value={deviceSearch}
                  onChange={(e) => setDeviceSearch(e.target.value)}
                  placeholder="Search devices..."
                  className="select-field-search-input"
                />
                {deviceSearch && (
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '14px', padding: 0 }} onClick={() => setDeviceSearch('')}>×</button>
                )}
              </div>
            )}
            <div className="run-job-device-list">
              {searchedDevices.length === 0 ? (
                <div className="text-muted text-sm">{deviceSearch ? 'No matching devices' : 'No devices available'}</div>
              ) : (
                searchedDevices.map((device) => (
                  <label key={device.id} className="run-job-device-item">
                    <Checkbox
                      checked={selectedDeviceIds.includes(device.id)}
                      onChange={() => handleToggleDevice(device.id)}
                    />
                    <span className={`status-dot status-${device.status}`} />
                    <span className="run-job-device-name">{device.hostname}</span>
                    <span className="run-job-device-ip">{device.ip}</span>
                    {device.vendor && (
                      <span className="run-job-device-vendor">{device.vendor}</span>
                    )}
                  </label>
                ))
              )}
            </div>
            {filteredDevices.length > 0 && (
              <div className="run-job-select-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedDeviceIds(searchedDevices.map((d) => d.id))}>
                  Select All{deviceSearch ? ' Visible' : ''}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedDeviceIds([])}>
                  Clear
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Group Selection */}
      {!isStaticWebhook && targetMode === 'group' && (
        <div className="form-group">
          <SelectField
            label="Group"
            name="group"
            value={selectedGroupId != null ? String(selectedGroupId) : ''}
            onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
            options={groupOptions}
          />
          {selectedGroupId != null && (
            <div className="run-job-group-info">
              {groupMembersLoading ? (
                <span className="text-muted text-sm">Loading members...</span>
              ) : groupMembers.length === 0 ? (
                <span className="text-muted text-sm">No devices in this group</span>
              ) : (
                <span className="text-sm">
                  {groupMembers.length} device{groupMembers.length !== 1 ? 's' : ''} will receive this command
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action / Command */}
      <SelectField
        label="Action"
        name="action"
        value={selectedActionId}
        onChange={(e) => setSelectedActionId(e.target.value)}
        options={actionOptions}
      />

      {!selectedAction && (
        <FormField
          label="Command"
          name="command"
          type="text"
          value={customCommand}
          onChange={(e) => setCustomCommand(e.target.value)}
          placeholder="e.g., show version"
          required
        />
      )}

      {selectedAction && !isWebhookAction && (
        <div className="form-group">
          <label className="form-label">Command Preview</label>
          <pre className="command-entry-output">{selectedAction.command}</pre>
        </div>
      )}

      {selectedAction && isWebhookAction && (
        <div className="form-group">
          <label className="form-label">Webhook Preview</label>
          <pre className="command-entry-output">
            {selectedAction.webhook_method} {selectedAction.webhook_url}
          </pre>
        </div>
      )}
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Main Jobs component
// ---------------------------------------------------------------------------

type JobTab = 'actions' | 'history' | 'templates' | 'credentials' | 'parsers';

export function Jobs() {
  const [showInfo, setShowInfo] = useState(false);
  const [showActionsInfo, setShowActionsInfo] = useState(false);
  const [showHistoryInfo, setShowHistoryInfo] = useState(false);
  const [activeTab, setActiveTab] = usePersistedTab<JobTab>('actions', ['actions', 'history', 'templates', 'credentials', 'parsers'], 'tab_jobs');
  const { jobs, loading, error, refresh } = useJobs();
  const { devices } = useDevices();
  const {
    actions: vendorActions,
    loading: actionsLoading,
    createAction,
    updateAction,
    deleteAction,
  } = useVendorActions();
  const { templates, loading: templatesLoading, refresh: refreshTemplates, create: createTemplate, update: updateTemplate, run: runTemplate, remove: removeTemplate } = useJobTemplates();
  const { credentials, loading: credentialsLoading, refresh: refreshCredentials, createCredential, updateCredential, deleteCredential } = useCredentials();
  const {
    outputParsers,
    loading: parsersLoading,
    refresh: refreshParsers,
    createOutputParser,
    updateOutputParser,
    deleteOutputParser,
  } = useOutputParsers();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [saveTemplateJob, setSaveTemplateJob] = useState<Job | null>(null);
  const [editTemplate, setEditTemplate] = useState<JobTemplate | null>(null);
  const [parsedOutputJob, setParsedOutputJob] = useState<Job | null>(null);

  // --- Actions tab state ---
  const [filterVendor, setFilterVendor] = useState('');
  const [runActionId, setRunActionId] = useState<string | null>(null);

  const actionForm = useModalForm<VendorAction, VendorActionFormData>({
    emptyFormData: EMPTY_VENDOR_ACTION_FORM,
    itemToFormData: (action) => ({
      vendor_id: String(action.vendor_id),
      label: action.label,
      command: action.command,
      sort_order: action.sort_order,
      action_type: action.action_type || 'ssh',
      webhook_url: action.webhook_url || '',
      webhook_method: action.webhook_method || 'POST',
      webhook_headers: action.webhook_headers || '{}',
      webhook_body: action.webhook_body || '',
      output_parser_id: action.output_parser_id ? String(action.output_parser_id) : '',
    }),
    onCreate: (data) => {
      const { output_parser_id, vendor_id, ...rest } = data;
      return createAction({
        ...rest,
        vendor_id: Number(vendor_id),
        output_parser_id: output_parser_id ? Number(output_parser_id) : undefined,
      });
    },
    onUpdate: (id, data) => {
      const { output_parser_id, vendor_id, ...rest } = data;
      return updateAction(id, {
        ...rest,
        vendor_id: Number(vendor_id),
        output_parser_id: output_parser_id ? Number(output_parser_id) : undefined,
      });
    },
    getItemId: (a) => String(a.id),
    modalName: 'action-form',
  });

  const isActionWebhook = actionForm.formData.action_type === 'webhook';

  const filterVendorOptions = useMemo(() => getVendorFilterOptions().map(o => ({ value: o.id, label: o.label })), []);
  const vendorSelectOptions = useMemo(() => {
    return getVendorSelectOptions().filter(o => o.value !== '');
  }, []);

  const actionParserOptions = useMemo(() => [
    { value: '', label: 'None' },
    ...outputParsers.filter(p => p.enabled).map(p => ({ value: String(p.id), label: p.name })),
  ], [outputParsers]);

  const actionParserNameMap = useMemo(() => {
    const map = new Map<number, string>();
    outputParsers.forEach(p => map.set(p.id, p.name));
    return map;
  }, [outputParsers]);

  const filteredActions = useMemo(
    () => filterByVendor(vendorActions, filterVendor, (a) => String(a.vendor_id)),
    [vendorActions, filterVendor]
  );

  const handleDeleteAction = async (id: number) => {
    const action = vendorActions.find((a) => a.id === id);
    if (action && confirm(`Delete action "${action.label}"?`)) {
      await deleteAction(id);
    }
  };

  const handleActionFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await actionForm.submit();
  };

  const handleActionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as ActionType;
    actionForm.setFields({
      action_type: newType,
      ...(newType === 'ssh' ? { webhook_url: '', webhook_body: '' } : { command: '' }),
    });
  };

  const actionColumns: TableColumn<VendorAction>[] = useMemo(() => [
    {
      header: 'Type',
      accessor: (a) => Cell.badge(a.action_type === 'webhook' ? 'Webhook' : 'SSH', getActionTypeBadgeVariant(a.action_type)),
      searchValue: (a) => a.action_type,
      width: '90px',
    },
    {
      header: 'Vendor',
      accessor: (a) => <span className="text-xs">{getVendorName(a.vendor_id)}</span>,
      searchValue: (a) => getVendorName(a.vendor_id),
    },
    { header: 'Label', accessor: 'label' },
    {
      header: 'Command / URL',
      accessor: (a) => Cell.code(a.action_type === 'webhook' ? a.webhook_url : a.command),
      searchValue: (a) => a.action_type === 'webhook' ? a.webhook_url : a.command,
    },
    {
      header: 'Parser',
      accessor: (a) => a.output_parser_id ? actionParserNameMap.get(a.output_parser_id) || String(a.output_parser_id) : <span className="text-muted">-</span>,
      searchValue: (a) => a.output_parser_id ? actionParserNameMap.get(a.output_parser_id) || '' : '',
      width: '120px',
    },
    { header: 'Order', accessor: (a) => String(a.sort_order), searchable: false, width: '70px' },
  ], [actionParserNameMap]);

  const actionTableActions: TableAction<VendorAction>[] = useMemo(() => [
    {
      icon: <Icon name="play_arrow" size={14} />,
      label: 'Run',
      onClick: (a) => setRunActionId(String(a.id)),
      variant: 'primary',
      tooltip: 'Run action',
    },
    {
      icon: <Icon name="edit" size={14} />,
      label: 'Edit',
      onClick: actionForm.openEdit,
      variant: 'secondary',
      tooltip: 'Edit action',
    },
    {
      icon: <Icon name="delete" size={14} />,
      label: 'Delete',
      onClick: (a) => handleDeleteAction(a.id),
      variant: 'danger',
      tooltip: 'Delete action',
    },
  ], []);

  // --- Job history state ---

  // Build action lookup for resolving webhook job commands
  const actionMap = useMemo(() => {
    const map = new Map<string, typeof vendorActions[number]>();
    vendorActions.forEach((a) => map.set(String(a.id), a));
    return map;
  }, [vendorActions]);

  // Build parser lookup (for job output parsing)
  const parserMap = useMemo(() => {
    const map = new Map<number, OutputParser>();
    outputParsers.forEach((p) => map.set(p.id, p));
    return map;
  }, [outputParsers]);

  // Resolve the output parser for a job (if any)
  const getJobParser = useCallback((job: Job): OutputParser | undefined => {
    let action;
    if (job.job_type === 'webhook') {
      // For webhook jobs, job.command is the action_id
      action = actionMap.get(job.command);
    } else {
      // For command jobs, multiple actions may share the same command text —
      // find one that has a parser assigned
      action = vendorActions.find((a) =>
        a.action_type === 'ssh' && a.command === job.command && a.output_parser_id
      );
    }
    if (!action?.output_parser_id) return undefined;
    return parserMap.get(action.output_parser_id);
  }, [actionMap, vendorActions, parserMap]);

  // Auto-refresh on job updates via WebSocket
  const onJobUpdate = useCallback(() => {
    refresh();
  }, [refresh]);

  useWebSocket({ onJobUpdate });

  // Build a device lookup for display
  const deviceMap = useMemo(() => {
    const map = new Map<number, Device>();
    devices.forEach((d) => map.set(d.id, d));
    return map;
  }, [devices]);

  // Credential options for template dialogs
  const credentialOptions = useMemo(() => [
    { value: '', label: 'Use device/vendor default' },
    ...credentials.map((c) => ({ value: String(c.id), label: `${c.name} (${c.cred_type})` })),
  ], [credentials]);

  // Compute job stats for header badges
  const jobStats = useMemo(() => {
    const stats = { total: jobs.length, completed: 0, failed: 0, running: 0, queued: 0, byType: {} as Record<string, number> };
    for (const job of jobs) {
      if (job.status === 'completed') stats.completed++;
      else if (job.status === 'failed') stats.failed++;
      else if (job.status === 'running') stats.running++;
      else if (job.status === 'queued') stats.queued++;
      stats.byType[job.job_type] = (stats.byType[job.job_type] || 0) + 1;
    }
    return stats;
  }, [jobs]);

  const columns: TableColumn<Job>[] = useMemo(() => [
    {
      header: 'Status',
      accessor: (job) => Cell.status(job.status, statusVariant(job.status)),
      searchValue: (job) => job.status,
      width: '100px',
    },
    {
      header: 'Type',
      accessor: (job) => Cell.badge(job.job_type, getJobTypeBadgeVariant(job.job_type)),
      searchValue: (job) => job.job_type,
      width: '90px',
    },
    {
      header: 'Device',
      accessor: (job) => {
        if (!job.device_id) return <span className="text-muted">—</span>;
        const device = deviceMap.get(job.device_id);
        return device
          ? <span>{device.hostname} <span className="text-muted text-xs">({device.ip})</span></span>
          : Cell.code(String(job.device_id));
      },
      searchValue: (job) => {
        if (!job.device_id) return '';
        const device = deviceMap.get(job.device_id);
        return device ? `${device.hostname} ${device.ip}` : String(job.device_id);
      },
    },
    {
      header: 'Command',
      accessor: (job) => {
        if (job.job_type === 'webhook') {
          const action = actionMap.get(job.command);
          if (action) {
            return <span>{action.label} <span className="text-muted text-xs">({action.webhook_method} {Cell.truncate(action.webhook_url, 30)})</span></span>;
          }
        }
        return Cell.truncate(job.command, 50);
      },
      searchValue: (job) => {
        if (job.job_type === 'webhook') {
          const action = actionMap.get(job.command);
          if (action) return `${action.label} ${action.webhook_method} ${action.webhook_url}`;
        }
        return job.command;
      },
    },
    {
      header: 'Result',
      accessor: (job) => {
        const text = job.error || job.output;
        if (!text) return <span className="text-muted">—</span>;
        return (
          <span style={job.error ? { color: 'var(--color-error)' } : undefined}>
            {Cell.truncate(text.replace(/\n/g, ' '), 60)}
          </span>
        );
      },
      searchValue: (job) => job.error || job.output || '',
    },
    {
      header: 'Created',
      accessor: (job) => formatRelativeTime(job.created_at),
      searchable: false,
    },
    {
      header: 'Duration',
      accessor: (job) => formatDuration(job),
      searchable: false,
      width: '80px',
    },
  ], [deviceMap, actionMap]);

  const handleRelaunch = useCallback(async (job: Job) => {
    try {
      const services = getServices();
      if (job.job_type === 'deploy' && job.device_id) {
        await services.devices.deployConfig(job.device_id);
      } else if (job.job_type === 'webhook') {
        if (job.device_id) {
          await services.devices.exec(job.device_id, '', job.command);
        } else {
          const action = actionMap.get(job.command);
          if (action) {
            await services.vendors.runAction(action.id);
          }
        }
      } else if (job.device_id) {
        await services.devices.exec(job.device_id, job.command);
      }
      addNotification('success', 'Job relaunched', navigateAction('View Jobs', 'jobs', 'history'));
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addNotification('error', `Failed to relaunch: ${msg}`);
    }
  }, [actionMap, refresh]);

  const tableActions: TableAction<Job>[] = useMemo(() => [
    {
      icon: <Icon name="replay" size={14} />,
      label: 'Relaunch',
      onClick: handleRelaunch,
      variant: 'secondary',
      tooltip: 'Relaunch this job',
    },
    {
      icon: <Icon name="visibility" size={14} />,
      label: 'View Output',
      onClick: (job: Job) => setSelectedJob(job),
      variant: 'secondary',
      tooltip: 'View job details',
    },
    {
      icon: <Icon name="data_object" size={14} />,
      label: 'Parsed Output',
      onClick: (job: Job) => setParsedOutputJob(job),
      variant: 'secondary',
      tooltip: 'View parsed output table',
      show: (job: Job) => !!job.output && !!getJobParser(job),
    },
    {
      icon: <Icon name="bookmark_add" size={14} />,
      label: 'Save as Template',
      onClick: (job: Job) => setSaveTemplateJob(job),
      variant: 'secondary',
      tooltip: 'Save as reusable template',
    },
  ], [handleRelaunch, getJobParser]);

  const tabs: SideTab[] = useMemo(() => [
    { id: 'actions', label: 'Actions', icon: 'play_arrow', count: vendorActions.length },
    { id: 'history', label: 'Job History', icon: 'history', count: jobs.length },
    { id: 'templates', label: 'Templates', icon: 'bookmark', count: templates.length },
    { id: 'credentials', label: 'Credentials', icon: 'vpn_key', count: credentials.length },
    { id: 'parsers', label: 'Output Parsers', icon: 'data_object', count: outputParsers.length },
  ], [vendorActions.length, jobs.length, templates.length, credentials.length, outputParsers.length]);

  return (
    <LoadingState loading={loading && actionsLoading} error={error} loadingMessage="Loading...">
      <Card title="Jobs" titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}>
        <InfoSection open={showInfo}>
          <div>
            <p>
              Manage vendor actions and review job execution history. Actions define SSH commands or webhook API calls
              that can be run against devices individually or in bulk.
            </p>
            <ul>
              <li>Create SSH commands or webhook actions per vendor</li>
              <li>Run jobs on selected devices and view real-time output</li>
              <li>Save frequently-used job configurations as reusable templates</li>
              <li>Parse command output with regex-based output parsers</li>
              <li>Manage SSH and API key credentials for device access</li>
            </ul>
          </div>
        </InfoSection>
        <SideTabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as JobTab)}>
          {activeTab === 'actions' && (
            <Card
              title="Actions"
              titleAction={<InfoSection.Toggle open={showActionsInfo} onToggle={setShowActionsInfo} />}
              headerAction={
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <SelectField
                    name="filter-vendor"
                    options={filterVendorOptions}
                    value={filterVendor}
                    onChange={(e) => setFilterVendor(e.target.value)}
                    placeholder="Filter: All Vendors"
                    icon="filter_list"
                    className="filter-dropdown"
                  />
                  <Button variant="primary" onClick={actionForm.openAdd}>
                    <PlusIcon size={14} />
                    Add Action
                  </Button>
                </div>
              }
            >
              <InfoSection open={showActionsInfo}>
                <div>
                  <p>
                    Vendor-specific actions that can be executed against devices. Each action is either an SSH command
                    or a webhook API call tied to a specific vendor.
                  </p>
                  <ul>
                    <li>SSH actions run commands directly on devices via SSH</li>
                    <li>Webhook actions send HTTP requests to external APIs</li>
                    <li>Assign output parsers to extract structured data from results</li>
                  </ul>
                </div>
              </InfoSection>
              <Table
                data={filteredActions}
                columns={actionColumns}
                getRowKey={(a) => a.id}
                actions={actionTableActions}
                tableId="vendor-actions"
                searchable
                searchPlaceholder="Search actions..."
                emptyMessage="No vendor actions configured."
                emptyDescription="Add actions using the button above."
              />
            </Card>
          )}

          {activeTab === 'history' && (
            <Card
              title="Job History"
              titleAction={<InfoSection.Toggle open={showHistoryInfo} onToggle={setShowHistoryInfo} />}
              headerAction={
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {jobs.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {Cell.badge(`${jobStats.completed} passed`, 'success')}
                      {Cell.badge(`${jobStats.failed} failed`, 'error')}
                      {jobStats.running > 0 && Cell.badge(`${jobStats.running} running`, 'warning')}
                      {jobStats.queued > 0 && Cell.badge(`${jobStats.queued} queued`, 'default')}
                    </div>
                  )}
                  <Button variant="secondary" onClick={refresh}>
                    <RefreshIcon size={14} />
                  </Button>
                  <Button variant="primary" onClick={() => setShowRunDialog(true)}>
                    <PlusIcon size={14} />
                    Run Job
                  </Button>
                </div>
              }
            >
              <InfoSection open={showHistoryInfo}>
                <div>
                  <p>
                    Log of all executed jobs with real-time status updates. View output, re-run jobs, or save
                    configurations as reusable templates.
                  </p>
                  <ul>
                    <li>View raw command output and parsed structured results</li>
                    <li>Save successful job configurations as templates</li>
                    <li>Jobs update in real time via WebSocket</li>
                  </ul>
                </div>
              </InfoSection>
              <Table
                data={jobs}
                columns={columns}
                getRowKey={(job) => job.id}
                actions={tableActions}
                tableId="jobs"
                searchable
                searchPlaceholder="Search jobs..."
                emptyMessage="No jobs found."
                emptyDescription="Jobs will appear here when commands or deploys are executed."
              />
            </Card>
          )}

          {activeTab === 'templates' && (
            <JobTemplatesPanel
              templates={templates}
              loading={templatesLoading}
              deviceMap={deviceMap}
              actionMap={actionMap}
              onRun={async (id) => { await runTemplate(id); refresh(); return true; }}
              onEdit={(t) => setEditTemplate(t)}
              onDelete={async (id) => { await removeTemplate(id); return true; }}
              onToggleEnabled={async (t) => {
                await updateTemplate(String(t.id), {
                  name: t.name,
                  description: t.description,
                  job_type: t.job_type,
                  command: t.command,
                  action_id: t.action_id,
                  target_mode: t.target_mode,
                  target_device_ids: t.target_device_ids,
                  target_group_id: t.target_group_id,
                  schedule: t.schedule,
                  enabled: !t.enabled,
                  credential_id: t.credential_id,
                });
              }}
              onRefresh={refreshTemplates}
            />
          )}

          {activeTab === 'credentials' && (
            <CredentialsPanel
              credentials={credentials}
              loading={credentialsLoading}
              onCreate={createCredential}
              onUpdate={updateCredential}
              onDelete={deleteCredential}
              onRefresh={refreshCredentials}
            />
          )}

          {activeTab === 'parsers' && (
            <OutputParsersPanel
              outputParsers={outputParsers}
              loading={parsersLoading}
              onCreate={createOutputParser}
              onUpdate={updateOutputParser}
              onDelete={deleteOutputParser}
              onRefresh={refreshParsers}
            />
          )}
        </SideTabs>
      </Card>

      {/* Action Form Dialog */}
      <FormDialog
        isOpen={actionForm.isOpen}
        onClose={actionForm.close}
        title={actionForm.getTitle('Add Action', 'Edit Action')}
        onSubmit={handleActionFormSubmit}
        submitText={actionForm.getSubmitText('Add Action', 'Update Action')}
        variant="wide"
      >
        <div className="form-row">
          <SelectField
            label="Vendor *"
            name="vendor_id"
            value={actionForm.formData.vendor_id}
            onChange={actionForm.handleChange}
            options={vendorSelectOptions}
            required
          />
          <FormField
            label="Label *"
            name="label"
            type="text"
            value={actionForm.formData.label}
            onChange={actionForm.handleChange}
            placeholder="e.g., Show Version"
            required
          />
        </div>

        <div className="form-row">
          <SelectField
            label="Action Type"
            name="action_type"
            value={actionForm.formData.action_type}
            onChange={handleActionTypeChange}
            options={ACTION_TYPE_OPTIONS}
          />
          <FormField
            label="Sort Order"
            name="sort_order"
            type="number"
            value={actionForm.formData.sort_order.toString()}
            onChange={actionForm.handleChange}
            placeholder="0"
            min={0}
          />
        </div>

        {!isActionWebhook && (
          <FormField
            label="Command *"
            name="command"
            type="text"
            value={actionForm.formData.command}
            onChange={actionForm.handleChange}
            placeholder="e.g., show version"
            required
          />
        )}

        {isActionWebhook && (
          <>
            <div className="form-row">
              <SelectField
                label="Method"
                name="webhook_method"
                value={actionForm.formData.webhook_method}
                onChange={actionForm.handleChange}
                options={WEBHOOK_METHOD_OPTIONS}
              />
              <FormField
                label="URL *"
                name="webhook_url"
                type="text"
                value={actionForm.formData.webhook_url}
                onChange={actionForm.handleChange}
                placeholder="https://api.example.com/webhook"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="webhook_headers">Headers (JSON)</label>
              <textarea
                id="webhook_headers"
                name="webhook_headers"
                value={actionForm.formData.webhook_headers}
                onChange={actionForm.handleChange}
                placeholder='{"Authorization": "Bearer ...", "Content-Type": "application/json"}'
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="webhook_body">Body</label>
              <textarea
                id="webhook_body"
                name="webhook_body"
                value={actionForm.formData.webhook_body}
                onChange={actionForm.handleChange}
                placeholder={'{"device_ip": "{{ip}}", "hostname": "{{hostname}}"}'}
                rows={4}
              />
            </div>

            <div className="form-hint">
              Use <code>{'{{hostname}}'}</code>, <code>{'{{ip}}'}</code>, <code>{'{{mac}}'}</code>, <code>{'{{vendor}}'}</code>, <code>{'{{model}}'}</code>, <code>{'{{serial_number}}'}</code>, <code>{'{{device_id}}'}</code> for device variable substitution in URL and body.
            </div>
          </>
        )}

        <SelectField
          label="Output Parser"
          name="output_parser_id"
          value={actionForm.formData.output_parser_id}
          onChange={actionForm.handleChange}
          options={actionParserOptions}
        />
      </FormDialog>

      {/* Save as Template Dialog */}
      <SaveAsTemplateDialog
        isOpen={!!saveTemplateJob}
        onClose={() => setSaveTemplateJob(null)}
        job={saveTemplateJob}
        deviceMap={deviceMap}
        actionMap={actionMap}
        onCreate={createTemplate}
        credentialOptions={credentialOptions}
      />

      {/* Edit Template Dialog */}
      <EditTemplateDialog
        isOpen={!!editTemplate}
        onClose={() => setEditTemplate(null)}
        template={editTemplate}
        onUpdate={updateTemplate}
        credentialOptions={credentialOptions}
        deviceMap={deviceMap}
        actionMap={actionMap}
      />

      {/* Job Detail Modal */}
      <Modal
        isOpen={!!selectedJob}
        title="Job Details"
        onClose={() => setSelectedJob(null)}
        variant="wide"
      >
        {selectedJob && (() => {
          const isWebhook = selectedJob.job_type === 'webhook';
          const action = isWebhook ? actionMap.get(selectedJob.command) : undefined;
          const device = selectedJob.device_id ? deviceMap.get(selectedJob.device_id) : undefined;
          const webhookHeaders = action?.webhook_headers && action.webhook_headers !== '{}'
            ? (() => { try { return JSON.parse(action.webhook_headers) as Record<string, string>; } catch { return undefined; } })()
            : undefined;

          return (
            <div className="job-detail">
              <div className="grid-2">
                <div className="info-grid">
                  <span className="label">Status</span>
                  {Cell.status(selectedJob.status, statusVariant(selectedJob.status))}

                  <span className="label">Type</span>
                  <span>{selectedJob.job_type}</span>

                  <span className="label">Device</span>
                  {selectedJob.device_id
                    ? (device
                        ? <span>{device.hostname} ({device.ip})</span>
                        : <code>{String(selectedJob.device_id)}</code>)
                    : <span className="text-muted">—</span>}

                  <span className="label">Job ID</span>
                  <code className="text-xs">{selectedJob.id}</code>
                </div>

                <div className="info-grid">
                  <span className="label">Created</span>
                  <span>{formatRelativeTime(selectedJob.created_at)}</span>

                  {selectedJob.started_at && (
                    <>
                      <span className="label">Started</span>
                      <span>{formatRelativeTime(selectedJob.started_at)}</span>
                    </>
                  )}

                  {selectedJob.completed_at && (
                    <>
                      <span className="label">Completed</span>
                      <span>{formatRelativeTime(selectedJob.completed_at)}</span>
                    </>
                  )}

                  <span className="label">Duration</span>
                  <span>{formatDuration(selectedJob)}</span>
                </div>
              </div>

              {isWebhook && action ? (
                <div className="info-grid" style={{ marginTop: '1rem' }}>
                  <span className="label">Action</span>
                  <span>{action.label}</span>

                  <span className="label">Method</span>
                  {Cell.badge(action.webhook_method, getHttpMethodBadgeVariant(action.webhook_method))}

                  <span className="label">URL</span>
                  <code className="text-xs" style={{ wordBreak: 'break-all' }}>{action.webhook_url}</code>

                  {webhookHeaders && (
                    <>
                      <span className="label">Headers</span>
                      <pre className="command-entry-output" style={{ margin: 0 }}>{JSON.stringify(webhookHeaders, null, 2)}</pre>
                    </>
                  )}

                  {action.webhook_body && (
                    <>
                      <span className="label">Body</span>
                      <pre className="command-entry-output" style={{ margin: 0 }}>{action.webhook_body}</pre>
                    </>
                  )}
                </div>
              ) : selectedJob.command ? (
                <div style={{ marginTop: '1rem' }}>
                  <span className="label" style={{ display: 'block', marginBottom: '4px' }}>
                    {selectedJob.job_type === 'deploy' ? 'Template' : 'Command'}
                  </span>
                  <pre className="command-entry-output">{selectedJob.command}</pre>
                </div>
              ) : null}

              {selectedJob.output && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <span className="label">Output</span>
                    <CopyButton text={selectedJob.output} />
                  </div>
                  <pre className="command-entry-output">{selectedJob.output}</pre>
                </div>
              )}

              {selectedJob.error && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                    <span className="label">Error</span>
                    <CopyButton text={selectedJob.error} />
                  </div>
                  <pre className="command-entry-output" style={{ color: 'var(--color-error)' }}>
                    {selectedJob.error}
                  </pre>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Parsed Output Modal */}
      <Modal
        isOpen={!!parsedOutputJob}
        title="Parsed Output"
        onClose={() => setParsedOutputJob(null)}
        variant="wide"
      >
        {parsedOutputJob && (() => {
          const parser = getJobParser(parsedOutputJob);
          if (!parser || !parsedOutputJob.output) return <span className="text-muted">No parser available</span>;

          try {
            const regex = new RegExp(parser.pattern, 'gm');
            const names = parser.extract_names.split(',').map(n => n.trim()).filter(Boolean);
            const matches: Record<string, string>[] = [];
            let match;
            while ((match = regex.exec(parsedOutputJob.output)) !== null) {
              const row: Record<string, string> = {};
              match.slice(1).forEach((val, i) => {
                row[names[i] || `group_${i + 1}`] = val || '';
              });
              matches.push(row);
              if (!regex.global) break;
            }

            if (matches.length === 0) {
              return (
                <div>
                  <p className="text-muted">Parser "{parser.name}" matched no results.</p>
                  <div style={{ marginTop: '12px' }}>
                    <span className="label" style={{ display: 'block', marginBottom: '4px' }}>Raw Output</span>
                    <pre className="command-entry-output">{parsedOutputJob.output}</pre>
                  </div>
                </div>
              );
            }

            const headers = names.length > 0 ? names : Object.keys(matches[0]);
            return (
              <div>
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="text-secondary text-xs">Parser: <strong>{parser.name}</strong></span>
                  <span className="text-muted text-xs">{matches.length} row{matches.length !== 1 ? 's' : ''} matched</span>
                </div>
                <SimpleTable
                  headers={headers}
                  rows={matches.map(row => headers.map(h => row[h] || ''))}
                  className="table"
                />
              </div>
            );
          } catch (err) {
            return (
              <div>
                <p style={{ color: 'var(--color-error)' }}>
                  Parser regex error: {err instanceof Error ? err.message : String(err)}
                </p>
                <div style={{ marginTop: '12px' }}>
                  <span className="label" style={{ display: 'block', marginBottom: '4px' }}>Raw Output</span>
                  <pre className="command-entry-output">{parsedOutputJob.output}</pre>
                </div>
              </div>
            );
          }
        })()}
      </Modal>

      {/* Run Job Dialog */}
      <RunJobDialog
        isOpen={showRunDialog || !!runActionId}
        onClose={() => { setShowRunDialog(false); setRunActionId(null); }}
        onSubmitted={refresh}
        initialActionId={runActionId || undefined}
      />
    </LoadingState>
  );
}
