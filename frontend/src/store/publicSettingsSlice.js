import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import {
  broadcastPublicSettingsUpdated,
  fetchPublicSettings,
  getDefaultPublicSettings,
  normalizePublicSettingsPayload,
  primePublicSettingsCache,
} from "../utils/publicSettings";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const initialSettings = getDefaultPublicSettings();

const mergeDraftWithCommittedSettings = (
  draftSettings,
  committedSettings,
  websitePatch = {},
) =>
  normalizePublicSettingsPayload({
    ...committedSettings,
    ...draftSettings,
    website: {
      ...(committedSettings?.website || {}),
      ...(draftSettings?.website || {}),
      ...websitePatch,
    },
  });

const setValueAtPath = (target, path, value) => {
  const keys = String(path || "")
    .split(".")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!keys.length) return false;

  let cursor = target;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const currentValue = cursor?.[key];

    cursor[key] =
      currentValue &&
      typeof currentValue === "object" &&
      !Array.isArray(currentValue)
        ? { ...currentValue }
        : {};

    cursor = cursor[key];
  }

  cursor[keys[keys.length - 1]] = value;
  return true;
};

export const loadPublicSettings = createAsyncThunk(
  "publicSettings/loadPublicSettings",
  async ({ force = false } = {}, { rejectWithValue }) => {
    try {
      return await fetchPublicSettings({ force });
    } catch (error) {
      return rejectWithValue(
        error?.message || "Failed to load public settings",
      );
    }
  },
);

