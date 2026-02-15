import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { User, UserFormData } from '../../types';
import { getServices } from '../../services';

interface UsersState {
  items: User[];
  loading: boolean;
  error: string | null;
}

const initialState: UsersState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchUsers = createAsyncThunk('users/fetch', async () => {
  return getServices().users.list();
});

export const createUser = createAsyncThunk('users/create', async (data: UserFormData) => {
  return getServices().users.create(data);
});

export const updateUser = createAsyncThunk(
  'users/update',
  async ({ id, data }: { id: string; data: Partial<UserFormData> }) => {
    return getServices().users.update(id, data);
  }
);

export const deleteUser = createAsyncThunk('users/delete', async (id: string) => {
  await getServices().users.remove(id);
  return id;
});

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load users';
      });
  },
});

export default usersSlice.reducer;
