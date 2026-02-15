import { useState, useMemo } from 'react';
import type { JobTemplate, Device } from '@core';
import { formatRelativeTime, getJobTypeBadgeVariant } from '@core';
import { Button } from './Button';
import { Card } from './Card';
import { InfoSection } from './InfoSection';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { Icon, RefreshIcon, SpinnerIcon } from './Icon';

interface JobTemplatesPanelProps {
  templates: JobTemplate[];
  loading: boolean;
  deviceMap: Map<number, Device>;
  actionMap: Map<string, { label: string }>;
  onRun: (id: string) => Promise<boolean>;
  onEdit: (template: JobTemplate) => void;
  onDelete: (id: string) => Promise<boolean>;
  onToggleEnabled: (template: JobTemplate) => Promise<void>;
  onRefresh: () => void;
}

export function JobTemplatesPanel({ templates, loading, deviceMap, actionMap, onRun, onEdit, onDelete, onToggleEnabled, onRefresh }: JobTemplatesPanelProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleRun = async (t: JobTemplate) => {
    setRunningId(t.id);
    try {
      await onRun(t.id);
    } finally {
      setRunningId(null);
    }
  };

  const columns: TableColumn<JobTemplate>[] = useMemo(() => [
    {
      header: 'Name',
      accessor: (t) => (
        <span>
          {t.name}
          {t.description && <span className="text-muted text-xs" style={{ marginLeft: '6px' }}>{t.description}</span>}
        </span>
      ),
      searchValue: (t) => `${t.name} ${t.description}`,
    },
    {
      header: 'Type',
      accessor: (t) => Cell.badge(t.job_type, getJobTypeBadgeVariant(t.job_type)),
      searchValue: (t) => t.job_type,
      width: '90px',
    },
    {
      header: 'Target',
      accessor: (t) => {
        if (t.target_mode === 'group' && t.target_group_id) {
          return <span><Icon name="account_tree" size={14} /> Group</span>;
        }
        if (t.target_device_ids.length > 0) {
          const names = t.target_device_ids
            .map((id) => deviceMap.get(id)?.hostname || String(id))
            .join(', ');
          return <span title={names}>{t.target_device_ids.length} device{t.target_device_ids.length !== 1 ? 's' : ''}</span>;
        }
        return <span className="text-muted">—</span>;
      },
      searchValue: (t) => t.target_device_ids.map((id) => deviceMap.get(id)?.hostname || String(id)).join(' '),
      width: '120px',
    },
    {
      header: 'Schedule',
      accessor: (t) => t.schedule
        ? <code className="text-xs">{t.schedule}</code>
        : <span className="text-muted">Manual</span>,
      searchValue: (t) => t.schedule || 'manual',
      width: '130px',
    },
    {
      header: 'Enabled',
      accessor: (t) => Cell.enabled(t.enabled),
      searchable: false,
      width: '90px',
    },
    {
      header: 'Last Run',
      accessor: (t) => t.last_run_at ? formatRelativeTime(t.last_run_at) : <span className="text-muted">Never</span>,
      searchable: false,
      width: '100px',
    },
  ], [deviceMap]);

  const tableActions: TableAction<JobTemplate>[] = [
    {
      icon: <Icon name="play_arrow" size={14} />,
      label: 'Run Now',
      onClick: (t: JobTemplate) => handleRun(t),
      variant: 'primary' as const,
      tooltip: 'Run this template now',
    },
    {
      icon: (t: JobTemplate) => <Icon name={t.enabled ? 'pause_circle' : 'play_circle'} size={14} />,
      label: (t: JobTemplate) => t.enabled ? 'Disable' : 'Enable',
      onClick: (t: JobTemplate) => onToggleEnabled(t),
      variant: 'secondary' as const,
      tooltip: (t: JobTemplate) => t.enabled ? 'Disable scheduled execution' : 'Enable scheduled execution',
    },
    {
      icon: <Icon name="edit" size={14} />,
      label: 'Edit',
      onClick: (t: JobTemplate) => onEdit(t),
      variant: 'secondary' as const,
      tooltip: 'Edit template',
    },
    {
      icon: <Icon name="delete" size={14} />,
      label: 'Delete',
      onClick: (t: JobTemplate) => onDelete(t.id),
      variant: 'danger' as const,
      tooltip: 'Delete template',
    },
  ];

  return (
    <Card
      title="Job Templates"
      titleAction={<InfoSection.Toggle open={showInfo} onToggle={setShowInfo} />}
      headerAction={
        <Button variant="secondary" onClick={onRefresh} disabled={loading}>
          <RefreshIcon size={14} />
        </Button>
      }
    >
      <InfoSection open={showInfo}>
        <div>
          <p>
            Saved job configurations that can be re-run on demand or scheduled. Templates capture the action,
            target devices, credentials, and scheduling preferences.
          </p>
          <ul>
            <li>Run templates instantly or on a cron schedule</li>
            <li>Enable or disable scheduled execution per template</li>
            <li>Save any job as a template from the job history actions</li>
          </ul>
        </div>
      </InfoSection>
      {loading && templates.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '24px', justifyContent: 'center' }}>
          <SpinnerIcon size={16} /> Loading templates...
        </div>
      ) : (
        <Table
          data={templates}
          columns={columns}
          getRowKey={(t) => t.id}
          actions={tableActions}
          tableId="job-templates"
          searchable
          searchPlaceholder="Search templates..."
          emptyMessage="No templates saved."
          emptyDescription="Save a job as a template using the action menu on any job row."
        />
      )}
    </Card>
  );
}
