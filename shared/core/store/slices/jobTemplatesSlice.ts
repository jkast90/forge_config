import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { JobTemplate, CreateJobTemplateRequest } from '../../types';
import { getServices } from '../../services';

interface JobTemplatesState {
  items: JobTemplate[];
  loading: boolean;
  error: string | null;
}

const initialState: JobTemplatesState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchJobTemplates = createAsyncThunk('jobTemplates/fetch', async () => {
  return getServices().jobTemplates.list();
});

export const createJobTemplate = createAsyncThunk('jobTemplates/create', async (req: CreateJobTemplateRequest) => {
  return getServices().jobTemplates.create(req);
});

export const updateJobTemplate = createAsyncThunk(
  'jobTemplates/update',
  async ({ id, req }: { id: number | string; req: CreateJobTemplateRequest }) => {
    return getServices().jobTemplates.update(id, req);
  }
);

export const deleteJobTemplate = createAsyncThunk('jobTemplates/delete', async (id: number | string) => {
  await getServices().jobTemplates.remove(id);
  return id;
});

const jobTemplatesSlice = createSlice({
  name: 'jobTemplates',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchJobTemplates.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchJobTemplates.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchJobTemplates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load job templates';
      });
  },
});

export default jobTemplatesSlice.reducer;
