// Persists a Set<string | number> to localStorage so selections survive page refresh

import { useState, useCallback } from 'react';

function load(key: string): Set<string | number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr: (string | number)[] = JSON.parse(raw);
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function save(key: string, set: Set<string | number>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function usePersistedSet(key: string): [Set<string | number>, (set: Set<string | number>) => void] {
  const [value, setValueRaw] = useState<Set<string | number>>(() => load(key));

  const setValue = useCallback((next: Set<string | number>) => {
    setValueRaw(next);
    save(key, next);
  }, [key]);

  return [value, setValue];
}
