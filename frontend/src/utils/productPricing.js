import {
  getDefaultSelectedVariants,
  getProductPricingForSelectedVariants,
  normalizeSelectedVariantsPayload,
} from "./productVariants";

export const normalizePriceType = (product) =>
  String(product?.priceType || "single").toLowerCase();

export const isTbaPrice = (product) => normalizePriceType(product) === "tba";

const toValidPrice = (value, fallback = null) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string" && value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const getEffectiveProductPrice = (product) => {
  if (!product || isTbaPrice(product)) return null;
  if (normalizePriceType(product) === "best") {
    const salePrice = toValidPrice(product?.salePrice, null);
    if (salePrice !== null) return salePrice;
  }
  return toValidPrice(product?.price, 0);
};

export const getProductPricingDisplay = (product) => {
  const priceType = normalizePriceType(product);
  if (priceType === "tba") {
    return {
      priceType,
      isTba: true,
      currentPrice: null,
      previousPrice: null,
      hasDiscount: false,
    };
  }

  const hasVariants = product?.variantDefinitions && product.variantDefinitions.length > 0;
  if (hasVariants) {
    return getProductCardPricingDisplay(product);
  }

  const currentPrice = getEffectiveProductPrice(product);
  const previousPrice = toValidPrice(product?.price, currentPrice || 0);
  const hasDiscount =
    priceType === "best" &&
    previousPrice !== null &&
    currentPrice !== null &&
    previousPrice > currentPrice;

  return {
    priceType,
    isTba: false,
    currentPrice,
    previousPrice,
    hasDiscount,
  };
};

// For product cards we want a consistent default: first variant option of each
// variant group (if any), and display the resulting combination price.
export const getProductCardPricingDisplay = (product) => {
  const selected = getDefaultSelectedVariants(product);
  const resolved = normalizeSelectedVariantsPayload(selected);
  const pricing = getProductPricingForSelectedVariants(product, resolved);
  return pricing || getProductPricingDisplay(product);
};

