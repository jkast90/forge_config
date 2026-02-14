import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Group, GroupFormData } from '../../types';
import { getServices } from '../../services';

interface GroupsState {
  items: Group[];
  loading: boolean;
  error: string | null;
}

const initialState: GroupsState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchGroups = createAsyncThunk('groups/fetch', async () => {
  return getServices().groups.list();
});

export const createGroup = createAsyncThunk('groups/create', async (data: Partial<GroupFormData>) => {
  return getServices().groups.create(data);
});

export const updateGroup = createAsyncThunk(
  'groups/update',
  async ({ id, data }: { id: string; data: Partial<GroupFormData> }) => {
    return getServices().groups.update(id, data);
  }
);

export const deleteGroup = createAsyncThunk('groups/delete', async (id: string) => {
  await getServices().groups.remove(id);
  return id;
});

const groupsSlice = createSlice({
  name: 'groups',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchGroups.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchGroups.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchGroups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load groups';
      });
  },
});

export default groupsSlice.reducer;
