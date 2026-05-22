import axios from "axios";
import {
  DEFAULT_ABOUT_CARDS,
  DEFAULT_ABOUT_STORY_CONTENT,
  DEFAULT_ABOUT_STORY_TITLE,
  normalizeAboutCards,
} from "./aboutSection";
import { normalizeMarketingSettings } from "./marketingProfiles";

const baseUrl = import.meta.env.VITE_API_URL;
const DEFAULT_MARKETPLACE_MODE = "single";
const CACHE_KEY = "publicStoreSettings";
const UPDATE_SIGNAL_KEY = "publicSettingsUpdatedAt";
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_NAV_LINK_PATHS = {
  "daily deals": "/shop?collection=deals",
  "top categories": "/#top-categories",
  "new arrivals": "/shop?collection=new-arrivals",
  "buyer protection": "/faqs#buyer-protection",
  "track order": "/track-order",
};
const LEGACY_CATALOG_TITLE = "{storeName} catalog with stock-aware shopping";
const LEGACY_CATALOG_DESCRIPTION =
  "Browse categories, compare pricing modes, and surface only the stock visibility you choose to publish.";
const DEFAULT_CATALOG_TITLE = "Shop the full {storeName} catalog";
const DEFAULT_CATALOG_DESCRIPTION =
  "Browse categories, compare pricing options, and discover curated deals across the store.";
const DEFAULT_STOREFRONT_NAV_LINKS = [
  { label: "Daily Deals", path: DEFAULT_NAV_LINK_PATHS["daily deals"] },
  { label: "Top Categories", path: DEFAULT_NAV_LINK_PATHS["top categories"] },
  { label: "New Arrivals", path: DEFAULT_NAV_LINK_PATHS["new arrivals"] },
  {
    label: "Buyer Protection",
    path: DEFAULT_NAV_LINK_PATHS["buyer protection"],
  },
  { label: "Track Order", path: DEFAULT_NAV_LINK_PATHS["track order"] },
];
const DEFAULT_STOREFRONT_TRUST_BULLETS = [
  "COD-friendly Bangladesh checkout flow",
  "Product stock only shows publicly when enabled",
  "Orders and purchases already sync inventory",
];
const COURIER_PROVIDER_DEFINITIONS = {
  steadfast: { label: "Steadfast" },
  pathao: { label: "Pathao" },
  ecourier: { label: "eCourier" },
  carrybee: { label: "CarryBee" },
  redx: { label: "RedX" },
};

const createCourierDefaults = (label) => ({
  providerName: label,
  enabled: false,
  apiBaseUrl: "",
  apiToken: "",
  apiKey: "",
  apiSecret: "",
  consignmentPath: "/consignments",
  trackingPath: "/track",
  labelPath: "/label",
  timeoutMs: 12000,
});

const normalizeCourierMap = (value = {}) => {
  const source = value && typeof value === "object" ? value : {};

  return Object.fromEntries(
    Object.entries(COURIER_PROVIDER_DEFINITIONS).map(([key, meta]) => [
      key,
      {
        ...createCourierDefaults(meta.label),
        ...(source[key] || {}),
        providerName: String(source[key]?.providerName || meta.label).trim(),
        enabled: Boolean(source[key]?.enabled),
        timeoutMs: Math.max(
          1000,
          Number.parseInt(source[key]?.timeoutMs, 10) || 12000,
        ),
      },
    ]),
  );
};

const normalizeIdList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim())
      .filter(Boolean)
      .filter((entry, index, list) => list.indexOf(entry) === index);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return normalizeIdList(parsed);
    } catch {
      return [];
    }
  }

  return [];
};

const cloneNavLinks = (links = DEFAULT_STOREFRONT_NAV_LINKS) =>
  links.map((entry) => ({
    label: String(entry?.label || "").trim(),
    path: String(entry?.path || "").trim() || "/",
  }));

