import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Job } from '../../types';
import { getServices } from '../../services';

interface JobsState {
  items: Job[];
  loading: boolean;
  error: string | null;
}

const initialState: JobsState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchJobs = createAsyncThunk('jobs/fetch', async () => {
  return getServices().devices.listJobs();
});

const jobsSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchJobs.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchJobs.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load jobs';
      });
  },
});

export default jobsSlice.reducer;
