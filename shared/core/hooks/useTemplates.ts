// Template management hook - Redux-backed

import { useEffect, useCallback, useMemo } from 'react';
import type { Template, TemplateVariable } from '../types';
import { getServices } from '../services';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchTemplates,
  fetchTemplateVariables,
  createTemplate as createTemplateThunk,
  updateTemplate as updateTemplateThunk,
  deleteTemplate as deleteTemplateThunk,
} from '../store/slices/templatesSlice';
import { addNotification } from '../services/notifications';

export interface UseTemplatesOptions {
  vendorFilter?: string;
}

export interface UseTemplatesReturn {
  templates: Template[];
  variables: TemplateVariable[];
  loading: boolean;
  error: string | null;
  createTemplate: (template: Partial<Template>) => Promise<boolean>;
  updateTemplate: (id: string, template: Partial<Template>) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;
  previewTemplate: (id: string, data: {
    device: {
      mac: string;
      ip: string;
      hostname: string;
      vendor?: string;
      serial_number?: string;
    };
    subnet: string;
    gateway: string;
  }) => Promise<string | null>;
  refresh: () => Promise<void>;
}

export function useTemplates(options: UseTemplatesOptions = {}): UseTemplatesReturn {
  const { vendorFilter } = options;
  const dispatch = useAppDispatch();
  const { items, variables, loading, error } = useAppSelector((state) => state.templates);

  // Client-side vendor filtering
  const templates = useMemo(() => {
    if (!vendorFilter || vendorFilter === 'all') return items;
    return items.filter(t => !t.vendor_id || t.vendor_id === vendorFilter);
  }, [items, vendorFilter]);

  const refresh = useCallback(async () => {
    await dispatch(fetchTemplates());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchTemplates());
    dispatch(fetchTemplateVariables());
  }, [dispatch]);

  const createTemplate = useCallback(async (data: Partial<Template>): Promise<boolean> => {
    try {
      await dispatch(createTemplateThunk(data)).unwrap();
      addNotification('success', 'Template added successfully');
      dispatch(fetchTemplates());
      return true;
    } catch (err) {
      addNotification('error', `Failed to add template: ${err}`);
      return false;
    }
  }, [dispatch]);

  const updateTemplate = useCallback(async (id: string, data: Partial<Template>): Promise<boolean> => {
    try {
      await dispatch(updateTemplateThunk({ id, data })).unwrap();
      addNotification('success', 'Template updated successfully');
      dispatch(fetchTemplates());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update template: ${err}`);
      return false;
    }
  }, [dispatch]);

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteTemplateThunk(id)).unwrap();
      addNotification('success', 'Template deleted successfully');
      dispatch(fetchTemplates());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete template: ${err}`);
      return false;
    }
  }, [dispatch]);

  const previewTemplate = useCallback(async (id: string, data: {
    device: {
      mac: string;
      ip: string;
      hostname: string;
      vendor?: string;
      serial_number?: string;
    };
    subnet: string;
    gateway: string;
  }): Promise<string | null> => {
    try {
      const services = getServices();
      const result = await services.templates.preview(id, data);
      return result.output;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to preview template';
      addNotification('error', errorMessage);
      return null;
    }
  }, []);

  return {
    templates,
    variables,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    previewTemplate,
    refresh,
  };
}
