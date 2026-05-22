const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const axios = require("axios");
const validator = require("validator");
const User = require("../models/User");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Purchase = require("../models/Purchase");
const AbandonedOrder = require("../models/AbandonedOrder");
const { AccountEntry } = require("../models/AccountEntry");
const { uploadImageBuffer, deleteImage } = require("../config/cloudinary");
const { clearResponseCacheByPrefix } = require("../middlewares/responseCache");
const { getRiskLevel } = require("../utils/customerRiskUtils");
const {
  authenticateNotificationToken,
  broadcastNotificationDeleted,
  broadcastNotificationRead,
  broadcastNotificationsCleared,
  broadcastNotificationsReadAll,
  registerNotificationClient,
  serializeNotification,
  writeSseEvent,
} = require("../utils/notificationUtils");
const { normalizeSeoSettings } = require("../services/seoService");
const { normalizeAnalyticsSettings } = require("../services/analyticsService");
const { normalizeCourierMap } = require("../services/courierService");
const {
  normalizeSeoAnalyticsSettings,
} = require("../services/seoAnalyticsService");
const {
  generateSitemapArtifacts,
  resolveApiBaseUrl,
  resolveStorefrontBaseUrl,
  syncStorefrontRobotsFile,
} = require("../services/sitemapService");

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

const sendEmail = async (mailOptions) => {
  const transporter = createTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      ...mailOptions,
    });
  } catch (error) {
    // Email failure should not block auth flows.
    console.warn("Email send skipped:", error.message);
  }
};

const isAdmin = (user) =>
  String(user?.userType || "").toLowerCase() === "admin";

const isSuperAdmin = (user) => {
  if (!isAdmin(user)) return false;
  return user?.adminSettings?.isSuperAdmin === true;
};

const hasAdminPermission = (user, key) => {
  if (!isAdmin(user)) return false;
  const permissions =
    user?.adminSettings?.permissions &&
    typeof user.adminSettings.permissions === "object"
      ? user.adminSettings.permissions
      : null;

  if (!permissions) return true;

  const hasAnyConfigured = ADMIN_PERMISSION_KEYS.some((permissionKey) =>
    Object.prototype.hasOwnProperty.call(permissions, permissionKey),
  );
  if (!hasAnyConfigured) return true;

  return Boolean(permissions[key]);
};

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const classifyRiskLevel = (
  successRate,
  totalOrders,
  isBlacklisted = false,
  cancelledOrders = 0,
  returnedOrders = 0,
) =>
  getRiskLevel({
    successRate,
    totalOrders,
    isBlacklisted,
    cancelledOrders,
    returnedOrders,
  });

const roundMoney = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

const safeString = (value) => String(value || "").trim();

const normalizeStringList = (value) => {
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

  return Array.from(uniqueValues);
};

const normalizeIdList = (value) => {
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

  return Array.from(uniqueValues);
};

const MAX_ADDRESS_BOOK_ITEMS = 10;

const normalizeAddressBookEntry = (value = {}) => {
  const payload =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const recipientName = String(payload.recipientName || "").trim();
  const phone = User.normalizePhone(String(payload.phone || "").trim());
  const alternativePhoneRaw = String(payload.alternativePhone || "").trim();
  const alternativePhone = alternativePhoneRaw
    ? User.normalizePhone(alternativePhoneRaw)
    : "";
  const address = String(payload.address || "").trim();
  const city = String(payload.city || "").trim();
  const subCity = String(payload.subCity || "").trim();
  const district = String(payload.district || "").trim();
  const postalCode = String(payload.postalCode || "").trim();
  const country =
    String(payload.country || "Bangladesh").trim() || "Bangladesh";
  const label = String(payload.label || "Home").trim() || "Home";
  const deliveryNotes = String(payload.deliveryNotes || "").trim();

  if (!recipientName) {
    throw new Error("Recipient name is required");
  }

  if (!User.validateBangladeshiPhone(phone)) {
    throw new Error("Valid Bangladesh phone number is required");
  }

  if (alternativePhone && !User.validateBangladeshiPhone(alternativePhone)) {
    throw new Error(
      "Alternative phone must be a valid Bangladesh phone number",
    );
  }

  if (!address || !city || !district || !postalCode) {
    throw new Error("Address, city, district, and postal code are required");
  }

  return {
    label,
    recipientName,
    phone,
    alternativePhone,
    address,
    city,
    subCity,
    district,
    postalCode,
    country,
    deliveryNotes,
    isDefault: Boolean(payload.isDefault),
  };
};

const syncDefaultAddressBook = (entries = [], preferredId = "") => {
  const addressBook = Array.isArray(entries) ? entries : [];
  if (addressBook.length === 0) return [];

  let defaultTargetId = String(preferredId || "").trim();

  if (!defaultTargetId) {
    const existingDefault = addressBook.find((entry) => entry?.isDefault);
    defaultTargetId = String(existingDefault?._id || "");
  }

  if (!defaultTargetId) {
    defaultTargetId = String(addressBook[0]?._id || "");
  }

  addressBook.forEach((entry) => {
    if (!entry) return;
    entry.isDefault = String(entry._id || "") === defaultTargetId;
  });

  return addressBook;
};

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
  "Browse categories, compare pricing options, and discover curated deals across the marketplace.";
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
const DEFAULT_ABOUT_STORY_TITLE = "Our Story";
const DEFAULT_ABOUT_STORY_CONTENT =
  "<p>E-Commerce was shaped to close the gap between a basic online catalog and a serious ecommerce operation with stronger discovery, cleaner checkout, and tighter inventory-aware storefront control.</p><p>The platform brings products, banners, categories, support, compare flows, wishlist behavior, and branded landing content into one polished office ecommerce system.</p><p>Our mission is simple: give shoppers a smoother buying journey while giving operators stronger control over stock, pricing, orders, and storefront presentation.</p>";
const DEFAULT_ABOUT_CARDS = [
  {
    icon: "truck",
    iconColor: "#ffffff",
    backgroundColor: "#2563eb",
    title: "Fast Shipping",
    description: "<p>Quick delivery windows and a smoother order handoff.</p>",
  },
  {
    icon: "shield",
    iconColor: "#ffffff",
    backgroundColor: "#16a34a",
    title: "Secure Payment",
    description:
      "<p>Protected checkout flow with clearer payment handling.</p>",
  },
  {
    icon: "refresh",
    iconColor: "#ffffff",
    backgroundColor: "#7c3aed",
    title: "Easy Returns",
    description:
      "<p>Clear policies and a more reliable post-purchase flow.</p>",
  },
  {
    icon: "package",
    iconColor: "#ffffff",
    backgroundColor: "#d97706",
    title: "Quality Products",
    description:
      "<p>Catalog, stock, and order controls built for dependable selling.</p>",
  },
];

