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

