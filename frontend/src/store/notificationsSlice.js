import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

const baseUrl = import.meta.env.VITE_API_URL;

let notificationStream = null;
let reconnectTimeout = null;
let activeToken = "";

const sortByCreatedAt = (items = []) =>
  [...items].sort(
    (a, b) =>
      new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime(),
  );

const closeNotificationStream = () => {
  if (typeof window !== "undefined" && reconnectTimeout) {
    window.clearTimeout(reconnectTimeout);
  }
  reconnectTimeout = null;

  if (notificationStream) {
    notificationStream.close();
    notificationStream = null;
  }

  activeToken = "";
};

export const fetchNotifications = createAsyncThunk(
  "notifications/fetchNotifications",
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token || localStorage.getItem("token");
      if (!token) return [];

      const response = await axios.get(`${baseUrl}/auth/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.data?.success ? response.data.notifications || [] : [];
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to load notifications",
      );
    }
  },
);

export const markNotificationRead = createAsyncThunk(
  "notifications/markNotificationRead",
  async (notificationId, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token || localStorage.getItem("token");
      const response = await axios.patch(
        `${baseUrl}/auth/notifications/${notificationId}/read`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      return response.data?.notification || null;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update notification",
      );
    }
  },
);

export const markAllNotificationsRead = createAsyncThunk(
  "notifications/markAllNotificationsRead",
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token || localStorage.getItem("token");
      await axios.patch(
        `${baseUrl}/auth/notifications/read-all`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      return new Date().toISOString();
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update notifications",
      );
    }
  },
);

export const deleteNotification = createAsyncThunk(
  "notifications/deleteNotification",
  async (notificationId, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token || localStorage.getItem("token");
      await axios.delete(`${baseUrl}/auth/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return String(notificationId || "").trim();
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete notification",
      );
    }
  },
);

export const clearAllNotifications = createAsyncThunk(
  "notifications/clearAllNotifications",
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getState().auth.token || localStorage.getItem("token");
      await axios.delete(`${baseUrl}/auth/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return true;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete notifications",
      );
    }
  },
);

const initialState = {
  items: [],
  isLoading: false,
  streamConnected: false,
  error: "",
};

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    clearNotifications: (state) => {
      state.items = [];
      state.isLoading = false;
      state.streamConnected = false;
      state.error = "";
    },
    setNotificationStreamConnected: (state, action) => {
      state.streamConnected = Boolean(action.payload);
    },
    notificationReceived: (state, action) => {
      const incoming = action.payload;
      if (!incoming?._id) return;

      const existingIndex = state.items.findIndex(
        (item) => item._id === incoming._id,
      );

      if (existingIndex >= 0) {
        state.items[existingIndex] = incoming;
      } else {
        state.items.unshift(incoming);
      }

      state.items = sortByCreatedAt(state.items);
    },
    notificationReadLocally: (state, action) => {
      const { notificationId, readAt } = action.payload || {};
      state.items = state.items.map((item) =>
        item._id === notificationId
          ? {
              ...item,
              isRead: true,
              readAt: readAt || new Date().toISOString(),
            }
          : item,
      );
    },
    notificationsReadAllLocally: (state, action) => {
      const readAt = action.payload || new Date().toISOString();
      state.items = state.items.map((item) => ({
        ...item,
        isRead: true,
        readAt,
      }));
    },
    notificationDeletedLocally: (state, action) => {
      const notificationId = String(action.payload || "").trim();
      state.items = state.items.filter((item) => item._id !== notificationId);
    },
    notificationsClearedLocally: (state) => {
      state.items = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.isLoading = true;
        state.error = "";
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.items = sortByCreatedAt(action.payload || []);
        state.isLoading = false;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Failed to load notifications";
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        if (!action.payload?._id) return;
        state.items = state.items.map((item) =>
          item._id === action.payload._id ? action.payload : item,
        );
      })
      .addCase(markAllNotificationsRead.fulfilled, (state, action) => {
        const readAt = action.payload || new Date().toISOString();
        state.items = state.items.map((item) => ({
          ...item,
          isRead: true,
          readAt,
        }));
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        const notificationId = String(action.payload || "").trim();
        state.items = state.items.filter((item) => item._id !== notificationId);
      })
      .addCase(clearAllNotifications.fulfilled, (state) => {
        state.items = [];
      });
  },
});

export const {
  clearNotifications,
  notificationDeletedLocally,
  notificationReadLocally,
  notificationReceived,
  notificationsClearedLocally,
  notificationsReadAllLocally,
  setNotificationStreamConnected,
} = notificationsSlice.actions;

export const startNotificationStream = () => (dispatch, getState) => {
  const token = getState().auth.token || localStorage.getItem("token");
  if (!token || typeof window === "undefined") {
    closeNotificationStream();
    dispatch(setNotificationStreamConnected(false));
    return;
  }

  if (notificationStream && activeToken === token) {
    return;
  }

  closeNotificationStream();
  activeToken = token;

  const streamUrl = `${baseUrl}/auth/notifications/stream?token=${encodeURIComponent(token)}`;
  notificationStream = new EventSource(streamUrl);

  notificationStream.addEventListener("ready", () => {
    dispatch(setNotificationStreamConnected(true));
  });

  notificationStream.addEventListener("notification", (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      dispatch(notificationReceived(payload.notification));
    } catch {
      // Ignore malformed stream messages.
    }
  });

  notificationStream.addEventListener("notification.read", (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      dispatch(
        notificationReadLocally({
          notificationId: payload.notificationId,
          readAt: payload.readAt || new Date().toISOString(),
        }),
      );
    } catch {
      // Ignore malformed stream messages.
    }
  });

  notificationStream.addEventListener("notification.readAll", (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      dispatch(notificationsReadAllLocally(payload.readAt || new Date().toISOString()));
    } catch {
      // Ignore malformed stream messages.
    }
  });

  notificationStream.addEventListener("notification.deleted", (event) => {
    try {
      const payload = JSON.parse(event.data || "{}");
      dispatch(notificationDeletedLocally(payload.notificationId));
    } catch {
      // Ignore malformed stream messages.
    }
  });

  notificationStream.addEventListener("notification.cleared", () => {
    dispatch(notificationsClearedLocally());
  });

  notificationStream.onerror = () => {
    dispatch(setNotificationStreamConnected(false));
    if (notificationStream) {
      notificationStream.close();
      notificationStream = null;
    }

    if (typeof window !== "undefined" && reconnectTimeout) {
      window.clearTimeout(reconnectTimeout);
    }

    reconnectTimeout =
      typeof window !== "undefined"
        ? window.setTimeout(() => {
            const latestToken =
              getState().auth.token || localStorage.getItem("token");
            if (latestToken) {
              dispatch(startNotificationStream());
            }
          }, 3000)
        : null;
  };
};

export const stopNotificationStream = () => (dispatch) => {
  closeNotificationStream();
  dispatch(setNotificationStreamConnected(false));
};

export default notificationsSlice.reducer;
