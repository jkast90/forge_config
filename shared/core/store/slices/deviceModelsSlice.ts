import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { DeviceModel } from '../../types';
import { getServices } from '../../services';

interface DeviceModelsState {
  items: DeviceModel[];
  loading: boolean;
  error: string | null;
}

const initialState: DeviceModelsState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchDeviceModels = createAsyncThunk('deviceModels/fetch', async () => {
  return getServices().deviceModels.list();
});

export const createDeviceModel = createAsyncThunk('deviceModels/create', async (data: Partial<DeviceModel>) => {
  return getServices().deviceModels.create(data);
});

export const updateDeviceModel = createAsyncThunk(
  'deviceModels/update',
  async ({ id, data }: { id: string; data: Partial<DeviceModel> }) => {
    return getServices().deviceModels.update(id, data);
  }
);

export const deleteDeviceModel = createAsyncThunk('deviceModels/delete', async (id: string) => {
  await getServices().deviceModels.remove(id);
  return id;
});

const deviceModelsSlice = createSlice({
  name: 'deviceModels',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDeviceModels.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchDeviceModels.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchDeviceModels.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load device models';
      });
  },
});

export default deviceModelsSlice.reducer;
