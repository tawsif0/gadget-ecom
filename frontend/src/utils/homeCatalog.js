import axios from "axios";

const baseUrl = import.meta.env.VITE_API_URL;
const CACHE_KEY = "homeCatalogCache";
const CACHE_MAX_AGE_MS = 2 * 60 * 1000;

let inMemoryCatalog = null;
let inMemoryTimestamp = 0;
let pendingRequest = null;

const isFresh = (timestamp) =>
  Number.isFinite(timestamp) && Date.now() - timestamp < CACHE_MAX_AGE_MS;

const getEmptyCatalog = () => ({
  sections: {},
  brands: [],
  fetchedAt: "",
});

const normalizeCatalog = (payload) => ({
  sections: payload?.sections && typeof payload.sections === "object" ? payload.sections : {},
  brands: Array.isArray(payload?.brands) ? payload.brands : [],
  fetchedAt: String(payload?.fetchedAt || "").trim(),
});

const readCache = () => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!isFresh(Number(parsed?.timestamp))) return null;

    return normalizeCatalog(parsed?.payload);
  } catch {
    return null;
  }
};

const writeCache = (payload) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        payload,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // ignore cache write issues
  }
};

export const fetchHomeCatalog = async ({ force = false } = {}) => {
  if (!force && inMemoryCatalog && isFresh(inMemoryTimestamp)) {
    return inMemoryCatalog;
  }

  if (!force) {
    const cached = readCache();
    if (cached) {
      inMemoryCatalog = cached;
      inMemoryTimestamp = Date.now();
      return cached;
    }
  }

  if (!force && pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = axios
    .get(`${baseUrl}/products/public/home-catalog`, {
      timeout: 10000,
    })
    .then((response) => normalizeCatalog(response.data))
    .then((catalog) => {
      inMemoryCatalog = catalog;
      inMemoryTimestamp = Date.now();
      writeCache(catalog);
      return catalog;
    })
    .catch(() => {
      const fallback = inMemoryCatalog || readCache() || getEmptyCatalog();
      inMemoryCatalog = fallback;
      inMemoryTimestamp = Date.now();
      return fallback;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
};

export const primeHomeCatalogCache = (payload) => {
  const catalog = normalizeCatalog(payload);
  inMemoryCatalog = catalog;
  inMemoryTimestamp = Date.now();
  writeCache(catalog);
  return catalog;
};

export const invalidateHomeCatalogCache = () => {
  inMemoryCatalog = null;
  inMemoryTimestamp = 0;
  pendingRequest = null;

  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore cache reset issues
  }
};
