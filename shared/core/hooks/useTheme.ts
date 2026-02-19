// Theme management hook - platform agnostic logic

import { useState, useCallback, useEffect } from 'react';
import type { Theme } from '../types';

const STORAGE_KEY = 'ztp-theme';
const DEFAULT_THEME: Theme = 'dark';

export interface ThemeConfig {
  value: Theme;
  icon: string;
  label: string;
  description: string;
}

export const THEME_OPTIONS: ThemeConfig[] = [
  { value: 'dark', icon: 'dark_mode', label: 'Dark', description: 'Pitch dark background with RGB cyan accents' },
  { value: 'light', icon: 'light_mode', label: 'Light', description: 'Soft white background with cyan accents' },
  { value: 'plain', icon: 'tonality', label: 'Mid', description: 'Gray background with deep cyan accents' },
  { value: 'solarized', icon: 'water', label: 'Cyan Monochrome', description: 'Deep cyan-teal background, cyan elements' },
{ value: 'evergreen-dark', icon: 'forest', label: 'Evergreen Dark', description: 'Deep forest greens, dark mode' },
  { value: 'evergreen-light', icon: 'park', label: 'Evergreen Light', description: 'Fresh forest greens, light mode' },
  { value: 'ocean-dark', icon: 'water', label: 'Ocean Dark', description: 'Deep sea blues, dark mode (I\'m blue da ba dee)' },
  { value: 'ocean-light', icon: 'waves', label: 'Ocean Light', description: 'Coastal blues, light mode' },
  { value: 'nautical-dark', icon: 'sailing', label: 'Nautical Dark', description: 'Maritime brass & navy, dark mode' },
  { value: 'nautical-light', icon: 'anchor', label: 'Nautical Light', description: 'Sandy coastal daylight, light mode' },
  { value: 'contrast-dark', icon: 'contrast', label: 'High Contrast Dark', description: 'Maximum contrast, dark background' },
  { value: 'contrast-light', icon: 'tonality', label: 'High Contrast Light', description: 'Maximum contrast, light background' },
];

export interface ThemeStorage {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
}

// Default storage for web - React Native should provide AsyncStorage adapter
const getDefaultStorage = (): ThemeStorage => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return {
      get: (key) => localStorage.getItem(key),
      set: (key, value) => localStorage.setItem(key, value),
    };
  }
  // Fallback for non-web environments (React Native must provide storage)
  return {
    get: () => null,
    set: () => {},
  };
};

export interface UseThemeOptions {
  storage?: ThemeStorage;
  onThemeChange?: (theme: Theme) => void;
}

export interface UseThemeReturn {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themeConfig: ThemeConfig;
  themeOptions: ThemeConfig[];
}

export function useTheme(options: UseThemeOptions = {}): UseThemeReturn {
  const { storage = getDefaultStorage(), onThemeChange } = options;

  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = storage.get(STORAGE_KEY) as Theme | null;
    return saved && THEME_OPTIONS.some(t => t.value === saved) ? saved : DEFAULT_THEME;
  });

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    storage.set(STORAGE_KEY, newTheme);
    onThemeChange?.(newTheme);
  }, [storage, onThemeChange]);

  const themeConfig = THEME_OPTIONS.find(t => t.value === theme) || THEME_OPTIONS[0];

  return {
    theme,
    setTheme,
    themeConfig,
    themeOptions: THEME_OPTIONS,
  };
}

// Web-specific: apply theme to document
// NOTE: Do not import this in React Native - use useTheme with a custom onThemeChange instead
export function useWebTheme(options: Omit<UseThemeOptions, 'onThemeChange'> = {}) {
  const result = useTheme({
    ...options,
    onThemeChange: (theme) => {
      document.documentElement.setAttribute('data-theme', theme);
    },
  });

  // Apply on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', result.theme);
  }, [result.theme]);

  return result;
}
