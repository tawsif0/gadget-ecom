const DEFAULT_TTL_MS = Number(process.env.RESPONSE_CACHE_TTL_MS || 30000);
const MAX_CACHE_ENTRIES = Number(process.env.RESPONSE_CACHE_MAX_ENTRIES || 2000);
const cacheStore = new Map();

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const pruneCache = () => {
  const current = Date.now();

  for (const [key, entry] of cacheStore.entries()) {
    if (!entry || entry.expiresAt <= current) {
      cacheStore.delete(key);
    }
  }

  while (cacheStore.size > toPositiveInt(MAX_CACHE_ENTRIES, 2000)) {
    const firstKey = cacheStore.keys().next().value;
    if (!firstKey) break;
    cacheStore.delete(firstKey);
  }
};

const responseCache = (ttlMs = DEFAULT_TTL_MS, options = {}) => {
  const ttl = toPositiveInt(ttlMs, DEFAULT_TTL_MS);
  const keyBuilder =
    typeof options.keyBuilder === "function"
      ? options.keyBuilder
      : (req) => req.originalUrl;
  const shouldBypass =
    typeof options.shouldBypass === "function" ? options.shouldBypass : () => false;

  return (req, res, next) => {
    if (req.method !== "GET" || shouldBypass(req)) {
      return next();
    }

    const cacheKey = keyBuilder(req);
    if (!cacheKey) {
      return next();
    }

    const requestTs = Date.now();
    const cached = cacheStore.get(cacheKey);
    if (cached && cached.expiresAt > requestTs) {
      res.set("X-Cache", "HIT");
      if (cached.cacheControl) {
        res.set("Cache-Control", cached.cacheControl);
      }
      return res.status(cached.statusCode).json(cached.payload);
    }

    if (cached) {
      cacheStore.delete(cacheKey);
    }

    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const maxAge = Math.max(1, Math.floor(ttl / 1000));
        const staleWhileRevalidate = Math.max(5, Math.floor(maxAge / 2));
        const cacheControl =
          options.cacheControl ||
          `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`;

        cacheStore.set(cacheKey, {
          payload,
          statusCode: res.statusCode,
          expiresAt: Date.now() + ttl,
          cacheControl,
        });
        pruneCache();
        res.set("X-Cache", "MISS");
        res.set("Cache-Control", cacheControl);
      }

      return originalJson(payload);
    };

    return next();
  };
};

const clearResponseCacheByPrefix = (prefix = "") => {
  const normalizedPrefix = String(prefix || "");
  if (!normalizedPrefix) {
    cacheStore.clear();
    return;
  }

  for (const key of cacheStore.keys()) {
    if (key.startsWith(normalizedPrefix)) {
      cacheStore.delete(key);
    }
  }
};

const clearResponseCache = () => {
  cacheStore.clear();
};

const getResponseCacheSize = () => cacheStore.size;

module.exports = responseCache;
module.exports.clearResponseCacheByPrefix = clearResponseCacheByPrefix;
module.exports.clearResponseCache = clearResponseCache;
module.exports.getResponseCacheSize = getResponseCacheSize;
