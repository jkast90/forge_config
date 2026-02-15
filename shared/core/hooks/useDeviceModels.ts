import { useEffect, useCallback } from 'react';
import type { DeviceModel } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchDeviceModels,
  createDeviceModel as createThunk,
  updateDeviceModel as updateThunk,
  deleteDeviceModel as deleteThunk,
} from '../store/slices/deviceModelsSlice';
import { addNotification } from '../services/notifications';
import { navigateAction } from '../services/navigation';
import { getErrorMessage } from '../utils/errors';

export interface UseDeviceModelsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseDeviceModelsReturn {
  deviceModels: DeviceModel[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createDeviceModel: (data: Partial<DeviceModel>) => Promise<boolean>;
  updateDeviceModel: (id: string, data: Partial<DeviceModel>) => Promise<boolean>;
  deleteDeviceModel: (id: string) => Promise<boolean>;
}

export function useDeviceModels(options: UseDeviceModelsOptions = {}): UseDeviceModelsReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  const dispatch = useAppDispatch();
  const { items: deviceModels, loading, error } = useAppSelector((state) => state.deviceModels);

  const refresh = useCallback(async () => {
    await dispatch(fetchDeviceModels());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchDeviceModels());
  }, [dispatch]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchDeviceModels()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  const createDeviceModel = useCallback(async (data: Partial<DeviceModel>): Promise<boolean> => {
    try {
      await dispatch(createThunk(data)).unwrap();
      addNotification('success', 'Device model created', navigateAction('View Models', 'vendors-models', 'models'));
      dispatch(fetchDeviceModels());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create device model: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateDeviceModel = useCallback(async (id: string, data: Partial<DeviceModel>): Promise<boolean> => {
    try {
      await dispatch(updateThunk({ id, data })).unwrap();
      addNotification('success', 'Device model updated', navigateAction('View Models', 'vendors-models', 'models'));
      dispatch(fetchDeviceModels());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update device model: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteDeviceModel = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteThunk(id)).unwrap();
      addNotification('success', 'Device model deleted', navigateAction('View Models', 'vendors-models', 'models'));
      dispatch(fetchDeviceModels());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete device model: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  return {
    deviceModels,
    loading,
    error,
    refresh,
    createDeviceModel,
    updateDeviceModel,
    deleteDeviceModel,
  };
}
