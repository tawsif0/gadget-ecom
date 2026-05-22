import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import toast from "react-hot-toast";
import { wasLoadingToastShownRecently } from "../utils/globalToast";
import { clearAuth, setAuth, setAuthLoading, setUser } from "../store/authSlice";

const baseUrl = import.meta.env.VITE_API_URL;
const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);
const BUTTON_LOADING_DELAY_MS = 250;
const TOAST_LOADING_DELAY_MS = 700;

let authBootstrapped = false;
let authListenersBound = false;
let interceptorsBound = false;

const createRequestId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const getActionLabel = (method) => {
  const normalizedMethod = String(method || "").toLowerCase();
  if (normalizedMethod === "post") return "Submitting";
  if (normalizedMethod === "put" || normalizedMethod === "patch") return "Updating";
  if (normalizedMethod === "delete") return "Deleting";
  return "Processing";
};

const getActiveActionButton = () => {
  if (typeof document === "undefined") return null;
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) return null;

  const nearestButton =
    activeElement.tagName === "BUTTON"
      ? activeElement
      : activeElement.closest("button");

  if (!(nearestButton instanceof HTMLButtonElement)) return null;
  return nearestButton;
};

const getFormSubmitButton = () => {
  if (typeof document === "undefined") return null;
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) return null;

  const parentForm = activeElement.closest("form");
  if (!(parentForm instanceof HTMLFormElement)) return null;

  const submitButton =
    parentForm.querySelector('button[type="submit"]:not([disabled])') ||
    parentForm.querySelector("button:not([type]):not([disabled])");

  if (!(submitButton instanceof HTMLButtonElement)) return null;
  return submitButton;
};

const startButtonLoadingState = (button) => {
  if (!(button instanceof HTMLButtonElement) || !button.isConnected) return null;
  if (button.dataset.globalLoading === "true") return null;

  const originalDisabled = button.disabled;
  const loadingText = button.getAttribute("data-loading-text") || "Processing...";

  button.dataset.globalLoading = "true";
  button.dataset.globalLoadingText = loadingText;
  button.setAttribute("aria-busy", "true");
  button.disabled = true;

  return () => {
    if (!button.isConnected) return;
    delete button.dataset.globalLoading;
    delete button.dataset.globalLoadingText;
    button.removeAttribute("aria-busy");
    button.disabled = originalDisabled;
  };
};

