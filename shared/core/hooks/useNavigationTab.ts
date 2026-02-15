// Hook for deep-link tab navigation + localStorage persistence
// Pages with SideTabs use this to restore the last-viewed tab on reload
// and to switch tabs when navigated to via navigateTo()

import { useState, useCallback, useEffect } from 'react';
import { onTabNavigate, consumePendingTab } from '../services/navigation';

/**
 * Replaces useState + useNavigationTab for SideTabs pages.
 * Returns [activeTab, setActiveTab] with:
 * - Persistence to localStorage (survives refresh)
 * - Deep-link navigation support (notification clicks, etc.)
 *
 * Priority on mount: pending navigation > localStorage > defaultTab.
 *
 * @param defaultTab - Default tab when nothing is stored
 * @param validTabs - List of valid tab IDs
 * @param storageKey - localStorage key (e.g. 'tab_jobs')
 */
export function usePersistedTab<T extends string>(
  defaultTab: T,
  validTabs: T[],
  storageKey: string,
): [T, (tab: T) => void] {
  const [tab, setTabRaw] = useState<T>(() => {
    // Pending navigation takes priority (notification click, etc.)
    const pending = consumePendingTab();
    if (pending && validTabs.includes(pending as T)) {
      try { localStorage.setItem(storageKey, pending); } catch {}
      return pending as T;
    }
    // Restore from localStorage
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && validTabs.includes(stored as T)) return stored as T;
    } catch {}
    return defaultTab;
  });

  const setTab = useCallback((next: T) => {
    setTabRaw(next);
    try { localStorage.setItem(storageKey, next); } catch {}
  }, [storageKey]);

  // Listen for deep-link navigation events
  useEffect(() => {
    return onTabNavigate((t) => {
      if (validTabs.includes(t as T)) {
        setTab(t as T);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return [tab, setTab];
}

// Keep backward-compatible export for existing callers
// (can be removed once all pages migrate to usePersistedTab)
export function useNavigationTab(
  setActiveTab: (tab: string) => void,
  validTabs?: string[],
  storageKey?: string,
) {
  useEffect(() => {
    const isValid = (tab: string) => !validTabs || validTabs.includes(tab);

    const pending = consumePendingTab();
    if (pending && isValid(pending)) {
      setActiveTab(pending);
      if (storageKey) {
        try { localStorage.setItem(storageKey, pending); } catch {}
      }
    } else if (storageKey) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored && isValid(stored)) {
          setActiveTab(stored);
        }
      } catch {}
    }

    return onTabNavigate((tab) => {
      if (isValid(tab)) {
        setActiveTab(tab);
        if (storageKey) {
          try { localStorage.setItem(storageKey, tab); } catch {}
        }
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
