// Backup management hook - Redux-backed
// No auto-fetch on mount: backups are device-specific and require a device ID.
// Consumers call loadBackups(deviceId) when they have the target device context.

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
  loadBackups: (deviceId: number) => Promise<void>;
  clear: () => void;
}

export function useBackups(): UseBackupsReturn {
  const dispatch = useAppDispatch();
  const { byDevice, loading, error } = useAppSelector((state) => state.backups);

  // Flatten all backups from the map
  const backups = (Object.values(byDevice) as Backup[][]).flat();

  const loadBackups = useCallback(async (deviceId: number) => {
    await dispatch(fetchBackups(deviceId));
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