const normalizeStorefrontNavLinks = (value) => {
  if (!Array.isArray(value)) {
    return DEFAULT_STOREFRONT_NAV_LINKS.map((entry) => ({ ...entry }));
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
  return items.length > 0
    ? items
    : DEFAULT_STOREFRONT_NAV_LINKS.map((entry) => ({ ...entry }));
};

const normalizeStorefrontText = (value, fallback, legacyValues = []) => {
  const normalized = String(value || "").trim();
  if (!normalized || legacyValues.includes(normalized)) {
    return fallback;
  }
  return normalized;
};

const normalizeStorefrontSettings = (value = {}) => {
  const storefront = isPlainObject(value) ? value : {};
  const trustBullets = normalizeStringList(storefront.trustBullets || []);

  return {
    showCategoryMarquee:
      storefront.showCategoryMarquee === undefined
        ? true
        : Boolean(storefront.showCategoryMarquee),
    showBrandMarquee:
      storefront.showBrandMarquee === undefined
        ? true
        : Boolean(storefront.showBrandMarquee),
    marketLabel: String(
      storefront.marketLabel || "Bangladesh marketplace",
    ).trim(),
    categoryRailEyebrow: String(
      storefront.categoryRailEyebrow || "Shop by Category",
    ).trim(),
    categoryRailTitle: String(
      storefront.categoryRailTitle || "All Departments",
    ).trim(),
    categoryRailButtonLabel: String(
      storefront.categoryRailButtonLabel || "Explore marketplace",
    ).trim(),
    heroFallbackTitle: String(
      storefront.heroFallbackTitle ||
        "{storeName} deals built for Bangladesh shoppers",
    ).trim(),
    heroFallbackDescription: String(
      storefront.heroFallbackDescription ||
        "Organize campaigns, categories, and product discovery in a stronger marketplace-style landing flow.",
    ).trim(),
    heroPrimaryLabel: String(
      storefront.heroPrimaryLabel || "Shop campaign",
    ).trim(),
    heroSecondaryLabel: String(
      storefront.heroSecondaryLabel || "Browse all products",
    ).trim(),
    sidebarControlEyebrow: String(
      storefront.sidebarControlEyebrow || "Marketplace control",
    ).trim(),
    sidebarControlTitle: String(
      storefront.sidebarControlTitle || "Shop by stock, not guesswork",
    ).trim(),
    sidebarControlDescription: String(
      storefront.sidebarControlDescription ||
        "Orders reserve stock, purchases increase stock, and public stock remains optional per product.",
    ).trim(),
    sidebarControlButtonLabel: String(
      storefront.sidebarControlButtonLabel || "Open storefront",
    ).trim(),
    discoveryEyebrow: String(
      storefront.discoveryEyebrow || "Top discovery lanes",
    ).trim(),
    highlightsEyebrow: String(
      storefront.highlightsEyebrow || "Marketplace Highlights",
    ).trim(),
    highlightsTitle: String(
      storefront.highlightsTitle ||
        "{storeName} shopping channels built for fast browsing",
    ).trim(),
    highlightsDescription: String(
      storefront.highlightsDescription ||
        "Bring campaign-style discovery, category-led shelves, and strong stock visibility into one marketplace flow.",
    ).trim(),
    flashEyebrow: String(storefront.flashEyebrow || "Flash Picks").trim(),
    flashTitle: String(
      storefront.flashTitle ||
        "Deal-driven shelves inspired by global marketplaces",
    ).trim(),
    flashDescription: String(
      storefront.flashDescription ||
        "Build home discovery around campaigns, category lanes, and clear price states without breaking your current commerce wiring.",
    ).trim(),
    flashPrimaryLabel: String(
      storefront.flashPrimaryLabel || "Open shop",
    ).trim(),
    flashSecondaryLabel: String(
      storefront.flashSecondaryLabel || "Open dashboard",
    ).trim(),
    trustEyebrow: String(storefront.trustEyebrow || "Buyer trust").trim(),
    trustBullets:
      trustBullets.length > 0
        ? trustBullets
        : [...DEFAULT_STOREFRONT_TRUST_BULLETS],
    topCategoriesEyebrow: String(
      storefront.topCategoriesEyebrow || "Top categories",
    ).trim(),
    dealsEyebrow: String(
      storefront.dealsEyebrow || "Limited-price shelves",
    ).trim(),
    dealsTitle: String(storefront.dealsTitle || "Flash deal picks").trim(),
    dealsButtonLabel: String(storefront.dealsButtonLabel || "See all").trim(),
    categoryFloorEyebrow: String(
      storefront.categoryFloorEyebrow || "Category channel",
    ).trim(),
    categoryFloorDescription: String(
      storefront.categoryFloorDescription ||
        "Discover the main shelf, active stock, and featured products in this category.",
    ).trim(),
    categoryFloorButtonLabel: String(
      storefront.categoryFloorButtonLabel || "Browse category",
    ).trim(),
    categoryFloorPanelButtonLabel: String(
      storefront.categoryFloorPanelButtonLabel || "Shop now",
    ).trim(),
    recommendedEyebrow: String(
      storefront.recommendedEyebrow || "Recommended shelf",
    ).trim(),
    recommendedTitle: String(
      storefront.recommendedTitle || "New arrivals for the marketplace",
    ).trim(),
    recommendedButtonLabel: String(
      storefront.recommendedButtonLabel || "View catalog",
    ).trim(),
    catalogTitle: normalizeStorefrontText(
      storefront.catalogTitle,
      DEFAULT_CATALOG_TITLE,
      [LEGACY_CATALOG_TITLE],
    ),
    catalogDescription: normalizeStorefrontText(
      storefront.catalogDescription,
      DEFAULT_CATALOG_DESCRIPTION,
      [LEGACY_CATALOG_DESCRIPTION],
    ),
    footerCaption: String(
      storefront.footerCaption || "Built for Bangladesh marketplace operations",
    ).trim(),
    navQuickLinks: normalizeStorefrontNavLinks(storefront.navQuickLinks),
  };
};

const normalizeAboutCards = (value = []) => {
  const cards = Array.isArray(value) ? value : [];

  return cards
    .map((card, index) => {
      const fallback =
        DEFAULT_ABOUT_CARDS[index] ||
        DEFAULT_ABOUT_CARDS[DEFAULT_ABOUT_CARDS.length - 1];
      const icon = String(card?.icon || card?.iconKey || fallback.icon)
        .trim()
        .toLowerCase();
      const title = String(card?.title || fallback.title).trim();
      const description = String(
        card?.description || fallback.description,
      ).trim();
      const iconColor =
        String(card?.iconColor || fallback.iconColor).trim() ||
        fallback.iconColor;
      const backgroundColor =
        String(
          card?.backgroundColor ||
            fallback.backgroundColor ||
            (String(card?.color || "")
              .toLowerCase()
              .includes("blue")
              ? "#2563eb"
              : String(card?.color || "")
                    .toLowerCase()
                    .includes("green")
                ? "#16a34a"
                : String(card?.color || "")
                      .toLowerCase()
                      .includes("purple")
                  ? "#7c3aed"
                  : String(card?.color || "")
                        .toLowerCase()
                        .includes("amber") ||
                      String(card?.color || "")
                        .toLowerCase()
                        .includes("yellow")
                    ? "#d97706"
                    : "#111827"),
        ).trim() || fallback.backgroundColor;

      if (!title && !description) {
        return null;
      }

      return {
        icon: [
          "truck",
          "shield",
          "refresh",
          "package",
          "message",
          "clock",
          "heart",
          "star",
        ].includes(icon)
          ? icon
          : fallback.icon,
        iconColor,
        backgroundColor,
        title: title || fallback.title,
        description: description || fallback.description,
      };
    })
    .filter(Boolean)
    .slice(0, 4);
};

const normalizeAboutSettings = (value = {}) => {
  const about = isPlainObject(value) ? value : {};

  return {
    storyTitle:
      String(about.storyTitle || "").trim() || DEFAULT_ABOUT_STORY_TITLE,
    storySubtitle: String(about.storySubtitle || "").trim(),
    storyContent:
      String(about.storyContent || "").trim() || DEFAULT_ABOUT_STORY_CONTENT,
    cards: normalizeAboutCards(about.cards || DEFAULT_ABOUT_CARDS),
    stat1Value: String(about.stat1Value || "").trim() || "99.9%",
    stat1Label: String(about.stat1Label || "").trim() || "Uptime Guarantee",
    stat2Value: String(about.stat2Value || "").trim() || "50K+",
    stat2Label: String(about.stat2Label || "").trim() || "Active Merchants",
    stat3Value: String(about.stat3Value || "").trim() || "24/7",
    stat3Label: String(about.stat3Label || "").trim() || "Premium Support",
  };
};

const ACCOUNT_INCOME_TYPES = new Set(["income", "adjustment"]);
const ACCOUNT_EXPENSE_TYPES = new Set([
  "expense",
  "salary",
  "bill",
  "payout",
  "fund_transfer",
]);
const ALLOWED_USER_TYPES = new Set(["admin", "user"]);
const ALLOWED_USER_STATUSES = new Set([
  "active",
  "pending",
  "inactive",
  "suspended",
]);
const ADMIN_PERMISSION_KEYS = [
  "manageOrders",
  "manageProducts",
  "manageUsers",
  "manageReports",
  "manageWebsite",
];
const buildAdminPermissions = (enabled = false) =>
  ADMIN_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(enabled);
    return acc;
  }, {});
const SOCIAL_PROVIDER_MAP = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    envClientId: "GOOGLE_CLIENT_ID",
    envClientSecret: "GOOGLE_CLIENT_SECRET",
    envRedirectUri: "GOOGLE_REDIRECT_URI",
    settingsKey: "enableGoogleLogin",
    scope: "openid email profile",
  },
  facebook: {
    authUrl: "https://www.facebook.com/v20.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v20.0/oauth/access_token",
    profileUrl: "https://graph.facebook.com/me",
    envClientId: "FACEBOOK_APP_ID",
    envClientSecret: "FACEBOOK_APP_SECRET",
    envRedirectUri: "FACEBOOK_REDIRECT_URI",
    settingsKey: "enableFacebookLogin",
    scope: "email,public_profile",
  },
};

const normalizeMarketplaceMode = (value) => {
  const mode = String(value || "")
    .trim()
    .toLowerCase();
  return mode === "multi" ? "multi" : "single";
};

const normalizeWebsiteLogoMode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase() === "text"
    ? "text"
    : "image";

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

const normalizeWebsiteUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/\/+$/, "");
};

const normalizeWebsiteSettings = (
  value = {},
  { includePrivate = false } = {},
) => {
  const website = isPlainObject(value) ? value : {};

  return {
    storeName: String(website.storeName || "E-Commerce").trim(),
    tagline: String(website.tagline || "").trim(),
    logoMode: normalizeWebsiteLogoMode(website.logoMode),
    logoText: String(website.logoText || "").trim(),
    logoUrl: String(website.logoUrl || "").trim(),
    headerIconUrl: String(
      website.headerIconUrl || website.headerIcon || "",
    ).trim(),
    useLogoAsHeaderIcon: Boolean(website.useLogoAsHeaderIcon),
    siteUrl: normalizeWebsiteUrl(website.siteUrl || website.storeUrl),
    storeUrl: normalizeWebsiteUrl(website.storeUrl || website.siteUrl),
    themeColor: normalizeHexColor(website.themeColor, "#000000"),
    buttonTextColor: normalizeHexColor(website.buttonTextColor, "#ffffff"),
    fontFamily: String(website.fontFamily || "inherit").trim() || "inherit",
    ...(includePrivate
      ? {
          logoPublicId: String(website.logoPublicId || "").trim(),
          headerIconPublicId: String(website.headerIconPublicId || "").trim(),
        }
      : {}),
  };
};

