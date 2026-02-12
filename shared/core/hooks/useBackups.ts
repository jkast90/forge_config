// Backup management hook - Redux-backed
// No auto-fetch on mount: backups are device-specific and require a MAC address.
// Consumers call loadBackups(mac) when they have the target device context.

import { useCallback } from 'react';
import type { Backup } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchBackups,
  clearBackups as clearBackupsAction,
} from '../store/slices/backupsSlice';

export interface UseBackupsReturn {
  backups: Backup[];
  loading: boolean;
  error: string | null;
  loadBackups: (mac: string) => Promise<void>;
  clear: () => void;
}

export function useBackups(): UseBackupsReturn {
  const dispatch = useAppDispatch();
  const { byDevice, loading, error } = useAppSelector((state) => state.backups);

  // Flatten all backups from the map
  const backups: Backup[] = Object.values(byDevice).flat();

  const loadBackups = useCallback(async (mac: string) => {
    await dispatch(fetchBackups(mac));
  }, [dispatch]);

  const clear = useCallback(() => {
    dispatch(clearBackupsAction());
  }, [dispatch]);

  return {
    backups,
    loading,
    error,
    loadBackups,
    clear,
  };
}
