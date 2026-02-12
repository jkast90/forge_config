import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { DhcpOption } from '../../types';
import { getServices } from '../../services';

interface DhcpOptionsState {
  items: DhcpOption[];
  loading: boolean;
  error: string | null;
}

const initialState: DhcpOptionsState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchDhcpOptions = createAsyncThunk('dhcpOptions/fetch', async () => {
  return getServices().dhcpOptions.list();
});

export const createDhcpOption = createAsyncThunk('dhcpOptions/create', async (data: Partial<DhcpOption>) => {
  return getServices().dhcpOptions.create(data);
});

export const updateDhcpOption = createAsyncThunk(
  'dhcpOptions/update',
  async ({ id, data }: { id: string; data: Partial<DhcpOption> }) => {
    return getServices().dhcpOptions.update(id, data);
  }
);

export const deleteDhcpOption = createAsyncThunk('dhcpOptions/delete', async (id: string) => {
  await getServices().dhcpOptions.remove(id);
  return id;
});

const dhcpOptionsSlice = createSlice({
  name: 'dhcpOptions',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDhcpOptions.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchDhcpOptions.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchDhcpOptions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load DHCP options';
      });
  },
});

export default dhcpOptionsSlice.reducer;