const PRIMARY_ADMIN_SORT = {
  createdAt: 1,
  _id: 1,
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getPrimaryAdminSettings = async () => {
  const primaryAdmin = await User.findOne({ userType: "admin" })
    .sort(PRIMARY_ADMIN_SORT)
    .select("adminSettings")
    .lean();
  return primaryAdmin?.adminSettings || {};
};

const getPrimaryAdminUser = async () =>
  User.findOne({ userType: "admin" })
    .sort(PRIMARY_ADMIN_SORT)
    .select("adminSettings");

const mergeSettingsSection = (currentSettings = {}, incoming = {}, key) => {
  const currentValue = isPlainObject(currentSettings?.[key])
    ? currentSettings[key]
    : {};
  const incomingValue = isPlainObject(incoming?.[key]) ? incoming[key] : {};
  return {
    ...currentValue,
    ...incomingValue,
  };
};

const PUBLIC_SETTINGS_CACHE_TTL_MS = Math.max(
  1000,
  Number(process.env.PUBLIC_SETTINGS_CACHE_TTL_MS || 60000),
);
const DEFAULT_MARKETPLACE_MODE = "single";

let publicSettingsCache = {
  value: null,
  expiresAt: 0,
};

const clearPublicSettingsCache = () => {
  publicSettingsCache = {
    value: null,
    expiresAt: 0,
  };
  clearResponseCacheByPrefix("/api/auth/public/settings");
};

const readMarketplaceControl = (settings = {}) => {
  const marketplace = isPlainObject(settings?.marketplace)
    ? settings.marketplace
    : {};
  const marketplaceMode = DEFAULT_MARKETPLACE_MODE;
  const explicitPublicStockSummary =
    marketplace.publicStockSummaryEnabled === undefined
      ? settings.publicStockSummaryEnabled
      : marketplace.publicStockSummaryEnabled;
  const publicStockSummaryEnabled = Boolean(explicitPublicStockSummary);

  return {
    marketplaceMode,
    publicStockSummaryEnabled,
  };
};

const buildPublicSettingsPayload = (
  settings = {},
  { isInitialSetup = false } = {},
) => {
  const contact = settings?.contact || {};
  const social = settings?.social || {};
  const policies = settings?.policies || {};
  const integrations = settings?.integrations || {};
  const seo = settings?.seo || {};
  const website = settings?.website || {};
  const invoice = settings?.invoice || {};
  const about = settings?.about || {};
  const courier = settings?.courier || {};
  const couriers = settings?.couriers || {};
  const shipping = settings?.shipping || {};
  const locations = settings?.locations || {};
  const storefront = settings?.storefront || {};
  const normalizedWebsite = normalizeWebsiteSettings(website);
  const normalizedSeoAnalytics = normalizeSeoAnalyticsSettings({
    ...settings,
    website: normalizedWebsite,
    seo: normalizeSeoSettings(seo),
  });
  const publicSitemapUrl = safeString(resolveApiBaseUrl()).replace(/\/+$/, "")
    ? `${safeString(resolveApiBaseUrl()).replace(/\/+$/, "")}/sitemap.xml`
    : "";
  const publicRobotsUrl = `${resolveStorefrontBaseUrl({
    website: normalizedWebsite,
  })}/robots.txt`;
  const control = readMarketplaceControl(settings);
  const publicStockCategoryIds = normalizeIdList(
    settings?.publicStockCategoryIds ||
      settings?.marketplace?.publicStockCategoryIds ||
      [],
  );

  return {
    isInitialSetup: Boolean(isInitialSetup),
    marketplaceMode: control.marketplaceMode,
    publicStockSummaryEnabled: control.publicStockSummaryEnabled,
    publicStockCategoryIds,
    marketplace: {
      marketplaceMode: control.marketplaceMode,
      publicStockSummaryEnabled: control.publicStockSummaryEnabled,
      publicStockCategoryIds,
    },
    website: normalizedWebsite,
    contact: {
      address: String(contact.address || "").trim(),
      addressLink: String(contact.addressLink || "").trim(),
      phone1: String(contact.phone1 || "").trim(),
      phone2: String(contact.phone2 || "").trim(),
      email: String(contact.email || "").trim(),
    },
    social: {
      facebook: String(social.facebook || "").trim(),
      whatsapp: String(social.whatsapp || "").trim(),
      instagram: String(social.instagram || "").trim(),
      youtube: String(social.youtube || "").trim(),
    },
    policies: {
      shipmentPolicy: String(policies.shipmentPolicy || "").trim(),
      deliveryPolicy: String(policies.deliveryPolicy || "").trim(),
      termsConditions: String(policies.termsConditions || "").trim(),
      returnPolicy: String(policies.returnPolicy || "").trim(),
      privacyPolicy: String(policies.privacyPolicy || "").trim(),
      cancellationPolicy: String(policies.cancellationPolicy || "").trim(),
      cancellationWindowDays: Number.isFinite(
        parseInt(policies.cancellationWindowDays, 10),
      )
        ? Math.max(0, parseInt(policies.cancellationWindowDays, 10))
        : 1,
    },
    seo: normalizeSeoSettings(seo),
    integrations: normalizeAnalyticsSettings(integrations),
    invoice: {
      logo: String(invoice.logo || "").trim(),
      address: String(invoice.address || "").trim(),
      footerText: String(invoice.footerText || "").trim(),
    },
    about: normalizeAboutSettings(about),
    courier: {
      providerName: String(courier.providerName || "").trim(),
      apiBaseUrl: String(courier.apiBaseUrl || "").trim(),
    },
    couriers: normalizeCourierMap(couriers),
    shipping: {
      outsideDhakaShippingCost: Math.max(
        0,
        Number(shipping.outsideDhakaShippingCost || 0),
      ),
    },
    locations: {
      cityOptions: normalizeStringList(locations.cityOptions || []),
      subCityOptions: normalizeStringList(locations.subCityOptions || []),
    },
    storefront: normalizeStorefrontSettings(storefront),
    seoAnalytics: {
      ...normalizedSeoAnalytics,
      sitemap: {
        ...normalizedSeoAnalytics.sitemap,
        publicSitemapUrl,
        publicRobotsUrl,
      },
    },
  };
};

const toSafeUser = (userDoc) => {
  if (!userDoc) return null;
  if (typeof userDoc.toSafeObject === "function") return userDoc.toSafeObject();

  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete user.password;
  delete user.tokens;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.notifications;
  user.phone = user.originalPhone || user.phone;
  return user;
};

const normalizeAdminPermissions = (value = {}) => {
  const source =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return ADMIN_PERMISSION_KEYS.reduce((acc, key) => {
    acc[key] = Boolean(source[key]);
    return acc;
  }, buildAdminPermissions(false));
};

const ensureAdminBootstrapFlags = async (userDoc) => {
  if (!isAdmin(userDoc)) return userDoc;

  const currentFlag = userDoc?.adminSettings?.isSuperAdmin;
  if (currentFlag === true || currentFlag === false) {
    return userDoc;
  }

  const primaryAdmin = await User.findOne({ userType: "admin" })
    .select("_id")
    .lean();
  const isPrimaryAdmin =
    primaryAdmin &&
    String(primaryAdmin._id || "") === String(userDoc?._id || "");

  userDoc.adminSettings = {
    ...(userDoc.adminSettings || {}),
    isSuperAdmin: Boolean(isPrimaryAdmin),
    permissions: normalizeAdminPermissions(
      userDoc?.adminSettings?.permissions ||
        (isPrimaryAdmin
          ? buildAdminPermissions(true)
          : buildAdminPermissions(false)),
    ),
  };
  await userDoc.save();
  return userDoc;
};

const getFrontendUrl = () =>
  String(process.env.FRONTEND_URL || "http://localhost:5173")
    .trim()
    .replace(/\/+$/, "");

const getSocialProviderConfig = async (providerKey) => {
  const provider = SOCIAL_PROVIDER_MAP[String(providerKey || "").toLowerCase()];
  if (!provider) {
    return { error: "Unsupported social login provider" };
  }

  const settings = await getPrimaryAdminSettings();
  const integrations = settings?.integrations || {};
  const isEnabled = Boolean(integrations[provider.settingsKey]);

  if (!isEnabled) {
    return { error: `${providerKey} login is disabled` };
  }

  const clientId = String(process.env[provider.envClientId] || "").trim();
  const clientSecret = String(
    process.env[provider.envClientSecret] || "",
  ).trim();
  const redirectUri = String(process.env[provider.envRedirectUri] || "").trim();

  if (!clientId || !clientSecret || !redirectUri) {
    return { error: `${providerKey} OAuth credentials are not configured` };
  }

  return {
    providerKey: String(providerKey).toLowerCase(),
    ...provider,
    clientId,
    clientSecret,
    redirectUri,
  };
};

const redirectSocialResult = (
  res,
  { token = "", provider = "", error = "" } = {},
) => {
  const targetUrl = new URL(`${getFrontendUrl()}/login`);
  targetUrl.searchParams.set("social", "1");

  if (provider) {
    targetUrl.searchParams.set("provider", String(provider).toLowerCase());
  }

  if (token) {
    targetUrl.searchParams.set("token", token);
  }

  if (error) {
    targetUrl.searchParams.set("socialError", String(error).slice(0, 260));
  }

  return res.redirect(targetUrl.toString());
};

const buildSocialDisplayName = (name, email) => {
  const normalizedName = String(name || "").trim();
  if (normalizedName) return normalizedName.slice(0, 120);
  return String(email || "Social User")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim()
    .slice(0, 120);
};

const generateUniqueSocialPhone = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = Math.floor(10000000 + Math.random() * 90000000);
    const candidate = `019${suffix}`;
    const exists = await User.findOne({ phone: candidate })
      .select("_id")
      .lean();
    if (!exists) return candidate;
  }
  throw new Error("Unable to generate a unique phone for social login");
};

const resolveSocialEmail = ({ email, provider, providerUserId }) => {
  const normalized = normalizeEmail(email);
  if (normalized) return normalized;
  return `${String(provider || "social").toLowerCase()}-${String(providerUserId || Date.now())}@social.example.com`;
};

const resolveOrCreateSocialUser = async ({
  email,
  name,
  provider,
  providerUserId,
}) => {
  const normalizedEmail = resolveSocialEmail({
    email,
    provider,
    providerUserId,
  });

  let user = await User.findOne({ email: normalizedEmail });
  if (user) {
    if (name) {
      user.name = buildSocialDisplayName(name, normalizedEmail);
      await user.save();
    }
    return user;
  }

  const generatedPhone = await generateUniqueSocialPhone();
  const randomPassword = crypto.randomBytes(24).toString("hex");

  user = await User.create({
    name: buildSocialDisplayName(name, normalizedEmail),
    email: normalizedEmail,
    phone: generatedPhone,
    originalPhone: generatedPhone,
    password: randomPassword,
    userType: "user",
    status: "active",
  });

  return user;
};

