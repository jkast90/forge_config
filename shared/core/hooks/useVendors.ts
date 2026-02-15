// Vendor management hook - Redux-backed

import { useEffect, useCallback } from 'react';
import type { Vendor } from '../types';
import { getServices } from '../services';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchVendors,
  createVendor as createVendorThunk,
  updateVendor as updateVendorThunk,
  deleteVendor as deleteVendorThunk,
} from '../store/slices/vendorsSlice';
import { addNotification } from '../services/notifications';
import { navigateAction } from '../services/navigation';
import { getErrorMessage } from '../utils/errors';

export interface UseVendorsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseVendorsReturn {
  vendors: Vendor[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createVendor: (vendor: Partial<Vendor>) => Promise<boolean>;
  updateVendor: (id: string, vendor: Partial<Vendor>) => Promise<boolean>;
  deleteVendor: (id: string) => Promise<boolean>;
  resetToDefaults: () => Promise<boolean>;
}

export function useVendors(options: UseVendorsOptions = {}): UseVendorsReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  const dispatch = useAppDispatch();
  const { items: vendors, loading, error } = useAppSelector((state) => state.vendors);

  const refresh = useCallback(async () => {
    await dispatch(fetchVendors());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchVendors());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchVendors()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  const createVendor = useCallback(async (data: Partial<Vendor>): Promise<boolean> => {
    try {
      await dispatch(createVendorThunk(data)).unwrap();
      addNotification('success', 'Vendor added successfully', navigateAction('View Vendors', 'vendors-models', 'vendors'));
      dispatch(fetchVendors());
      return true;
    } catch (err) {
      addNotification('error', `Failed to add vendor: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateVendor = useCallback(async (id: string, data: Partial<Vendor>): Promise<boolean> => {
    try {
      await dispatch(updateVendorThunk({ id, data })).unwrap();
      addNotification('success', 'Vendor updated successfully', navigateAction('View Vendors', 'vendors-models', 'vendors'));
      dispatch(fetchVendors());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update vendor: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteVendor = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteVendorThunk(id)).unwrap();
      addNotification('success', 'Vendor deleted successfully', navigateAction('View Vendors', 'vendors-models', 'vendors'));
      dispatch(fetchVendors());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete vendor: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // Bypasses Redux for individual operations — multi-step batch (fetch defaults,
  // update/create each vendor) avoids N intermediate re-renders. Re-fetches at end.
  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    try {
      const services = getServices();
      const defaults = await services.vendors.listDefaults();

      for (const defaultVendor of defaults) {
        const existing = vendors.find(v => v.id === defaultVendor.id);
        if (existing) {
          await services.vendors.update(defaultVendor.id, {
            ...existing,
            mac_prefixes: defaultVendor.mac_prefixes,
          });
        } else {
          await services.vendors.create(defaultVendor);
        }
      }

      dispatch(fetchVendors());
      addNotification('success', 'Vendors reset to defaults', navigateAction('View Vendors', 'vendors-models', 'vendors'));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset vendors';
      addNotification('error', errorMessage);
      return false;
    }
  }, [vendors, dispatch]);

  return {
    vendors,
    loading,
    error,
    refresh,
    createVendor,
    updateVendor,
    deleteVendor,
    resetToDefaults,
  };
}
