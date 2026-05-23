const API_BASE_URL = import.meta.env.VITE_API_URL || "";

const safeString = (value) => String(value || "").trim();

const PAGE_TARGETS = [
  { key: "home", label: "Home", path: "/" },
  { key: "shop", label: "Shop", path: "/shop" },
  { key: "contact", label: "Contact", path: "/contact" },
  { key: "cart", label: "Cart", path: "/cart" },
  { key: "checkout", label: "Checkout", path: "/checkout" },
  {
    key: "productDetails",
    label: "All Product Pages",
    path: "/product/:id",
    hidden: true,
  },
];

const PAGE_TARGET_MAP = new Map(PAGE_TARGETS.map((entry) => [entry.key, entry]));

const normalizeKeywords = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => safeString(entry))
      .filter(Boolean)
      .join(", ");
  }

  return safeString(value);
};

const normalizeType = (value) => {
  const normalized = safeString(value).toLowerCase();
  if (normalized === "seo") return "seo";
  if (normalized === "facebook" || normalized === "facebookpixel") {
    return "facebook";
  }
  if (normalized === "custom" || normalized === "customscript") {
    return "custom";
  }
  if (
    normalized === "analytics" ||
    normalized === "googleanalytics" ||
    normalized === "google"
  ) {
    return "analytics";
  }
  return "seo";
};

const normalizeScope = (value) =>
  safeString(value).toLowerCase() === "global" ? "global" : "page";

const defaultEntryName = (type) => {
  if (type === "facebook") return "Facebook Pixel";
  if (type === "custom") return "Custom Script";
  if (type === "analytics") return "Google Analytics";
  return "SEO";
};

const hasSeoValues = (value = {}) =>
  Boolean(
    safeString(value.metaTitle) ||
      safeString(value.metaDescription) ||
      normalizeKeywords(value.metaKeywords) ||
      safeString(value.openGraphImage),
  );

const hasFacebookValues = (value = {}) => Boolean(safeString(value.facebookPixelId));

const hasAnalyticsValues = (value = {}) =>
  Boolean(
    safeString(value.ga4MeasurementId) ||
      safeString(value.googleAnalyticsId) ||
      safeString(value.gtmId) ||
      safeString(value.customTrackingCode),
  );

const hasCustomValues = (value = {}) => Boolean(safeString(value.customTrackingCode));

const isEntryConfigured = (entry = {}) => {
  if (entry.type === "facebook") return hasFacebookValues(entry);
  if (entry.type === "custom") return hasCustomValues(entry);
  if (entry.type === "analytics") return hasAnalyticsValues(entry);
  return hasSeoValues(entry);
};

