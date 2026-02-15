import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Device } from '../../types';
import { getServices } from '../../services';

interface DevicesState {
  items: Device[];
  loading: boolean;
  error: string | null;
}

const initialState: DevicesState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchDevices = createAsyncThunk('devices/fetch', async () => {
  return getServices().devices.list();
});

export const createDevice = createAsyncThunk('devices/create', async (data: Partial<Device>) => {
  return getServices().devices.create(data);
});

export const updateDevice = createAsyncThunk(
  'devices/update',
  async ({ id, data }: { id: number; data: Partial<Device> }) => {
    return getServices().devices.update(id, data);
  }
);

export const deleteDevice = createAsyncThunk('devices/delete', async (id: number) => {
  await getServices().devices.remove(id);
  return id;
});

export const triggerBackup = createAsyncThunk('devices/triggerBackup', async (id: number) => {
  await getServices().devices.triggerBackup(id);
  return id;
});

const devicesSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDevices.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchDevices.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchDevices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load devices';
      });
  },
});

export default devicesSlice.reducer;
