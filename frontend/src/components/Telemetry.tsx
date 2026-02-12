import { useState } from 'react';
import { useTelemetry, clearTelemetryEvents, type TelemetryEvent, type TelemetryEventType } from '@core';
import { Drawer } from './Drawer';
import { IconButton } from './IconButton';
import { Icon } from './Icon';
import { EmptyState } from './EmptyState';

const EVENT_ICONS: Record<TelemetryEventType, string> = {
  page_nav: 'swap_horiz',
  page_load: 'open_in_browser',
  visibility_change: 'visibility',
  route_change: 'tag',
  theme_change: 'palette',
  modal_open: 'open_in_new',
  modal_close: 'close',
};

const EVENT_COLORS: Record<TelemetryEventType, string> = {
  page_nav: 'var(--color-accent-blue)',
  page_load: 'var(--color-success)',
  visibility_change: 'var(--color-warning)',
  route_change: 'var(--color-accent-cyan)',
  theme_change: 'var(--color-accent-purple)',
  modal_open: 'var(--color-accent-teal)',
  modal_close: 'var(--color-text-muted)',
};

const EVENT_LABELS: Record<TelemetryEventType, string> = {
  page_nav: 'Page Nav',
  page_load: 'Page Load',
  visibility_change: 'Visibility',
  route_change: 'Route Change',
  theme_change: 'Theme',
  modal_open: 'Modal Open',
  modal_close: 'Modal Close',
};

function EventTypeBadge({ type }: { type: TelemetryEventType }) {
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.65rem',
      fontWeight: 600,
      color: EVENT_COLORS[type] || 'var(--color-text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
    }}>
      {EVENT_LABELS[type] || type}
    </span>
  );
}

function EventDetail({ event }: { event: TelemetryEvent }) {
  const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;

  return (
    <div className="api-history-detail">
      <div className="info-grid" style={{ fontSize: '0.8rem' }}>
        <span className="label">Detail</span>
        <code className="code-sm">{event.detail}</code>

        {hasMetadata && Object.entries(event.metadata!).map(([k, v]) => (
          <span key={k}>
            <span className="label">{k}</span>
            <code className="code-sm">{v}</code>
          </span>
        ))}
      </div>
    </div>
  );
}

function TelemetryEntry({ event }: { event: TelemetryEvent }) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(event.timestamp).toLocaleTimeString();

  return (
    <div className="api-history-entry">
      <div className="api-history-row clickable" onClick={() => setExpanded(!expanded)}>
        <Icon name={expanded ? 'expand_more' : 'chevron_right'} size={16} />
        <Icon name={EVENT_ICONS[event.type] || 'circle'} size={14} style={{ color: EVENT_COLORS[event.type] }} />
        <EventTypeBadge type={event.type} />
        <span className="api-history-path">{event.detail}</span>
        <span className="flex-1" />
        <span className="api-history-time">{time}</span>
      </div>
      {expanded && <EventDetail event={event} />}
    </div>
  );
}

interface TelemetryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Telemetry({ isOpen, onClose }: TelemetryProps) {
  const events = useTelemetry();

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Telemetry" wide>
      <div className="flex-between mb-8">
        <span className="text-xs text-muted">{events.length} events</span>
        <IconButton variant="ghost" onClick={() => clearTelemetryEvents()} title="Clear telemetry">
          <Icon name="delete_sweep" size={16} />
        </IconButton>
      </div>
      {events.length === 0 ? (
        <EmptyState
          icon="insights"
          message="No telemetry events yet"
          description="Page navigations, visibility changes, and route changes will appear here"
          size="sm"
        />
      ) : (
        <div className="api-history-list">
          {events.map((event) => (
            <TelemetryEntry key={event.id} event={event} />
          ))}
        </div>
      )}
    </Drawer>
  );
}
