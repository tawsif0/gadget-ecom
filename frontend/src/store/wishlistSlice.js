import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { createProductSnapshot } from "../utils/productSnapshot";

const baseUrl = import.meta.env.VITE_API_URL;
const GUEST_WISHLIST_KEY = "guestWishlist";
const WISHLIST_EVENT = "wishlistUpdated";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const readGuestWishlist = () => {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(GUEST_WISHLIST_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item === "object" && item._id)
      : [];
  } catch {
    return [];
  }
};

const writeGuestWishlist = (items) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(items || []));
  window.dispatchEvent(new CustomEvent(WISHLIST_EVENT));
};

const sanitizeWishlistItem = (item) => {
  if (!item?._id) return null;
  return {
    ...item,
    _id: String(item._id),
  };
};

const sanitizeWishlistItems = (items = []) =>
  items
    .map((item) => sanitizeWishlistItem(item))
    .filter(Boolean)
    .filter((item, index, list) => list.findIndex((entry) => entry._id === item._id) === index);

const isLoggedIn = () => Boolean(localStorage.getItem("token"));

export const loadWishlist = createAsyncThunk(
  "wishlist/loadWishlist",
  async (_, { rejectWithValue }) => {
    try {
      if (!isLoggedIn()) {
        return {
          items: sanitizeWishlistItems(readGuestWishlist()),
          source: "guest",
        };
      }

      const response = await axios.get(`${baseUrl}/wishlist`, {
        headers: getAuthHeaders(),
      });
      const rawItems = response.data?.wishlist?.items || [];
      const items = sanitizeWishlistItems(
        rawItems.map((entry) => createProductSnapshot(entry?.product)).filter(Boolean),
      );
      return {
        items,
        source: "auth",
      };
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || "Failed to load wishlist");
    }
  },
);

export const toggleWishlistItem = createAsyncThunk(
  "wishlist/toggleWishlistItem",
  async (product, { getState, rejectWithValue }) => {
    const snapshot = sanitizeWishlistItem(createProductSnapshot(product));
    if (!snapshot?._id) {
      return rejectWithValue("Product is unavailable");
    }

    try {
      const currentItems = getState()?.wishlist?.items || [];
      const exists = currentItems.some(
        (item) => String(item?._id || "") === String(snapshot._id),
      );

      if (!isLoggedIn()) {
        const nextItems = exists
          ? currentItems.filter((item) => String(item?._id || "") !== String(snapshot._id))
          : [snapshot, ...currentItems.filter((item) => item?._id !== snapshot._id)];
        const sanitizedItems = sanitizeWishlistItems(nextItems);
        writeGuestWishlist(sanitizedItems);
        return {
          items: sanitizedItems,
          source: "guest",
          productId: snapshot._id,
          isWishlisted: !exists,
        };
      }

      if (exists) {
        await axios.delete(`${baseUrl}/wishlist/${snapshot._id}`, {
          headers: getAuthHeaders(),
        });
      } else {
        await axios.post(
          `${baseUrl}/wishlist`,
          { productId: snapshot._id },
          { headers: getAuthHeaders() },
        );
      }

      const nextItems = exists
        ? currentItems.filter((item) => String(item?._id || "") !== String(snapshot._id))
        : [snapshot, ...currentItems.filter((item) => item?._id !== snapshot._id)];

      return {
        items: sanitizeWishlistItems(nextItems),
        source: "auth",
        productId: snapshot._id,
        isWishlisted: !exists,
      };
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || "Failed to update wishlist");
    }
  },
);

export const removeWishlistItem = createAsyncThunk(
  "wishlist/removeWishlistItem",
  async (productId, { getState, rejectWithValue }) => {
    const normalizedId = String(productId || "").trim();
    if (!normalizedId) {
      return rejectWithValue("Product is unavailable");
    }

    try {
      const currentItems = getState()?.wishlist?.items || [];
      const nextItems = currentItems.filter(
        (item) => String(item?._id || "") !== normalizedId,
      );

      if (!isLoggedIn()) {
        const sanitizedItems = sanitizeWishlistItems(nextItems);
        writeGuestWishlist(sanitizedItems);
        return {
          items: sanitizedItems,
          source: "guest",
          productId: normalizedId,
        };
      }

      await axios.delete(`${baseUrl}/wishlist/${normalizedId}`, {
        headers: getAuthHeaders(),
      });

      return {
        items: sanitizeWishlistItems(nextItems),
        source: "auth",
        productId: normalizedId,
      };
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || "Failed to remove wishlist item");
    }
  },
);

