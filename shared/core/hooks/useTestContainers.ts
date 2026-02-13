// Test containers hook - Redux-backed

import { useEffect, useCallback } from 'react';
import type { TestContainer, SpawnContainerRequest } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchContainers,
  spawnContainer as spawnContainerThunk,
  startContainer as startContainerThunk,
  restartContainer as restartContainerThunk,
  removeContainer as removeContainerThunk,
} from '../store/slices/containersSlice';
import { addNotification } from '../services/notifications';

export interface UseTestContainersOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseTestContainersReturn {
  containers: TestContainer[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  spawn: (request: SpawnContainerRequest) => Promise<TestContainer | null>;
  start: (id: string) => Promise<boolean>;
  restart: (id: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

export function useTestContainers(options: UseTestContainersOptions = {}): UseTestContainersReturn {
  const { autoRefresh = false, refreshInterval = 5000 } = options;
  const dispatch = useAppDispatch();
  const { items: containers, loading, error } = useAppSelector((state) => state.containers);

  const refresh = useCallback(async () => {
    await dispatch(fetchContainers());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchContainers());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchContainers()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  const spawn = useCallback(async (request: SpawnContainerRequest): Promise<TestContainer | null> => {
    try {
      const container = await dispatch(spawnContainerThunk(request)).unwrap();
      addNotification('success', `Container ${container.hostname} spawned successfully`);
      dispatch(fetchContainers());
      return container;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to spawn container';
      addNotification('error', errMsg);
      return null;
    }
  }, [dispatch]);

  const start = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(startContainerThunk(id)).unwrap();
      addNotification('success', 'Container started successfully');
      dispatch(fetchContainers());
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to start container';
      addNotification('error', errMsg);
      return false;
    }
  }, [dispatch]);

  const restart = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(restartContainerThunk(id)).unwrap();
      addNotification('success', 'Container restarted successfully');
      dispatch(fetchContainers());
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to restart container';
      addNotification('error', errMsg);
      return false;
    }
  }, [dispatch]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(removeContainerThunk(id)).unwrap();
      addNotification('success', 'Container removed successfully');
      dispatch(fetchContainers());
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to remove container';
      addNotification('error', errMsg);
      return false;
    }
  }, [dispatch]);

  return {
    containers,
    loading,
    error,
    refresh,
    spawn,
    start,
    restart,
    remove,
  };
}
