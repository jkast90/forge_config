import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Credential, CredentialFormData } from '../../types';
import { getServices } from '../../services';

interface CredentialsState {
  items: Credential[];
  loading: boolean;
  error: string | null;
}

const initialState: CredentialsState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchCredentials = createAsyncThunk('credentials/fetch', async () => {
  return getServices().credentials.list();
});

export const createCredential = createAsyncThunk('credentials/create', async (data: CredentialFormData) => {
  return getServices().credentials.create(data);
});

export const updateCredential = createAsyncThunk(
  'credentials/update',
  async ({ id, data }: { id: string; data: CredentialFormData }) => {
    return getServices().credentials.update(id, data);
  }
);

export const deleteCredential = createAsyncThunk('credentials/delete', async (id: string) => {
  await getServices().credentials.remove(id);
  return id;
});

const credentialsSlice = createSlice({
  name: 'credentials',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCredentials.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchCredentials.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchCredentials.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load credentials';
      });
  },
});

export default credentialsSlice.reducer;
