// Notification history store — captures toast notifications for persistent viewing

export type NotificationLevel = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: number;
  level: NotificationLevel;
  message: string;
  timestamp: number;
  read: boolean;
}

let notifications: Notification[] = [];
let nextId = 1;
let listeners: Array<(notifications: Notification[]) => void> = [];

function emit() {
  const snapshot = [...notifications];
  listeners.forEach((fn) => fn(snapshot));
}

export function addNotification(level: NotificationLevel, message: string): Notification {
  const notification: Notification = {
    id: nextId++,
    level,
    message,
    timestamp: Date.now(),
    read: false,
  };
  notifications = [notification, ...notifications];
  // Cap at 100
  if (notifications.length > 100) {
    notifications = notifications.slice(0, 100);
  }
  emit();
  return notification;
}

export function markAllRead() {
  notifications = notifications.map((n) => ({ ...n, read: true }));
  emit();
}

export function clearNotifications() {
  notifications = [];
  emit();
}

export function getNotifications(): Notification[] {
  return [...notifications];
}

export function getUnreadCount(): number {
  return notifications.filter((n) => !n.read).length;
}

export function onNotificationsChange(listener: (notifications: Notification[]) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((fn) => fn !== listener);
  };
}
