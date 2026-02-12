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
  async ({ mac, data }: { mac: string; data: Partial<Device> }) => {
    return getServices().devices.update(mac, data);
  }
);

export const deleteDevice = createAsyncThunk('devices/delete', async (mac: string) => {
  await getServices().devices.remove(mac);
  return mac;
});

export const triggerBackup = createAsyncThunk('devices/triggerBackup', async (mac: string) => {
  await getServices().devices.triggerBackup(mac);
  return mac;
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
