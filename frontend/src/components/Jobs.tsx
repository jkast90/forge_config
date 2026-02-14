import { useState, useMemo, useCallback } from 'react';
import type { Job } from '@core';
import { useJobs, useWebSocket, formatRelativeTime } from '@core';
import { ActionBar } from './ActionBar';
import { Button } from './Button';
import { Card } from './Card';
import { LoadingState } from './LoadingState';
import { Modal } from './Modal';
import { Table, Cell } from './Table';
import type { TableColumn, TableAction } from './Table';
import { Icon, RefreshIcon } from './Icon';

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

export function Jobs() {
  const { jobs, loading, error, refresh } = useJobs();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Auto-refresh on job updates via WebSocket
  const onJobUpdate = useCallback(() => {
    refresh();
  }, [refresh]);

  useWebSocket({ onJobUpdate });

  const columns: TableColumn<Job>[] = useMemo(() => [
    {
      header: 'Status',
      accessor: (job) => Cell.status(job.status, statusVariant(job.status)),
      searchValue: (job) => job.status,
      width: '100px',
    },
    {
      header: 'Type',
      accessor: (job) => (
        <span className={`badge badge-${job.job_type === 'deploy' ? 'info' : 'default'}`}>
          {job.job_type}
        </span>
      ),
      searchValue: (job) => job.job_type,
      width: '90px',
    },
    {
      header: 'Device',
      accessor: (job) => Cell.code(job.device_id),
      searchValue: (job) => job.device_id,
    },
    {
      header: 'Command',
      accessor: (job) => Cell.truncate(job.command, 50),
      searchValue: (job) => job.command,
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
  ], []);

  const actions: TableAction<Job>[] = useMemo(() => [
    {
      icon: <Icon name="visibility" size={14} />,
      label: 'View Output',
      onClick: (job: Job) => setSelectedJob(job),
      variant: 'secondary',
      tooltip: 'View job details',
    },
  ], []);

  return (
    <LoadingState loading={loading} error={error} loadingMessage="Loading jobs...">
      <ActionBar>
        <Button variant="secondary" onClick={refresh}>
          <RefreshIcon size={16} />
          Refresh
        </Button>
      </ActionBar>

      <Card title="Job History">
        <Table
          data={jobs}
          columns={columns}
          getRowKey={(job) => job.id}
          actions={actions}
          tableId="jobs"
          searchable
          searchPlaceholder="Search jobs..."
          emptyMessage="No jobs found."
          emptyDescription="Jobs will appear here when commands or deploys are executed."
        />
      </Card>

      <Modal
        isOpen={!!selectedJob}
        title="Job Details"
        onClose={() => setSelectedJob(null)}
        variant="wide"
      >
        {selectedJob && (
          <div className="job-detail">
            <div className="info-grid">
              <div className="info-item">
                <label>Status</label>
                {Cell.status(selectedJob.status, statusVariant(selectedJob.status))}
              </div>
              <div className="info-item">
                <label>Type</label>
                <span>{selectedJob.job_type}</span>
              </div>
              <div className="info-item">
                <label>Device</label>
                <code>{selectedJob.device_id}</code>
              </div>
              <div className="info-item">
                <label>Job ID</label>
                <code className="text-xs">{selectedJob.id}</code>
              </div>
              <div className="info-item">
                <label>Created</label>
                <span>{formatRelativeTime(selectedJob.created_at)}</span>
              </div>
              {selectedJob.started_at && (
                <div className="info-item">
                  <label>Started</label>
                  <span>{formatRelativeTime(selectedJob.started_at)}</span>
                </div>
              )}
              {selectedJob.completed_at && (
                <div className="info-item">
                  <label>Completed</label>
                  <span>{formatRelativeTime(selectedJob.completed_at)}</span>
                </div>
              )}
              <div className="info-item">
                <label>Duration</label>
                <span>{formatDuration(selectedJob)}</span>
              </div>
            </div>

            <div className="info-item" style={{ marginTop: '1rem' }}>
              <label>Command</label>
              <pre className="command-entry-output">{selectedJob.command}</pre>
            </div>

            {selectedJob.output && (
              <div className="info-item" style={{ marginTop: '1rem' }}>
                <label>Output</label>
                <pre className="command-entry-output">{selectedJob.output}</pre>
              </div>
            )}

            {selectedJob.error && (
              <div className="info-item" style={{ marginTop: '1rem' }}>
                <label>Error</label>
                <pre className="command-entry-output" style={{ color: 'var(--color-error)' }}>
                  {selectedJob.error}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </LoadingState>
  );
}
