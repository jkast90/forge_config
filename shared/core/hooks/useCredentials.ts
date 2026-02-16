// Credential management hook - Redux-backed

import { useEffect, useCallback } from 'react';
import type { CredentialFormData } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchCredentials,
  createCredential as createCredentialThunk,
  updateCredential as updateCredentialThunk,
  deleteCredential as deleteCredentialThunk,
} from '../store/slices/credentialsSlice';
import { addNotification } from '../services/notifications';
import { navigateAction } from '../services/navigation';
import { getErrorMessage } from '../utils/errors';

export interface UseCredentialsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseCredentialsReturn {
  credentials: import('../types').Credential[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCredential: (data: CredentialFormData) => Promise<boolean>;
  updateCredential: (id: number | string, data: CredentialFormData) => Promise<boolean>;
  deleteCredential: (id: number | string) => Promise<boolean>;
}

export function useCredentials(options: UseCredentialsOptions = {}): UseCredentialsReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  const dispatch = useAppDispatch();
  const { items: credentials, loading, error } = useAppSelector((state) => state.credentials);

  const refresh = useCallback(async () => {
    await dispatch(fetchCredentials());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchCredentials());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchCredentials()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  const createCredential = useCallback(async (data: CredentialFormData): Promise<boolean> => {
    try {
      await dispatch(createCredentialThunk(data)).unwrap();
      addNotification('success', 'Credential created successfully', navigateAction('View Credentials', 'config', 'credentials'));
      dispatch(fetchCredentials());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create credential: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateCredential = useCallback(async (id: number | string, data: CredentialFormData): Promise<boolean> => {
    try {
      await dispatch(updateCredentialThunk({ id, data })).unwrap();
      addNotification('success', 'Credential updated successfully', navigateAction('View Credentials', 'config', 'credentials'));
      dispatch(fetchCredentials());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update credential: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteCredential = useCallback(async (id: number | string): Promise<boolean> => {
    try {
      await dispatch(deleteCredentialThunk(id)).unwrap();
      addNotification('success', 'Credential deleted', navigateAction('View Credentials', 'config', 'credentials'));
      dispatch(fetchCredentials());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete credential: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  return {
    credentials,
    loading,
    error,
    refresh,
    createCredential,
    updateCredential,
    deleteCredential,
  };
}
