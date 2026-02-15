import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { OutputParser, OutputParserFormData } from '../../types';
import { getServices } from '../../services';

interface OutputParsersState {
  items: OutputParser[];
  loading: boolean;
  error: string | null;
}

const initialState: OutputParsersState = {
  items: [],
  loading: true,
  error: null,
};

export const fetchOutputParsers = createAsyncThunk('outputParsers/fetch', async () => {
  return getServices().outputParsers.list();
});

export const createOutputParser = createAsyncThunk('outputParsers/create', async (data: OutputParserFormData) => {
  return getServices().outputParsers.create(data);
});

export const updateOutputParser = createAsyncThunk(
  'outputParsers/update',
  async ({ id, data }: { id: number; data: OutputParserFormData }) => {
    return getServices().outputParsers.update(id, data);
  }
);

export const deleteOutputParser = createAsyncThunk('outputParsers/delete', async (id: number) => {
  await getServices().outputParsers.remove(id);
  return id;
});

const outputParsersSlice = createSlice({
  name: 'outputParsers',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchOutputParsers.pending, (state) => {
        state.loading = state.items.length === 0;
      })
      .addCase(fetchOutputParsers.fulfilled, (state, action) => {
        state.items = action.payload || [];
        state.loading = false;
        state.error = null;
      })
      .addCase(fetchOutputParsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load output parsers';
      });
  },
});

export default outputParsersSlice.reducer;
