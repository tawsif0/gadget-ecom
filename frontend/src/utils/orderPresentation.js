import {
  getResolvedSelectedVariants,
  getSelectedVariantSummaryLines,
  normalizeColorHex,
} from "./productVariants";

const isCashOnDeliveryValue = (value) =>
  /\bcod\b|cash[\s_-]*on[\s_-]*delivery/i.test(String(value || "").trim());

const toWholeNumber = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const COLOR_SWATCH_FALLBACKS = {
  black: "#000000",
  white: "#ffffff",
  gray: "#6b7280",
  grey: "#6b7280",
  silver: "#cbd5e1",
  blue: "#2563eb",
  navy: "#1e3a8a",
  green: "#16a34a",
  red: "#dc2626",
  orange: "#f97316",
  yellow: "#eab308",
  purple: "#9333ea",
  pink: "#db2777",
  beige: "#f0deba",
  brown: "#a16207",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  skyblue: "#0ea5e9",
  "sky blue": "#0ea5e9",
};

const readDeliveryWindow = (source = {}) => {
  const estimatedMinDays = toWholeNumber(
    source?.estimatedMinDays ?? source?.deliveryMinDays,
  );
  const estimatedMaxDays = Math.max(
    estimatedMinDays,
    toWholeNumber(source?.estimatedMaxDays ?? source?.deliveryMaxDays),
  );

  return {
    estimatedMinDays,
    estimatedMaxDays,
    hasEstimate: estimatedMaxDays > 0,
  };
};

const getItemDeliveryWindow = (items = []) => {
  let estimatedMinDays = 0;
  let estimatedMaxDays = 0;

  items.forEach((item) => {
    const product =
      item?.product && typeof item.product === "object" ? item.product : {};
    const deliveryWindow = readDeliveryWindow(product);

    if (!deliveryWindow.hasEstimate) return;

    estimatedMinDays = Math.max(
      estimatedMinDays,
      deliveryWindow.estimatedMinDays,
    );
    estimatedMaxDays = Math.max(
      estimatedMaxDays,
      deliveryWindow.estimatedMaxDays,
    );
  });

  return {
    estimatedMinDays,
    estimatedMaxDays,
    hasEstimate: estimatedMaxDays > 0,
  };
};

const addBusinessDays = (dateValue, businessDays) => {
  const startDate = new Date(dateValue);
  if (Number.isNaN(startDate.getTime())) return null;

  const result = new Date(startDate);
  let remainingDays = Math.max(0, toWholeNumber(businessDays));

  while (remainingDays > 0) {
    result.setDate(result.getDate() + 1);
    const weekday = result.getDay();
    if (weekday !== 0 && weekday !== 6) {
      remainingDays -= 1;
    }
  }

  return result;
};

export const formatPaymentMethodLabel = (value) => {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase().replace(/[_-]+/g, " ");
  if (normalized === "cod" || normalized === "cash on delivery") {
    return "Cash on Delivery";
  }
  if (normalized === "bkash") {
    return "bKash";
  }
  if (normalized === "nagad") {
    return "Nagad";
  }
  return raw.replace(/_/g, " ");
};

