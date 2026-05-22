import { createSlice } from "@reduxjs/toolkit";

const STORAGE_KEY = "compareProducts";
export const MAX_COMPARE_ITEMS = 4;
export const COMPARE_LIMIT_MESSAGE = `You can compare up to ${MAX_COMPARE_ITEMS} products at a time.`;

const loadStoredItems = () => {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item === "object" && item._id)
      : [];
  } catch {
    return [];
  }
};

const persistItems = (items) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const sanitizeItem = (item) =>
  item && typeof item === "object" && item._id
    ? {
        ...item,
        _id: String(item._id),
      }
    : null;

const compareSlice = createSlice({
  name: "compare",
  initialState: {
    items: loadStoredItems(),
  },
  reducers: {
    addCompareItem(state, action) {
      const nextItem = sanitizeItem(action.payload);
      if (!nextItem) return;

      const withoutDuplicate = state.items.filter(
        (item) => String(item?._id || "") !== nextItem._id,
      );

      if (withoutDuplicate.length >= MAX_COMPARE_ITEMS) return;

      state.items = [nextItem, ...withoutDuplicate];
      persistItems(state.items);
    },
    removeCompareItem(state, action) {
      const targetId = String(action.payload || "").trim();
      state.items = state.items.filter(
        (item) => String(item?._id || "") !== targetId,
      );
      persistItems(state.items);
    },
    clearCompareItems(state) {
      state.items = [];
      persistItems([]);
    },
    toggleCompareItem(state, action) {
      const nextItem = sanitizeItem(action.payload);
      if (!nextItem) return;

      const exists = state.items.some(
        (item) => String(item?._id || "") === nextItem._id,
      );

      if (exists) {
        state.items = state.items.filter(
          (item) => String(item?._id || "") !== nextItem._id,
        );
      } else {
        const withoutDuplicate = state.items.filter(
          (item) => String(item?._id || "") !== nextItem._id,
        );
        if (withoutDuplicate.length >= MAX_COMPARE_ITEMS) return;
        state.items = [nextItem, ...withoutDuplicate];
      }

      persistItems(state.items);
    },
  },
});

export const {
  addCompareItem,
  removeCompareItem,
  clearCompareItems,
  toggleCompareItem,
} = compareSlice.actions;

export default compareSlice.reducer;

