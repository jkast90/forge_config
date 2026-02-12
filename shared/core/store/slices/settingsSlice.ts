import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Settings } from '../../types';
import { getServices } from '../../services';

interface SettingsState {
  data: Settings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  data: null,
  loading: false,
  saving: false,
  error: null,
};

export const fetchSettings = createAsyncThunk('settings/fetch', async () => {
  return getServices().settings.getSettings();
});

export const saveSettings = createAsyncThunk('settings/save', async (settings: Settings) => {
  return getServices().settings.update(settings);
});

export const reloadConfig = createAsyncThunk('settings/reloadConfig', async () => {
  await getServices().settings.reloadConfig();
});

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.data = action.payload;
        state.loading = false;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load settings';
      })
      .addCase(saveSettings.pending, (state) => {
        state.saving = true;
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.data = action.payload;
        state.saving = false;
      })
      .addCase(saveSettings.rejected, (state) => {
        state.saving = false;
      });
  },
});

export default settingsSlice.reducer;
