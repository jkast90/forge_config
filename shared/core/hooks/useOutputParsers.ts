import { useEffect, useCallback } from 'react';
import type { OutputParserFormData } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchOutputParsers,
  createOutputParser as createOutputParserThunk,
  updateOutputParser as updateOutputParserThunk,
  deleteOutputParser as deleteOutputParserThunk,
} from '../store/slices/outputParsersSlice';
import { addNotification } from '../services/notifications';
import { navigateAction } from '../services/navigation';
import { getErrorMessage } from '../utils/errors';

export interface UseOutputParsersReturn {
  outputParsers: import('../types').OutputParser[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createOutputParser: (data: OutputParserFormData) => Promise<boolean>;
  updateOutputParser: (id: number, data: OutputParserFormData) => Promise<boolean>;
  deleteOutputParser: (id: number) => Promise<boolean>;
}

export function useOutputParsers(): UseOutputParsersReturn {
  const dispatch = useAppDispatch();
  const { items: outputParsers, loading, error } = useAppSelector((state) => state.outputParsers);

  const refresh = useCallback(async () => {
    await dispatch(fetchOutputParsers());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchOutputParsers());
  }, [dispatch]);

  const createOutputParser = useCallback(async (data: OutputParserFormData): Promise<boolean> => {
    try {
      await dispatch(createOutputParserThunk(data)).unwrap();
      addNotification('success', 'Output parser created', navigateAction('View Parsers', 'jobs', 'parsers'));
      dispatch(fetchOutputParsers());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create output parser: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateOutputParser = useCallback(async (id: number, data: OutputParserFormData): Promise<boolean> => {
    try {
      await dispatch(updateOutputParserThunk({ id, data })).unwrap();
      addNotification('success', 'Output parser updated', navigateAction('View Parsers', 'jobs', 'parsers'));
      dispatch(fetchOutputParsers());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update output parser: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteOutputParser = useCallback(async (id: number): Promise<boolean> => {
    try {
      await dispatch(deleteOutputParserThunk(id)).unwrap();
      addNotification('success', 'Output parser deleted', navigateAction('View Parsers', 'jobs', 'parsers'));
      dispatch(fetchOutputParsers());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete output parser: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  return {
    outputParsers,
    loading,
    error,
    refresh,
    createOutputParser,
    updateOutputParser,
    deleteOutputParser,
  };
}
