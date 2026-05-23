import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import categoryTypeService from "../services/categoryTypeService";

const unwrapTypesPayload = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.types)) return data.types;
  return [];
};

export const fetchCategoryTypes = createAsyncThunk(
  "categoryTypes/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const data = await categoryTypeService.getAll();
      return unwrapTypesPayload(data);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const createCategoryType = createAsyncThunk(
  "categoryTypes/create",
  async (payload, { rejectWithValue }) => {
    try {
      const data = await categoryTypeService.create(payload);
      return data?.type || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const updateCategoryType = createAsyncThunk(
  "categoryTypes/update",
  async ({ id, changes }, { rejectWithValue }) => {
    try {
      const data = await categoryTypeService.update(id, changes);
      return data?.type || data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

export const deleteCategoryType = createAsyncThunk(
  "categoryTypes/delete",
  async (id, { rejectWithValue }) => {
    try {
      await categoryTypeService.remove(id);
      return id;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  },
);

const categoryTypeSlice = createSlice({
  name: "categoryTypes",
  initialState: {
    list: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategoryTypes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCategoryTypes.fulfilled, (state, action) => {
        state.loading = false;
        state.list = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchCategoryTypes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(createCategoryType.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createCategoryType.fulfilled, (state, action) => {
        state.loading = false;
        const created = action.payload;
        if (!created) return;
        const createdId = String(created?._id || created?.id || "").trim();
        if (createdId && state.list.some((t) => String(t?._id || t?.id || "") === createdId)) return;
        state.list.push(created);
        state.list.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
      })
      .addCase(createCategoryType.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateCategoryType.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCategoryType.fulfilled, (state, action) => {
        state.loading = false;
        const updated = action.payload;
        const updatedId = String(updated?._id || updated?.id || "").trim();
        if (!updatedId) return;
        const index = state.list.findIndex((t) => String(t?._id || t?.id || "") === updatedId);
        if (index !== -1) state.list[index] = updated;
        state.list.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
      })
      .addCase(updateCategoryType.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(deleteCategoryType.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteCategoryType.fulfilled, (state, action) => {
        state.loading = false;
        const id = String(action.payload || "").trim();
        state.list = state.list.filter((t) => String(t?._id || t?.id || "").trim() !== id);
      })
      .addCase(deleteCategoryType.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default categoryTypeSlice.reducer;