const hydrateAuthFromStorage = (dispatch) => {
  const storedUser = localStorage.getItem("user");
  const storedToken = localStorage.getItem("token");

  if (storedUser && storedToken) {
    try {
      dispatch(setAuth({ user: JSON.parse(storedUser), token: storedToken }));
      return;
    } catch {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
  }

  dispatch(clearAuth());
};

const emitAuthEvents = (eventName) => {
  window.dispatchEvent(new CustomEvent(eventName));
  window.dispatchEvent(new CustomEvent("profileUpdated"));
};

const performLogout = (dispatch, options = {}) => {
  const showToast = options.showToast !== false;

  ["user", "token", "dashboardActiveTab", "guestCart"].forEach((item) =>
    localStorage.removeItem(item),
  );

  dispatch(clearAuth());
  setTimeout(() => emitAuthEvents("userLoggedOut"), 0);

  if (showToast) {
    toast.success("Successfully logged out!", {
      duration: 2000,
      position: "top-center",
      id: "logout-toast",
    });
  }
};

const bindAuthEventListeners = (dispatch) => {
  if (authListenersBound) return;
  authListenersBound = true;

  window.addEventListener("userLoggedOut", () => {
    dispatch(clearAuth());
  });

  window.addEventListener("userLoggedIn", () => {
    hydrateAuthFromStorage(dispatch);
  });
};

const bindAxiosInterceptors = (dispatch) => {
  if (interceptorsBound) return;
  interceptorsBound = true;

  const toastTimerMap = new Map();
  const buttonTimerMap = new Map();
  const activeToastMap = new Map();
  const buttonCleanupMap = new Map();

  const clearRequestFeedback = (config) => {
    const requestId = config?.meta?.__requestId;
    if (!requestId) return;

    const toastTimer = toastTimerMap.get(requestId);
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimerMap.delete(requestId);
    }

    const buttonTimer = buttonTimerMap.get(requestId);
    if (buttonTimer) {
      clearTimeout(buttonTimer);
      buttonTimerMap.delete(requestId);
    }

    const toastId = activeToastMap.get(requestId);
    if (toastId) {
      toast.dismiss(toastId);
      activeToastMap.delete(requestId);
    }

    const cleanupButtonState = buttonCleanupMap.get(requestId);
    if (cleanupButtonState) {
      cleanupButtonState();
      buttonCleanupMap.delete(requestId);
    }
  };

  axios.interceptors.request.use(
    (config) => {
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        config.headers.Authorization = `Bearer ${storedToken}`;
      }

      const method = String(config?.method || "get").toLowerCase();
      const isMutation = MUTATION_METHODS.has(method);
      const requestId = createRequestId();
      config.meta = { ...(config.meta || {}), __requestId: requestId };

      if (!isMutation) return config;

      if (!config.meta.skipGlobalButtonLoading) {
        const activeButton = getActiveActionButton() || getFormSubmitButton();
        if (activeButton) {
          const buttonTimer = setTimeout(() => {
            const cleanup = startButtonLoadingState(activeButton);
            if (cleanup) {
              buttonCleanupMap.set(requestId, cleanup);
            }
          }, BUTTON_LOADING_DELAY_MS);
          buttonTimerMap.set(requestId, buttonTimer);
        }
      }

      if (!config.meta.skipGlobalLoadingToast) {
        const toastTimer = setTimeout(() => {
          if (wasLoadingToastShownRecently()) return;
          const loadingToastId = toast.loading(`${getActionLabel(method)}...`, {
            id: `request-loading-${requestId}`,
          });
          activeToastMap.set(requestId, loadingToastId);
        }, TOAST_LOADING_DELAY_MS);
        toastTimerMap.set(requestId, toastTimer);
      }

      return config;
    },
    (error) => Promise.reject(error),
  );

  axios.interceptors.response.use(
    (response) => {
      clearRequestFeedback(response.config);
      return response;
    },
    (error) => {
      clearRequestFeedback(error.config);

      if (
        error.response?.status === 401 &&
        !error.config?.url?.includes("/auth/login") &&
        !error.config?.url?.includes("/auth/register")
      ) {
        performLogout(dispatch, { showToast: false });
      }
      return Promise.reject(error);
    },
  );
};

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, token, isLoading } = useSelector((state) => state.auth);

  useEffect(() => {
    bindAxiosInterceptors(dispatch);
    bindAuthEventListeners(dispatch);

    if (!authBootstrapped) {
      authBootstrapped = true;
      hydrateAuthFromStorage(dispatch);
    } else if (isLoading) {
      dispatch(setAuthLoading(false));
    }
  }, [dispatch, isLoading]);

  const login = useCallback(
    async (userData, newToken) => {
      localStorage.setItem("dashboardActiveTab", "dashboard");
      localStorage.setItem("user", JSON.stringify(userData));
      localStorage.setItem("token", newToken);
      dispatch(setAuth({ user: userData, token: newToken }));
      emitAuthEvents("userLoggedIn");
      toast.success("Successfully logged in!");
      return { success: true };
    },
    [dispatch],
  );

  const logout = useCallback(() => {
    performLogout(dispatch, { showToast: true });
  }, [dispatch]);

  const updateUser = useCallback(
    (updatedUserData) => {
      localStorage.setItem("user", JSON.stringify(updatedUserData));
      dispatch(setUser(updatedUserData));
      window.dispatchEvent(new CustomEvent("profileUpdated"));
    },
    [dispatch],
  );

  const refreshProfile = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem("token");
      if (!storedToken) return null;

      const response = await axios.get(`${baseUrl}/auth/profile`, {
        headers: { Authorization: `Bearer ${storedToken}` },
        timeout: 5000,
      });

      const updatedUser = { ...(user || {}), ...response.data };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      dispatch(setUser(updatedUser));
      window.dispatchEvent(new CustomEvent("profileUpdated"));
      return updatedUser;
    } catch {
      return null;
    }
  }, [dispatch, user]);

  const updateAdminSettings = useCallback(async (settings) => {
    try {
      const storedToken = localStorage.getItem("token");
      const response = await axios.put(`${baseUrl}/auth/admin/settings`, settings, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      toast.success("Settings updated successfully");
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Failed to update settings";
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    }
  }, []);

  const getAllUsers = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem("token");
      const response = await axios.get(`${baseUrl}/auth/admin/all-users`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Failed to fetch users";
      return { success: false, message: errorMessage };
    }
  }, []);

  const getSystemStats = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem("token");
      const response = await axios.get(`${baseUrl}/auth/admin/system-stats`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });
      return { success: true, data: response.data };
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || "Failed to fetch system stats";
      return { success: false, message: errorMessage };
    }
  }, []);

  return {
    user,
    token,
    isLoading,
    login,
    logout,
    updateUser,
    refreshProfile,
    updateAdminSettings,
    getAllUsers,
    getSystemStats,
    isAuthenticated: Boolean(user && token),
    isLoggedIn: Boolean(user && token),
    isAdmin: user?.userType === "admin",
    isActive: user?.status === "active",
    isPending: user?.status === "pending",
    isInactive: user?.status === "inactive",
    getUserStatus: () => (user?.status ? user.status : "unknown"),
  };
};
