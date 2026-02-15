import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { DeviceRole, DeviceRoleFormData } from '../../types';
import { getServices } from '../../services';

interface DeviceRolesState {
  items: DeviceRole[];
  loading: boolean;
  error: string | null;
}

const initialState: DeviceRolesState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchDeviceRoles = createAsyncThunk('deviceRoles/fetch', async () => {
  return getServices().deviceRoles.list();
});

export const createDeviceRole = createAsyncThunk('deviceRoles/create', async (data: DeviceRoleFormData) => {
  return getServices().deviceRoles.create(data);
});

export const updateDeviceRole = createAsyncThunk(
  'deviceRoles/update',
  async ({ id, data }: { id: string; data: DeviceRoleFormData }) => {
    return getServices().deviceRoles.update(id, data);
  }
);

export const deleteDeviceRole = createAsyncThunk('deviceRoles/delete', async (id: string) => {
  await getServices().deviceRoles.remove(id);
  return id;
});

const deviceRolesSlice = createSlice({
  name: 'deviceRoles',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDeviceRoles.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchDeviceRoles.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchDeviceRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load device roles';
      });
  },
});

export default deviceRolesSlice.reducer;
