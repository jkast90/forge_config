// DHCP Options management hook - Redux-backed

import { useEffect, useCallback, useMemo } from 'react';
import type { DhcpOption } from '../types';
import { getServices } from '../services';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchDhcpOptions,
  createDhcpOption as createDhcpOptionThunk,
  updateDhcpOption as updateDhcpOptionThunk,
  deleteDhcpOption as deleteDhcpOptionThunk,
} from '../store/slices/dhcpOptionsSlice';
import { addNotification } from '../services/notifications';
import { getErrorMessage } from '../utils/errors';

export interface UseDhcpOptionsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  vendorFilter?: string;
}

export interface UseDhcpOptionsReturn {
  options: DhcpOption[];
  filteredOptions: DhcpOption[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createOption: (option: Partial<DhcpOption>) => Promise<boolean>;
  updateOption: (id: string, option: Partial<DhcpOption>) => Promise<boolean>;
  deleteOption: (id: string) => Promise<boolean>;
  resetToDefaults: () => Promise<boolean>;
}

export function useDhcpOptions(options: UseDhcpOptionsOptions = {}): UseDhcpOptionsReturn {
  const { autoRefresh = false, refreshInterval = 30000, vendorFilter } = options;
  const dispatch = useAppDispatch();
  const { items: dhcpOptions, loading, error } = useAppSelector((state) => state.dhcpOptions);

  // Client-side vendor filtering
  const filteredOptions = useMemo(() => {
    if (!vendorFilter || vendorFilter === 'all') return dhcpOptions;
    if (vendorFilter === 'global') return dhcpOptions.filter(o => !o.vendor_id);
    return dhcpOptions.filter(o => o.vendor_id === vendorFilter);
  }, [dhcpOptions, vendorFilter]);

  const refresh = useCallback(async () => {
    await dispatch(fetchDhcpOptions());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchDhcpOptions());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchDhcpOptions()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  const createOption = useCallback(async (data: Partial<DhcpOption>): Promise<boolean> => {
    try {
      await dispatch(createDhcpOptionThunk(data)).unwrap();
      addNotification('success', 'DHCP option added successfully');
      dispatch(fetchDhcpOptions());
      return true;
    } catch (err) {
      addNotification('error', `Failed to add DHCP option: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateOption = useCallback(async (id: string, data: Partial<DhcpOption>): Promise<boolean> => {
    try {
      await dispatch(updateDhcpOptionThunk({ id, data })).unwrap();
      addNotification('success', 'DHCP option updated successfully');
      dispatch(fetchDhcpOptions());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update DHCP option: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteOption = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteDhcpOptionThunk(id)).unwrap();
      addNotification('success', 'DHCP option deleted successfully');
      dispatch(fetchDhcpOptions());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete DHCP option: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // Bypasses Redux for individual operations — multi-step batch (delete all,
  // re-create from defaults) avoids N intermediate re-renders. Re-fetches at end.
  const resetToDefaults = useCallback(async (): Promise<boolean> => {
    try {
      const services = getServices();
      const defaults = await services.dhcpOptions.listDefaults();

      for (const option of dhcpOptions) {
        await services.dhcpOptions.remove(option.id);
      }

      for (const option of defaults) {
        await services.dhcpOptions.create(option);
      }

      dispatch(fetchDhcpOptions());
      addNotification('success', 'DHCP options reset to defaults');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset DHCP options';
      addNotification('error', errorMessage);
      return false;
    }
  }, [dhcpOptions, dispatch]);

  return {
    options: dhcpOptions,
    filteredOptions,
    loading,
    error,
    refresh,
    createOption,
    updateOption,
    deleteOption,
    resetToDefaults,
  };
}
