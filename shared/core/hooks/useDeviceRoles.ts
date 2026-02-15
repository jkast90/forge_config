import { useEffect, useCallback } from 'react';
import type { DeviceRoleFormData } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchDeviceRoles,
  createDeviceRole as createDeviceRoleThunk,
  updateDeviceRole as updateDeviceRoleThunk,
  deleteDeviceRole as deleteDeviceRoleThunk,
} from '../store/slices/deviceRolesSlice';
import { addNotification } from '../services/notifications';
import { getErrorMessage } from '../utils/errors';

export interface UseDeviceRolesReturn {
  deviceRoles: import('../types').DeviceRole[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createDeviceRole: (data: DeviceRoleFormData) => Promise<boolean>;
  updateDeviceRole: (id: string, data: DeviceRoleFormData) => Promise<boolean>;
  deleteDeviceRole: (id: string) => Promise<boolean>;
}

export function useDeviceRoles(): UseDeviceRolesReturn {
  const dispatch = useAppDispatch();
  const { items: deviceRoles, loading, error } = useAppSelector((state) => state.deviceRoles);

  const refresh = useCallback(async () => {
    await dispatch(fetchDeviceRoles());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchDeviceRoles());
  }, [dispatch]);

  const createDeviceRole = useCallback(async (data: DeviceRoleFormData): Promise<boolean> => {
    try {
      const payload = data.id ? data : { ...data, id: String(Date.now()) };
      await dispatch(createDeviceRoleThunk(payload)).unwrap();
      addNotification('success', 'Device role created');
      dispatch(fetchDeviceRoles());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create device role: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateDeviceRole = useCallback(async (id: string, data: DeviceRoleFormData): Promise<boolean> => {
    try {
      await dispatch(updateDeviceRoleThunk({ id, data })).unwrap();
      addNotification('success', 'Device role updated');
      dispatch(fetchDeviceRoles());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update device role: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteDeviceRole = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteDeviceRoleThunk(id)).unwrap();
      addNotification('success', 'Device role deleted');
      dispatch(fetchDeviceRoles());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete device role: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  return { deviceRoles, loading, error, refresh, createDeviceRole, updateDeviceRole, deleteDeviceRole };
}