export const formatShippingSourceLabel = (order = {}) => {
  const shippingMeta =
    order?.shippingMeta && typeof order.shippingMeta === "object"
      ? order.shippingMeta
      : {};
  const sourceLabel = String(shippingMeta?.sourceLabel || "").trim();

  if (sourceLabel) {
    return sourceLabel;
  }

  if (shippingMeta?.source === "fallback-outside-dhaka") {
    return "Fallback shipping applied (Outside Dhaka)";
  }

  if (shippingMeta?.source === "zone-based") {
    return "Shipping calculated from zone";
  }

  if (String(shippingMeta?.source || "").trim()) {
    return String(shippingMeta.source)
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return "Shipping source unavailable";
};

export const formatPaymentStatusLabel = (value) => {
  const normalized =
    String(value || "pending")
      .trim()
      .toLowerCase() || "pending";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const isCashOnDeliveryOrder = (order = {}) => {
  const paymentCategory = String(order?.paymentDetails?.paymentCategory || "")
    .trim()
    .toLowerCase();
  const providerType = String(order?.paymentDetails?.providerType || "")
    .trim()
    .toLowerCase();
  const paymentLookup = `${order?.paymentMethod || ""} ${order?.paymentDetails?.method || ""}`;

  return (
    paymentCategory === "cash_on_delivery" ||
    providerType === "cod" ||
    isCashOnDeliveryValue(paymentLookup)
  );
};

export const shouldShowPaymentStatus = (order = {}) =>
  !isCashOnDeliveryOrder(order);

export const getOrderEstimatedDeliveryMeta = (order = {}) => {
  const shippingWindow = readDeliveryWindow(
    order?.shippingMeta && typeof order.shippingMeta === "object"
      ? order.shippingMeta
      : {},
  );

  if (shippingWindow.hasEstimate) {
    return shippingWindow;
  }

  return getItemDeliveryWindow(Array.isArray(order?.items) ? order.items : []);
};

export const formatOrderEstimatedDeliveryLabel = (order = {}) => {
  const { hasEstimate, estimatedMinDays, estimatedMaxDays } =
    getOrderEstimatedDeliveryMeta(order);

  if (!hasEstimate) {
    return "To be confirmed";
  }

  if (estimatedMinDays > 0 && estimatedMinDays < estimatedMaxDays) {
    return `${estimatedMinDays}-${estimatedMaxDays} business days`;
  }

  return `${estimatedMaxDays || estimatedMinDays} business days`;
};

export const formatOrderEstimatedDeliveryDate = (
  order = {},
  locale = "en-US",
) => {
  const { hasEstimate, estimatedMinDays, estimatedMaxDays } =
    getOrderEstimatedDeliveryMeta(order);

  if (!hasEstimate || !order?.createdAt) {
    return "To be confirmed";
  }

  const estimatedDate = addBusinessDays(
    order.createdAt,
    estimatedMaxDays || estimatedMinDays,
  );

  if (!estimatedDate) {
    return "To be confirmed";
  }

  return estimatedDate.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
};

export const getOrderCustomerProfile = (order = {}) => {
  const customer =
    order?.customer && typeof order.customer === "object" ? order.customer : {};
  const shipping =
    order?.shippingAddress && typeof order.shippingAddress === "object"
      ? order.shippingAddress
      : {};

  const fallbackName =
    String(order?.customerName || "").trim() ||
    `${String(shipping?.firstName || "").trim()} ${String(
      shipping?.lastName || "",
    ).trim()}`.trim();

  return {
    name: String(customer?.name || fallbackName || "Customer").trim(),
    email: String(customer?.email || shipping?.email || "").trim(),
    phone: String(customer?.phone || shipping?.phone || "").trim(),
    accountType: String(
      customer?.accountType || (order?.user ? "Registered" : "Guest"),
    ).trim(),
  };
};

const isColorVariant = (variant = {}) =>
  String(
    variant?.preset || variant?.kind || variant?.type || variant?.name || "",
  )
    .trim()
    .toLowerCase() === "color";

const getOrderItemSelectedVariants = (item = {}) => {
  const selectedVariants = Array.isArray(item?.selectedVariants)
    ? item.selectedVariants
    : [];
  const product =
    item?.product && typeof item.product === "object" ? item.product : item;
  const resolvedSelectedVariants = getResolvedSelectedVariants(
    product,
    selectedVariants,
  );

  return resolvedSelectedVariants.length
    ? resolvedSelectedVariants
    : selectedVariants;
};

const resolveOrderSwatchColor = (value) => {
  const normalizedColorHex = normalizeColorHex(value);
  if (normalizedColorHex) {
    return normalizedColorHex;
  }

  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalizedValue) {
    return "";
  }

  if (COLOR_SWATCH_FALLBACKS[normalizedValue]) {
    return COLOR_SWATCH_FALLBACKS[normalizedValue];
  }

  if (COLOR_SWATCH_FALLBACKS[normalizedValue.replace(/\s+/g, "")]) {
    return COLOR_SWATCH_FALLBACKS[normalizedValue.replace(/\s+/g, "")];
  }

  return normalizedValue.includes(" ") ? "" : normalizedValue;
};

export const getOrderItemColorSwatch = (item = {}) => {
  const selectedVariants = getOrderItemSelectedVariants(item);
  const selectedColorVariant = selectedVariants.find((variant) =>
    isColorVariant(variant),
  );
  const normalizedSelectedColor = normalizeColorHex(
    selectedColorVariant?.colorHex ||
      selectedColorVariant?.colorCode ||
      selectedColorVariant?.color ||
      selectedColorVariant?.hex,
  );
  const selectedColor = String(
    normalizedSelectedColor ||
      selectedColorVariant?.colorHex ||
      selectedColorVariant?.colorCode ||
      selectedColorVariant?.color ||
      selectedColorVariant?.hex ||
      selectedColorVariant?.value ||
      selectedColorVariant?.label ||
      "",
  ).trim();

  if (selectedColor) {
    return resolveOrderSwatchColor(selectedColor) || selectedColor;
  }

  const legacyColor = String(item?.color || "").trim();
  if (legacyColor && legacyColor.toLowerCase() !== "default") {
    return resolveOrderSwatchColor(legacyColor) || legacyColor;
  }

  const legacyType = String(item?.variantType || item?.variationId || "")
    .trim()
    .toLowerCase();
  const legacyOption = String(
    item?.variantOption || item?.variationLabel || "",
  ).trim();
  if (legacyType === "color" && legacyOption) {
    return resolveOrderSwatchColor(legacyOption) || legacyOption;
  }

  return "";
};

export const getOrderItemVariantLines = (item = {}) => {
  const selectedLines = getSelectedVariantSummaryLines(
    getOrderItemSelectedVariants(item),
  );
  const variationLabel = String(item?.variationLabel || "").trim();

  if (selectedLines.length) {
    return selectedLines;
  }

  return variationLabel ? [variationLabel] : [];
};

export const getOrderItemMetaLine = (item = {}) =>
  [item?.sku, item?.dimensions].filter(Boolean).join(" | ");

export const getOrderItemUnitPrice = (item = {}) => {
  const directPrice = Number(item?.price);
  if (Number.isFinite(directPrice) && directPrice >= 0) {
    return roundMoney(directPrice);
  }

  const product =
    item?.product && typeof item.product === "object" ? item.product : {};
  const fallbackPrice = Number(
    item?.unitPrice ?? product?.salePrice ?? product?.price ?? 0,
  );

  return Number.isFinite(fallbackPrice) && fallbackPrice >= 0
    ? roundMoney(fallbackPrice)
    : 0;
};

export const getOrderItemLineTotal = (item = {}) => {
  const explicitTotal = Number(item?.itemTotal);
  if (Number.isFinite(explicitTotal) && explicitTotal >= 0) {
    return roundMoney(explicitTotal);
  }

  const quantity = Math.max(1, Number(item?.quantity || 1));
  return roundMoney(getOrderItemUnitPrice(item) * quantity);
};
