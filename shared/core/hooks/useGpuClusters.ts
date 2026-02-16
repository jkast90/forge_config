// GPU Cluster management hook - Redux-backed

import { useEffect, useCallback } from 'react';
import type { GpuCluster } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchGpuClusters,
  createGpuCluster as createGpuClusterThunk,
  updateGpuCluster as updateGpuClusterThunk,
  deleteGpuCluster as deleteGpuClusterThunk,
} from '../store/slices/gpuClustersSlice';
import { addNotification } from '../services/notifications';
import { navigateAction } from '../services/navigation';
import { getErrorMessage } from '../utils/errors';

export interface UseGpuClustersOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseGpuClustersReturn {
  gpuClusters: GpuCluster[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createGpuCluster: (data: Partial<GpuCluster>) => Promise<boolean>;
  updateGpuCluster: (id: string, data: Partial<GpuCluster>) => Promise<boolean>;
  deleteGpuCluster: (id: string) => Promise<boolean>;
}

export function useGpuClusters(options: UseGpuClustersOptions = {}): UseGpuClustersReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  const dispatch = useAppDispatch();
  const { items: gpuClusters, loading, error } = useAppSelector((state) => state.gpuClusters);

  const refresh = useCallback(async () => {
    await dispatch(fetchGpuClusters());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchGpuClusters());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchGpuClusters()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  const createGpuCluster = useCallback(async (data: Partial<GpuCluster>): Promise<boolean> => {
    try {
      await dispatch(createGpuClusterThunk(data)).unwrap();
      addNotification('success', 'GPU cluster created successfully', navigateAction('View GPU Clusters', 'tenants'));
      dispatch(fetchGpuClusters());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create GPU cluster: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateGpuCluster = useCallback(async (id: string, data: Partial<GpuCluster>): Promise<boolean> => {
    try {
      await dispatch(updateGpuClusterThunk({ id, data })).unwrap();
      addNotification('success', 'GPU cluster updated successfully', navigateAction('View GPU Clusters', 'tenants'));
      dispatch(fetchGpuClusters());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update GPU cluster: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteGpuCluster = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteGpuClusterThunk(id)).unwrap();
      addNotification('success', 'GPU cluster deleted', navigateAction('View GPU Clusters', 'tenants'));
      dispatch(fetchGpuClusters());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete GPU cluster: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  return {
    gpuClusters,
    loading,
    error,
    refresh,
    createGpuCluster,
    updateGpuCluster,
    deleteGpuCluster,
  };
}
