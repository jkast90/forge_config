// Tenant management hook - Redux-backed

import { useEffect, useCallback } from 'react';
import type { Tenant } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchTenants,
  createTenant as createTenantThunk,
  updateTenant as updateTenantThunk,
  deleteTenant as deleteTenantThunk,
} from '../store/slices/tenantsSlice';
import { addNotification } from '../services/notifications';
import { navigateAction } from '../services/navigation';
import { getErrorMessage } from '../utils/errors';

export interface UseTenantsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseTenantsReturn {
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTenant: (data: Partial<Tenant>) => Promise<boolean>;
  updateTenant: (id: string, data: Partial<Tenant>) => Promise<boolean>;
  deleteTenant: (id: string) => Promise<boolean>;
}

export function useTenants(options: UseTenantsOptions = {}): UseTenantsReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  const dispatch = useAppDispatch();
  const { items: tenants, loading, error } = useAppSelector((state) => state.tenants) ?? { items: [], loading: true, error: null };

  const refresh = useCallback(async () => {
    await dispatch(fetchTenants());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchTenants());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchTenants()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  const createTenant = useCallback(async (data: Partial<Tenant>): Promise<boolean> => {
    try {
      await dispatch(createTenantThunk(data)).unwrap();
      addNotification('success', 'Tenant created successfully', navigateAction('View Tenants', 'tenants'));
      dispatch(fetchTenants());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create tenant: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateTenant = useCallback(async (id: string, data: Partial<Tenant>): Promise<boolean> => {
    try {
      await dispatch(updateTenantThunk({ id, data })).unwrap();
      addNotification('success', 'Tenant updated successfully', navigateAction('View Tenants', 'tenants'));
      dispatch(fetchTenants());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update tenant: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteTenant = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteTenantThunk(id)).unwrap();
      addNotification('success', 'Tenant deleted', navigateAction('View Tenants', 'tenants'));
      dispatch(fetchTenants());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete tenant: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  return {
    tenants,
    loading,
    error,
    refresh,
    createTenant,
    updateTenant,
    deleteTenant,
  };
}
