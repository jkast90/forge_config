import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { DeviceVariable, VariableKeyInfo } from '../../types';
import { getServices } from '../../services';

interface DeviceVariablesState {
  keys: VariableKeyInfo[];
  byKey: DeviceVariable[];
  selectedKey: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: DeviceVariablesState = {
  keys: [],
  byKey: [],
  selectedKey: null,
  loading: true,
  error: null,
};

export const fetchKeys = createAsyncThunk('deviceVariables/fetchKeys', async () => {
  return getServices().deviceVariables.listKeys();
});

export const fetchByKey = createAsyncThunk('deviceVariables/fetchByKey', async (key: string) => {
  const vars = await getServices().deviceVariables.listByKey(key);
  return { key, vars };
});

export const bulkSetVariables = createAsyncThunk(
  'deviceVariables/bulkSet',
  async (entries: { device_id: number; key: string; value: string }[]) => {
    await getServices().deviceVariables.bulkSet(entries);
    return entries;
  }
);

export const deleteVariableKey = createAsyncThunk(
  'deviceVariables/deleteKey',
  async (key: string) => {
    await getServices().deviceVariables.deleteKey(key);
    return key;
  }
);

const deviceVariablesSlice = createSlice({
  name: 'deviceVariables',
  initialState,
  reducers: {
    setSelectedKey(state, action) {
      state.selectedKey = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchKeys.pending, (state) => {
        state.loading = state.keys.length === 0;
      })
      .addCase(fetchKeys.fulfilled, (state, action) => {
        state.keys = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchKeys.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load variable keys';
      })
      .addCase(fetchByKey.fulfilled, (state, action) => {
        state.byKey = action.payload.vars || [];
        state.selectedKey = action.payload.key;
      })
      .addCase(deleteVariableKey.fulfilled, (state, action) => {
        state.keys = state.keys.filter(k => k.key !== action.payload);
        if (state.selectedKey === action.payload) {
          state.selectedKey = null;
          state.byKey = [];
        }
      });
  },
});

export const { setSelectedKey } = deviceVariablesSlice.actions;
export default deviceVariablesSlice.reducer;
