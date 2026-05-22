export const getPublicStockCategoryIds = (settings = {}) => {
  const source =
    settings?.publicStockCategoryIds !== undefined
      ? settings.publicStockCategoryIds
      : settings?.marketplace?.publicStockCategoryIds;

  if (!Array.isArray(source)) return [];

  return source
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .filter((entry, index, list) => list.indexOf(entry) === index);
};

export const isPublicStockSummaryEnabled = (settings = {}) =>
  Boolean(
    settings?.publicStockSummaryEnabled ??
      settings?.marketplace?.publicStockSummaryEnabled,
  );

export const getProductCategoryId = (product) => {
  if (!product?.category) return "";
  if (typeof product.category === "string") return String(product.category);
  if (product.category?._id) return String(product.category._id);
  return "";
};

export const isPublicStockVisible = (product, settings = null) => {
  const resolvedSettings = settings || {};
  if (!isPublicStockSummaryEnabled(resolvedSettings)) {
    return false;
  }

  const publicCategoryIds = getPublicStockCategoryIds(resolvedSettings);
  if (publicCategoryIds.length === 0) {
    return false;
  }

  return publicCategoryIds.includes(getProductCategoryId(product));
};

export const getNumericStockValue = (value) => {
  const normalized = Number(value || 0);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
};

export const getPublicStockQuantity = (product, variation = null, settings = null) => {
  if (!isPublicStockVisible(product, settings)) {
    return null;
  }

  const source = variation && typeof variation === "object" ? variation : product;
  return getNumericStockValue(source?.stock);
};

export const getPublicStockBadgeText = (product, variation = null, settings = null) => {
  const quantity = getPublicStockQuantity(product, variation, settings);
  if (quantity === null) {
    return "";
  }
  return `Stock ${quantity}`;
};

export const hasPurchasableInventory = (product, variation = null) =>
  getNumericStockValue(variation?.stock ?? product?.stock) > 0;
