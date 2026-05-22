// App.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { Provider } from "react-redux";
import { store } from "./store";
import { configureGlobalToasts } from "./utils/globalToast";

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

const hexToRgba = (value, alpha) => {
  const normalized = normalizeHexColor(value, "#000000");
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const applyCachedBrandTheme = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  try {
    const raw = window.localStorage.getItem("publicStoreSettings");
    if (!raw) return;

    const parsed = JSON.parse(raw);
    const website = parsed?.settings?.website || {};
    const themeColor = normalizeHexColor(website?.themeColor, "#000000");
    const buttonTextColor = normalizeHexColor(
      website?.buttonTextColor,
      "#ffffff",
    );

    document.documentElement.style.setProperty("--brand-theme-color", themeColor);
    document.documentElement.style.setProperty(
      "--brand-button-text-color",
      buttonTextColor,
    );
    document.documentElement.style.setProperty(
      "--brand-theme-shadow",
      hexToRgba(themeColor, 0.24),
    );
  } catch {
    // Keep default CSS fallback colors when cache is unavailable or invalid.
  }
};

applyCachedBrandTheme();

configureGlobalToasts();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
