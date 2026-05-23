const safeString = (value) => String(value || "").trim();

const PAGE_TARGET_DEFINITIONS = [
  { key: "home", label: "Home", path: "/" },
  { key: "shop", label: "Shop", path: "/shop" },
  { key: "contact", label: "Contact", path: "/contact" },
  { key: "cart", label: "Cart", path: "/cart" },
  { key: "checkout", label: "Checkout", path: "/checkout" },
  { key: "productDetails", label: "All Product Pages", path: "/product/:id" },
];

const PAGE_TARGET_MAP = new Map(
  PAGE_TARGET_DEFINITIONS.map((entry) => [entry.key, entry]),
);

const normalizeEntryType = (value) => {
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

const normalizeKeywords = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => safeString(entry))
      .filter(Boolean)
      .join(", ");
  }

  return safeString(value);
};

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

const normalizeTarget = (target = {}) => {
  const kind = safeString(target.kind || target.type).toLowerCase();
  if (kind === "product") {
    return normalizeProductTarget(target);
  }
  return normalizePageTarget(target);
};

const normalizeTargets = (value = []) => {
  const source = Array.isArray(value) ? value : [];
  const uniqueTargets = new Map();

  source.forEach((target) => {
    const normalized = normalizeTarget(target);
    if (!normalized) return;
    uniqueTargets.set(`${normalized.kind}:${normalized.key}`, normalized);
  });

  return Array.from(uniqueTargets.values());
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

const defaultEntryName = (type) => {
  if (type === "facebook") return "Facebook Pixel";
  if (type === "custom") return "Custom Script";
  if (type === "analytics") return "Google Analytics";
  return "SEO";
};

const normalizeEntry = (entry = {}, index = 0) => {
  const type = normalizeEntryType(entry.type);
  const scope = normalizeScope(entry.scope);

  return {
    id:
      safeString(entry.id) ||
      `${type}-${scope}-${index + 1}`.replace(/\s+/g, "-").toLowerCase(),
    type,
    scope,
    name: safeString(entry.name || entry.label || defaultEntryName(type)),
    targets: scope === "global" ? [] : normalizeTargets(entry.targets),
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

const isEntryConfigured = (entry = {}) => {
  if (entry.type === "facebook") return hasFacebookValues(entry);
  if (entry.type === "custom") return hasCustomValues(entry);
  if (entry.type === "analytics") return hasAnalyticsValues(entry);
  return hasSeoValues(entry);
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
      normalizeEntry({
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
        normalizeEntry({
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
        normalizeEntry({
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
        normalizeEntry({
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
      normalizeEntry({
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
      normalizeEntry({
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
        normalizeEntry({
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
        normalizeEntry({
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

const normalizeSeoAnalyticsSettings = (settings = {}) => {
  const seoAnalytics = settings?.seoAnalytics || {};
  const hasExplicitEntries = Array.isArray(seoAnalytics.entries);
  const providedEntries = hasExplicitEntries ? seoAnalytics.entries : [];
  const normalizedEntries = hasExplicitEntries
    ? providedEntries
        .map((entry, index) => normalizeEntry(entry, index))
        .filter(isEntryConfigured)
    : buildLegacyEntries(settings);

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
    entries: normalizedEntries,
    sitemap: {
      autoIntegrate:
        seoAnalytics?.sitemap?.autoIntegrate === undefined
          ? true
          : Boolean(seoAnalytics.sitemap.autoIntegrate),
      lastGeneratedAt: safeString(seoAnalytics?.sitemap?.lastGeneratedAt),
    },
  };
};

module.exports = {
  PAGE_TARGET_DEFINITIONS,
  normalizeSeoAnalyticsSettings,
};
