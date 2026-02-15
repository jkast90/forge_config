// Settings management hook - Redux-backed

import { useCallback, useEffect } from 'react';
import type { Settings } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchSettings,
  saveSettings as saveSettingsThunk,
  reloadConfig as reloadConfigThunk,
} from '../store/slices/settingsSlice';
import { addNotification } from '../services/notifications';
import { dialogAction } from '../services/navigation';
import { getErrorMessage } from '../utils/errors';

export interface UseSettingsReturn {
  settings: Settings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: (settings: Settings) => Promise<boolean>;
  reloadConfig: () => Promise<boolean>;
}

export function useSettings(): UseSettingsReturn {
  const dispatch = useAppDispatch();
  const { data: settings, loading, saving, error } = useAppSelector((state) => state.settings);

  // Auto-fetch on mount (consistent with other hooks)
  useEffect(() => {
    dispatch(fetchSettings());
  }, [dispatch]);

  const load = useCallback(async () => {
    try {
      await dispatch(fetchSettings()).unwrap();
    } catch (err) {
      addNotification('error', `Failed to load settings: ${getErrorMessage(err)}`);
    }
  }, [dispatch]);

  const save = useCallback(async (newSettings: Settings): Promise<boolean> => {
    try {
      await dispatch(saveSettingsThunk(newSettings)).unwrap();
      addNotification('success', 'Settings saved successfully', dialogAction('View Settings', 'settings'));
      return true;
    } catch (err) {
      addNotification('error', `Failed to save settings: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const reloadConfig = useCallback(async (): Promise<boolean> => {
    try {
      await dispatch(reloadConfigThunk()).unwrap();
      addNotification('success', 'Configuration reloaded', dialogAction('View Settings', 'settings'));
      return true;
    } catch (err) {
      addNotification('error', `Failed to reload: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  return {
    settings,
    loading,
    saving,
    error,
    load,
    save,
    reloadConfig,
  };
}