export const createMarketingEntryId = (type = "entry") =>
  `${normalizeType(type)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizePageTarget = (target = {}) => {
  const rawKey = safeString(target.key || target.pageKey || target.id);
  if (!rawKey) return null;

  const definition = PAGE_TARGET_MAP.get(rawKey);
  return {
    kind: "page",
    key: definition?.key || rawKey,
    label: safeString(target.label || definition?.label || rawKey),
    path: safeString(target.path || definition?.path || ""),
  };
};

const normalizeProductTarget = (target = {}) => {
  const productId = safeString(
    target.key || target.productId || target.id || target._id,
  );
  if (!productId) return null;

  return {
    kind: "product",
    key: productId,
    label: safeString(
      target.label || target.productName || target.name || "Untitled Product",
    ),
    path: safeString(target.path || `/product/${productId}`),
  };
};

export const normalizeMarketingTarget = (target = {}) => {
  const kind = safeString(target.kind || target.type).toLowerCase();
  if (kind === "product") {
    return normalizeProductTarget(target);
  }
  return normalizePageTarget(target);
};

export const normalizeMarketingTargets = (targets = []) => {
  const uniqueTargets = new Map();

  (Array.isArray(targets) ? targets : []).forEach((target) => {
    const normalized = normalizeMarketingTarget(target);
    if (!normalized) return;
    uniqueTargets.set(`${normalized.kind}:${normalized.key}`, normalized);
  });

  return Array.from(uniqueTargets.values());
};

export const normalizeMarketingEntry = (entry = {}, index = 0) => {
  const type = normalizeType(entry.type);
  const scope = normalizeScope(entry.scope);

  return {
    id:
      safeString(entry.id) ||
      `${type}-${scope}-${index + 1}`.replace(/\s+/g, "-").toLowerCase(),
    type,
    scope,
    name: safeString(entry.name || entry.label || defaultEntryName(type)),
    targets: scope === "global" ? [] : normalizeMarketingTargets(entry.targets),
    metaTitle: safeString(entry.metaTitle),
    metaDescription: safeString(entry.metaDescription),
    metaKeywords: normalizeKeywords(entry.metaKeywords),
    openGraphImage: safeString(entry.openGraphImage),
    facebookPixelId: safeString(
      entry.facebookPixelId || entry.metaPixelId || entry.pixelId,
    ),
    enableDataLayer:
      entry.enableDataLayer === undefined
        ? true
        : Boolean(entry.enableDataLayer),
    ga4MeasurementId: safeString(
      entry.ga4MeasurementId || entry.measurementId || "",
    ),
    googleAnalyticsId: safeString(entry.googleAnalyticsId),
    gtmId: safeString(entry.gtmId),
    customTrackingCode: safeString(entry.customTrackingCode),
    createdAt: safeString(entry.createdAt),
    updatedAt: safeString(entry.updatedAt),
  };
};

const normalizeLegacyPageConfig = (value = {}) => ({
  metaTitle: safeString(value.metaTitle),
  metaDescription: safeString(value.metaDescription),
  metaKeywords: normalizeKeywords(value.metaKeywords),
  openGraphImage: safeString(value.openGraphImage),
  facebookPixelId: safeString(value.facebookPixelId),
  googleAnalyticsId: safeString(value.googleAnalyticsId),
  ga4MeasurementId: safeString(value.ga4MeasurementId),
});

const normalizeLegacyGlobalConfig = (value = {}) => ({
  facebookPixelId: safeString(value.facebookPixelId),
  googleAnalyticsId: safeString(value.googleAnalyticsId),
  ga4MeasurementId: safeString(value.ga4MeasurementId),
  gtmId: safeString(value.gtmId),
  customTrackingCode: safeString(value.customTrackingCode),
  enableDataLayer:
    value.enableDataLayer === undefined ? true : Boolean(value.enableDataLayer),
});

const normalizeLegacyProductConfig = (value = {}) => ({
  productId: safeString(value.productId || value._id),
  productName: safeString(value.productName || value.name || value.title),
  facebookPixelId: safeString(value.facebookPixelId),
  googleAnalyticsId: safeString(value.googleAnalyticsId),
  ga4MeasurementId: safeString(value.ga4MeasurementId),
  gtmId: safeString(value.gtmId),
  customTrackingCode: safeString(value.customTrackingCode),
});

const buildLegacyEntries = (settings = {}) => {
  const entries = [];
  const seo = settings?.seo || {};
  const seoAnalytics = settings?.seoAnalytics || {};

  if (hasSeoValues(seo)) {
    entries.push(
      normalizeMarketingEntry({
        id: "legacy-global-seo",
        type: "seo",
        scope: "global",
        name: "Global SEO",
        ...seo,
      }),
    );
  }

  const pageMappings = [
    { key: "home", label: "Home", value: seoAnalytics?.pages?.home || {} },
    { key: "shop", label: "Shop", value: seoAnalytics?.pages?.shop || {} },
    { key: "cart", label: "Cart", value: seoAnalytics?.pages?.cart || {} },
    {
      key: "checkout",
      label: "Checkout",
      value: seoAnalytics?.pages?.checkout || {},
    },
    {
      key: "productDetails",
      label: "All Product Pages",
      value: seoAnalytics?.pages?.productDetails || {},
    },
  ];

  pageMappings.forEach((mapping) => {
    const pageValue = normalizeLegacyPageConfig(mapping.value);

    if (hasSeoValues(pageValue)) {
      entries.push(
        normalizeMarketingEntry({
          id: `legacy-${mapping.key}-seo`,
          type: "seo",
          scope: "page",
          name: `${mapping.label} SEO`,
          targets: [{ kind: "page", key: mapping.key, label: mapping.label }],
          ...pageValue,
        }),
      );
    }

    if (hasFacebookValues(pageValue)) {
      entries.push(
        normalizeMarketingEntry({
          id: `legacy-${mapping.key}-facebook`,
          type: "facebook",
          scope: "page",
          name: `${mapping.label} Facebook Pixel`,
          targets: [{ kind: "page", key: mapping.key, label: mapping.label }],
          ...pageValue,
        }),
      );
    }

    if (hasAnalyticsValues(pageValue)) {
      entries.push(
        normalizeMarketingEntry({
          id: `legacy-${mapping.key}-analytics`,
          type: "analytics",
          scope: "page",
          name: `${mapping.label} Google Analytics`,
          targets: [{ kind: "page", key: mapping.key, label: mapping.label }],
          ...pageValue,
        }),
      );
    }
  });

  const globalTracking = normalizeLegacyGlobalConfig(seoAnalytics?.global || {});

  if (hasFacebookValues(globalTracking)) {
    entries.push(
      normalizeMarketingEntry({
        id: "legacy-global-facebook",
        type: "facebook",
        scope: "global",
        name: "Global Facebook Pixel",
        ...globalTracking,
      }),
    );
  }

  if (hasAnalyticsValues(globalTracking)) {
    entries.push(
      normalizeMarketingEntry({
        id: "legacy-global-analytics",
        type: "analytics",
        scope: "global",
        name: "Global Google Analytics",
        ...globalTracking,
      }),
    );
  }

  const products = Array.isArray(seoAnalytics?.products)
    ? seoAnalytics.products
    : [];

  products.forEach((product, index) => {
    const normalizedProduct = normalizeLegacyProductConfig(product);
    if (!normalizedProduct.productId) return;

    const productTarget = {
      kind: "product",
      key: normalizedProduct.productId,
      label: normalizedProduct.productName || "Untitled Product",
    };

    if (hasFacebookValues(normalizedProduct)) {
      entries.push(
        normalizeMarketingEntry({
          id: `legacy-product-${normalizedProduct.productId}-facebook-${index + 1}`,
          type: "facebook",
          scope: "page",
          name: `${productTarget.label} Facebook Pixel`,
          targets: [productTarget],
          ...normalizedProduct,
        }),
      );
    }

    if (hasAnalyticsValues(normalizedProduct)) {
      entries.push(
        normalizeMarketingEntry({
          id: `legacy-product-${normalizedProduct.productId}-analytics-${index + 1}`,
          type: "analytics",
          scope: "page",
          name: `${productTarget.label} Google Analytics`,
          targets: [productTarget],
          ...normalizedProduct,
        }),
      );
    }
  });

  return entries.filter(isEntryConfigured);
};

export const normalizeMarketingSettings = (settings = {}) => {
  const seoAnalytics = settings?.seoAnalytics || {};
  const hasExplicitEntries = Array.isArray(seoAnalytics.entries);
  const providedEntries = hasExplicitEntries ? seoAnalytics.entries : [];

  return {
    hasExplicitEntries,
    pages: {
      home: normalizeLegacyPageConfig(seoAnalytics?.pages?.home || {}),
      shop: normalizeLegacyPageConfig(seoAnalytics?.pages?.shop || {}),
      cart: normalizeLegacyPageConfig(seoAnalytics?.pages?.cart || {}),
      checkout: normalizeLegacyPageConfig(
        seoAnalytics?.pages?.checkout || {},
      ),
      productDetails: normalizeLegacyPageConfig(
        seoAnalytics?.pages?.productDetails || {},
      ),
    },
    global: normalizeLegacyGlobalConfig(seoAnalytics?.global || {}),
    products: Array.isArray(seoAnalytics?.products)
      ? seoAnalytics.products
          .map((product) => normalizeLegacyProductConfig(product))
          .filter((product) => product.productId)
      : [],
    entries:
      hasExplicitEntries
        ? providedEntries
            .map((entry, index) => normalizeMarketingEntry(entry, index))
            .filter(isEntryConfigured)
        : buildLegacyEntries(settings),
    sitemap: {
      autoIntegrate:
        seoAnalytics?.sitemap?.autoIntegrate === undefined
          ? true
          : Boolean(seoAnalytics.sitemap.autoIntegrate),
      lastGeneratedAt: safeString(seoAnalytics?.sitemap?.lastGeneratedAt),
      publicSitemapUrl: safeString(seoAnalytics?.sitemap?.publicSitemapUrl),
      publicRobotsUrl: safeString(seoAnalytics?.sitemap?.publicRobotsUrl),
    },
  };
};

export const resolveMarketingPageKey = (pathname = "") => {
  const normalizedPath = safeString(pathname).replace(/\/+$/, "") || "/";

  if (normalizedPath === "/" || normalizedPath === "/home") return "home";
  if (normalizedPath === "/shop") return "shop";
  if (normalizedPath === "/contact" || normalizedPath === "/contact-us") {
    return "contact";
  }
  if (normalizedPath === "/cart" || normalizedPath === "/added-to-cart") {
    return "cart";
  }
  if (normalizedPath === "/checkout") return "checkout";
  if (/^\/product\/[^/]+$/i.test(normalizedPath)) return "productDetails";
  return "";
};

const normalizeMatchContext = (context = {}) => ({
  pathname: safeString(context.pathname || "/") || "/",
  pageKey: safeString(context.pageKey || resolveMarketingPageKey(context.pathname)),
  productId: safeString(context.productId),
});

const getEntryMatchScore = (entry = {}, context = {}) => {
  const resolvedContext = normalizeMatchContext(context);
  if (entry.scope === "global") return 1;

  let score = 0;
  (Array.isArray(entry.targets) ? entry.targets : []).forEach((target) => {
    if (target.kind === "product") {
      if (
        resolvedContext.pageKey === "productDetails" &&
        resolvedContext.productId &&
        safeString(target.key) === resolvedContext.productId
      ) {
        score = Math.max(score, 4);
      }
      return;
    }

    if (target.kind === "page" && safeString(target.key) === resolvedContext.pageKey) {
      score = Math.max(
        score,
        target.key === "productDetails" ? 3 : 2,
      );
    }
  });

  return score;
};

const compareEntries = (left = {}, right = {}, context = {}) => {
  const scoreDifference =
    getEntryMatchScore(right, context) - getEntryMatchScore(left, context);
  if (scoreDifference !== 0) return scoreDifference;

  const leftUpdated = Date.parse(left.updatedAt || left.createdAt || 0) || 0;
  const rightUpdated = Date.parse(right.updatedAt || right.createdAt || 0) || 0;
  if (rightUpdated !== leftUpdated) return rightUpdated - leftUpdated;

  return safeString(right.id).localeCompare(safeString(left.id));
};

export const getMatchingMarketingEntries = (
  settings = {},
  { type = "", pathname = "/", pageKey = "", productId = "" } = {},
) => {
  const normalizedType = safeString(type);
  const context = normalizeMatchContext({ pathname, pageKey, productId });
  const entries = Array.isArray(settings?.seoAnalytics?.entries)
    ? settings.seoAnalytics.entries
    : [];

  return entries
    .filter((entry) => !normalizedType || entry.type === normalizedType)
    .filter((entry) => getEntryMatchScore(entry, context) > 0)
    .sort((left, right) => compareEntries(left, right, context));
};

export const getActiveMarketingEntry = (settings = {}, options = {}) =>
  getMatchingMarketingEntries(settings, options)[0] || null;

export const applyMarketingTemplate = (value, replacements = {}) => {
  let resolved = safeString(value);
  Object.entries(replacements || {}).forEach(([key, replacement]) => {
    const normalizedReplacement = safeString(replacement);
    resolved = resolved.replaceAll(`{${key}}`, normalizedReplacement);
  });
  return resolved.trim();
};

const pickFirstFilledValue = (...values) => {
  const match = values.find((value) => safeString(value));
  return safeString(match);
};

const resolveLegacyTrackingConfiguration = (settings = {}, pathname = "/", productId = "") => {
  const integrations = settings?.integrations || {};
  const seoAnalytics = settings?.seoAnalytics || {};
  const globalTracking = seoAnalytics?.global || {};
  const pageKey = resolveMarketingPageKey(pathname);

  let pageTracking = {};
  let productTracking = {};

  if (pageKey === "home") {
    pageTracking = seoAnalytics?.pages?.home || {};
  } else if (pageKey === "shop") {
    pageTracking = seoAnalytics?.pages?.shop || {};
  } else if (pageKey === "cart") {
    pageTracking = seoAnalytics?.pages?.cart || {};
  } else if (pageKey === "checkout") {
    pageTracking = seoAnalytics?.pages?.checkout || {};
  } else if (pageKey === "productDetails") {
    pageTracking = seoAnalytics?.pages?.productDetails || {};
    productTracking = Array.isArray(seoAnalytics?.products)
      ? seoAnalytics.products.find(
          (entry) => safeString(entry?.productId) === safeString(productId),
        ) || {}
      : {};
  }

  return {
    facebookPixelId: pickFirstFilledValue(
      productTracking?.facebookPixelId,
      pageTracking?.facebookPixelId,
      globalTracking?.facebookPixelId,
      integrations?.facebookPixelId,
    ),
    googleAnalyticsId: pickFirstFilledValue(
      productTracking?.googleAnalyticsId,
      pageTracking?.googleAnalyticsId,
      globalTracking?.googleAnalyticsId,
      integrations?.googleAnalyticsId,
    ),
    ga4MeasurementId: pickFirstFilledValue(
      productTracking?.ga4MeasurementId,
      pageTracking?.ga4MeasurementId,
      globalTracking?.ga4MeasurementId,
      integrations?.ga4MeasurementId,
    ),
    gtmId: pickFirstFilledValue(
      productTracking?.gtmId,
      globalTracking?.gtmId,
      integrations?.gtmId,
    ),
    customTrackingCode: pickFirstFilledValue(
      productTracking?.customTrackingCode,
      globalTracking?.customTrackingCode,
      integrations?.customTrackingCode,
    ),
    enableDataLayer:
      globalTracking?.enableDataLayer === undefined
        ? integrations?.enableDataLayer !== false
        : Boolean(globalTracking.enableDataLayer),
  };
};

const toUniqueValues = (values = []) =>
  Array.from(
    new Set(
      values.map((value) => safeString(value)).filter(Boolean),
    ),
  );

export const resolveTrackingConfiguration = (
  settings = {},
  { pathname = "/", productId = "" } = {},
) => {
  const hasExplicitEntries = Boolean(settings?.seoAnalytics?.hasExplicitEntries);
  const facebookEntries = getMatchingMarketingEntries(settings, {
    type: "facebook",
    pathname,
    productId,
  });
  const analyticsEntries = getMatchingMarketingEntries(settings, {
    type: "analytics",
    pathname,
    productId,
  });
  const customEntries = getMatchingMarketingEntries(settings, {
    type: "custom",
    pathname,
    productId,
  });
  const legacyTracking = resolveLegacyTrackingConfiguration(
    settings,
    pathname,
    productId,
  );

  const hasFacebookEntries = facebookEntries.length > 0;
  const hasAnalyticsEntries = analyticsEntries.length > 0;
  const pixelIds = toUniqueValues([
    ...facebookEntries.map((entry) => entry.facebookPixelId),
    ...(
      hasExplicitEntries || hasFacebookEntries
        ? []
        : [legacyTracking.facebookPixelId]
    ),
  ]);
  const hasActivePixelIds = pixelIds.length > 0;

  return {
    pixelIds,
    ga4Ids: toUniqueValues([
      ...analyticsEntries.map((entry) => entry.ga4MeasurementId),
      ...(
        hasExplicitEntries || hasAnalyticsEntries
          ? []
          : [legacyTracking.ga4MeasurementId]
      ),
    ]),
    googleAnalyticsIds: toUniqueValues([
      ...analyticsEntries.map((entry) => entry.googleAnalyticsId),
      ...(
        hasExplicitEntries || hasAnalyticsEntries
          ? []
          : [legacyTracking.googleAnalyticsId]
      ),
    ]),
    gtmIds: toUniqueValues([
      ...analyticsEntries.map((entry) => entry.gtmId),
      ...(hasExplicitEntries || hasAnalyticsEntries ? [] : [legacyTracking.gtmId]),
    ]),
    customTrackingCodes: toUniqueValues([
      ...customEntries.map((entry) => entry.customTrackingCode),
      ...analyticsEntries.map((entry) => entry.customTrackingCode),
      ...(
        hasExplicitEntries || hasAnalyticsEntries || customEntries.length > 0
          ? []
          : [legacyTracking.customTrackingCode]
      ),
    ]),
    dataLayerEnabled: hasExplicitEntries
      ? hasActivePixelIds &&
        facebookEntries.some((entry) => entry.enableDataLayer !== false)
      : hasFacebookEntries
      ? hasActivePixelIds &&
        facebookEntries.some((entry) => entry.enableDataLayer !== false)
      : Boolean(safeString(legacyTracking.facebookPixelId)) &&
        legacyTracking.enableDataLayer !== false,
  };
};

export const formatEntryTargets = (entry = {}) => {
  if (entry.scope === "global") return "All storefront pages and products";
  return (Array.isArray(entry.targets) ? entry.targets : [])
    .map((target) => target.label || target.key)
    .filter(Boolean);
};

export const buildEntryTargets = ({
  pageKeys = [],
  products = [],
} = {}) => [
  ...pageKeys
    .map((key) => normalizeMarketingTarget({ kind: "page", key }))
    .filter(Boolean),
  ...products
    .map((product) =>
      normalizeMarketingTarget({
        kind: "product",
        key: product.productId || product.key || product._id,
        label: product.productName || product.label || product.name,
      }),
    )
    .filter(Boolean),
];

export const getPageTargetOptions = ({ includeHidden = false } = {}) =>
  PAGE_TARGETS.filter((entry) => includeHidden || !entry.hidden);

export const getApiRootUrl = () => safeString(API_BASE_URL).replace(/\/api\/?$/, "");

export const getFallbackSitemapUrl = () => {
  const apiRoot = getApiRootUrl();
  return apiRoot ? `${apiRoot}/sitemap.xml` : "";
};

export const getFallbackRobotsUrl = (siteUrl = "") => {
  const normalizedSiteUrl = safeString(siteUrl).replace(/\/+$/, "");
  return normalizedSiteUrl ? `${normalizedSiteUrl}/robots.txt` : "";
};
