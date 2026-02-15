// Job templates hook - Redux-backed

import { useEffect, useCallback } from 'react';
import type { CreateJobTemplateRequest } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchJobTemplates,
  createJobTemplate as createJobTemplateThunk,
  updateJobTemplate as updateJobTemplateThunk,
  deleteJobTemplate as deleteJobTemplateThunk,
} from '../store/slices/jobTemplatesSlice';
import { getServices } from '../services';
import { addNotification } from '../services/notifications';
import { navigateAction } from '../services/navigation';
import { getErrorMessage } from '../utils/errors';

export interface UseJobTemplatesReturn {
  templates: import('../types').JobTemplate[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (req: CreateJobTemplateRequest) => Promise<boolean>;
  update: (id: string, req: CreateJobTemplateRequest) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  run: (id: string) => Promise<boolean>;
}

export function useJobTemplates(): UseJobTemplatesReturn {
  const dispatch = useAppDispatch();
  const { items: templates, loading, error } = useAppSelector((state) => state.jobTemplates);

  const refresh = useCallback(async () => {
    await dispatch(fetchJobTemplates());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchJobTemplates());
  }, [dispatch]);

  const create = useCallback(async (req: CreateJobTemplateRequest): Promise<boolean> => {
    try {
      await dispatch(createJobTemplateThunk(req)).unwrap();
      addNotification('success', `Template "${req.name}" saved`);
      dispatch(fetchJobTemplates());
      return true;
    } catch (err) {
      addNotification('error', `Failed to save template: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const update = useCallback(async (id: string, req: CreateJobTemplateRequest): Promise<boolean> => {
    try {
      await dispatch(updateJobTemplateThunk({ id, req })).unwrap();
      addNotification('success', `Template "${req.name}" updated`);
      dispatch(fetchJobTemplates());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update template: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteJobTemplateThunk(id)).unwrap();
      addNotification('success', 'Template deleted');
      dispatch(fetchJobTemplates());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete template: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const run = useCallback(async (id: string): Promise<boolean> => {
    try {
      const jobs = await getServices().jobTemplates.run(id);
      addNotification('success', `Queued ${jobs.length} job${jobs.length !== 1 ? 's' : ''} from template`, navigateAction('View Jobs', 'jobs', 'history'));
      dispatch(fetchJobTemplates());
      return true;
    } catch (err) {
      addNotification('error', `Failed to run template: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  return { templates, loading, error, refresh, create, update, remove, run };
}
