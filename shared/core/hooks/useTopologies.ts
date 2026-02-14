// Topology management hook - Redux-backed

import { useEffect, useCallback } from 'react';
import type { Topology } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchTopologies,
  createTopology as createTopologyThunk,
  updateTopology as updateTopologyThunk,
  deleteTopology as deleteTopologyThunk,
} from '../store/slices/topologiesSlice';
import { addNotification } from '../services/notifications';
import { getErrorMessage } from '../utils/errors';

export interface UseTopologiesOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseTopologiesReturn {
  topologies: Topology[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTopology: (topology: Partial<Topology>) => Promise<boolean>;
  updateTopology: (id: string, topology: Partial<Topology>) => Promise<boolean>;
  deleteTopology: (id: string) => Promise<boolean>;
}

export function useTopologies(options: UseTopologiesOptions = {}): UseTopologiesReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  const dispatch = useAppDispatch();
  const { items: topologies, loading, error } = useAppSelector((state) => state.topologies);

  const refresh = useCallback(async () => {
    await dispatch(fetchTopologies());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchTopologies());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchTopologies()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  const createTopology = useCallback(async (data: Partial<Topology>): Promise<boolean> => {
    try {
      await dispatch(createTopologyThunk(data)).unwrap();
      addNotification('success', 'Topology created successfully');
      dispatch(fetchTopologies());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create topology: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateTopology = useCallback(async (id: string, data: Partial<Topology>): Promise<boolean> => {
    try {
      await dispatch(updateTopologyThunk({ id, data })).unwrap();
      addNotification('success', 'Topology updated successfully');
      dispatch(fetchTopologies());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update topology: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteTopology = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteTopologyThunk(id)).unwrap();
      addNotification('success', 'Topology deleted (devices unassigned)');
      dispatch(fetchTopologies());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete topology: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  return {
    topologies,
    loading,
    error,
    refresh,
    createTopology,
    updateTopology,
    deleteTopology,
  };
}
