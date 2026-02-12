import { useState, useEffect } from 'react';
import { getNotifications, getUnreadCount, onNotificationsChange, type Notification } from '../services/notifications';

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
}

export function useNotificationHistory(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>(getNotifications);
  const [unreadCount, setUnreadCount] = useState<number>(getUnreadCount);

  useEffect(() => {
    return onNotificationsChange((updated) => {
      setNotifications(updated);
      setUnreadCount(updated.filter((n) => !n.read).length);
    });
  }, []);

  return { notifications, unreadCount };
}