export const clearWishlist = createAsyncThunk(
  "wishlist/clearWishlist",
  async (_, { rejectWithValue }) => {
    try {
      if (!isLoggedIn()) {
        writeGuestWishlist([]);
        return {
          items: [],
          source: "guest",
        };
      }

      await axios.delete(`${baseUrl}/wishlist`, {
        headers: getAuthHeaders(),
      });

      return {
        items: [],
        source: "auth",
      };
    } catch (error) {
      return rejectWithValue(error?.response?.data?.message || "Failed to clear wishlist");
    }
  },
);

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState: {
    items: sanitizeWishlistItems(readGuestWishlist()),
    status: "idle",
    error: "",
    source: isLoggedIn() ? "auth" : "guest",
    loaded: false,
    pendingIds: [],
    clearStatus: "idle",
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadWishlist.pending, (state) => {
        state.status = "loading";
        state.error = "";
      })
      .addCase(loadWishlist.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.error = "";
        state.loaded = true;
        state.items = sanitizeWishlistItems(action.payload?.items || []);
        state.source = action.payload?.source || state.source;
      })
      .addCase(loadWishlist.rejected, (state, action) => {
        state.status = "failed";
        state.error = String(action.payload || action.error?.message || "");
      })
      .addCase(toggleWishlistItem.pending, (state, action) => {
        state.error = "";
        const productId = String(action.meta.arg?._id || "").trim();
        if (productId && !state.pendingIds.includes(productId)) {
          state.pendingIds.push(productId);
        }
      })
      .addCase(toggleWishlistItem.fulfilled, (state, action) => {
        const productId = String(action.payload?.productId || "").trim();
        state.items = sanitizeWishlistItems(action.payload?.items || []);
        state.source = action.payload?.source || state.source;
        state.pendingIds = state.pendingIds.filter((id) => id !== productId);
      })
      .addCase(toggleWishlistItem.rejected, (state, action) => {
        const productId = String(action.meta.arg?._id || "").trim();
        state.error = String(action.payload || action.error?.message || "");
        state.pendingIds = state.pendingIds.filter((id) => id !== productId);
      })
      .addCase(removeWishlistItem.pending, (state, action) => {
        state.error = "";
        const productId = String(action.meta.arg || "").trim();
        if (productId && !state.pendingIds.includes(productId)) {
          state.pendingIds.push(productId);
        }
      })
      .addCase(removeWishlistItem.fulfilled, (state, action) => {
        const productId = String(action.payload?.productId || "").trim();
        state.items = sanitizeWishlistItems(action.payload?.items || []);
        state.source = action.payload?.source || state.source;
        state.pendingIds = state.pendingIds.filter((id) => id !== productId);
      })
      .addCase(removeWishlistItem.rejected, (state, action) => {
        const productId = String(action.meta.arg || "").trim();
        state.error = String(action.payload || action.error?.message || "");
        state.pendingIds = state.pendingIds.filter((id) => id !== productId);
      })
      .addCase(clearWishlist.pending, (state) => {
        state.clearStatus = "loading";
        state.error = "";
      })
      .addCase(clearWishlist.fulfilled, (state, action) => {
        state.clearStatus = "succeeded";
        state.items = sanitizeWishlistItems(action.payload?.items || []);
        state.source = action.payload?.source || state.source;
      })
      .addCase(clearWishlist.rejected, (state, action) => {
        state.clearStatus = "failed";
        state.error = String(action.payload || action.error?.message || "");
      });
  },
});

export const selectWishlistItems = (state) => state.wishlist.items || [];
export const selectWishlistCount = (state) => state.wishlist.items?.length || 0;
export const selectWishlistPendingIds = (state) => state.wishlist.pendingIds || [];
export const selectIsWishlisted = (productId) => (state) =>
  (state.wishlist.items || []).some(
    (item) => String(item?._id || "") === String(productId || ""),
  );

export { GUEST_WISHLIST_KEY, WISHLIST_EVENT };

export default wishlistSlice.reducer;
