import { resolveTrackingConfiguration } from "./marketingProfiles";

const DATALAYER_DEFAULT_ENABLED =
  String(import.meta.env.VITE_ENABLE_DATALAYER || "true").toLowerCase() !==
  "false";
const PUBLIC_SETTINGS_CACHE_KEY = "publicStoreSettings";
const safeString = (value) => String(value || "").trim();
const toCleanPayload = (value = {}) =>
  Object.fromEntries(
    Object.entries(value || {}).filter(
      ([, entryValue]) => entryValue !== undefined,
    ),
  );

const resolveCurrentProductId = (pathname = "") => {
  if (typeof window !== "undefined") {
    const runtimeProductId = safeString(window.__CURRENT_PRODUCT_ID__);
    if (runtimeProductId) return runtimeProductId;
  }

  const match = String(pathname || "")
    .trim()
    .match(/^\/product\/([^/?#]+)/i);

  return match ? decodeURIComponent(match[1] || "").trim() : "";
};

const isDataLayerEnabledFromSettings = () => {
  if (typeof window === "undefined") return DATALAYER_DEFAULT_ENABLED;

  const runtimeState = window.__MARKETING_STATE__;
  if (runtimeState?.ready === false) {
    return false;
  }
  if (runtimeState?.dataLayerEnabled !== undefined) {
    return Boolean(runtimeState.dataLayerEnabled);
  }

  try {
    const cached = window.localStorage.getItem(PUBLIC_SETTINGS_CACHE_KEY);
    if (!cached) return DATALAYER_DEFAULT_ENABLED;

    const parsed = JSON.parse(cached);
    const settings =
      parsed?.settings &&
      typeof parsed.settings === "object" &&
      !Array.isArray(parsed.settings)
        ? parsed.settings
        : null;

    if (!settings) return DATALAYER_DEFAULT_ENABLED;

    const tracking = resolveTrackingConfiguration(settings, {
      pathname: window.location.pathname,
      productId: resolveCurrentProductId(window.location.pathname),
    });

    if (tracking?.dataLayerEnabled !== undefined) {
      return Boolean(tracking.dataLayerEnabled);
    }

    const fromSettings = settings?.seoAnalytics?.global?.enableDataLayer;
    if (fromSettings === undefined || fromSettings === null) {
      return DATALAYER_DEFAULT_ENABLED;
    }
    return Boolean(fromSettings);
  } catch {
    return DATALAYER_DEFAULT_ENABLED;
  }
};

export const pushDataLayerEvent = (eventName, payload = {}) => {
  if (!isDataLayerEnabledFromSettings()) return false;
  if (typeof window === "undefined") return false;

  const name = String(eventName || "").trim();
  if (!name) return false;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: name,
    timestamp: Date.now(),
    ...payload,
  });
  return true;
};

export const buildDataLayerItem = (source = {}) => {
  const productId = String(
    source.productId || source._id || source.id || source.product || "",
  ).trim();
  const title = String(source.title || source.name || "Product").trim();
  const price = Number(
    source.unitPrice ??
      source.price ??
      source.salePrice ??
      source.currentPrice ??
      0,
  );
  const quantity = Math.max(1, Number(source.quantity || 1));
  const category = String(
    source.category?.name || source.category || source.productType || "",
  ).trim();
  const brand = String(source.brand || "").trim();
  const variation = String(
    source.variationLabel || source.variation || "",
  ).trim();

  return {
    item_id: productId,
    item_name: title,
    price: Number.isFinite(price) ? price : 0,
    quantity,
    item_category: category || undefined,
    item_brand: brand || undefined,
    item_variant: variation || undefined,
  };
};

const slugifyDataLayerValue = (value = "") =>
  safeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeCatalogRecord = (source = {}) => {
  const id = safeString(
    source.id ||
      source._id ||
      source.key ||
      source.productId ||
      source.categoryId ||
      source.brandId ||
      "",
  );
  const name = safeString(
    source.name ||
      source.title ||
      source.label ||
      source.brand ||
      source.category ||
      "",
  );

  return toCleanPayload({
    id: id || undefined,
    name: name || undefined,
    slug: safeString(source.slug || source.path || "") || undefined,
    type:
      safeString(
        source.type || source.categoryType || source.brandType || "",
      ) || undefined,
    description: safeString(source.description || "") || undefined,
    logo_url: safeString(source.logoUrl || source.logo || "") || undefined,
  });
};

const normalizeCatalogRecords = (entries = []) => {
  const seen = new Set();

  return (Array.isArray(entries) ? entries : [])
    .map((entry) => normalizeCatalogRecord(entry))
    .filter((entry) => {
      const key = safeString(entry.name || entry.id).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const buildCatalogDataLayerPayload = ({
  pageKey = "",
  pagePath = "",
  itemListId = "",
  itemListName = "",
  selectedCategoryId = "",
  selectedCategoryName = "",
  selectedCategoryType = "",
  selectedBrand = "",
  collectionType = "",
  searchTerm = "",
  sortBy = "",
  categories = [],
  brands = [],
  catalogProducts = [],
  items = [],
} = {}) => {
  const normalizedCategories = normalizeCatalogRecords(categories);
  const normalizedBrands = normalizeCatalogRecords(brands);
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => buildDataLayerItem(item))
    .filter((item) => item.item_id || item.item_name);
  const catalogProductCount = Array.isArray(catalogProducts)
    ? catalogProducts.length
    : 0;
  const normalizedItemListId =
    safeString(itemListId) ||
    (safeString(selectedBrand)
      ? `brand:${slugifyDataLayerValue(selectedBrand)}`
      : safeString(selectedCategoryId)
        ? `category:${slugifyDataLayerValue(selectedCategoryId)}`
        : safeString(collectionType)
          ? `collection:${slugifyDataLayerValue(collectionType)}`
          : "shop");
  const normalizedItemListName =
    safeString(itemListName) ||
    safeString(selectedBrand) ||
    safeString(selectedCategoryName) ||
    safeString(collectionType) ||
    "Shop";

  return toCleanPayload({
    page_key: safeString(pageKey) || undefined,
    page_path: safeString(pagePath) || undefined,
    item_list_id: normalizedItemListId,
    item_list_name: normalizedItemListName,
    catalog_category_id: safeString(selectedCategoryId) || undefined,
    catalog_category_name: safeString(selectedCategoryName) || undefined,
    catalog_category_type: safeString(selectedCategoryType) || undefined,
    catalog_brand: safeString(selectedBrand) || undefined,
    catalog_collection: safeString(collectionType) || undefined,
    catalog_search_term: safeString(searchTerm) || undefined,
    catalog_sort_by: safeString(sortBy) || undefined,
    catalog_category_count: normalizedCategories.length || undefined,
    catalog_brand_count: normalizedBrands.length || undefined,
    catalog_product_count: catalogProductCount || undefined,
    catalog_visible_item_count: normalizedItems.length || undefined,
    catalog_context: toCleanPayload({
      page_key: safeString(pageKey) || undefined,
      page_path: safeString(pagePath) || undefined,
      selected_category_id: safeString(selectedCategoryId) || undefined,
      selected_category_name: safeString(selectedCategoryName) || undefined,
      selected_category_type: safeString(selectedCategoryType) || undefined,
      selected_brand: safeString(selectedBrand) || undefined,
      selected_collection: safeString(collectionType) || undefined,
      search_term: safeString(searchTerm) || undefined,
      sort_by: safeString(sortBy) || undefined,
      category_count: normalizedCategories.length || undefined,
      brand_count: normalizedBrands.length || undefined,
      product_count: catalogProductCount || undefined,
      visible_item_count: normalizedItems.length || undefined,
    }),
    catalog_categories: normalizedCategories.length
      ? normalizedCategories
      : undefined,
    catalog_brands: normalizedBrands.length ? normalizedBrands : undefined,
    ecommerce: toCleanPayload({
      currency: getDataLayerCurrency(),
      item_list_id: normalizedItemListId,
      item_list_name: normalizedItemListName,
      items: normalizedItems.length ? normalizedItems : undefined,
    }),
  });
};

export const getDataLayerCurrency = () =>
  String(import.meta.env.VITE_STORE_CURRENCY || "BDT")
    .trim()
    .toUpperCase();
