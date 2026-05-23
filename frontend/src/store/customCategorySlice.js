// src/store/customCategorySlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import customCategoryService from "../services/customCategoryService";

// Async thunks
export const fetchCustomCategories = createAsyncThunk(
  "customCategories/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const data = await customCategoryService.getAll();
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  },
);

export const createCustomCategory = createAsyncThunk(
  "customCategories/create",
  async (payload, { rejectWithValue }) => {
    try {
      const data = await customCategoryService.create(payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  },
);

export const updateCustomCategory = createAsyncThunk(
  "customCategories/update",
  async ({ id, changes }, { rejectWithValue }) => {
    try {
      const data = await customCategoryService.update(id, changes);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  },
);

export const deleteCustomCategory = createAsyncThunk(
  "customCategories/delete",
  async (id, { rejectWithValue }) => {
    try {
      await customCategoryService.remove(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  },
);

const customCategorySlice = createSlice({
  name: "customCategories",
  initialState: {
    list: [],
    loading: false,
    error: null,
  },
  reducers: {
    // Synchronous actions can be added if needed
  },
  extraReducers: (builder) => {
    builder
      // fetch
      .addCase(fetchCustomCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCustomCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(fetchCustomCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // create
      .addCase(createCustomCategory.pending, (state) => {
        state.loading = true;
      })
      .addCase(createCustomCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.list.push(action.payload);
      })
      .addCase(createCustomCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // update
      .addCase(updateCustomCategory.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateCustomCategory.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.list.findIndex((c) => c.id === action.payload.id);
        if (index !== -1) state.list[index] = action.payload;
      })
      .addCase(updateCustomCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // delete
      .addCase(deleteCustomCategory.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteCustomCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.list = state.list.filter((c) => c.id !== action.payload);
      })
      .addCase(deleteCustomCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const customCategoryReducer = customCategorySlice.reducer;
export default customCategorySlice.reducer;
