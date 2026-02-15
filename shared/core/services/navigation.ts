// Global navigation service — registered by App, consumed anywhere
// Supports deep linking to page + tab combinations

import type { NotificationAction } from './notifications';

export interface NavigationTarget {
  page: string;
  tab?: string;
}

type NavigationHandler = (target: NavigationTarget) => void;

let handler: NavigationHandler | null = null;
let pendingTab: string | null = null;
let tabListeners: Array<(tab: string) => void> = [];

/** Register the app-level navigation handler (called once by App) */
export function registerNavigator(fn: NavigationHandler) {
  handler = fn;
}

/** Navigate to a page (and optionally a specific tab) */
export function navigateTo(target: NavigationTarget) {
  if (target.tab) {
    pendingTab = target.tab;
  }
  handler?.(target);
  // Notify tab listeners after page change (deferred so new page can mount first)
  if (target.tab) {
    setTimeout(() => tabListeners.forEach(fn => fn(target.tab!)), 0);
  }
}

/** Subscribe to tab navigation events. Returns unsubscribe function. */
export function onTabNavigate(listener: (tab: string) => void): () => void {
  tabListeners.push(listener);
  return () => {
    tabListeners = tabListeners.filter(fn => fn !== listener);
  };
}

/** Consume pending tab target (called by page components on mount/render) */
export function consumePendingTab(): string | null {
  const tab = pendingTab;
  pendingTab = null;
  return tab;
}

/** Create a NotificationAction that navigates on click */
export function navigateAction(label: string, page: string, tab?: string): NotificationAction {
  return {
    label,
    onClick: () => navigateTo({ page, tab }),
  };
}