const normalizeStorefrontText = (value, fallback, legacyValues = []) => {
  const normalized = String(value || "").trim();
  if (!normalized || legacyValues.includes(normalized)) {
    return fallback;
  }
  return normalized;
};

const normalizeStringList = (value, fallback = []) => {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];
  const uniqueValues = new Set();

  source.forEach((entry) => {
    const normalized = String(entry || "").trim();
    if (normalized) {
      uniqueValues.add(normalized);
    }
  });

  const items = Array.from(uniqueValues);
  return items.length > 0 ? items : [...fallback];
};

const normalizeStorefrontNavLinks = (value) => {
  if (!Array.isArray(value)) {
    return cloneNavLinks();
  }

  const uniqueValues = new Map();
  value.forEach((entry) => {
    const label = String(entry?.label || "").trim();
    const normalizedLabel = label.toLowerCase();
    const inputPath = String(entry?.path || "").trim();
    const defaultPath = DEFAULT_NAV_LINK_PATHS[normalizedLabel] || "/";
    const path =
      !inputPath ||
      (normalizedLabel === "daily deals" && inputPath === "/shop") ||
      (normalizedLabel === "top categories" && inputPath === "/shop") ||
      (normalizedLabel === "new arrivals" && inputPath === "/shop") ||
      (normalizedLabel === "buyer protection" && inputPath === "/faqs") ||
      (normalizedLabel === "track order" && inputPath === "/contact")
        ? defaultPath
        : inputPath;
    if (!label) return;
    uniqueValues.set(`${label}|${path}`, { label, path });
  });

  const items = Array.from(uniqueValues.values());
  return items.length > 0 ? items : cloneNavLinks();
};

