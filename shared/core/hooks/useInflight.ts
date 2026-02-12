import { useState, useEffect, useRef } from 'react';
import { getInflightCount, onInflightChange } from '../services/base';

const MIN_DISPLAY_MS = 600;

export function useInflight(): number {
  const [count, setCount] = useState(getInflightCount);
  const [displayCount, setDisplayCount] = useState(count);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wentPositiveAt = useRef<number>(0);

  useEffect(() => {
    return onInflightChange(setCount);
  }, []);

  useEffect(() => {
    if (count > 0) {
      // Going from 0 to positive — record the time and show immediately
      if (displayCount === 0) {
        wentPositiveAt.current = Date.now();
      }
      setDisplayCount(count);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } else {
      // Count dropped to 0 — linger for minimum display time
      const elapsed = Date.now() - wentPositiveAt.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setDisplayCount(0);
        timerRef.current = null;
      }, remaining);
    }
  }, [count]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return displayCount;
}
