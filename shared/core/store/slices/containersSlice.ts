import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { TestContainer, SpawnContainerRequest } from '../../types';
import { getServices } from '../../services';

interface ContainersState {
  items: TestContainer[];
  loading: boolean;
  error: string | null;
}

const initialState: ContainersState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchContainers = createAsyncThunk('containers/fetch', async () => {
  return getServices().testContainers.list();
});

export const spawnContainer = createAsyncThunk('containers/spawn', async (request: SpawnContainerRequest) => {
  return getServices().testContainers.spawn(request);
});

export const startContainer = createAsyncThunk('containers/start', async (id: string) => {
  await getServices().testContainers.start(id);
  return id;
});

export const restartContainer = createAsyncThunk('containers/restart', async (id: string) => {
  await getServices().testContainers.restart(id);
  return id;
});

export const removeContainer = createAsyncThunk('containers/remove', async (id: string) => {
  await getServices().testContainers.remove(id);
  return id;
});

const containersSlice = createSlice({
  name: 'containers',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchContainers.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchContainers.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchContainers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch containers';
      });
  },
});

export default containersSlice.reducer;
