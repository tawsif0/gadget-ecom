import { createSlice } from "@reduxjs/toolkit";

const STORAGE_KEY = "recentlyViewedProducts";
const MAX_RECENT_ITEMS = 18;

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

const recentlyViewedSlice = createSlice({
  name: "recentlyViewed",
  initialState: {
    items: loadStoredItems(),
  },
  reducers: {
    addRecentlyViewedItem(state, action) {
      const nextItem = sanitizeItem(action.payload);
      if (!nextItem) return;

      const withoutDuplicate = state.items.filter(
        (item) => String(item?._id || "") !== nextItem._id,
      );
      state.items = [nextItem, ...withoutDuplicate].slice(0, MAX_RECENT_ITEMS);
      persistItems(state.items);
    },
    clearRecentlyViewed(state) {
      state.items = [];
      persistItems([]);
    },
  },
});

export const { addRecentlyViewedItem, clearRecentlyViewed } =
  recentlyViewedSlice.actions;

export default recentlyViewedSlice.reducer;

