import {
  getEffectiveProductPricing,
  normalizeSelectedVariantsPayload,
} from "./productVariants";

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const toFinitePrice = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const getVariationPricing = (variation = {}) => {
  const salePrice = toFinitePrice(variation?.salePrice);
  const regularPrice = toFinitePrice(variation?.price);

  if (salePrice !== null && regularPrice !== null && regularPrice > salePrice) {
    return {
      basePrice: salePrice,
      baseComparePrice: regularPrice,
    };
  }

  return {
    basePrice: regularPrice ?? salePrice ?? 0,
    baseComparePrice: null,
  };
};

const getProductPricing = (product = {}) => {
  const priceType = String(product?.priceType || "single").trim().toLowerCase();
  const salePrice = toFinitePrice(product?.salePrice);
  const regularPrice = toFinitePrice(product?.price);

  if (priceType === "best" && salePrice !== null && regularPrice !== null && regularPrice > salePrice) {
    return {
      basePrice: salePrice,
      baseComparePrice: regularPrice,
    };
  }

  return {
    basePrice: regularPrice ?? salePrice ?? 0,
    baseComparePrice: null,
  };
};

export const resolveEffectiveUnitPriceForProduct = (
  product,
  variationId = "",
  selectedVariants = [],
) => {
  if (!product || typeof product !== "object") return 0;

  const normalizedSelectedVariants = normalizeSelectedVariantsPayload(selectedVariants);
  const normalizedVariationId = String(variationId || "").trim();
  const marketplaceType = String(product?.marketplaceType || "simple")
    .trim()
    .toLowerCase();

  if (
    marketplaceType === "variable" &&
    normalizedVariationId &&
    Array.isArray(product?.variations)
  ) {
    const selectedVariation =
      product.variations.find(
        (variation) =>
          String(variation?._id || "") === normalizedVariationId &&
          variation?.isActive !== false,
      ) || null;

    if (selectedVariation) {
      const pricing = getVariationPricing(selectedVariation);
      const resolved = getEffectiveProductPricing({
        basePrice: pricing.basePrice,
        baseComparePrice: pricing.baseComparePrice,
        selectedVariants: normalizedSelectedVariants,
      });

      if (Number.isFinite(resolved.currentPrice) && resolved.currentPrice >= 0) {
        return roundMoney(resolved.currentPrice);
      }
    }
  }

  const pricing = getProductPricing(product);
  const resolved = getEffectiveProductPricing({
    basePrice: pricing.basePrice,
    baseComparePrice: pricing.baseComparePrice,
    selectedVariants: normalizedSelectedVariants,
  });

  if (Number.isFinite(resolved.currentPrice) && resolved.currentPrice >= 0) {
    return roundMoney(resolved.currentPrice);
  }

  return roundMoney(pricing.basePrice);
};

export const resolveLiveCartLineUnitPrice = (item = {}) => {
  const storedUnitPrice = toFinitePrice(item?.unitPrice);
  if (storedUnitPrice !== null) {
    return roundMoney(storedUnitPrice);
  }

  const product =
    item?.product && typeof item.product === "object" ? item.product : null;
  if (product) {
    const resolved = resolveEffectiveUnitPriceForProduct(
      product,
      item?.variationId || "",
      item?.selectedVariants || [],
    );
    if (Number.isFinite(resolved) && resolved >= 0) {
      return roundMoney(resolved);
    }
  }

  const fallbackPrice = toFinitePrice(
    item?.price ?? product?.salePrice ?? product?.price ?? 0,
  );
  return roundMoney(fallbackPrice ?? 0);
};

export const resolveLiveCartLineTotal = (item = {}) => {
  const quantity = Math.max(1, Number(item?.quantity || 1));
  return roundMoney(resolveLiveCartLineUnitPrice(item) * quantity);
};
