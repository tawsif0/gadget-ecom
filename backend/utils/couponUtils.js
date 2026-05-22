const Coupon = require("../models/Coupon.js");
const Product = require("../models/Product.js");

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const roundMoney = (value) =>
  Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;

const normalizeCouponCode = (code) => String(code || "").trim().toUpperCase();

const extractProductIdFromItem = (item) =>
  item?.productId || item?.product?._id || item?.product || null;

const extractVendorIdFromItem = (item) =>
  item?.vendor || item?.product?.vendor || null;

const calculateEligibleSubtotalForVendor = async (vendorId, items = []) => {
  const normalizedVendorId = String(vendorId || "");
  if (!normalizedVendorId) return 0;

  const productIdsToResolve = [];

  for (const item of items) {
    const itemVendor = extractVendorIdFromItem(item);
    if (itemVendor) continue;

    const productId = extractProductIdFromItem(item);
    if (productId) {
      productIdsToResolve.push(String(productId));
    }
  }

  let productVendorMap = new Map();
  if (productIdsToResolve.length > 0) {
    const products = await Product.find({
      _id: { $in: productIdsToResolve },
    })
      .select("_id vendor")
      .lean();

    productVendorMap = new Map(
      products.map((product) => [String(product._id), String(product.vendor || "")]),
    );
  }

  let eligibleSubtotal = 0;

  for (const item of items) {
    const productId = String(extractProductIdFromItem(item) || "");
    const explicitVendor = String(extractVendorIdFromItem(item) || "");
    const resolvedVendor = explicitVendor || productVendorMap.get(productId) || "";

    if (resolvedVendor !== normalizedVendorId) continue;

    const quantity = Math.max(1, parseInt(item?.quantity, 10) || 1);
    const unitPrice = Math.max(
      0,
      toNumber(item?.price ?? item?.product?.price ?? 0, 0),
    );

    eligibleSubtotal += unitPrice * quantity;
  }

  return roundMoney(Math.max(eligibleSubtotal, 0));
};

const collectItemProductIds = (items = []) =>
  new Set(
    items
      .map((item) => String(extractProductIdFromItem(item) || "").trim())
      .filter(Boolean),
  );

const normalizeStringArray = (value) =>
  [...new Set((Array.isArray(value) ? value : []).map((entry) => String(entry || "").trim()).filter(Boolean))];

const normalizeObjectIdArray = (value) =>
  [...new Set((Array.isArray(value) ? value : []).map((entry) => String(entry || "").trim()).filter((entry) => /^[0-9a-fA-F]{24}$/.test(entry)))];

const hasCatalogTargets = (coupon = {}) =>
  normalizeStringArray(coupon?.targetCategoryTypes).length > 0 ||
  normalizeObjectIdArray(coupon?.targetCategories).length > 0 ||
  normalizeObjectIdArray(coupon?.targetProducts).length > 0;

const buildCouponItemCatalogMap = async (items = []) => {
  const productIds = [...collectItemProductIds(items)];
  if (productIds.length === 0) {
    return new Map();
  }

  const products = await Product.find({ _id: { $in: productIds } })
    .select("_id vendor category")
    .populate({ path: "category", select: "name type" })
    .lean();

  return new Map(products.map((product) => [String(product._id), product]));
};

const buildCouponItemVendorMap = async (items = []) => {
  const productIds = [...collectItemProductIds(items)];
  if (productIds.length === 0) return new Map();

  const products = await Product.find({ _id: { $in: productIds } })
    .select("_id vendor")
    .lean();

  return new Map(
    products.map((product) => [String(product._id), String(product.vendor || "")]),
  );
};

const calculateEligibleSubtotalForCouponTargets = async (coupon = {}, items = []) => {
  const couponVendorId = String(coupon?.vendor || "");
  const targetCategoryTypes = normalizeStringArray(coupon?.targetCategoryTypes).map((entry) =>
    entry.toLowerCase(),
  );
  const targetCategories = new Set(normalizeObjectIdArray(coupon?.targetCategories));
  const targetProducts = new Set(normalizeObjectIdArray(coupon?.targetProducts));
  const needsCatalogTargets = hasCatalogTargets(coupon);
  const hasExplicitVendors = (Array.isArray(items) ? items : []).every((item) => {
    const explicitVendor = String(extractVendorIdFromItem(item) || "");
    return Boolean(explicitVendor);
  });

  const catalogMap = needsCatalogTargets ? await buildCouponItemCatalogMap(items) : new Map();
  const vendorMap =
    !needsCatalogTargets && couponVendorId && !hasExplicitVendors
      ? await buildCouponItemVendorMap(items)
      : new Map();

  let eligibleSubtotal = 0;

  for (const item of items) {
    const productId = String(extractProductIdFromItem(item) || "");
    const catalogProduct = needsCatalogTargets ? catalogMap.get(productId) || null : null;
    const explicitVendor = String(extractVendorIdFromItem(item) || "");
    const resolvedVendor =
      explicitVendor ||
      String(catalogProduct?.vendor || "") ||
      vendorMap.get(productId) ||
      "";

    if (couponVendorId && resolvedVendor !== couponVendorId) {
      continue;
    }

    if (needsCatalogTargets) {
      const categoryId = String(catalogProduct?.category?._id || catalogProduct?.category || "");
      const categoryType = String(catalogProduct?.category?.type || "").trim().toLowerCase();
      const matchesTarget =
        targetProducts.has(productId) ||
        (categoryId && targetCategories.has(categoryId)) ||
        (categoryType && targetCategoryTypes.includes(categoryType));

      if (!matchesTarget) {
        continue;
      }
    }

    const quantity = Math.max(1, parseInt(item?.quantity, 10) || 1);
    const unitPrice = Math.max(0, toNumber(item?.price ?? item?.product?.price ?? 0, 0));
    eligibleSubtotal += unitPrice * quantity;
  }

  return roundMoney(Math.max(eligibleSubtotal, 0));
};