const DEFAULT_SETTINGS = {
  isInitialSetup: false,
  marketplaceMode: DEFAULT_MARKETPLACE_MODE,
  publicStockSummaryEnabled: false,
  publicStockCategoryIds: [],
  marketplace: {
    marketplaceMode: DEFAULT_MARKETPLACE_MODE,
    publicStockSummaryEnabled: false,
    publicStockCategoryIds: [],
  },
  seo: {
    metaTitle: "",
    metaDescription: "",
    metaKeywords: "",
    openGraphImage: "",
    enableLegacyMode: false,
  },
  website: {
    storeName: "E-Commerce",
    tagline: "",
    logoMode: "image",
    logoText: "",
    logoUrl: "",
    headerIconUrl: "",
    useLogoAsHeaderIcon: false,
    siteUrl: "",
    storeUrl: "",
    themeColor: "#000000",
    buttonTextColor: "#ffffff",
    fontFamily: '"Manrope", "Inter", system-ui, -apple-system, sans-serif',
  },
  contact: {
    address: "",
    addressLink: "",
    phone1: "",
    phone2: "",
    email: "",
  },
  social: {
    facebook: "",
    whatsapp: "",
    instagram: "",
    youtube: "",
  },
  policies: {
    shipmentPolicy: "",
    deliveryPolicy: "",
    termsConditions: "",
    returnPolicy: "",
    privacyPolicy: "",
    cancellationPolicy: "",
    cancellationWindowDays: 1,
  },
  integrations: {
    enableGoogleLogin: false,
    enableFacebookLogin: false,
  },
  invoice: {
    logo: "",
    address: "",
    footerText: "",
  },
  about: {
    storyTitle: DEFAULT_ABOUT_STORY_TITLE,
    storySubtitle: "",
    storyContent: DEFAULT_ABOUT_STORY_CONTENT,
    cards: [...DEFAULT_ABOUT_CARDS],
    stat1Value: "99.9%",
    stat1Label: "Uptime Guarantee",
    stat2Value: "50K+",
    stat2Label: "Active Merchants",
    stat3Value: "24/7",
    stat3Label: "Premium Support",
  },
  courier: {
    providerName: "",
    apiBaseUrl: "",
    enabled: true,
    apiToken: "",
    apiKey: "",
    apiSecret: "",
    consignmentPath: "/consignments",
    trackingPath: "/track",
    labelPath: "/label",
    timeoutMs: 12000,
  },
  couriers: normalizeCourierMap(),
  shipping: {
    outsideDhakaShippingCost: 0,
  },
  locations: {
    cityOptions: [],
    subCityOptions: [],
  },
  storefront: {
    showCategoryMarquee: true,
    showBrandMarquee: true,
    marketLabel: "Bangladesh store",
    categoryRailEyebrow: "Shop by Category",
    categoryRailTitle: "All Departments",
    categoryRailButtonLabel: "Explore catalog",
    heroFallbackTitle: "{storeName} deals built for Bangladesh shoppers",
    heroFallbackDescription:
      "Organize campaigns, categories, and product discovery in a stronger store landing flow.",
    heroPrimaryLabel: "Shop campaign",
    heroSecondaryLabel: "Browse all products",
    sidebarControlEyebrow: "Store control",
    sidebarControlTitle: "Shop by stock, not guesswork",
    sidebarControlDescription:
      "Orders reserve stock, purchases increase stock, and public stock remains optional per product.",
    sidebarControlButtonLabel: "Open storefront",
    discoveryEyebrow: "Top discovery lanes",
    highlightsEyebrow: "Store Highlights",
    highlightsTitle: "{storeName} shopping channels built for fast browsing",
    highlightsDescription:
      "Bring campaign-style discovery, category-led shelves, and strong stock visibility into one storefront flow.",
    flashEyebrow: "Flash Picks",
    flashTitle: "Deal-driven shelves inspired by global marketplaces",
    flashDescription:
      "Build home discovery around campaigns, category lanes, and clear price states without breaking your current commerce wiring.",
    flashPrimaryLabel: "Open shop",
    flashSecondaryLabel: "Open dashboard",
    trustEyebrow: "Buyer trust",
    trustBullets: [...DEFAULT_STOREFRONT_TRUST_BULLETS],
    topCategoriesEyebrow: "Top categories",
    dealsEyebrow: "Limited-price shelves",
    dealsTitle: "Flash deal picks",
    dealsButtonLabel: "See all",
    categoryFloorEyebrow: "Category channel",
    categoryFloorDescription:
      "Discover the main shelf, active stock, and featured products in this category.",
    categoryFloorButtonLabel: "Browse category",
    categoryFloorPanelButtonLabel: "Shop now",
    recommendedEyebrow: "Recommended shelf",
    recommendedTitle: "New arrivals for the store",
    recommendedButtonLabel: "View catalog",
    catalogTitle: DEFAULT_CATALOG_TITLE,
    catalogDescription: DEFAULT_CATALOG_DESCRIPTION,
    footerCaption: "Built for Bangladesh ecommerce operations",
    navQuickLinks: cloneNavLinks(),
  },
  seoAnalytics: {
    hasExplicitEntries: false,
    pages: {
      home: {
        metaTitle: "",
        metaDescription: "",
        metaKeywords: "",
        openGraphImage: "",
        facebookPixelId: "",
        googleAnalyticsId: "",
        ga4MeasurementId: "",
      },
      shop: {
        metaTitle: "",
        metaDescription: "",
        metaKeywords: "",
        openGraphImage: "",
        facebookPixelId: "",
        googleAnalyticsId: "",
        ga4MeasurementId: "",
      },
      cart: {
        metaTitle: "",
        metaDescription: "",
        metaKeywords: "",
        openGraphImage: "",
        facebookPixelId: "",
        googleAnalyticsId: "",
        ga4MeasurementId: "",
      },
      checkout: {
        metaTitle: "",
        metaDescription: "",
        metaKeywords: "",
        openGraphImage: "",
        facebookPixelId: "",
        googleAnalyticsId: "",
        ga4MeasurementId: "",
      },
      productDetails: {
        metaTitle: "",
        metaDescription: "",
        metaKeywords: "",
        openGraphImage: "",
        facebookPixelId: "",
        googleAnalyticsId: "",
        ga4MeasurementId: "",
      },
    },
    products: [],
    global: {
      facebookPixelId: "",
      googleAnalyticsId: "",
      ga4MeasurementId: "",
      gtmId: "",
      customTrackingCode: "",
      enableDataLayer: true,
    },
    entries: [],
    sitemap: {
      autoIntegrate: true,
      lastGeneratedAt: "",
      publicSitemapUrl: "",
      publicRobotsUrl: "",
    },
  },
};

