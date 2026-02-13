// Vendor Actions management hook - Redux-backed

import { useEffect, useCallback, useMemo } from 'react';
import type { VendorAction } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchVendorActions,
  createVendorAction as createVendorActionThunk,
  updateVendorAction as updateVendorActionThunk,
  deleteVendorAction as deleteVendorActionThunk,
} from '../store/slices/vendorActionsSlice';
import { addNotification } from '../services/notifications';

export interface UseVendorActionsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  vendorFilter?: string;
}

export interface UseVendorActionsReturn {
  actions: VendorAction[];
  filteredActions: VendorAction[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createAction: (data: Partial<VendorAction>) => Promise<boolean>;
  updateAction: (id: string, data: Partial<VendorAction>) => Promise<boolean>;
  deleteAction: (id: string) => Promise<boolean>;
}

export function useVendorActions(options: UseVendorActionsOptions = {}): UseVendorActionsReturn {
  const { autoRefresh = false, refreshInterval = 30000, vendorFilter } = options;
  const dispatch = useAppDispatch();
  const { items: actions, loading, error } = useAppSelector((state) => state.vendorActions);

  // Client-side vendor filtering
  const filteredActions = useMemo(() => {
    if (!vendorFilter || vendorFilter === 'all') return actions;
    return actions.filter(a => a.vendor_id === vendorFilter);
  }, [actions, vendorFilter]);

  const refresh = useCallback(async () => {
    await dispatch(fetchVendorActions());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchVendorActions());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchVendorActions()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  const createAction = useCallback(async (data: Partial<VendorAction>): Promise<boolean> => {
    try {
      await dispatch(createVendorActionThunk(data)).unwrap();
      addNotification('success', 'Action added successfully');
      dispatch(fetchVendorActions());
      return true;
    } catch (err) {
      addNotification('error', `Failed to add action: ${err}`);
      return false;
    }
  }, [dispatch]);

  const updateAction = useCallback(async (id: string, data: Partial<VendorAction>): Promise<boolean> => {
    try {
      await dispatch(updateVendorActionThunk({ id, data })).unwrap();
      addNotification('success', 'Action updated successfully');
      dispatch(fetchVendorActions());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update action: ${err}`);
      return false;
    }
  }, [dispatch]);

  const deleteAction = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteVendorActionThunk(id)).unwrap();
      addNotification('success', 'Action deleted successfully');
      dispatch(fetchVendorActions());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete action: ${err}`);
      return false;
    }
  }, [dispatch]);

  return {
    actions,
    filteredActions,
    loading,
    error,
    refresh,
    createAction,
    updateAction,
    deleteAction,
  };
}