const evaluateCouponForSubtotal = async (coupon, subtotal, items = [], code = "") => {
  if (!coupon || coupon?.isActive === false) {
    return {
      success: false,
      status: 404,
      message: "Invalid or inactive coupon code",
    };
  }

  if (coupon.validUntil && new Date() > coupon.validUntil) {
    return {
      success: false,
      status: 400,
      message: "Coupon has expired",
    };
  }

  if (
    Number.isFinite(coupon.usageLimit) &&
    Number(coupon.usedCount || 0) >= Number(coupon.usageLimit)
  ) {
    return {
      success: false,
      status: 400,
      message: "Coupon usage limit reached",
    };
  }

  const normalizedSubtotal = toNumber(subtotal, NaN);
  if (!Number.isFinite(normalizedSubtotal) || normalizedSubtotal < 0) {
    return {
      success: false,
      status: 400,
      message: "Valid subtotal is required",
    };
  }

  let eligibleSubtotal = normalizedSubtotal;
  const couponVendorId = String(coupon.vendor || "");
  const offerType = String(coupon.offerType || "discount").trim().toLowerCase();
  const normalizedCode = normalizeCouponCode(code || coupon.code);

  if (couponVendorId || hasCatalogTargets(coupon)) {
    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        status: 400,
        message: "This coupon requires cart item details",
      };
    }

    eligibleSubtotal = await calculateEligibleSubtotalForCouponTargets(
      coupon,
      items,
    );

    if (eligibleSubtotal <= 0) {
      return {
        success: false,
        status: 400,
        message: hasCatalogTargets(coupon)
          ? "Coupon is not applicable to the selected products"
          : "Coupon is not applicable to selected cart items",
      };
    }
  }

  const minPurchase = toNumber(coupon.minPurchase, 0);
  if (eligibleSubtotal < minPurchase) {
    return {
      success: false,
      status: 400,
      message: `Minimum purchase of ${minPurchase} required`,
    };
  }

  if (offerType === "combo") {
    const requiredProducts = Array.isArray(coupon.requiredProducts)
      ? coupon.requiredProducts.map((entry) => String(entry || "")).filter(Boolean)
      : [];

    if (requiredProducts.length > 0) {
      const productSet = collectItemProductIds(items);
      const missingProductIds = requiredProducts.filter((id) => !productSet.has(id));
      if (missingProductIds.length > 0) {
        return {
          success: false,
          status: 400,
          message: "Cart items do not satisfy combo coupon requirements",
        };
      }
    }
  }

  let discount = 0;
  let freeShipping = false;

  if (offerType === "free_shipping") {
    freeShipping = true;
    discount = 0;
  } else if (coupon.discountType === "percentage") {
    discount = (eligibleSubtotal * toNumber(coupon.discountValue, 0)) / 100;
    if (Number.isFinite(coupon.maxDiscount) && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = toNumber(coupon.discountValue, 0);
  }

  discount = roundMoney(Math.min(Math.max(discount, 0), eligibleSubtotal));
  const finalAmount = roundMoney(Math.max(normalizedSubtotal - discount, 0));

  return {
    success: true,
    coupon,
    code: normalizedCode,
    offerType,
    freeShipping,
    eligibleSubtotal,
    discount,
    finalAmount,
    appliesToVendor: couponVendorId || null,
  };
};

const validateCouponForSubtotal = async (code, subtotal, items = []) => {
  const normalizedCode = normalizeCouponCode(code);

  if (!normalizedCode) {
    return {
      success: false,
      status: 400,
      message: "Coupon code is required",
    };
  }

  const coupon = await Coupon.findOne({ code: normalizedCode });
  return evaluateCouponForSubtotal(coupon, subtotal, items, normalizedCode);
};

const incrementCouponUsage = async (couponDoc) => {
  if (!couponDoc?._id) return null;

  const filter = {
    _id: couponDoc._id,
    isActive: true,
    validUntil: { $gt: new Date() },
  };

  if (Number.isFinite(couponDoc.usageLimit)) {
    filter.usedCount = { $lt: couponDoc.usageLimit };
  }

  const updatedCoupon = await Coupon.findOneAndUpdate(
    filter,
    { $inc: { usedCount: 1 } },
    { new: true },
  );

  if (!updatedCoupon) {
    throw new Error("Coupon is no longer valid");
  }

  return updatedCoupon;
};

module.exports = {
  normalizeCouponCode,
  validateCouponForSubtotal,
  evaluateCouponForSubtotal,
  incrementCouponUsage,
  roundMoney,
  toNumber,
  calculateEligibleSubtotalForVendor,
  calculateEligibleSubtotalForCouponTargets,
  normalizeStringArray,
  normalizeObjectIdArray,
  hasCatalogTargets,
};
