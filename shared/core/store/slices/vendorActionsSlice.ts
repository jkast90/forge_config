import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { VendorAction } from '../../types';
import { getServices } from '../../services';

interface VendorActionsState {
  items: VendorAction[];
  loading: boolean;
  error: string | null;
}

const initialState: VendorActionsState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchVendorActions = createAsyncThunk('vendorActions/fetch', async () => {
  return getServices().vendors.listAllActions();
});

export const createVendorAction = createAsyncThunk('vendorActions/create', async (data: Partial<VendorAction>) => {
  return getServices().vendors.createAction(data);
});

export const updateVendorAction = createAsyncThunk(
  'vendorActions/update',
  async ({ id, data }: { id: string; data: Partial<VendorAction> }) => {
    return getServices().vendors.updateAction(id, data);
  }
);

export const deleteVendorAction = createAsyncThunk('vendorActions/delete', async (id: string) => {
  await getServices().vendors.deleteAction(id);
  return id;
});

const vendorActionsSlice = createSlice({
  name: 'vendorActions',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchVendorActions.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchVendorActions.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchVendorActions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load vendor actions';
      });
  },
});

export default vendorActionsSlice.reducer;
