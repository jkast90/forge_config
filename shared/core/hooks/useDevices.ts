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
  updateDevice: (id: string, device: Partial<Device>) => Promise<boolean>;
  deleteDevice: (id: string) => Promise<boolean>;
  triggerBackup: (id: string) => Promise<boolean>;
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
      addNotification('success', 'Device added successfully');
      dispatch(fetchDevices());
      return true;
    } catch (err) {
      addNotification('error', `Failed to add device: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateDevice = useCallback(async (id: string, data: Partial<Device>): Promise<boolean> => {
    try {
      await dispatch(updateDeviceThunk({ id, data })).unwrap();
      addNotification('success', 'Device updated successfully');
      dispatch(fetchDevices());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update device: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteDevice = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteDeviceThunk(id)).unwrap();
      addNotification('success', 'Device deleted successfully');
      dispatch(fetchDevices());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete device: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const triggerBackupFn = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(triggerBackupThunk(id)).unwrap();
      addNotification('success', 'Backup initiated');
      return true;
    } catch (err) {
      addNotification('error', `Failed to trigger backup: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

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
