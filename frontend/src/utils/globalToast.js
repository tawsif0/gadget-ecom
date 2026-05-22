import React from "react";
import toast, { toast as namedToast } from "react-hot-toast";
import { FiAlertCircle, FiCheckCircle, FiLoader } from "react-icons/fi";

const toastApi = namedToast || toast;

let isConfigured = false;
let lastLoadingToastAt = 0;
const activeLoadingToastIds = new Set();

const successIcon = React.createElement(FiCheckCircle, {
  className: "h-5 w-5 text-emerald-600",
});

const errorIcon = React.createElement(FiAlertCircle, {
  className: "h-5 w-5 text-red-600",
});

const loadingIcon = React.createElement(FiLoader, {
  className: "h-5 w-5 text-black animate-spin",
});

const withDefaultIcon = (options = {}, iconElement) => {
  if (Object.prototype.hasOwnProperty.call(options, "icon")) {
    return options;
  }
  return { ...options, icon: iconElement };
};

export const GLOBAL_TOAST_OPTIONS = {
  duration: 3500,
  style: {
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.12)",
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 500,
  },
  success: {
    duration: 2800,
  },
  error: {
    duration: 4200,
  },
};

export const wasLoadingToastShownRecently = (windowMs = 1200) =>
  Date.now() - lastLoadingToastAt <= windowMs;

export const configureGlobalToasts = () => {
  if (isConfigured) return;

  const originalSuccess = toastApi.success.bind(toastApi);
  const originalError = toastApi.error.bind(toastApi);
  const originalLoading = toastApi.loading.bind(toastApi);
  const originalDismiss = toastApi.dismiss.bind(toastApi);

  const clearTrackedLoadingToast = (toastId) => {
    const normalizedId = String(toastId || "").trim();
    if (!normalizedId) return;
    activeLoadingToastIds.delete(normalizedId);
  };

  const dismissActiveLoadingToasts = (exceptId = "") => {
    const preservedId = String(exceptId || "").trim();

    Array.from(activeLoadingToastIds).forEach((toastId) => {
      if (toastId === preservedId) return;
      originalDismiss(toastId);
      activeLoadingToastIds.delete(toastId);
    });
  };

  const patchedSuccess = (message, options = {}) => {
    dismissActiveLoadingToasts(options.id);
    clearTrackedLoadingToast(options.id);
    return originalSuccess(message, withDefaultIcon(options, successIcon));
  };

  const patchedError = (message, options = {}) => {
    dismissActiveLoadingToasts(options.id);
    clearTrackedLoadingToast(options.id);
    return originalError(message, withDefaultIcon(options, errorIcon));
  };

  const patchedLoading = (message, options = {}) => {
    lastLoadingToastAt = Date.now();
    const loadingToastId = originalLoading(
      message,
      withDefaultIcon(options, loadingIcon),
    );
    clearTrackedLoadingToast(options.id);
    activeLoadingToastIds.add(String(loadingToastId));
    return loadingToastId;
  };

  const patchedDismiss = (toastId) => {
    if (toastId === undefined) {
      activeLoadingToastIds.clear();
    } else {
      clearTrackedLoadingToast(toastId);
    }
    return originalDismiss(toastId);
  };

  toastApi.success = patchedSuccess;
  toastApi.error = patchedError;
  toastApi.loading = patchedLoading;
  toastApi.dismiss = patchedDismiss;

  if (toast && toast !== toastApi) {
    toast.success = patchedSuccess;
    toast.error = patchedError;
    toast.loading = patchedLoading;
    toast.dismiss = patchedDismiss;
  }

  if (namedToast && namedToast !== toastApi) {
    namedToast.success = patchedSuccess;
    namedToast.error = patchedError;
    namedToast.loading = patchedLoading;
    namedToast.dismiss = patchedDismiss;
  }

  isConfigured = true;
};