let inMemorySettings = null;
let inMemoryTimestamp = 0;

const normalizeLogoMode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase() === "text"
    ? "text"
    : "image";

const mergeSettings = (incoming = {}) => {
  const normalizedMarketplaceMode = DEFAULT_MARKETPLACE_MODE;
  const publicStockSummarySource =
    incoming?.publicStockSummaryEnabled === undefined
      ? incoming?.marketplace?.publicStockSummaryEnabled
      : incoming.publicStockSummaryEnabled;
  const publicStockSummaryEnabled = Boolean(publicStockSummarySource);
  const publicStockCategoryIds = normalizeIdList(
    incoming?.publicStockCategoryIds !== undefined
      ? incoming.publicStockCategoryIds
      : incoming?.marketplace?.publicStockCategoryIds,
  );

  return {
    ...DEFAULT_SETTINGS,
    ...incoming,
    isInitialSetup: Boolean(incoming?.isInitialSetup),
    marketplaceMode: normalizedMarketplaceMode,
    publicStockSummaryEnabled,
    publicStockCategoryIds,
    marketplace: {
      ...DEFAULT_SETTINGS.marketplace,
      ...(incoming.marketplace || {}),
      marketplaceMode: normalizedMarketplaceMode,
      publicStockSummaryEnabled,
      publicStockCategoryIds,
    },
    seo: {
      ...DEFAULT_SETTINGS.seo,
      ...(incoming.seo || {}),
      metaTitle: String(
        incoming?.seo?.metaTitle || incoming?.seo?.title || "",
      ).trim(),
      metaDescription: String(
        incoming?.seo?.metaDescription || incoming?.seo?.description || "",
      ).trim(),
      metaKeywords: String(
        incoming?.seo?.metaKeywords || incoming?.seo?.keywords || "",
      ).trim(),
      openGraphImage: String(
        incoming?.seo?.openGraphImage ||
          incoming?.seo?.ogImage ||
          incoming?.seo?.image ||
          "",
      ).trim(),
    },
    website: {
      ...DEFAULT_SETTINGS.website,
      ...(incoming.website || {}),
      logoMode: normalizeLogoMode(incoming?.website?.logoMode),
      logoText: String(incoming?.website?.logoText || "").trim(),
      logoUrl: String(incoming?.website?.logoUrl || "").trim(),
      headerIconUrl: String(
        incoming?.website?.headerIconUrl || incoming?.website?.headerIcon || "",
      ).trim(),
      useLogoAsHeaderIcon: Boolean(incoming?.website?.useLogoAsHeaderIcon),
      siteUrl: String(
        incoming?.website?.siteUrl || incoming?.website?.storeUrl || "",
      )
        .trim()
        .replace(/\/+$/, ""),
      storeUrl: String(
        incoming?.website?.storeUrl || incoming?.website?.siteUrl || "",
      )
        .trim()
        .replace(/\/+$/, ""),
      buttonTextColor: String(
        incoming?.website?.buttonTextColor || "#ffffff",
      ).trim(),
    },
    contact: { ...DEFAULT_SETTINGS.contact, ...(incoming.contact || {}) },
    social: { ...DEFAULT_SETTINGS.social, ...(incoming.social || {}) },
    policies: {
      ...DEFAULT_SETTINGS.policies,
      ...(incoming.policies || {}),
      cancellationWindowDays: Number.isFinite(
        parseInt(incoming?.policies?.cancellationWindowDays, 10),
      )
        ? Math.max(0, parseInt(incoming?.policies?.cancellationWindowDays, 10))
        : 1,
    },
    integrations: {
      ...DEFAULT_SETTINGS.integrations,
      ...(incoming.integrations || {}),
      enableGoogleLogin: Boolean(incoming?.integrations?.enableGoogleLogin),
      enableFacebookLogin: Boolean(incoming?.integrations?.enableFacebookLogin),
    },
    invoice: { ...DEFAULT_SETTINGS.invoice, ...(incoming.invoice || {}) },
    about: {
      ...DEFAULT_SETTINGS.about,
      ...(incoming.about || {}),
      storyTitle:
        String(incoming?.about?.storyTitle || "").trim() ||
        DEFAULT_ABOUT_STORY_TITLE,
      storySubtitle: String(incoming?.about?.storySubtitle || "").trim(),
      storyContent:
        String(incoming?.about?.storyContent || "").trim() ||
        DEFAULT_ABOUT_STORY_CONTENT,
      cards: normalizeAboutCards(incoming?.about?.cards || DEFAULT_ABOUT_CARDS),
      stat1Value: String(incoming?.about?.stat1Value || "").trim() || "99.9%",
      stat1Label:
        String(incoming?.about?.stat1Label || "").trim() || "Uptime Guarantee",
      stat2Value: String(incoming?.about?.stat2Value || "").trim() || "50K+",
      stat2Label:
        String(incoming?.about?.stat2Label || "").trim() || "Active Merchants",
      stat3Value: String(incoming?.about?.stat3Value || "").trim() || "24/7",
      stat3Label:
        String(incoming?.about?.stat3Label || "").trim() || "Premium Support",
    },
    courier: { ...DEFAULT_SETTINGS.courier, ...(incoming.courier || {}) },
    couriers: normalizeCourierMap(incoming.couriers || {}),
    shipping: {
      ...DEFAULT_SETTINGS.shipping,
      ...(incoming.shipping || {}),
      outsideDhakaShippingCost: Math.max(
        0,
        Number(incoming?.shipping?.outsideDhakaShippingCost || 0),
      ),
    },
    locations: {
      ...DEFAULT_SETTINGS.locations,
      ...(incoming.locations || {}),
      cityOptions: Array.isArray(incoming?.locations?.cityOptions)
        ? incoming.locations.cityOptions
        : DEFAULT_SETTINGS.locations.cityOptions,
      subCityOptions: Array.isArray(incoming?.locations?.subCityOptions)
        ? incoming.locations.subCityOptions
        : DEFAULT_SETTINGS.locations.subCityOptions,
    },
    storefront: {
      ...DEFAULT_SETTINGS.storefront,
      ...(incoming.storefront || {}),
      catalogTitle: normalizeStorefrontText(
        incoming?.storefront?.catalogTitle,
        DEFAULT_SETTINGS.storefront.catalogTitle,
        [LEGACY_CATALOG_TITLE],
      ),
      catalogDescription: normalizeStorefrontText(
        incoming?.storefront?.catalogDescription,
        DEFAULT_SETTINGS.storefront.catalogDescription,
        [LEGACY_CATALOG_DESCRIPTION],
      ),
      trustBullets: normalizeStringList(
        incoming?.storefront?.trustBullets,
        DEFAULT_STOREFRONT_TRUST_BULLETS,
      ),
      navQuickLinks: normalizeStorefrontNavLinks(
        incoming?.storefront?.navQuickLinks,
      ),
    },
    seoAnalytics: {
      ...DEFAULT_SETTINGS.seoAnalytics,
      ...normalizeMarketingSettings(incoming),
    },
  };
};

