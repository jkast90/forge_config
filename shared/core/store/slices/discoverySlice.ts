import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { DiscoveredDevice, DiscoveryLog } from '../../types';
import { getServices } from '../../services';

interface DiscoveryState {
  discovered: DiscoveredDevice[];
  allLeases: DiscoveredDevice[];
  logs: DiscoveryLog[];
  loading: boolean;
  logsLoading: boolean;
  error: string | null;
}

const initialState: DiscoveryState = {
  discovered: [],
  allLeases: [],
  logs: [],
  loading: true,
  logsLoading: false,
  error: null,
};

export const fetchDiscovered = createAsyncThunk('discovery/fetchDiscovered', async () => {
  return getServices().discovery.list();
});

export const fetchAllLeases = createAsyncThunk('discovery/fetchAllLeases', async () => {
  return getServices().discovery.listAllLeases();
});

export const dismissDevice = createAsyncThunk('discovery/dismiss', async (mac: string) => {
  await getServices().discovery.dismiss(mac);
  return mac;
});

export const fetchLogs = createAsyncThunk('discovery/fetchLogs', async (limit: number = 50) => {
  return getServices().discovery.listLogs(limit);
});

export const clearLogs = createAsyncThunk('discovery/clearLogs', async () => {
  await getServices().discovery.clearLogs();
});

const discoverySlice = createSlice({
  name: 'discovery',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDiscovered.pending, (state) => {
        state.loading = state.discovered.length === 0;
      })
      .addCase(fetchDiscovered.fulfilled, (state, action) => {
        state.discovered = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchDiscovered.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to fetch discovered devices';
        state.discovered = [];
      })
      .addCase(fetchAllLeases.fulfilled, (state, action) => {
        state.allLeases = action.payload || [];
      })
      .addCase(fetchAllLeases.rejected, (state) => {
        state.allLeases = [];
      })
      .addCase(dismissDevice.fulfilled, (state, action) => {
        state.discovered = state.discovered.filter(d => d.mac !== action.payload);
      })
      .addCase(fetchLogs.pending, (state) => {
        state.logsLoading = state.logs.length === 0;
      })
      .addCase(fetchLogs.fulfilled, (state, action) => {
        state.logs = action.payload || [];
        state.logsLoading = false;
      })
      .addCase(fetchLogs.rejected, (state) => {
        state.logsLoading = false;
      })
      .addCase(clearLogs.fulfilled, (state) => {
        state.logs = [];
      });
  },
});

export default discoverySlice.reducer;
