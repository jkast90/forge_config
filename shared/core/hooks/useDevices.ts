// Device management hook - Redux-backed

import { useEffect, useCallback } from 'react';
import type { Device } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchDevices,
  createDevice as createDeviceThunk,
  updateDevice as updateDeviceThunk,
  deleteDevice as deleteDeviceThunk,
  triggerBackup as triggerBackupThunk,
} from '../store/slices/devicesSlice';
import { addNotification } from '../services/notifications';
import { navigateAction } from '../services/navigation';
import { getErrorMessage } from '../utils/errors';

export interface UseDevicesOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseDevicesReturn {
  devices: Device[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createDevice: (device: Partial<Device>) => Promise<boolean>;
  updateDevice: (id: number, device: Partial<Device>) => Promise<boolean>;
  deleteDevice: (id: number) => Promise<boolean>;
  triggerBackup: (id: number) => Promise<boolean>;
}

export function useDevices(options: UseDevicesOptions = {}): UseDevicesReturn {
  const { autoRefresh = true, refreshInterval = 10000 } = options;
  const dispatch = useAppDispatch();
  const { items: devices, loading, error } = useAppSelector((state) => state.devices);

  const refresh = useCallback(async () => {
    await dispatch(fetchDevices());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchDevices());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchDevices()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  const createDevice = useCallback(async (data: Partial<Device>): Promise<boolean> => {
    try {
      await dispatch(createDeviceThunk(data)).unwrap();
      addNotification('success', `Device added: ${data.hostname || 'unknown'}`);
      dispatch(fetchDevices());
      return true;
    } catch (err) {
      addNotification('error', `Failed to add device${data.hostname ? ` ${data.hostname}` : ''}: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateDevice = useCallback(async (id: number, data: Partial<Device>): Promise<boolean> => {
    const name = data.hostname || devices.find((d) => d.id === id)?.hostname || 'unknown';
    try {
      await dispatch(updateDeviceThunk({ id, data })).unwrap();
      addNotification('success', `Device updated: ${name}`);
      dispatch(fetchDevices());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update ${name}: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch, devices]);

  const deleteDevice = useCallback(async (id: number): Promise<boolean> => {
    const name = devices.find((d) => d.id === id)?.hostname || 'unknown';
    try {
      await dispatch(deleteDeviceThunk(id)).unwrap();
      addNotification('success', `Device deleted: ${name}`);
      dispatch(fetchDevices());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete ${name}: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch, devices]);

  const triggerBackupFn = useCallback(async (id: number): Promise<boolean> => {
    const name = devices.find((d) => d.id === id)?.hostname || 'unknown';
    try {
      await dispatch(triggerBackupThunk(id)).unwrap();
      addNotification('success', `Backup initiated for ${name}`, navigateAction('View Jobs', 'jobs', 'history'));
      return true;
    } catch (err) {
      addNotification('error', `Failed to trigger backup for ${name}: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch, devices]);

  return {
    devices,
    loading,
    error,
    refresh,
    createDevice,
    updateDevice,
    deleteDevice,
    triggerBackup: triggerBackupFn,
  };
}