const readCache = () => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.settings || !parsed?.timestamp) return null;

    if (Date.now() - Number(parsed.timestamp) > CACHE_MAX_AGE_MS) {
      return null;
    }

    return mergeSettings(parsed.settings);
  } catch {
    return null;
  }
};

const writeCache = (settings) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        settings,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // ignore cache write issues
  }
};

export const fetchPublicSettings = async ({ force = false } = {}) => {
  if (
    !force &&
    inMemorySettings &&
    Date.now() - inMemoryTimestamp < CACHE_MAX_AGE_MS
  ) {
    return inMemorySettings;
  }

  if (!force) {
    const cached = readCache();
    if (cached) {
      inMemorySettings = cached;
      inMemoryTimestamp = Date.now();
      return cached;
    }
  }

  try {
    const response = await axios.get(`${baseUrl}/auth/public/settings`, {
      timeout: 8000,
    });

    const settings = mergeSettings(response.data?.settings || {});
    inMemorySettings = settings;
    inMemoryTimestamp = Date.now();
    writeCache(settings);
    return settings;
  } catch {
    const fallback = mergeSettings();
    inMemorySettings = fallback;
    inMemoryTimestamp = Date.now();
    return fallback;
  }
};

export const normalizePublicSettingsPayload = (payload = {}) =>
  mergeSettings(payload);

