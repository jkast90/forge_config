// Discovery hook - Redux-backed

import { useEffect, useCallback, useRef } from 'react';
import type { DiscoveredDevice, DiscoveryLog } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchDiscovered,
  fetchAllLeases,
  dismissDevice,
  fetchLogs,
  clearLogs as clearLogsThunk,
} from '../store/slices/discoverySlice';
import { addNotification } from '../services/notifications';

export interface UseDiscoveryOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  onNewDevices?: (devices: DiscoveredDevice[]) => void;
}

export interface UseDiscoveryReturn {
  discovered: DiscoveredDevice[];
  allLeases: DiscoveredDevice[];
  logs: DiscoveryLog[];
  loading: boolean;
  logsLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshLeases: () => Promise<void>;
  dismiss: (mac: string) => Promise<void>;
  fetchLogs: (limit?: number) => Promise<void>;
  clearLogs: () => Promise<void>;
  clearKnownDevices: () => void;
}

export function useDiscovery(options: UseDiscoveryOptions = {}): UseDiscoveryReturn {
  const { autoRefresh = false, refreshInterval = 10000, onNewDevices } = options;
  const dispatch = useAppDispatch();
  const { discovered, allLeases, logs, loading, logsLoading, error } = useAppSelector((state) => state.discovery);

  // Track known MACs to detect new devices (per-hook instance)
  const knownMacsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const failureCountRef = useRef(0);

  const clearKnownDevices = useCallback(() => {
    knownMacsRef.current = new Set();
  }, []);

  // Detect new devices when discovered list changes
  useEffect(() => {
    if (error) {
      if (failureCountRef.current === 0) {
        console.warn('Discovery fetch failed (will retry silently):', error);
      }
      failureCountRef.current++;
      return;
    }

    failureCountRef.current = 0;

    if (!initialLoadRef.current && onNewDevices && discovered.length > 0) {
      const newDevices = discovered.filter(device => !knownMacsRef.current.has(device.mac));
      if (newDevices.length > 0) {
        onNewDevices(newDevices);
      }
    }

    knownMacsRef.current = new Set(discovered.map(d => d.mac));
    initialLoadRef.current = false;
  }, [discovered, error, onNewDevices]);

  const refresh = useCallback(async () => {
    await dispatch(fetchDiscovered());
  }, [dispatch]);

  const refreshLeases = useCallback(async () => {
    await dispatch(fetchAllLeases());
  }, [dispatch]);

  const dismiss = useCallback(async (mac: string) => {
    try {
      await dispatch(dismissDevice(mac)).unwrap();
      addNotification('success', 'Device dismissed from discovery');
    } catch (err) {
      addNotification('error', `Failed to dismiss device: ${err}`);
    }
  }, [dispatch]);

  const fetchLogsCallback = useCallback(async (limit = 50) => {
    await dispatch(fetchLogs(limit));
  }, [dispatch]);

  const clearLogsCallback = useCallback(async () => {
    try {
      await dispatch(clearLogsThunk()).unwrap();
      addNotification('success', 'Discovery logs cleared');
    } catch (err) {
      addNotification('error', `Failed to clear logs: ${err}`);
    }
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchDiscovered());
    dispatch(fetchAllLeases());
    dispatch(fetchLogs(50));
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      dispatch(fetchDiscovered());
      dispatch(fetchAllLeases());
      dispatch(fetchLogs(50));
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  return {
    discovered,
    allLeases,
    logs,
    loading,
    logsLoading,
    error,
    refresh,
    refreshLeases,
    dismiss,
    fetchLogs: fetchLogsCallback,
    clearLogs: clearLogsCallback,
    clearKnownDevices,
  };
}
