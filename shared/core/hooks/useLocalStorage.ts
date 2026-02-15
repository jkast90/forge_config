// Generic hook for persisting state in localStorage
// Supports any JSON-serializable value with type safety

import { useState, useCallback, useEffect } from 'react';

/**
 * Like useState, but persisted to localStorage.
 * Value is read from localStorage on mount and written on every update.
 * Falls back to initialValue if the key doesn't exist or can't be parsed.
 *
 * @param key - localStorage key
 * @param initialValue - default value when nothing is stored
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValueRaw] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initialValue;
      return JSON.parse(raw) as T;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    setValueRaw((prev) => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Storage full or unavailable
      }
      return resolved;
    });
  }, [key]);

  // Sync across tabs via storage event
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      try {
        setValueRaw(e.newValue === null ? initialValue : JSON.parse(e.newValue) as T);
      } catch {
        setValueRaw(initialValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, initialValue]);

  return [value, setValue];
}