export const getDefaultPublicSettings = () => mergeSettings();

export const primePublicSettingsCache = (settings) => {
  const normalized = mergeSettings(settings || {});
  inMemorySettings = normalized;
  inMemoryTimestamp = Date.now();
  writeCache(normalized);
  return normalized;
};

export const broadcastPublicSettingsUpdated = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UPDATE_SIGNAL_KEY, String(Date.now()));
  } catch {
    // ignore update signal issues
  }
  window.dispatchEvent(new CustomEvent("publicSettingsUpdated"));
};

export const invalidatePublicSettingsCache = () => {
  inMemorySettings = null;
  inMemoryTimestamp = 0;

  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore cache reset issues
  }
};

export const toPublicAssetUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return baseUrl ? `${baseUrl}${raw}` : raw;
  }

  return baseUrl ? `${baseUrl}/${raw.replace(/^\/+/, "")}` : raw;
};

let defaultDocumentTitle = "";
let defaultFaviconHref = "";

export const resolveWebsiteIconValue = (website = {}) => {
  if (website?.useLogoAsHeaderIcon) {
    return String(website?.logoUrl || "").trim();
  }

  return String(website?.headerIconUrl || website?.headerIcon || "").trim();
};

export const resolveWebsiteIconUrl = (website = {}) =>
  toPublicAssetUrl(resolveWebsiteIconValue(website));

export const formatDocumentTitle = (
  settingsOrStoreName = "",
  pageTitle = "",
) => {
  const resolvedStoreName =
    typeof settingsOrStoreName === "string"
      ? settingsOrStoreName
      : settingsOrStoreName?.website?.storeName;
  const storeName =
    String(resolvedStoreName || defaultDocumentTitle || "E-Commerce").trim() ||
    "E-Commerce";
  const resolvedPageTitle = String(pageTitle || "").trim();

  return resolvedPageTitle ? `${storeName} - ${resolvedPageTitle}` : storeName;
};

export const applyPublicSettingsDocument = (settings = {}) => {
  if (typeof document === "undefined") return;

  const website = settings?.website || {};

  if (!defaultDocumentTitle) {
    defaultDocumentTitle =
      String(document.title || "E-Commerce").trim() || "E-Commerce";
  }

  if (!defaultFaviconHref) {
    defaultFaviconHref =
      document
        .querySelector("link[data-website-favicon='true']")
        ?.getAttribute("href") || "/vite.png";
  }

  const resolvedIcon =
    resolveWebsiteIconUrl(website) || defaultFaviconHref || "/vite.png";
  let faviconLink = document.querySelector("link[data-website-favicon='true']");

  if (!faviconLink) {
    faviconLink = document.createElement("link");
    faviconLink.setAttribute("rel", "icon");
    faviconLink.setAttribute("data-website-favicon", "true");
    document.head.appendChild(faviconLink);
  }

  faviconLink.setAttribute("rel", "icon");
  faviconLink.setAttribute("href", resolvedIcon);
};
