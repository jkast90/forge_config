// Client-side telemetry event tracking

export type TelemetryEventType =
  | 'page_nav'
  | 'page_load'
  | 'visibility_change'
  | 'route_change'
  | 'theme_change'
  | 'modal_open'
  | 'modal_close';

export interface TelemetryEvent {
  id: number;
  type: TelemetryEventType;
  timestamp: number;
  detail: string;
  metadata?: Record<string, string>;
}

const MAX_EVENTS = 200;
let eventIdCounter = 0;
const events: TelemetryEvent[] = [];
const listeners = new Set<(events: TelemetryEvent[]) => void>();

function notify() {
  const snapshot = [...events];
  listeners.forEach(fn => fn(snapshot));
}

export function trackEvent(
  type: TelemetryEventType,
  detail: string,
  metadata?: Record<string, string>,
) {
  const event: TelemetryEvent = {
    id: ++eventIdCounter,
    type,
    timestamp: Date.now(),
    detail,
    metadata,
  };
  events.unshift(event);
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS;
  }
  notify();
}

export function getTelemetryEvents(): TelemetryEvent[] {
  return [...events];
}

export function clearTelemetryEvents(): void {
  events.length = 0;
  notify();
}

export function onTelemetryChange(listener: (events: TelemetryEvent[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Auto-track browser events when running in a browser environment
let initialized = false;

export function initTelemetry() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Page load
  trackEvent('page_load', window.location.pathname, {
    url: window.location.href,
    referrer: document.referrer || '(direct)',
  });

  // Visibility changes
  document.addEventListener('visibilitychange', () => {
    trackEvent('visibility_change', document.visibilityState, {
      hidden: String(document.hidden),
    });
  });

  // Hash changes (route changes)
  window.addEventListener('hashchange', () => {
    trackEvent('route_change', window.location.hash || '(empty)', {
      url: window.location.href,
    });
  });
}
