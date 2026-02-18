import { useState, useEffect, useRef } from 'react';
import { useNotificationHistory, markAllRead, clearNotifications, onNotificationsChange, type Notification, type NotificationLevel } from '@core';
import { Drawer } from './Drawer';
import { IconButton } from './IconButton';
import { Icon } from './Icon';
import { EmptyState } from './EmptyState';

const LEVEL_ICONS: Record<NotificationLevel, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

const LEVEL_COLORS: Record<NotificationLevel, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  warning: 'var(--color-warning)',
  info: 'var(--color-accent-blue)',
};

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function NotificationItem({ notification, onClick, onAction }: { notification: Notification; onClick?: () => void; onAction?: () => void }) {
  const action = notification.action;
  const isClickable = !!onClick || !!action;
  const handleClick = onClick || (action ? () => { action.onClick(); onAction?.(); } : undefined);
  return (
    <div
      className={`notification-item${notification.read ? '' : ' notification-unread'}${isClickable ? ' clickable' : ''}`}
      onClick={handleClick}
      title={isClickable ? (action ? action.label : 'View API details') : undefined}
    >
      <Icon
        name={LEVEL_ICONS[notification.level]}
        size={16}
        style={{ color: LEVEL_COLORS[notification.level], flexShrink: 0, marginTop: 2 }}
      />
      <div className="notification-body">
        <span className="notification-message">{notification.message}</span>
        <span className="notification-time">
          {formatTime(notification.timestamp)}
          {action && (
            <span className="notification-action-link">{action.label}</span>
          )}
          {!action && isClickable && (
            <Icon name="open_in_new" size={12} style={{ marginLeft: 4, opacity: 0.5 }} />
          )}
        </span>
      </div>
    </div>
  );
}

interface NotificationsProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when an error notification is clicked — timestamp used to find matching API entry */
  onViewApiError?: (timestamp: number) => void;
}

export function Notifications({ isOpen, onClose, onViewApiError }: NotificationsProps) {
  const { notifications, unreadCount } = useNotificationHistory();

  // Mark as read when opened
  useEffect(() => {
    if (isOpen && unreadCount > 0) {
      markAllRead();
    }
  }, [isOpen, unreadCount]);

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Notifications" side="right" wide>
      <div className="flex-between mb-8">
        <span className="text-xs text-muted">{notifications.length} notifications</span>
        <IconButton variant="ghost" onClick={() => clearNotifications()} title="Clear all">
          <Icon name="delete_sweep" size={16} />
        </IconButton>
      </div>
      {notifications.length === 0 ? (
        <EmptyState
          icon="notifications_none"
          message="No notifications yet"
          description="Notifications from actions and events will appear here"
          size="sm"
        />
      ) : (
        <div className="notification-list">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onClick={n.level === 'error' && onViewApiError ? () => onViewApiError(n.timestamp) : undefined}
              onAction={onClose}
            />
          ))}
        </div>
      )}
    </Drawer>
  );
}

// Small pop-up that briefly appears when a new notification is added
interface NotificationPopupProps {
  onViewApiError?: (timestamp: number) => void;
}

export function NotificationPopup({ onViewApiError }: NotificationPopupProps) {
  const [popup, setPopup] = useState<Notification | null>(null);
  const [exiting, setExiting] = useState(false);
  const prevCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return onNotificationsChange((notifications) => {
      if (notifications.length > prevCountRef.current && notifications.length > 0) {
        const newest = notifications[0];
        // Clear any existing timer
        if (timerRef.current) clearTimeout(timerRef.current);
        setExiting(false);
        setPopup(newest);
        // Auto-dismiss after 3s
        timerRef.current = setTimeout(() => {
          setExiting(true);
          setTimeout(() => setPopup(null), 300);
        }, 3000);
      }
      prevCountRef.current = notifications.length;
    });
  }, []);

  if (!popup) return null;

  const hasAction = !!popup.action;
  const hasErrorAction = popup.level === 'error' && !!onViewApiError;
  const isClickable = hasAction || hasErrorAction;

  const handleClick = isClickable ? () => {
    if (hasAction) {
      popup.action!.onClick();
    } else if (hasErrorAction) {
      onViewApiError!(popup.timestamp);
    }
    setPopup(null);
  } : undefined;

  return (
    <div
      className={`notification-popup${isClickable ? ' notification-popup-clickable' : ''}`}
      style={{
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateY(-12px) scale(0.95)' : 'translateY(0) scale(1)',
        cursor: isClickable ? 'pointer' : undefined,
      }}
      onClick={handleClick}
    >
      <Icon
        name={LEVEL_ICONS[popup.level]}
        size={16}
        style={{ color: LEVEL_COLORS[popup.level], flexShrink: 0 }}
      />
      <span className="notification-popup-text">{popup.message}</span>
      {popup.action && (
        <span className="notification-action-link">{popup.action.label}</span>
      )}
      {!popup.action && hasErrorAction && (
        <Icon name="open_in_new" size={12} style={{ marginLeft: 4, opacity: 0.5 }} />
      )}
    </div>
  );
}
