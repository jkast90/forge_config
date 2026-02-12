import { createContext, useContext, useCallback, ReactNode } from 'react';
import { addNotification } from '@core';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Generate unique ID
let toastIdCounter = 0;
const generateId = () => `toast-${++toastIdCounter}-${Date.now()}`;

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = generateId();
    addNotification(toast.type, toast.message);
    return id;
  }, []);

  const removeToast = useCallback((_id: string) => {}, []);
  const clearToasts = useCallback(() => {}, []);

  return (
    <ToastContext.Provider value={{ toasts: [], addToast, removeToast, clearToasts }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Options for toast convenience methods
interface ToastOptions {
  duration?: number;
  action?: ToastAction;
}

// Convenience hook for common toast operations
export function useToastActions() {
  const { addToast, removeToast, clearToasts } = useToast();

  return {
    success: (message: string, options?: ToastOptions) =>
      addToast({ type: 'success', message, ...options }),
    error: (message: string, options?: ToastOptions) =>
      addToast({ type: 'error', message, ...options }),
    warning: (message: string, options?: ToastOptions) =>
      addToast({ type: 'warning', message, ...options }),
    info: (message: string, options?: ToastOptions) =>
      addToast({ type: 'info', message, ...options }),
    remove: removeToast,
    clear: clearToasts,
  };
}
