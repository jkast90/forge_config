// useLocalSettings hook for browser-local settings (not dependent on API)
// These settings are stored in localStorage and available immediately

import { useState, useCallback, useEffect } from 'react';

export interface LocalSettings {
  apiUrl: string;
  theme: string;
  defaultPageSize: number;
}

const LOCAL_SETTINGS_KEY = 'ztp_local_settings';

const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  apiUrl: '/api',
  theme: 'dark',
  defaultPageSize: 25,
};

function getStoredSettings(): LocalSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCAL_SETTINGS;
  }
  try {
    const stored = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_LOCAL_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to parse local settings:', e);
  }
  return DEFAULT_LOCAL_SETTINGS;
}

function saveStoredSettings(settings: LocalSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save local settings:', e);
  }
}

export interface UseLocalSettingsReturn {
  settings: LocalSettings;
  updateSettings: (updates: Partial<LocalSettings>) => void;
  resetSettings: () => void;
}

export function useLocalSettings(): UseLocalSettingsReturn {
  const [settings, setSettings] = useState<LocalSettings>(getStoredSettings);

  // Sync with localStorage on mount and when storage changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LOCAL_SETTINGS_KEY && e.newValue) {
        try {
          setSettings({ ...DEFAULT_LOCAL_SETTINGS, ...JSON.parse(e.newValue) });
        } catch {
          // Ignore parse errors
        }
      }
    };

    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const updateSettings = useCallback((updates: Partial<LocalSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...updates };
      saveStoredSettings(newSettings);
      return newSettings;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_LOCAL_SETTINGS);
    saveStoredSettings(DEFAULT_LOCAL_SETTINGS);
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}

// Utility to get default page size
export function getDefaultPageSize(): number {
  return getStoredSettings().defaultPageSize;
}

// Per-table page size overrides stored in localStorage
const TABLE_PAGE_SIZE_KEY = 'ztp_table_page_sizes';

function getTablePageSizes(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(TABLE_PAGE_SIZE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveTablePageSizes(sizes: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TABLE_PAGE_SIZE_KEY, JSON.stringify(sizes));
  } catch {
    // Ignore storage errors
  }
}

export function getTablePageSize(tableId: string): number | null {
  const sizes = getTablePageSizes();
  return sizes[tableId] ?? null;
}

export function setTablePageSize(tableId: string, size: number): void {
  const sizes = getTablePageSizes();
  const defaultSize = getDefaultPageSize();
  if (size === defaultSize) {
    // Clear override when it matches the user's preference
    delete sizes[tableId];
  } else {
    sizes[tableId] = size;
  }
  saveTablePageSizes(sizes);
}

// Clear all per-table overrides (useful when default changes)
export function clearTablePageSizeOverrides(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TABLE_PAGE_SIZE_KEY);
}

// Utility to get current API URL (can be called outside of React)
export function getLocalApiUrl(): string {
  return getStoredSettings().apiUrl;
}

// Utility to set API URL (can be called outside of React)
export function setLocalApiUrl(url: string): void {
  const settings = getStoredSettings();
  settings.apiUrl = url;
  saveStoredSettings(settings);
}
