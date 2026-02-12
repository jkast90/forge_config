import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Template, TemplateVariable } from '../../types';
import { getServices } from '../../services';

interface TemplatesState {
  items: Template[];
  variables: TemplateVariable[];
  loading: boolean;
  error: string | null;
}

const initialState: TemplatesState = {
  items: [],
  variables: [],
  loading: true,
  error: null,
};

export const fetchTemplates = createAsyncThunk('templates/fetch', async () => {
  return getServices().templates.list();
});

export const fetchTemplateVariables = createAsyncThunk('templates/fetchVariables', async () => {
  return getServices().templates.getVariables();
});

export const createTemplate = createAsyncThunk('templates/create', async (data: Partial<Template>) => {
  return getServices().templates.create(data);
});

export const updateTemplate = createAsyncThunk(
  'templates/update',
  async ({ id, data }: { id: string; data: Partial<Template> }) => {
    return getServices().templates.update(id, data);
  }
);

export const deleteTemplate = createAsyncThunk('templates/delete', async (id: string) => {
  await getServices().templates.remove(id);
  return id;
});

const templatesSlice = createSlice({
  name: 'templates',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load templates';
      })
      .addCase(fetchTemplateVariables.fulfilled, (state, action) => {
        state.variables = action.payload || [];
      });
  },
});

export default templatesSlice.reducer;