exports.checkRegistrationAvailability = async (req, res) => {
  try {
    const rawEmail = req.query?.email ?? req.body?.email;
    const rawPhone = req.query?.phone ?? req.body?.phone;
    const email = normalizeEmail(rawEmail);
    const phoneInput = String(rawPhone || "").trim();

    if (!email && !phoneInput) {
      return res.status(400).json({ error: "Email or phone is required" });
    }

    if (phoneInput && !User.validateBangladeshiPhone(phoneInput)) {
      return res.status(400).json({
        error:
          "Invalid Bangladeshi phone number. Format: 01XXXXXXXXX or +8801XXXXXXXXX",
      });
    }

    const normalizedPhone = phoneInput ? User.normalizePhone(phoneInput) : "";
    const query = [];

    if (email) {
      query.push({ email });
    }

    if (normalizedPhone) {
      query.push({ phone: normalizedPhone });
    }

    const existingUsers = query.length
      ? await User.find({ $or: query }).select("email phone").lean()
      : [];

    const emailExists = Boolean(
      email &&
      existingUsers.some((user) => normalizeEmail(user?.email) === email),
    );
    const phoneExists = Boolean(
      normalizedPhone &&
      existingUsers.some(
        (user) => String(user?.phone || "").trim() === normalizedPhone,
      ),
    );

    return res.json({
      available: !emailExists && !phoneExists,
      emailExists,
      phoneExists,
    });
  } catch (error) {
    console.error("Check registration availability error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        error: "Name, email, phone and password are required",
      });
    }

    if (!User.validateBangladeshiPhone(phone)) {
      return res.status(400).json({
        error:
          "Invalid Bangladeshi phone number. Format: 01XXXXXXXXX or +8801XXXXXXXXX",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = User.normalizePhone(phone);

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        return res.status(400).json({ error: "Email already in use" });
      }
      return res.status(400).json({ error: "Phone number already in use" });
    }

    const userCount = await User.countDocuments();
    const isFirstRegisteredUser = userCount === 0;
    const userType = isFirstRegisteredUser ? "admin" : "user";
    const adminSettings =
      userType === "admin"
        ? {
            isSuperAdmin: isFirstRegisteredUser,
            permissions: isFirstRegisteredUser
              ? buildAdminPermissions(true)
              : buildAdminPermissions(false),
          }
        : {};

    const user = new User({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      originalPhone: String(phone).trim(),
      password,
      userType,
      adminSettings,
      status: "active",
    });

    await user.save();
    clearPublicSettingsCache();

    const token = await user.generateAuthToken();

    await sendEmail({
      to: user.email,
      subject: "Welcome to our store",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111;">Welcome, ${user.name}!</h2>
          <p>Your account has been created successfully.</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>Phone:</strong> ${user.originalPhone || user.phone}</p>
        </div>
      `,
    });

    return res.status(201).json({
      message: "User registered successfully",
      user: toSafeUser(user),
      token,
    });
  } catch (error) {
    console.error("Register user error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res
        .status(400)
        .json({ error: "Email or phone and password are required" });
    }

    const user = await User.findByCredentials(loginId, password);
    await ensureAdminBootstrapFlags(user);
    user.lastLogin = new Date();
    await user.save();

    const token = await user.generateAuthToken();

    return res.json({
      message: "Login successful",
      user: toSafeUser(user),
      token,
    });
  } catch (error) {
    return res.status(401).json({ error: "Invalid login credentials" });
  }
};

const beginSocialLogin = async (res, providerKey) => {
  const config = await getSocialProviderConfig(providerKey);
  if (config.error) {
    return redirectSocialResult(res, {
      provider: providerKey,
      error: config.error,
    });
  }

  const state = crypto.randomBytes(12).toString("hex");
  const authUrl = new URL(config.authUrl);

  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", config.scope);
  authUrl.searchParams.set("state", state);

  if (config.providerKey === "google") {
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "select_account");
  }

  return res.redirect(authUrl.toString());
};

exports.startGoogleLogin = async (_req, res) => {
  try {
    return await beginSocialLogin(res, "google");
  } catch (error) {
    console.error("Start Google login error:", error);
    return redirectSocialResult(res, {
      provider: "google",
      error: "Unable to start Google login",
    });
  }
};

exports.startFacebookLogin = async (_req, res) => {
  try {
    return await beginSocialLogin(res, "facebook");
  } catch (error) {
    console.error("Start Facebook login error:", error);
    return redirectSocialResult(res, {
      provider: "facebook",
      error: "Unable to start Facebook login",
    });
  }
};

exports.handleGoogleLoginCallback = async (req, res) => {
  try {
    const code = String(req.query?.code || "").trim();
    if (!code) {
      return redirectSocialResult(res, {
        provider: "google",
        error: "Google authorization failed",
      });
    }

    const config = await getSocialProviderConfig("google");
    if (config.error) {
      return redirectSocialResult(res, {
        provider: "google",
        error: config.error,
      });
    }

    const tokenPayload = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    });

    const tokenResponse = await axios.post(
      config.tokenUrl,
      tokenPayload.toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000,
      },
    );

    const accessToken = String(tokenResponse.data?.access_token || "").trim();
    if (!accessToken) {
      return redirectSocialResult(res, {
        provider: "google",
        error: "Google token exchange failed",
      });
    }

    const profileResponse = await axios.get(config.profileUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });

    const profile = profileResponse.data || {};
    const user = await resolveOrCreateSocialUser({
      email: profile?.email,
      name: profile?.name,
      provider: "google",
      providerUserId: profile?.id,
    });

    const token = await user.generateAuthToken();
    return redirectSocialResult(res, {
      provider: "google",
      token,
    });
  } catch (error) {
    console.error(
      "Google login callback error:",
      error?.response?.data || error,
    );
    return redirectSocialResult(res, {
      provider: "google",
      error: "Google login failed",
    });
  }
};

exports.handleFacebookLoginCallback = async (req, res) => {
  try {
    const code = String(req.query?.code || "").trim();
    if (!code) {
      return redirectSocialResult(res, {
        provider: "facebook",
        error: "Facebook authorization failed",
      });
    }

    const config = await getSocialProviderConfig("facebook");
    if (config.error) {
      return redirectSocialResult(res, {
        provider: "facebook",
        error: config.error,
      });
    }

    const tokenResponse = await axios.get(config.tokenUrl, {
      params: {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
      },
      timeout: 10000,
    });

    const accessToken = String(tokenResponse.data?.access_token || "").trim();
    if (!accessToken) {
      return redirectSocialResult(res, {
        provider: "facebook",
        error: "Facebook token exchange failed",
      });
    }

    const profileResponse = await axios.get(config.profileUrl, {
      params: {
        fields: "id,name,email",
        access_token: accessToken,
      },
      timeout: 10000,
    });

    const profile = profileResponse.data || {};
    const user = await resolveOrCreateSocialUser({
      email: profile?.email,
      name: profile?.name,
      provider: "facebook",
      providerUserId: profile?.id,
    });

    const token = await user.generateAuthToken();
    return redirectSocialResult(res, {
      provider: "facebook",
      token,
    });
  } catch (error) {
    console.error(
      "Facebook login callback error:",
      error?.response?.data || error,
    );
    return redirectSocialResult(res, {
      provider: "facebook",
      error: "Facebook login failed",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: "Password reset link sent to email" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.passwordResetExpires = Date.now() + 30 * 60 * 1000;
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password/${resetToken}`;

    await sendEmail({
      to: user.email,
      subject: "Password reset request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111;">Password Reset</h2>
          <p>You requested a password reset.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:4px;">
              Reset Password
            </a>
          </p>
          <p>This link is valid for 30 minutes.</p>
        </div>
      `,
    });

    return res.json({ message: "Password reset link sent to email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Failed to send reset email" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || String(password).length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "Token is invalid or expired" });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.tokens = [];
    await user.save();

    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.getUserProfile = async (req, res) => {
  if (isAdmin(req.user)) {
    await ensureAdminBootstrapFlags(req.user);
  }
  return res.json(toSafeUser(req.user));
};

exports.updateUserProfile = async (req, res) => {
  try {
    const user = req.user;
    const { name, email, phone } = req.body;

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return res.status(400).json({ error: "Name cannot be empty" });
      }
      user.name = trimmedName;
    }

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({ error: "Email cannot be empty" });
      }

      const existingEmail = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id },
      });

      if (existingEmail) {
        return res.status(400).json({ error: "Email already in use" });
      }

      user.email = normalizedEmail;
    }

    if (phone !== undefined) {
      const normalizedPhone = User.normalizePhone(String(phone).trim());
      if (!normalizedPhone) {
        return res.status(400).json({ error: "Phone cannot be empty" });
      }

      if (!User.validateBangladeshiPhone(normalizedPhone)) {
        return res
          .status(400)
          .json({ error: "Valid Bangladesh phone number is required" });
      }

      const existingPhone = await User.findOne({
        phone: normalizedPhone,
        _id: { $ne: user._id },
      });

      if (existingPhone) {
        return res.status(400).json({ error: "Phone number already in use" });
      }

      user.phone = normalizedPhone;
    }

    await user.save();
    return res.json(toSafeUser(user));
  } catch (error) {
    console.error("Update profile error:", error);
    return res
      .status(400)
      .json({ error: error.message || "Failed to update profile" });
  }
};

exports.getUserAddresses = async (req, res) => {
  const safeUser = toSafeUser(req.user);
  return res.json({
    success: true,
    addressBook: Array.isArray(safeUser?.addressBook)
      ? safeUser.addressBook
      : [],
    user: safeUser,
  });
};

exports.createUserAddress = async (req, res) => {
  try {
    const user = req.user;
    user.addressBook = Array.isArray(user.addressBook) ? user.addressBook : [];

    if (user.addressBook.length >= MAX_ADDRESS_BOOK_ITEMS) {
      return res.status(400).json({
        error: `You can save up to ${MAX_ADDRESS_BOOK_ITEMS} addresses`,
      });
    }

    const nextAddress = normalizeAddressBookEntry(req.body);
    user.addressBook.push(nextAddress);

    const createdAddress = user.addressBook[user.addressBook.length - 1];
    const preferredId =
      nextAddress.isDefault || user.addressBook.length === 1
        ? String(createdAddress?._id || "")
        : "";

    syncDefaultAddressBook(user.addressBook, preferredId);
    await user.save();

    const safeUser = toSafeUser(user);
    return res.status(201).json({
      success: true,
      message: "Address saved",
      address: safeUser?.addressBook?.find(
        (entry) =>
          String(entry?._id || "") === String(createdAddress?._id || ""),
      ),
      addressBook: safeUser?.addressBook || [],
      user: safeUser,
    });
  } catch (error) {
    console.error("Create user address error:", error);
    return res.status(400).json({
      error: error.message || "Failed to save address",
    });
  }
};

exports.updateUserAddress = async (req, res) => {
  try {
    const user = req.user;
    const addressId = String(req.params.addressId || "").trim();
    user.addressBook = Array.isArray(user.addressBook) ? user.addressBook : [];

    const address = user.addressBook.id(addressId);
    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    const nextAddress = normalizeAddressBookEntry({
      ...address.toObject(),
      ...req.body,
    });

    Object.assign(address, nextAddress);
    syncDefaultAddressBook(
      user.addressBook,
      nextAddress.isDefault ? addressId : "",
    );

    await user.save();

    const safeUser = toSafeUser(user);
    return res.json({
      success: true,
      message: "Address updated",
      address: safeUser?.addressBook?.find(
        (entry) => String(entry?._id || "") === addressId,
      ),
      addressBook: safeUser?.addressBook || [],
      user: safeUser,
    });
  } catch (error) {
    console.error("Update user address error:", error);
    return res.status(400).json({
      error: error.message || "Failed to update address",
    });
  }
};

exports.setDefaultUserAddress = async (req, res) => {
  try {
    const user = req.user;
    const addressId = String(req.params.addressId || "").trim();
    user.addressBook = Array.isArray(user.addressBook) ? user.addressBook : [];

    const address = user.addressBook.id(addressId);
    if (!address) {
      return res.status(404).json({ error: "Address not found" });
    }

    syncDefaultAddressBook(user.addressBook, addressId);
    await user.save();

    const safeUser = toSafeUser(user);
    return res.json({
      success: true,
      message: "Default address updated",
      addressBook: safeUser?.addressBook || [],
      user: safeUser,
    });
  } catch (error) {
    console.error("Set default user address error:", error);
    return res.status(400).json({
      error: error.message || "Failed to update default address",
    });
  }
};

exports.deleteUserAddress = async (req, res) => {
  try {
    const user = req.user;
    const addressId = String(req.params.addressId || "").trim();
    user.addressBook = Array.isArray(user.addressBook) ? user.addressBook : [];

    const target = user.addressBook.id(addressId);
    if (!target) {
      return res.status(404).json({ error: "Address not found" });
    }

    target.deleteOne();
    syncDefaultAddressBook(user.addressBook);
    await user.save();

    const safeUser = toSafeUser(user);
    return res.json({
      success: true,
      message: "Address deleted",
      addressBook: safeUser?.addressBook || [],
      user: safeUser,
    });
  } catch (error) {
    console.error("Delete user address error:", error);
    return res.status(400).json({
      error: error.message || "Failed to delete address",
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current password and new password are required" });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        error: "New password must be at least 8 characters long",
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    user.password = newPassword;
    user.tokens = [];
    await user.save();

    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res
      .status(400)
      .json({ error: error.message || "Failed to change password" });
  }
};

exports.getSettings = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const primarySettings = await getPrimaryAdminSettings();
    const control = readMarketplaceControl(primarySettings);
    const marketplace = isPlainObject(primarySettings?.marketplace)
      ? primarySettings.marketplace
      : {};
    const publicStockCategoryIds = normalizeIdList(
      primarySettings?.publicStockCategoryIds ||
        marketplace?.publicStockCategoryIds ||
        [],
    );

    return res.json({
      ...primarySettings,
      marketplaceMode: control.marketplaceMode,
      publicStockSummaryEnabled: control.publicStockSummaryEnabled,
      publicStockCategoryIds,
      marketplace: {
        ...marketplace,
        marketplaceMode: control.marketplaceMode,
        publicStockSummaryEnabled: control.publicStockSummaryEnabled,
        publicStockCategoryIds,
      },
    });
  } catch (error) {
    console.error("Get settings error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.getPublicSettings = async (_req, res) => {
  try {
    const now = Date.now();
    if (publicSettingsCache.value && publicSettingsCache.expiresAt > now) {
      return res.json(publicSettingsCache.value);
    }

    const [settings, totalUsers] = await Promise.all([
      getPrimaryAdminSettings(),
      User.countDocuments(),
    ]);
    const payload = {
      success: true,
      settings: buildPublicSettingsPayload(settings, {
        isInitialSetup: Number(totalUsers || 0) === 0,
      }),
    };

    publicSettingsCache = {
      value: payload,
      expiresAt: now + PUBLIC_SETTINGS_CACHE_TTL_MS,
    };

    return res.json(payload);
  } catch (error) {
    console.error("Get public settings error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const primaryAdmin = await getPrimaryAdminUser();
    if (!primaryAdmin) {
      return res.status(404).json({ error: "Primary admin account not found" });
    }

    const currentSettings = isPlainObject(primaryAdmin.adminSettings)
      ? primaryAdmin.adminSettings
      : {};
    const incoming = isPlainObject(req.body) ? req.body : {};
    const currentControl = readMarketplaceControl(currentSettings);
    const incomingMarketplace = isPlainObject(incoming.marketplace)
      ? incoming.marketplace
      : {};
    const requestedMode = DEFAULT_MARKETPLACE_MODE;
    const requestedPublicStockSummaryInput =
      incomingMarketplace.publicStockSummaryEnabled !== undefined
        ? incomingMarketplace.publicStockSummaryEnabled
        : incoming.publicStockSummaryEnabled;
    const requestedPublicStockSummary =
      requestedPublicStockSummaryInput === undefined
        ? currentControl.publicStockSummaryEnabled
        : Boolean(requestedPublicStockSummaryInput);
    const requestedPublicStockCategoryIds = normalizeIdList(
      incoming.publicStockCategoryIds !== undefined
        ? incoming.publicStockCategoryIds
        : incomingMarketplace.publicStockCategoryIds !== undefined
          ? incomingMarketplace.publicStockCategoryIds
          : currentSettings?.publicStockCategoryIds ||
            currentSettings?.marketplace?.publicStockCategoryIds ||
            [],
    );

    const mergedWebsite = normalizeWebsiteSettings(
      mergeSettingsSection(currentSettings, incoming, "website"),
      { includePrivate: true },
    );
    const mergedSeo = normalizeSeoSettings(
      mergeSettingsSection(currentSettings, incoming, "seo"),
    );
    const mergedSeoAnalytics = normalizeSeoAnalyticsSettings({
      ...currentSettings,
      ...incoming,
      website: mergedWebsite,
      seo: mergedSeo,
      seoAnalytics: mergeSettingsSection(
        currentSettings,
        incoming,
        "seoAnalytics",
      ),
    });

    const nextSettings = {
      ...currentSettings,
      ...incoming,
      website: mergedWebsite,
      contact: mergeSettingsSection(currentSettings, incoming, "contact"),
      social: mergeSettingsSection(currentSettings, incoming, "social"),
      policies: mergeSettingsSection(currentSettings, incoming, "policies"),
      seo: mergedSeo,
      integrations: normalizeAnalyticsSettings(
        mergeSettingsSection(currentSettings, incoming, "integrations"),
      ),
      invoice: mergeSettingsSection(currentSettings, incoming, "invoice"),
      about: normalizeAboutSettings(
        mergeSettingsSection(currentSettings, incoming, "about"),
      ),
      courier: mergeSettingsSection(currentSettings, incoming, "courier"),
      couriers: normalizeCourierMap(
        mergeSettingsSection(currentSettings, incoming, "couriers"),
      ),
      shipping: mergeSettingsSection(currentSettings, incoming, "shipping"),
      locations: mergeSettingsSection(currentSettings, incoming, "locations"),
      storefront: normalizeStorefrontSettings({
        ...mergeSettingsSection(currentSettings, incoming, "storefront"),
      }),
      seoAnalytics: mergedSeoAnalytics,
      publicStockCategoryIds: requestedPublicStockCategoryIds,
      marketplaceMode: requestedMode,
      publicStockSummaryEnabled: requestedPublicStockSummary,
      marketplace: {
        ...(isPlainObject(currentSettings.marketplace)
          ? currentSettings.marketplace
          : {}),
        ...incomingMarketplace,
        marketplaceMode: requestedMode,
        publicStockSummaryEnabled: requestedPublicStockSummary,
        publicStockCategoryIds: requestedPublicStockCategoryIds,
      },
    };

    primaryAdmin.adminSettings = nextSettings;
    await primaryAdmin.save();
    try {
      const sitemapArtifacts = await generateSitemapArtifacts(
        nextSettings,
        req,
      );
      await syncStorefrontRobotsFile({ robotsTxt: sitemapArtifacts.robotsTxt });
    } catch (sitemapError) {
      console.warn("Sitemap sync skipped:", sitemapError.message);
    }
    clearPublicSettingsCache();
    const control = readMarketplaceControl(nextSettings);

    return res.json({
      message: "Settings updated successfully",
      settings: {
        ...nextSettings,
        marketplaceMode: control.marketplaceMode,
        publicStockSummaryEnabled: control.publicStockSummaryEnabled,
        publicStockCategoryIds: requestedPublicStockCategoryIds,
        marketplace: {
          ...(isPlainObject(nextSettings.marketplace)
            ? nextSettings.marketplace
            : {}),
          marketplaceMode: control.marketplaceMode,
          publicStockSummaryEnabled: control.publicStockSummaryEnabled,
          publicStockCategoryIds: requestedPublicStockCategoryIds,
        },
      },
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.uploadWebsiteLogo = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ error: "Logo image file is required" });
    }

    const primaryAdmin = await getPrimaryAdminUser();
    if (!primaryAdmin) {
      return res.status(404).json({ error: "Primary admin account not found" });
    }

    const currentSettings = isPlainObject(primaryAdmin.adminSettings)
      ? primaryAdmin.adminSettings
      : {};
    const currentWebsite = isPlainObject(currentSettings.website)
      ? currentSettings.website
      : {};
    const previousPublicId = String(currentWebsite.logoPublicId || "").trim();

    const uploaded = await uploadImageBuffer(req.file.buffer, {
      folder: "marketplace/site-brand",
      resource_type: "image",
    });

    if (!uploaded?.secure_url) {
      return res.status(500).json({ error: "Logo upload failed" });
    }

    primaryAdmin.adminSettings = {
      ...currentSettings,
      website: {
        ...currentWebsite,
        logoMode: "image",
        logoUrl: String(uploaded.secure_url || "").trim(),
        logoPublicId: String(uploaded.public_id || "").trim(),
      },
    };

    await primaryAdmin.save();

    if (previousPublicId && previousPublicId !== uploaded.public_id) {
      await deleteImage(previousPublicId).catch(() => null);
    }

    clearPublicSettingsCache();

    return res.json({
      success: true,
      message: "Website logo uploaded successfully",
      logoUrl: String(uploaded.secure_url || "").trim(),
      settings: buildPublicSettingsPayload(primaryAdmin.adminSettings),
    });
  } catch (error) {
    console.error("Upload website logo error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.uploadWebsiteHeaderIcon = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (!req.file?.buffer) {
      return res
        .status(400)
        .json({ error: "Header icon image file is required" });
    }

    const primaryAdmin = await getPrimaryAdminUser();
    if (!primaryAdmin) {
      return res.status(404).json({ error: "Primary admin account not found" });
    }

    const currentSettings = isPlainObject(primaryAdmin.adminSettings)
      ? primaryAdmin.adminSettings
      : {};
    const currentWebsite = isPlainObject(currentSettings.website)
      ? currentSettings.website
      : {};
    const previousPublicId = String(
      currentWebsite.headerIconPublicId || "",
    ).trim();

    const uploaded = await uploadImageBuffer(req.file.buffer, {
      folder: "marketplace/site-brand",
      resource_type: "image",
    });

    if (!uploaded?.secure_url) {
      return res.status(500).json({ error: "Header icon upload failed" });
    }

    primaryAdmin.adminSettings = {
      ...currentSettings,
      website: {
        ...currentWebsite,
        headerIconUrl: String(uploaded.secure_url || "").trim(),
        headerIconPublicId: String(uploaded.public_id || "").trim(),
      },
    };

    await primaryAdmin.save();

    if (previousPublicId && previousPublicId !== uploaded.public_id) {
      await deleteImage(previousPublicId).catch(() => null);
    }

    clearPublicSettingsCache();

    return res.json({
      success: true,
      message: "Website header icon uploaded successfully",
      headerIconUrl: String(uploaded.secure_url || "").trim(),
      settings: buildPublicSettingsPayload(primaryAdmin.adminSettings),
    });
  } catch (error) {
    console.error("Upload website header icon error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.getPublicSitemapXml = async (req, res) => {
  try {
    const settings = await getPrimaryAdminSettings();
    const sitemapArtifacts = await generateSitemapArtifacts(settings, req);

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.status(200).send(sitemapArtifacts.xml);
  } catch (error) {
    console.error("Public sitemap error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Failed to generate sitemap" });
  }
};

exports.getPublicRobotsTxt = async (req, res) => {
  try {
    const settings = await getPrimaryAdminSettings();
    const sitemapArtifacts = await generateSitemapArtifacts(settings, req);

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(200).send(sitemapArtifacts.robotsTxt);
  } catch (error) {
    console.error("Public robots error:", error);
    return res.status(500).send("User-agent: *\nAllow: /\n");
  }
};

exports.generateSitemapXml = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const settings = await getPrimaryAdminSettings();
    const sitemapArtifacts = await generateSitemapArtifacts(settings, req);

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="sitemap.xml"');
    return res.status(200).send(sitemapArtifacts.xml);
  } catch (error) {
    console.error("Generate sitemap error:", error);
    return res
      .status(500)
      .json({ error: error.message || "Failed to generate sitemap" });
  }
};

exports.getMarketplaceControlOverview = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const settings = await getPrimaryAdminSettings();
    const control = readMarketplaceControl(settings);

    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);

    const [totalUsers, activeUsers, pendingUsers, totalOrders] =
      await Promise.all([
        User.countDocuments({ userType: { $ne: "admin" } }),
        User.countDocuments({
          userType: { $ne: "admin" },
          status: "active",
        }),
        User.countDocuments({
          userType: { $ne: "admin" },
          status: "pending",
        }),
        Order.countDocuments({}),
      ]);

    const [salesRows, last30SalesRows, recentOrders, recentUsers] =
      await Promise.all([
        Order.aggregate([
          {
            $project: {
              normalizedStatus: { $toLower: { $ifNull: ["$orderStatus", ""] } },
              total: { $ifNull: ["$total", 0] },
            },
          },
          { $match: { normalizedStatus: "delivered" } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$total" },
            },
          },
        ]),
        Order.aggregate([
          {
            $project: {
              createdAt: 1,
              normalizedStatus: { $toLower: { $ifNull: ["$orderStatus", ""] } },
              total: { $ifNull: ["$total", 0] },
            },
          },
          {
            $match: {
              normalizedStatus: "delivered",
              createdAt: { $gte: last30Days },
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$total" },
              totalOrders: { $sum: 1 },
            },
          },
        ]),
        Order.find()
          .select("orderNumber orderStatus total createdAt shippingAddress")
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
        User.find({ userType: { $ne: "admin" } })
          .select(
            "name email phone originalPhone userType status createdAt lastLogin",
          )
          .sort({ createdAt: -1 })
          .limit(8)
          .lean(),
      ]);

    const totalRevenue = roundMoney(salesRows?.[0]?.totalRevenue || 0);
    const last30DaysRevenue = roundMoney(
      last30SalesRows?.[0]?.totalRevenue || 0,
    );
    const last30DaysOrders = Number(last30SalesRows?.[0]?.totalOrders || 0);

    return res.json({
      success: true,
      control,
      activity: {
        totalUsers,
        activeUsers,
        pendingUsers,
        totalOrders,
        totalRevenue,
        last30DaysOrders,
        last30DaysRevenue,
        recentOrders: recentOrders.map((order) => ({
          orderNumber: order.orderNumber,
          status: order.orderStatus,
          total: roundMoney(order.total),
          customerName:
            `${String(order?.shippingAddress?.firstName || "").trim()} ${String(
              order?.shippingAddress?.lastName || "",
            ).trim()}`.trim(),
          createdAt: order.createdAt,
        })),
        recentUsers: recentUsers.map((account) => ({
          name: account.name || "",
          email: account.email || "",
          phone: account.originalPhone || account.phone || "",
          userType: account.userType || "user",
          status: account.status || "active",
          createdAt: account.createdAt,
          lastLogin: account.lastLogin || null,
        })),
      },
    });
  } catch (error) {
    console.error("Get marketplace control overview error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while loading marketplace control overview",
    });
  }
};

exports.updateMarketplaceControl = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const primaryAdmin = await getPrimaryAdminUser();
    if (!primaryAdmin) {
      return res.status(404).json({
        success: false,
        message: "Primary admin account not found",
      });
    }

    const requestedMode = DEFAULT_MARKETPLACE_MODE;
    const currentSettings = primaryAdmin.adminSettings || {};
    const currentControl = readMarketplaceControl(currentSettings);
    const requestedPublicStockSummary =
      req.body?.publicStockSummaryEnabled === undefined
        ? currentControl.publicStockSummaryEnabled
        : Boolean(req.body.publicStockSummaryEnabled);

    primaryAdmin.adminSettings = {
      ...currentSettings,
      marketplaceMode: requestedMode,
      publicStockSummaryEnabled: requestedPublicStockSummary,
      marketplace: {
        ...(currentSettings.marketplace || {}),
        marketplaceMode: requestedMode,
        publicStockSummaryEnabled: requestedPublicStockSummary,
      },
    };

    await primaryAdmin.save();
    clearPublicSettingsCache();

    return res.json({
      success: true,
      message: "Marketplace control updated successfully",
      control: readMarketplaceControl(primaryAdmin.adminSettings || {}),
    });
  } catch (error) {
    console.error("Update marketplace control error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating marketplace control",
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    if (!hasAdminPermission(req.user, "manageUsers")) {
      return res
        .status(403)
        .json({ error: "Permission denied: manageUsers required" });
    }

    const users = await User.find({
      $or: [
        { "adminSettings.isSuperAdmin": { $ne: true } },
        { adminSettings: { $exists: false } },
      ],
    })
      .select(
        "name email phone originalPhone userType status createdAt lastLogin adminNotes adminSettings",
      )
      .sort({ createdAt: -1 });

    return res.json(users.map((user) => toSafeUser(user)));
  } catch (error) {
    console.error("Get all users error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.updateUserByAdmin = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    if (!hasAdminPermission(req.user, "manageUsers")) {
      return res
        .status(403)
        .json({ error: "Permission denied: manageUsers required" });
    }

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const actingAdminId = String(req.user?._id || "");
    const targetUserId = String(targetUser._id || "");
    const requestedType = req.body?.userType;
    const requestedStatus = req.body?.status;
    const requestedNotes = req.body?.adminNotes;
    const requestedAdminPermissions = req.body?.adminPermissions;
    const currentTargetType = String(targetUser.userType || "")
      .trim()
      .toLowerCase();
    const targetIsSuperAdmin = Boolean(targetUser?.adminSettings?.isSuperAdmin);

    if (targetIsSuperAdmin) {
      return res.status(403).json({
        error: "Super admin account cannot be managed from this panel",
      });
    }

    if (requestedType !== undefined) {
      const normalizedType = String(requestedType || "")
        .trim()
        .toLowerCase();
      if (!ALLOWED_USER_TYPES.has(normalizedType)) {
        return res.status(400).json({ error: "Invalid user type" });
      }

      const isPromotingToAdmin =
        currentTargetType !== "admin" && normalizedType === "admin";

      if (actingAdminId === targetUserId && normalizedType !== "admin") {
        return res.status(400).json({
          error: "You cannot remove admin role from your own account",
        });
      }

      if (
        String(targetUser.userType || "").toLowerCase() === "admin" &&
        normalizedType !== "admin"
      ) {
        const adminCount = await User.countDocuments({ userType: "admin" });
        if (adminCount <= 1) {
          return res
            .status(400)
            .json({ error: "At least one admin account must remain" });
        }
      }

      targetUser.userType = normalizedType;

      if (isPromotingToAdmin) {
        targetUser.adminSettings = {
          ...(targetUser.adminSettings || {}),
          isSuperAdmin: false,
          permissions: normalizeAdminPermissions(
            requestedAdminPermissions || buildAdminPermissions(true),
          ),
        };
      }

      if (currentTargetType === "admin" && normalizedType !== "admin") {
        targetUser.adminSettings = {
          ...(targetUser.adminSettings || {}),
          isSuperAdmin: false,
          permissions: normalizeAdminPermissions({}),
        };
      }
    }

    if (requestedStatus !== undefined) {
      const normalizedStatus = String(requestedStatus || "")
        .trim()
        .toLowerCase();
      if (!ALLOWED_USER_STATUSES.has(normalizedStatus)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      if (actingAdminId === targetUserId && normalizedStatus !== "active") {
        return res
          .status(400)
          .json({ error: "You cannot deactivate your own account" });
      }

      targetUser.status = normalizedStatus;
    }

    if (requestedNotes !== undefined) {
      targetUser.adminNotes = String(requestedNotes || "").trim();
    }

    if (requestedAdminPermissions !== undefined) {
      const normalizedPermissions = ["admin", "staff"].includes(
        String(targetUser.userType || "").toLowerCase(),
      )
        ? normalizeAdminPermissions(requestedAdminPermissions)
        : normalizeAdminPermissions({});
      targetUser.adminSettings = {
        ...(targetUser.adminSettings || {}),
        isSuperAdmin:
          String(targetUser.userType || "").toLowerCase() === "admin"
            ? Boolean(targetUser?.adminSettings?.isSuperAdmin)
            : false,
        permissions: normalizedPermissions,
      };
    }

    await targetUser.save();

    return res.json({
      success: true,
      message: "User updated successfully",
      user: toSafeUser(targetUser),
    });
  } catch (error) {
    console.error("Update user by admin error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.createAdminUser = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ error: "Super admin access required" });
    }

    const {
      name,
      email,
      phone,
      password,
      status = "active",
      adminPermissions,
    } = req.body || {};

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        error: "Name, email, phone and password are required",
      });
    }

    if (!validator.isEmail(String(email || "").trim())) {
      return res.status(400).json({
        error: "Invalid email address",
      });
    }

    if (!User.validateBangladeshiPhone(phone)) {
      return res.status(400).json({
        error:
          "Invalid Bangladeshi phone number. Format: 01XXXXXXXXX or +8801XXXXXXXXX",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters long",
      });
    }

    const normalizedStatus = String(status || "active")
      .trim()
      .toLowerCase();
    if (!ALLOWED_USER_STATUSES.has(normalizedStatus)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = User.normalizePhone(phone);
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    }).lean();

    if (existingUser) {
      if (String(existingUser.email || "").toLowerCase() === normalizedEmail) {
        return res.status(400).json({ error: "Email already in use" });
      }
      return res.status(400).json({ error: "Phone number already in use" });
    }

    const user = new User({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      originalPhone: String(phone).trim(),
      password,
      userType: "admin",
      status: normalizedStatus,
      adminSettings: {
        isSuperAdmin: false,
        permissions: normalizeAdminPermissions(
          adminPermissions && typeof adminPermissions === "object"
            ? adminPermissions
            : buildAdminPermissions(true),
        ),
      },
    });

    await user.save();

    return res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      user: toSafeUser(user),
    });
  } catch (error) {
    console.error("Create admin user error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.getSystemStats = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      nonAdminUsers,
      allOrders,
      inventoryRows,
      purchaseRows,
      accountRows,
      abandonedRows,
    ] = await Promise.all([
      User.find({ userType: { $ne: "admin" } })
        .select("status")
        .lean(),
      Order.find()
        .select("orderNumber createdAt orderStatus total shippingAddress")
        .sort({ createdAt: -1 })
        .lean(),
      Product.find().select("stock lowStockThreshold").lean(),
      Purchase.find().select("totalAmount").lean(),
      AccountEntry.find().select("type amount").lean(),
      AbandonedOrder.find({ status: { $in: ["new", "follow_up"] } })
        .select("total")
        .lean(),
    ]);

    const totalUsers = nonAdminUsers.length;
    const activeUsers = nonAdminUsers.filter(
      (user) => user.status === "active",
    ).length;
    const pendingUsers = nonAdminUsers.filter(
      (user) => user.status === "pending",
    ).length;

    const orderStats = {
      total: allOrders.length,
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
    };

    let todaySales = 0;
    let monthlySales = 0;
    let totalRevenue = 0;

    const riskMap = new Map();

    allOrders.forEach((order) => {
      const status = String(order.orderStatus || "").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(orderStats, status)) {
        orderStats[status] += 1;
      }

      const orderDate = order.createdAt ? new Date(order.createdAt) : null;
      const orderTotal = Number(order.total || 0);

      if (status === "delivered") {
        totalRevenue += orderTotal;
        if (orderDate && orderDate >= startOfToday) {
          todaySales += orderTotal;
        }
        if (orderDate && orderDate >= startOfMonth) {
          monthlySales += orderTotal;
        }
      }

      const customerKey = [
        String(order?.shippingAddress?.phone || "").trim(),
        String(order?.shippingAddress?.email || "")
          .trim()
          .toLowerCase(),
      ]
        .filter(Boolean)
        .join("|");

      if (!customerKey) return;

      if (!riskMap.has(customerKey)) {
        riskMap.set(customerKey, { totalOrders: 0, deliveredOrders: 0 });
      }
      const entry = riskMap.get(customerKey);
      entry.totalOrders += 1;
      if (status === "delivered") {
        entry.deliveredOrders += 1;
      }
    });

    let highRiskCustomers = 0;
    for (const entry of riskMap.values()) {
      const successRate =
        entry.totalOrders > 0
          ? (entry.deliveredOrders / entry.totalOrders) * 100
          : 0;
      const riskLevel = classifyRiskLevel(
        successRate,
        entry.totalOrders,
        false,
        entry.cancelledOrders || 0,
        entry.returnedOrders || 0,
      );
      if (riskLevel === "high" || riskLevel === "blacklisted") {
        highRiskCustomers += 1;
      }
    }

    const purchaseExpense = purchaseRows.reduce(
      (sum, row) => sum + Number(row.totalAmount || 0),
      0,
    );

    let accountIncome = 0;
    let accountExpense = 0;
    accountRows.forEach((entry) => {
      const type = String(entry.type || "").toLowerCase();
      const amount = Number(entry.amount || 0);
      if (ACCOUNT_INCOME_TYPES.has(type)) {
        accountIncome += amount;
      }
      if (ACCOUNT_EXPENSE_TYPES.has(type)) {
        accountExpense += amount;
      }
    });

    const totalExpense = purchaseExpense + accountExpense;
    const netProfit = totalRevenue + accountIncome - totalExpense;

    let totalStock = 0;
    let lowStockAlerts = 0;
    let outOfStock = 0;
    inventoryRows.forEach((row) => {
      const stock = Number(row.stock || 0);
      const threshold = Number(row.lowStockThreshold || 0);
      totalStock += stock;
      if (stock <= 0) {
        outOfStock += 1;
      } else if (stock <= threshold) {
        lowStockAlerts += 1;
      }
    });

    const abandonedOrders = abandonedRows.length;
    const abandonedValue = abandonedRows.reduce(
      (sum, row) => sum + Number(row.total || 0),
      0,
    );

    const recentOrders = allOrders.slice(0, 8).map((order) => ({
      orderNumber: order.orderNumber,
      status: order.orderStatus,
      total: roundMoney(order.total),
      customerName:
        `${String(order?.shippingAddress?.firstName || "").trim()} ${String(
          order?.shippingAddress?.lastName || "",
        ).trim()}`.trim(),
      createdAt: order.createdAt,
    }));

    return res.json({
      totalUsers,
      activeUsers,
      pendingUsers,
      totalRevenue: roundMoney(totalRevenue),
      sales: {
        today: roundMoney(todaySales),
        monthly: roundMoney(monthlySales),
        total: roundMoney(totalRevenue),
      },
      orders: orderStats,
      financials: {
        revenue: roundMoney(totalRevenue),
        otherIncome: roundMoney(accountIncome),
        expense: roundMoney(totalExpense),
        netProfit: roundMoney(netProfit),
      },
      inventory: {
        totalProducts: inventoryRows.length,
        totalStock: Math.max(0, Number(totalStock || 0)),
        lowStockAlerts,
        outOfStock,
      },
      customerInsights: {
        abandonedOrders,
        abandonedValue: roundMoney(abandonedValue),
        highRiskCustomers,
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Get system stats error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.getCustomerRiskProfiles = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const search = String(req.query?.search || "")
      .trim()
      .toLowerCase();
    const risk = String(req.query?.risk || "")
      .trim()
      .toLowerCase();
    const blacklistedOnly =
      String(req.query?.blacklisted || "")
        .trim()
        .toLowerCase() === "true";

    const orders = await Order.find()
      .select("shippingAddress orderStatus total createdAt user")
      .sort({ createdAt: -1 })
      .lean();

    const users = await User.find()
      .select(
        "_id name email phone originalPhone userType status isBlacklisted blacklistReason adminNotes createdAt",
      )
      .lean();

    const userByPhone = new Map();
    const userByEmail = new Map();
    const userById = new Map();

    for (const user of users) {
      const normalizedPhone = User.normalizePhone(
        user?.phone || user?.originalPhone || "",
      );
      const normalizedMail = normalizeEmail(user?.email || "");
      if (normalizedPhone) userByPhone.set(normalizedPhone, user);
      if (normalizedMail) userByEmail.set(normalizedMail, user);
      userById.set(String(user._id), user);
    }

    const profileMap = new Map();

    for (const order of orders) {
      const shipping = order?.shippingAddress || {};
      const phone = User.normalizePhone(shipping.phone || "");
      const email = normalizeEmail(shipping.email || "");
      const key = phone || email;
      if (!key) continue;

      const matchedUser = order?.user
        ? userById.get(String(order.user))
        : userByPhone.get(phone) || userByEmail.get(email) || null;

      if (!profileMap.has(key)) {
        profileMap.set(key, {
          key,
          customerId: matchedUser?._id || null,
          customerName:
            matchedUser?.name ||
            `${shipping.firstName || ""} ${shipping.lastName || ""}`.trim() ||
            "Guest Customer",
          phone: phone || "",
          email: email || "",
          totalOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0,
          returnedOrders: 0,
          exchangeOrders: 0,
          totalRevenue: 0,
          lastOrderDate: null,
          isBlacklisted: Boolean(matchedUser?.isBlacklisted),
          blacklistReason: matchedUser?.blacklistReason || "",
          adminNotes: matchedUser?.adminNotes || "",
          userType: matchedUser?.userType || "guest",
        });
      }

      const profile = profileMap.get(key);
      profile.totalOrders += 1;

      const orderStatus = String(order.orderStatus || "").toLowerCase();
      if (orderStatus === "delivered") {
        profile.deliveredOrders += 1;
        profile.totalRevenue += Number(order.total || 0);
      } else if (orderStatus === "cancelled") {
        profile.cancelledOrders += 1;
      } else if (orderStatus === "returned") {
        profile.returnedOrders += 1;
      } else if (orderStatus === "exchange") {
        profile.exchangeOrders += 1;
      }

      const createdAt = order.createdAt ? new Date(order.createdAt) : null;
      if (
        createdAt &&
        (!profile.lastOrderDate || createdAt > new Date(profile.lastOrderDate))
      ) {
        profile.lastOrderDate = createdAt;
      }

      if (!profile.customerId && matchedUser?._id) {
        profile.customerId = matchedUser._id;
        profile.customerName = matchedUser.name || profile.customerName;
        profile.isBlacklisted = Boolean(matchedUser.isBlacklisted);
        profile.blacklistReason = matchedUser.blacklistReason || "";
        profile.adminNotes = matchedUser.adminNotes || "";
        profile.userType = matchedUser.userType || profile.userType;
      }
    }

    let profiles = Array.from(profileMap.values()).map((entry) => {
      const successRate =
        entry.totalOrders > 0
          ? (entry.deliveredOrders / entry.totalOrders) * 100
          : 0;
      const riskLevel = classifyRiskLevel(
        successRate,
        entry.totalOrders,
        entry.isBlacklisted,
        entry.cancelledOrders || 0,
        entry.returnedOrders || 0,
      );

      return {
        ...entry,
        successRate: Number(successRate.toFixed(2)),
        riskLevel,
      };
    });

    if (search) {
      profiles = profiles.filter((entry) =>
        [
          entry.customerName,
          entry.phone,
          entry.email,
          entry.blacklistReason,
          entry.adminNotes,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search)),
      );
    }

    if (
      risk &&
      ["new", "trusted", "medium", "high", "blacklisted"].includes(risk)
    ) {
      profiles = profiles.filter((entry) => entry.riskLevel === risk);
    }

    if (blacklistedOnly) {
      profiles = profiles.filter((entry) => entry.isBlacklisted);
    }

    profiles.sort((a, b) => {
      if (a.isBlacklisted !== b.isBlacklisted) return a.isBlacklisted ? -1 : 1;
      return Number(b.totalOrders || 0) - Number(a.totalOrders || 0);
    });

    return res.json({
      success: true,
      profiles,
      summary: {
        totalProfiles: profiles.length,
        blacklisted: profiles.filter((entry) => entry.isBlacklisted).length,
        trusted: profiles.filter((entry) => entry.riskLevel === "trusted")
          .length,
        highRisk: profiles.filter((entry) =>
          ["high", "blacklisted"].includes(entry.riskLevel),
        ).length,
      },
    });
  } catch (error) {
    console.error("Get customer risk profiles error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.getCustomerProfileByAdmin = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { userId } = req.params;
    const user = await User.findById(userId)
      .select(
        "_id name email phone originalPhone userType status isBlacklisted blacklistReason adminNotes createdAt lastLogin",
      )
      .lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const normalizedEmail = normalizeEmail(user.email || "");
    const normalizedPhone = User.normalizePhone(
      user.phone || user.originalPhone || "",
    );
    const rawPhone = String(user.originalPhone || user.phone || "").trim();

    const orderConditions = [{ user: user._id }];
    if (normalizedEmail) {
      orderConditions.push({ "shippingAddress.email": normalizedEmail });
    }
    if (normalizedPhone) {
      orderConditions.push({ "shippingAddress.phone": normalizedPhone });
    }
    if (rawPhone) {
      orderConditions.push({ "shippingAddress.phone": rawPhone });
    }

    const orders = await Order.find({ $or: orderConditions })
      .select(
        "orderNumber orderStatus total subtotal shippingFee discount paymentStatus paymentMethod createdAt source shippingAddress",
      )
      .sort({ createdAt: -1 })
      .lean();

    const metrics = {
      totalOrders: orders.length,
      deliveredOrders: 0,
      cancelledOrders: 0,
      returnedOrders: 0,
      exchangeOrders: 0,
      totalRevenue: 0,
      totalOrderValue: 0,
      lastOrderDate: orders[0]?.createdAt || null,
    };

    orders.forEach((order) => {
      const status = String(order.orderStatus || "").toLowerCase();
      const total = Number(order.total || 0);
      metrics.totalOrderValue += total;

      if (status === "delivered") {
        metrics.deliveredOrders += 1;
        metrics.totalRevenue += total;
      } else if (status === "cancelled") {
        metrics.cancelledOrders += 1;
      } else if (status === "returned") {
        metrics.returnedOrders += 1;
      } else if (status === "exchange") {
        metrics.exchangeOrders += 1;
      }
    });

    const successRate =
      metrics.totalOrders > 0
        ? (metrics.deliveredOrders / metrics.totalOrders) * 100
        : 0;

    const riskLevel = classifyRiskLevel(
      successRate,
      metrics.totalOrders,
      user.isBlacklisted,
      metrics.cancelledOrders,
      metrics.returnedOrders,
    );

    return res.json({
      success: true,
      profile: {
        customerId: user._id,
        name: user.name || "",
        email: user.email || "",
        phone: user.originalPhone || user.phone || "",
        userType: user.userType || "user",
        status: user.status || "active",
        isBlacklisted: Boolean(user.isBlacklisted),
        blacklistReason: user.blacklistReason || "",
        adminNotes: user.adminNotes || "",
        createdAt: user.createdAt || null,
        lastLogin: user.lastLogin || null,
      },
      metrics: {
        ...metrics,
        totalRevenue: roundMoney(metrics.totalRevenue),
        totalOrderValue: roundMoney(metrics.totalOrderValue),
        successRate: roundMoney(successRate),
        riskLevel,
      },
      orderHistory: orders.slice(0, 100).map((order) => ({
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        subtotal: roundMoney(order.subtotal),
        shippingFee: roundMoney(order.shippingFee),
        discount: roundMoney(order.discount),
        total: roundMoney(order.total),
        source: order.source || "shop",
      })),
    });
  } catch (error) {
    console.error("Get customer profile by admin error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.updateCustomerBlacklist = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { userId } = req.params;
    const isBlacklisted = Boolean(req.body?.isBlacklisted);
    const blacklistReason = String(req.body?.blacklistReason || "").trim();
    const adminNotes = String(req.body?.adminNotes || "").trim();

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (String(user.userType || "").toLowerCase() === "admin") {
      return res
        .status(400)
        .json({ error: "Admin user cannot be blacklisted" });
    }

    user.isBlacklisted = isBlacklisted;
    user.blacklistReason = isBlacklisted ? blacklistReason : "";
    if (adminNotes !== "") {
      user.adminNotes = adminNotes;
    }

    await user.save();

    return res.json({
      success: true,
      message: isBlacklisted
        ? "Customer blacklisted"
        : "Customer removed from blacklist",
      user: toSafeUser(user),
    });
  } catch (error) {
    console.error("Update customer blacklist error:", error);
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = Array.isArray(req.user?.notifications)
      ? [...req.user.notifications]
          .sort(
            (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
          )
          .map((item) => serializeNotification(item))
      : [];

    return res.json({
      success: true,
      notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load notifications",
      error: error.message,
    });
  }
};

exports.markUserNotificationRead = async (req, res) => {
  try {
    const notification = req.user?.notifications?.id(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await req.user.save();
      broadcastNotificationRead(
        req.user._id,
        notification._id,
        notification.readAt,
      );
    }

    return res.json({
      success: true,
      message: "Notification marked as read",
      notification: serializeNotification(notification),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update notification",
      error: error.message,
    });
  }
};

exports.markAllUserNotificationsRead = async (req, res) => {
  try {
    const notifications = Array.isArray(req.user?.notifications)
      ? req.user.notifications
      : [];

    let changed = false;
    const readAt = new Date();

    notifications.forEach((notification) => {
      if (!notification.isRead) {
        notification.isRead = true;
        notification.readAt = readAt;
        changed = true;
      }
    });

    if (changed) {
      await req.user.save();
      broadcastNotificationsReadAll(req.user._id, readAt);
    }

    return res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update notifications",
      error: error.message,
    });
  }
};

exports.deleteUserNotification = async (req, res) => {
  try {
    const notification = req.user?.notifications?.id(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const notificationId = String(notification._id || "").trim();
    notification.deleteOne();
    await req.user.save();
    broadcastNotificationDeleted(req.user._id, notificationId);

    return res.json({
      success: true,
      message: "Notification deleted",
      notificationId,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: error.message,
    });
  }
};

exports.clearAllUserNotifications = async (req, res) => {
  try {
    if (
      !Array.isArray(req.user?.notifications) ||
      req.user.notifications.length === 0
    ) {
      return res.json({
        success: true,
        message: "No notifications to delete",
      });
    }

    req.user.notifications = [];
    await req.user.save();
    broadcastNotificationsCleared(req.user._id);

    return res.json({
      success: true,
      message: "All notifications deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete notifications",
      error: error.message,
    });
  }
};

exports.streamUserNotifications = async (req, res) => {
  let unregister = null;

  try {
    const token =
      req.query?.token ||
      req.headers.authorization ||
      req.headers.Authorization;
    const user = await authenticateNotificationToken(token);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    unregister = registerNotificationClient(user._id, res);

    const unreadCount = Array.isArray(user.notifications)
      ? user.notifications.filter((item) => !item.isRead).length
      : 0;

    writeSseEvent(res, "ready", {
      connected: true,
      unreadCount,
    });

    req.on("close", () => {
      if (unregister) {
        unregister();
        unregister = null;
      }
      if (!res.writableEnded) {
        res.end();
      }
    });
  } catch (error) {
    if (unregister) {
      unregister();
    }
    return res.status(error.statusCode || 401).json({
      success: false,
      message: error.message || "Unable to open notification stream",
    });
  }
};
