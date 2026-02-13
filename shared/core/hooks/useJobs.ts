// Job history hook - Redux-backed

import { useEffect, useCallback } from 'react';
import type { Job } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchJobs } from '../store/slices/jobsSlice';

export interface UseJobsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseJobsReturn {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useJobs(options: UseJobsOptions = {}): UseJobsReturn {
  const { autoRefresh = true, refreshInterval = 10000 } = options;
  const dispatch = useAppDispatch();
  const { items: jobs, loading, error } = useAppSelector((state) => state.jobs);

  const refresh = useCallback(async () => {
    await dispatch(fetchJobs());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchJobs());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchJobs()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  return { jobs, loading, error, refresh };
}