export const loadAdminSettings = createAsyncThunk(
  "publicSettings/loadAdminSettings",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl}/auth/admin/settings`, {
        headers: getAuthHeaders(),
      });
      return normalizePublicSettingsPayload(response.data || {});
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.error || "Failed to load website settings",
      );
    }
  },
);

export const saveAdminSettings = createAsyncThunk(
  "publicSettings/saveAdminSettings",
  async (payload, { getState, rejectWithValue }) => {
    const previousSettings = normalizePublicSettingsPayload(
      getState()?.publicSettings?.settings || {},
    );
    const optimisticSettings = normalizePublicSettingsPayload(
      getState()?.publicSettings?.adminDraft || payload || {},
    );

    primePublicSettingsCache(optimisticSettings);

    try {
      const response = await axios.put(
        `${baseUrl}/auth/admin/settings`,
        payload,
        {
          headers: getAuthHeaders(),
        },
      );
      const normalized = normalizePublicSettingsPayload(
        response?.data?.settings || payload,
      );
      primePublicSettingsCache(normalized);
      broadcastPublicSettingsUpdated();
      return {
        settings: normalized,
        message: response?.data?.message || "Settings saved",
      };
    } catch (error) {
      primePublicSettingsCache(previousSettings);
      return rejectWithValue(
        error?.response?.data?.error || "Failed to save settings",
      );
    }
  },
);

export const uploadAdminLogo = createAsyncThunk(
  "publicSettings/uploadAdminLogo",
  async (file, { getState, rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const currentDraft = normalizePublicSettingsPayload(
        getState()?.publicSettings?.adminDraft || {},
      );

      const response = await axios.post(
        `${baseUrl}/auth/admin/settings/logo-upload`,
        formData,
        {
          headers: getAuthHeaders(),
        },
      );
      const logoUrl = String(response?.data?.logoUrl || "").trim();
      const committedSettings = normalizePublicSettingsPayload(
        response?.data?.settings || {},
      );
      const draftSettings = mergeDraftWithCommittedSettings(
        currentDraft,
        committedSettings,
        {
          logoMode: "image",
          logoUrl: logoUrl || committedSettings?.website?.logoUrl || "",
        },
      );
      primePublicSettingsCache(committedSettings);
      broadcastPublicSettingsUpdated();
      return {
        logoUrl,
        settings: committedSettings,
        draftSettings,
        message: response?.data?.message || "Logo uploaded",
      };
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.error || "Failed to upload logo",
      );
    }
  },
);

export const uploadAdminHeaderIcon = createAsyncThunk(
  "publicSettings/uploadAdminHeaderIcon",
  async (file, { getState, rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("icon", file);

      const currentDraft = normalizePublicSettingsPayload(
        getState()?.publicSettings?.adminDraft || {},
      );

      const response = await axios.post(
        `${baseUrl}/auth/admin/settings/header-icon-upload`,
        formData,
        {
          headers: getAuthHeaders(),
        },
      );

      const headerIconUrl = String(response?.data?.headerIconUrl || "").trim();
      const committedSettings = normalizePublicSettingsPayload(
        response?.data?.settings || {},
      );
      const draftSettings = mergeDraftWithCommittedSettings(
        currentDraft,
        committedSettings,
        {
          headerIconUrl:
            headerIconUrl || committedSettings?.website?.headerIconUrl || "",
        },
      );

      primePublicSettingsCache(committedSettings);
      broadcastPublicSettingsUpdated();

      return {
        headerIconUrl,
        settings: committedSettings,
        draftSettings,
        message: response?.data?.message || "Header icon uploaded",
      };
    } catch (error) {
      return rejectWithValue(
        error?.response?.data?.error || "Failed to upload header icon",
      );
    }
  },
);

const publicSettingsSlice = createSlice({
  name: "publicSettings",
  initialState: {
    settings: initialSettings,
    status: "idle",
    error: "",
    loaded: false,
    adminDraft: initialSettings,
    lastCommittedSettings: initialSettings,
    saveOptimisticSnapshot: null,
    adminStatus: "idle",
    adminError: "",
    saveStatus: "idle",
    saveError: "",
    logoUploadStatus: "idle",
    logoUploadError: "",
  },
  reducers: {
    setAdminSettingsDraft(state, action) {
      state.adminDraft = normalizePublicSettingsPayload(action.payload || {});
    },
    updateAdminField(state, action) {
      const { key, value } = action.payload || {};
      if (!key) return;
      state.adminDraft = {
        ...state.adminDraft,
        [key]: value,
      };
    },
    updateAdminNestedField(state, action) {
      const { section, key, value, path } = action.payload || {};
      if (path) {
        const nextDraft = normalizePublicSettingsPayload(
          state.adminDraft || {},
        );
        const didUpdate = setValueAtPath(nextDraft, path, value);
        if (didUpdate) {
          state.adminDraft = nextDraft;
        }
        return;
      }

      if (!section || !key) return;
      state.adminDraft = {
        ...state.adminDraft,
        [section]: {
          ...(state.adminDraft?.[section] || {}),
          [key]: value,
        },
      };
    },
    setPublicStockSummaryEnabled(state, action) {
      const enabled = Boolean(action.payload);
      state.adminDraft.publicStockSummaryEnabled = enabled;
      state.adminDraft.marketplace = {
        ...(state.adminDraft.marketplace || {}),
        marketplaceMode: "single",
        publicStockSummaryEnabled: enabled,
      };
    },
    mergePublicSettingsState(state, action) {
      const normalized = normalizePublicSettingsPayload(action.payload || {});
      state.settings = normalized;
      state.lastCommittedSettings = normalized;
      state.loaded = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPublicSettings.pending, (state) => {
        state.status = "loading";
        state.error = "";
      })
      .addCase(loadPublicSettings.fulfilled, (state, action) => {
        const normalized = normalizePublicSettingsPayload(action.payload || {});
        state.status = "succeeded";
        state.error = "";
        state.loaded = true;
        state.settings = normalized;
        state.lastCommittedSettings = normalized;
      })
      .addCase(loadPublicSettings.rejected, (state, action) => {
        state.status = "failed";
        state.error = String(action.payload || action.error?.message || "");
      })
      .addCase(loadAdminSettings.pending, (state) => {
        state.adminStatus = "loading";
        state.adminError = "";
      })
      .addCase(loadAdminSettings.fulfilled, (state, action) => {
        const normalized = normalizePublicSettingsPayload(action.payload || {});
        state.adminStatus = "succeeded";
        state.adminError = "";
        state.adminDraft = normalized;
        state.settings = normalized;
        state.lastCommittedSettings = normalized;
        state.loaded = true;
      })
      .addCase(loadAdminSettings.rejected, (state, action) => {
        state.adminStatus = "failed";
        state.adminError = String(
          action.payload || action.error?.message || "",
        );
      })
      .addCase(saveAdminSettings.pending, (state) => {
        state.saveOptimisticSnapshot = normalizePublicSettingsPayload(
          state.settings || {},
        );
        state.settings = normalizePublicSettingsPayload(
          state.adminDraft || state.settings || {},
        );
        state.loaded = true;
        state.saveStatus = "loading";
        state.saveError = "";
      })
      .addCase(saveAdminSettings.fulfilled, (state, action) => {
        const normalized = normalizePublicSettingsPayload(
          action.payload?.settings || {},
        );
        state.saveStatus = "succeeded";
        state.saveError = "";
        state.settings = normalized;
        state.adminDraft = normalized;
        state.lastCommittedSettings = normalized;
        state.saveOptimisticSnapshot = null;
        state.loaded = true;
      })
      .addCase(saveAdminSettings.rejected, (state, action) => {
        state.settings = normalizePublicSettingsPayload(
          state.saveOptimisticSnapshot ||
            state.lastCommittedSettings ||
            state.settings ||
            {},
        );
        state.saveStatus = "failed";
        state.saveError = String(action.payload || action.error?.message || "");
        state.saveOptimisticSnapshot = null;
      })
      .addCase(uploadAdminLogo.pending, (state) => {
        state.logoUploadStatus = "loading";
        state.logoUploadError = "";
      })
      .addCase(uploadAdminLogo.fulfilled, (state, action) => {
        const normalized = normalizePublicSettingsPayload(
          action.payload?.settings || {},
        );
        const normalizedDraft = normalizePublicSettingsPayload(
          action.payload?.draftSettings || normalized,
        );
        state.logoUploadStatus = "succeeded";
        state.logoUploadError = "";
        state.settings = normalized;
        state.adminDraft = normalizedDraft;
        state.lastCommittedSettings = normalized;
        state.loaded = true;
      })
      .addCase(uploadAdminLogo.rejected, (state, action) => {
        state.logoUploadStatus = "failed";
        state.logoUploadError = String(
          action.payload || action.error?.message || "",
        );
      })
      .addCase(uploadAdminHeaderIcon.fulfilled, (state, action) => {
        const normalized = normalizePublicSettingsPayload(
          action.payload?.settings || {},
        );
        const normalizedDraft = normalizePublicSettingsPayload(
          action.payload?.draftSettings || normalized,
        );
        state.settings = normalized;
        state.adminDraft = normalizedDraft;
        state.lastCommittedSettings = normalized;
        state.loaded = true;
      });
  },
});

export const {
  setAdminSettingsDraft,
  updateAdminField,
  updateAdminNestedField,
  setPublicStockSummaryEnabled,
  mergePublicSettingsState,
} = publicSettingsSlice.actions;

export const selectPublicSettingsState = (state) => state.publicSettings;
export const selectPublicSettings = (state) => state.publicSettings.settings;
export const selectAdminSettingsDraft = (state) =>
  state.publicSettings.adminDraft;

export default publicSettingsSlice.reducer;
