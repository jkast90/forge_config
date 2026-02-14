// Device variables management hook - Redux-backed

import { useEffect, useCallback } from 'react';
import type { DeviceVariable, VariableKeyInfo } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchKeys,
  fetchByKey,
  bulkSetVariables as bulkSetThunk,
  deleteVariableKey as deleteKeyThunk,
  setSelectedKey,
} from '../store/slices/deviceVariablesSlice';
import { getServices } from '../services';
import { addNotification } from '../services/notifications';
import { getErrorMessage } from '../utils/errors';

export interface UseDeviceVariablesOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseDeviceVariablesReturn {
  keys: VariableKeyInfo[];
  byKey: DeviceVariable[];
  selectedKey: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectKey: (key: string) => Promise<void>;
  clearSelection: () => void;
  addKey: (key: string, deviceIds: string[], defaultValue: string) => Promise<boolean>;
  deleteKey: (key: string) => Promise<boolean>;
  setVariable: (deviceId: string, key: string, value: string) => Promise<boolean>;
  deleteVariable: (deviceId: string, key: string) => Promise<boolean>;
  bulkSet: (entries: { device_id: string; key: string; value: string }[]) => Promise<boolean>;
}

export function useDeviceVariables(options: UseDeviceVariablesOptions = {}): UseDeviceVariablesReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  const dispatch = useAppDispatch();
  const slice = useAppSelector((state) => state.deviceVariables);
  const keys = slice?.keys ?? [];
  const byKey = slice?.byKey ?? [];
  const selectedKey = slice?.selectedKey ?? null;
  const loading = slice?.loading ?? false;
  const error = slice?.error ?? null;

  const refresh = useCallback(async () => {
    await dispatch(fetchKeys());
    if (selectedKey) {
      await dispatch(fetchByKey(selectedKey));
    }
  }, [dispatch, selectedKey]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchKeys());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchKeys()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  const selectKey = useCallback(async (key: string) => {
    dispatch(setSelectedKey(key));
    await dispatch(fetchByKey(key));
  }, [dispatch]);

  const clearSelection = useCallback(() => {
    dispatch(setSelectedKey(null));
  }, [dispatch]);

  const addKey = useCallback(async (key: string, deviceIds: string[], defaultValue: string): Promise<boolean> => {
    try {
      const entries = deviceIds.map(device_id => ({ device_id, key, value: defaultValue }));
      await dispatch(bulkSetThunk(entries)).unwrap();
      addNotification('success', `Added key "${key}" to ${deviceIds.length} device(s)`);
      await dispatch(fetchKeys());
      return true;
    } catch (err) {
      addNotification('error', `Failed to add key: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteKeyAction = useCallback(async (key: string): Promise<boolean> => {
    try {
      await dispatch(deleteKeyThunk(key)).unwrap();
      addNotification('success', `Deleted key "${key}" from all devices`);
      dispatch(fetchKeys());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete key: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const setVariable = useCallback(async (deviceId: string, key: string, value: string): Promise<boolean> => {
    try {
      await getServices().deviceVariables.setVariable(deviceId, key, value);
      if (selectedKey === key) {
        dispatch(fetchByKey(key));
      }
      dispatch(fetchKeys());
      return true;
    } catch (err) {
      addNotification('error', `Failed to set variable: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch, selectedKey]);

  const deleteVariable = useCallback(async (deviceId: string, key: string): Promise<boolean> => {
    try {
      await getServices().deviceVariables.deleteVariable(deviceId, key);
      addNotification('success', 'Variable deleted');
      if (selectedKey === key) {
        dispatch(fetchByKey(key));
      }
      dispatch(fetchKeys());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete variable: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch, selectedKey]);

  const bulkSet = useCallback(async (entries: { device_id: string; key: string; value: string }[]): Promise<boolean> => {
    try {
      await dispatch(bulkSetThunk(entries)).unwrap();
      addNotification('success', `Updated ${entries.length} variable(s)`);
      dispatch(fetchKeys());
      if (selectedKey) {
        dispatch(fetchByKey(selectedKey));
      }
      return true;
    } catch (err) {
      addNotification('error', `Failed to bulk set variables: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch, selectedKey]);

  return {
    keys,
    byKey,
    selectedKey,
    loading,
    error,
    refresh,
    selectKey,
    clearSelection,
    addKey,
    deleteKey: deleteKeyAction,
    setVariable,
    deleteVariable,
    bulkSet,
  };
}
