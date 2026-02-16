import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Tenant } from '../../types';
import { getServices } from '../../services';

interface TenantsState {
  items: Tenant[];
  loading: boolean;
  error: string | null;
}

const initialState: TenantsState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchTenants = createAsyncThunk('tenants/fetch', async () => {
  return getServices().tenants.list();
});

export const createTenant = createAsyncThunk('tenants/create', async (data: Partial<Tenant>) => {
  return getServices().tenants.create(data);
});

export const updateTenant = createAsyncThunk(
  'tenants/update',
  async ({ id, data }: { id: number | string; data: Partial<Tenant> }) => {
    return getServices().tenants.update(id, data);
  }
);

export const deleteTenant = createAsyncThunk('tenants/delete', async (id: number | string) => {
  await getServices().tenants.remove(id);
  return id;
});

const tenantsSlice = createSlice({
  name: 'tenants',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTenants.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchTenants.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchTenants.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load tenants';
      });
  },
});

export default tenantsSlice.reducer;
