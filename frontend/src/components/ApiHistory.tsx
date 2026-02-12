import { useState, useEffect, useRef } from 'react';
import { useApiHistory, clearApiHistory, type ApiHistoryEntry } from '@core';
import { Drawer } from './Drawer';
import { IconButton } from './IconButton';
import { Icon } from './Icon';
import { EmptyState } from './EmptyState';

function StatusBadge({ status, error }: { status: number | null; error: string | null }) {
  if (error) {
    return <span className="status offline">{status ?? 'ERR'}</span>;
  }
  if (status === null) {
    return <span className="status provisioning">...</span>;
  }
  const cls = status < 300 ? 'online' : status < 500 ? 'provisioning' : 'offline';
  return <span className={`status ${cls}`}>{status}</span>;
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'var(--color-accent-cyan)',
    POST: 'var(--color-success)',
    PUT: 'var(--color-warning)',
    DELETE: 'var(--color-error)',
  };
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.7rem',
      fontWeight: 600,
      color: colors[method] || 'var(--color-text-secondary)',
    }}>
      {method}
    </span>
  );
}

function EntryDetail({ entry }: { entry: ApiHistoryEntry }) {
  const hasParams = Object.keys(entry.queryParams).length > 0;

  return (
    <div className="api-history-detail">
      <div className="info-grid" style={{ fontSize: '0.8rem' }}>
        <span className="label">URL</span>
        <code className="code-sm">{entry.url}</code>

        {hasParams && (
          <>
            <span className="label">Params</span>
            <div>
              {Object.entries(entry.queryParams).map(([k, v]) => (
                <div key={k}>
                  <code className="code-sm">{k}</code>
                  <span style={{ color: 'var(--color-text-muted)' }}> = </span>
                  <code className="code-sm">{v}</code>
                </div>
              ))}
            </div>
          </>
        )}

        {entry.requestBody && (
          <>
            <span className="label">Body</span>
            <pre className="pre-scrollable">{JSON.stringify(entry.requestBody, null, 2)}</pre>
          </>
        )}

        {entry.responseBody !== null && (
          <>
            <span className="label">Response</span>
            <pre className="pre-scrollable">{JSON.stringify(entry.responseBody, null, 2)}</pre>
          </>
        )}

        {entry.error && (
          <>
            <span className="label">Error</span>
            <span style={{ color: 'var(--color-error)', fontSize: '0.8rem' }}>{entry.error}</span>
          </>
        )}
      </div>
    </div>
  );
}

function HistoryEntry({ entry, defaultExpanded }: { entry: ApiHistoryEntry; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const ref = useRef<HTMLDivElement>(null);
  const time = new Date(entry.timestamp).toLocaleTimeString();

  useEffect(() => {
    if (defaultExpanded && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [defaultExpanded]);

  return (
    <div
      ref={ref}
      className={`api-history-entry${entry.error ? ' api-history-error' : ''}${defaultExpanded ? ' api-history-highlight' : ''}`}
    >
      <div className="api-history-row clickable" onClick={() => setExpanded(!expanded)}>
        <Icon name={expanded ? 'expand_more' : 'chevron_right'} size={16} />
        <MethodBadge method={entry.method} />
        <span className="api-history-path">{entry.path.split('?')[0]}</span>
        <span className="flex-1" />
        <StatusBadge status={entry.status} error={entry.error} />
        <span className="api-history-duration">{entry.durationMs}ms</span>
        <span className="api-history-time">{time}</span>
      </div>
      {expanded && <EntryDetail entry={entry} />}
    </div>
  );
}

interface ApiHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  /** Timestamp of a notification — auto-expands the closest error API entry */
  highlightTimestamp?: number | null;
}

export function ApiHistory({ isOpen, onClose, highlightTimestamp }: ApiHistoryProps) {
  const entries = useApiHistory();

  // Find the API error entry closest to the notification timestamp
  const highlightId = (() => {
    if (!highlightTimestamp) return null;
    const errorEntries = entries.filter(e => e.error);
    if (errorEntries.length === 0) return null;
    // Find the entry with the closest timestamp (within 2s window)
    let best: ApiHistoryEntry | null = null;
    let bestDiff = Infinity;
    for (const e of errorEntries) {
      const diff = Math.abs(e.timestamp - highlightTimestamp);
      if (diff < bestDiff && diff < 2000) {
        bestDiff = diff;
        best = e;
      }
    }
    return best?.id ?? null;
  })();

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="API History" wide>
      <div className="flex-between mb-8">
        <span className="text-xs text-muted">{entries.length} calls</span>
        <IconButton variant="ghost" onClick={() => clearApiHistory()} title="Clear history">
          <Icon name="delete_sweep" size={16} />
        </IconButton>
      </div>
      {entries.length === 0 ? (
        <EmptyState
          icon="history"
          message="No API calls yet"
          description="API calls will appear here as you interact with the app"
          size="sm"
        />
      ) : (
        <div className="api-history-list">
          {entries.map((entry) => (
            <HistoryEntry
              key={entry.id}
              entry={entry}
              defaultExpanded={entry.id === highlightId}
            />
          ))}
        </div>
      )}
    </Drawer>
  );
}
