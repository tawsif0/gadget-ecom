import { useMemo } from "react";
import { useSelector } from "react-redux";
import {
  selectAdminSettingsDraft,
  selectPublicSettings,
  selectPublicSettingsState,
} from "../store/publicSettingsSlice";

const normalizeHexColor = (value, fallback) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }

  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw;
  }

  return fallback;
};

export const useThemeColors = () => {
  const settings = useSelector(selectPublicSettings);
  const adminDraft = useSelector(selectAdminSettingsDraft);
  const { adminStatus, saveStatus, loaded } = useSelector(selectPublicSettingsState);

  return useMemo(() => {
    const shouldUseAdminWebsite =
      adminStatus === "succeeded" ||
      saveStatus === "loading" ||
      saveStatus === "succeeded";

    const reduxWebsite = shouldUseAdminWebsite
      ? adminDraft?.website || settings?.website || {}
      : settings?.website || {};

    const reduxThemeColor = normalizeHexColor(reduxWebsite?.themeColor, "");
    const reduxButtonTextColor = normalizeHexColor(
      reduxWebsite?.buttonTextColor,
      "",
    );

    let cachedWebsite = {};
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("publicStoreSettings");
        const parsed = raw ? JSON.parse(raw) : null;
        cachedWebsite = parsed?.settings?.website || {};
      } catch {
        cachedWebsite = {};
      }
    }

    const cachedThemeColor = normalizeHexColor(cachedWebsite?.themeColor, "");
    const cachedButtonTextColor = normalizeHexColor(
      cachedWebsite?.buttonTextColor,
      "",
    );

    let cssThemeColor = "";
    let cssButtonTextColor = "";
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const rootStyle = window.getComputedStyle(document.documentElement);
      cssThemeColor = normalizeHexColor(
        rootStyle.getPropertyValue("--brand-theme-color"),
        "",
      );
      cssButtonTextColor = normalizeHexColor(
        rootStyle.getPropertyValue("--brand-button-text-color"),
        "",
      );
    }

    return {
      themeColor:
        reduxThemeColor ||
        (loaded ? "" : cachedThemeColor) ||
        cssThemeColor ||
        "#000000",
      buttonTextColor:
        reduxButtonTextColor ||
        (loaded ? "" : cachedButtonTextColor) ||
        cssButtonTextColor ||
        "#ffffff",
    };
  }, [adminDraft?.website, adminStatus, loaded, saveStatus, settings?.website]);
};

export default useThemeColors;
