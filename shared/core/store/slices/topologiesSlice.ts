import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Topology } from '../../types';
import { getServices } from '../../services';

interface TopologiesState {
  items: Topology[];
  loading: boolean;
  error: string | null;
}

const initialState: TopologiesState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchTopologies = createAsyncThunk('topologies/fetch', async () => {
  return getServices().topologies.list();
});

export const createTopology = createAsyncThunk('topologies/create', async (data: Partial<Topology>) => {
  return getServices().topologies.create(data);
});

export const updateTopology = createAsyncThunk(
  'topologies/update',
  async ({ id, data }: { id: number | string; data: Partial<Topology> }) => {
    return getServices().topologies.update(id, data);
  }
);

export const deleteTopology = createAsyncThunk('topologies/delete', async (id: number | string) => {
  await getServices().topologies.remove(id);
  return id;
});

const topologiesSlice = createSlice({
  name: 'topologies',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTopologies.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchTopologies.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchTopologies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load topologies';
      });
  },
});

export default topologiesSlice.reducer;
