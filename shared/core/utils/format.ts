// Formatting utilities - platform agnostic

export function formatDate(date?: string | Date | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}

export function formatRelativeTime(date?: string | Date | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yy}${mm}${dd} ${hh}:${min}:${ss}`;
}

export function formatMacAddress(mac: string): string {
  return mac.toLowerCase();
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format a future expiry time as a human-readable duration
 * @param expiresAt - ISO date string of the expiry time
 * @returns Duration string (e.g., "2h 15m", "45m", "Expired")
 */
export function formatExpiry(expiresAt: string): string {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs < 0) {
    return 'Expired';
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHours > 0) {
    return `${diffHours}h ${diffMins}m`;
  }
  return `${diffMins}m`;
}

/**
 * Discovery event types
 */
export type DiscoveryEventType = 'discovered' | 'added' | 'lease_renewed' | string;

/**
 * Format a discovery event type as a human-readable label
 * @param eventType - The event type string
 * @returns Human-readable label
 */
export function formatEventType(eventType: DiscoveryEventType): string {
  switch (eventType) {
    case 'discovered':
      return 'New Device';
    case 'added':
      return 'Device Added';
    case 'lease_renewed':
      return 'Lease Renewed';
    default:
      return eventType;
  }
}

/**
 * Get the icon name for a discovery event type
 * @param eventType - The event type string
 * @returns Material icon name
 */
export function getEventTypeIcon(eventType: DiscoveryEventType): string {
  switch (eventType) {
    case 'discovered':
      return 'fiber_new';
    case 'added':
      return 'add_circle';
    case 'lease_renewed':
      return 'refresh';
    default:
      return 'schedule';
  }
}
