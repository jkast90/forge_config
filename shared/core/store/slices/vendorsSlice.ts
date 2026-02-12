import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Vendor } from '../../types';
import { getServices } from '../../services';

interface VendorsState {
  items: Vendor[];
  loading: boolean;
  error: string | null;
}

const initialState: VendorsState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchVendors = createAsyncThunk('vendors/fetch', async () => {
  return getServices().vendors.list();
});

export const createVendor = createAsyncThunk('vendors/create', async (data: Partial<Vendor>) => {
  return getServices().vendors.create(data);
});

export const updateVendor = createAsyncThunk(
  'vendors/update',
  async ({ id, data }: { id: string; data: Partial<Vendor> }) => {
    return getServices().vendors.update(id, data);
  }
);

export const deleteVendor = createAsyncThunk('vendors/delete', async (id: string) => {
  await getServices().vendors.remove(id);
  return id;
});

const vendorsSlice = createSlice({
  name: 'vendors',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendors.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchVendors.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchVendors.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load vendors';
      });
  },
});

export default vendorsSlice.reducer;
