import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Backup } from '../../types';
import { getServices } from '../../services';

interface BackupsState {
  byDevice: Record<string, Backup[]>;
  loading: boolean;
  error: string | null;
}

const initialState: BackupsState = {
  byDevice: {},
  loading: false,
  error: null,
};

export const fetchBackups = createAsyncThunk('backups/fetch', async (mac: string) => {
  const data = await getServices().devices.listBackups(mac);
  return { mac, backups: data || [] };
});

const backupsSlice = createSlice({
  name: 'backups',
  initialState,
  reducers: {
    clearBackups(state) {
      state.byDevice = {};
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBackups.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBackups.fulfilled, (state, action) => {
        state.byDevice[action.payload.mac] = action.payload.backups;
        state.loading = false;
      })
      .addCase(fetchBackups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load backups';
      });
  },
});

export const { clearBackups } = backupsSlice.actions;
export default backupsSlice.reducer;
