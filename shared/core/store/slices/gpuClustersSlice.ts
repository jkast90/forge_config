import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { GpuCluster } from '../../types';
import { getServices } from '../../services';

interface GpuClustersState {
  items: GpuCluster[];
  loading: boolean;
  error: string | null;
}

const initialState: GpuClustersState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchGpuClusters = createAsyncThunk('gpuClusters/fetch', async () => {
  return getServices().gpuClusters.list();
});

export const createGpuCluster = createAsyncThunk('gpuClusters/create', async (data: Partial<GpuCluster>) => {
  return getServices().gpuClusters.create(data);
});

export const updateGpuCluster = createAsyncThunk(
  'gpuClusters/update',
  async ({ id, data }: { id: number | string; data: Partial<GpuCluster> }) => {
    return getServices().gpuClusters.update(id, data);
  }
);

export const deleteGpuCluster = createAsyncThunk('gpuClusters/delete', async (id: number | string) => {
  await getServices().gpuClusters.remove(id);
  return id;
});

const gpuClustersSlice = createSlice({
  name: 'gpuClusters',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchGpuClusters.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchGpuClusters.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchGpuClusters.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load GPU clusters';
      });
  },
});

export default gpuClustersSlice.reducer;
