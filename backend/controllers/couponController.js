const Coupon = require("../models/Coupon.js");
const Vendor = require("../models/Vendor.js");
const Product = require("../models/Product.js");
const Category = require("../models/Category.js");
const {
  normalizeCouponCode,
  normalizeObjectIdArray,
  normalizeStringArray,
  validateCouponForSubtotal,
  toNumber,
} = require("../utils/couponUtils.js");

const isAdminUser = (user) =>
  user && (user.userType === "admin" || user.role === "admin");

const isVendorUser = () => false;

const ensureCouponManager = (req, res) => {
  if (isAdminUser(req.user)) return true;

  res.status(403).json({
    success: false,
    message: "Admin access required",
  });
  return false;
};

const parseUsageLimit = (value) => {
  if (value === null || value === "" || value === undefined) {
    return { value: null };
  }

  const parsed = parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return { error: "Usage limit must be at least 1" };
  }

  return { value: parsed };
};

const normalizeOfferType = (value) => {
  const normalized = String(value || "discount")
    .trim()
    .toLowerCase();
  return ["discount", "free_shipping", "combo"].includes(normalized)
    ? normalized
    : "discount";
};

const normalizeRequiredProducts = (value) => {
  const source = Array.isArray(value) ? value : [];
  const ids = source
    .map((entry) => String(entry || "").trim())
    .filter((entry) => /^[0-9a-fA-F]{24}$/.test(entry));
  return [...new Set(ids)];
};

const CATEGORY_TYPE_OPTIONS = [
  "General",
  "Popular",
  "Hot deals",
  "Best Selling",
  "Latest",
];

const normalizeCategoryTypes = (value) => {
  const source = normalizeStringArray(value);
  return source
    .map((entry) => {
      const matched = CATEGORY_TYPE_OPTIONS.find(
        (option) => option.toLowerCase() === entry.toLowerCase(),
      );
      return matched || "";
    })
    .filter(Boolean);
};

const resolveCouponCatalogTargeting = async ({
  applicabilityMode,
  targetCategoryTypes,
  targetCategories,
  targetProducts,
  vendorId = null,
}) => {
  const normalizedMode =
    String(applicabilityMode || "").trim().toLowerCase() === "targeted"
      ? "targeted"
      : "global";
  const normalizedCategoryTypes = normalizeCategoryTypes(targetCategoryTypes);
  const normalizedTargetCategories = normalizeObjectIdArray(targetCategories);
  const normalizedTargetProducts = normalizeObjectIdArray(targetProducts);

  if (normalizedMode === "global") {
    return {
      applicabilityMode: "global",
      targetCategoryTypes: [],
      targetCategories: [],
      targetProducts: [],
    };
  }

  if (
    normalizedMode === "targeted" &&
    !normalizedCategoryTypes.length &&
    !normalizedTargetCategories.length &&
    !normalizedTargetProducts.length
  ) {
    return { error: "Select at least one category type, category, or product" };
  }

  if (normalizedTargetCategories.length > 0) {
    const categories = await Category.find({ _id: { $in: normalizedTargetCategories } })
      .select("_id")
      .lean();

    if (categories.length !== normalizedTargetCategories.length) {
      return { error: "One or more selected categories are invalid" };
    }
  }

  if (normalizedTargetProducts.length > 0) {
    const products = await Product.find({ _id: { $in: normalizedTargetProducts } })
      .select("_id vendor")
      .lean();

    if (products.length !== normalizedTargetProducts.length) {
      return { error: "One or more selected target products are invalid" };
    }

    if (vendorId) {
      const mismatched = products.some(
        (product) => String(product.vendor || "") !== String(vendorId),
      );
      if (mismatched) {
        return {
          error: "Target products must belong to the same vendor scope",
        };
      }
    }
  }

  return {
    applicabilityMode: normalizedMode,
    targetCategoryTypes: normalizedCategoryTypes,
    targetCategories: normalizedTargetCategories,
    targetProducts: normalizedTargetProducts,
  };
};

const getVendorForRequester = async (req) =>
  Vendor.findOne({ user: req.user.id || req.user._id })
    .select("_id storeName status")
    .lean();

const resolveCouponVendorForPayload = async (req, vendorIdFromPayload) => {
  if (isVendorUser(req.user) && !isAdminUser(req.user)) {
    const requesterVendor = await getVendorForRequester(req);
    if (!requesterVendor) {
      return {
        error: "Vendor profile not found",
      };
    }

    if (requesterVendor.status !== "approved") {
      return {
        error: "Vendor profile is not approved yet",
      };
    }

    return {
      vendorId: requesterVendor._id,
      vendor: requesterVendor,
    };
  }

  if (isAdminUser(req.user) && vendorIdFromPayload) {
    const vendor = await Vendor.findById(vendorIdFromPayload)
      .select("_id storeName status")
      .lean();

    if (!vendor) {
      return {
        error: "Vendor not found",
      };
    }

    return {
      vendorId: vendor._id,
      vendor,
    };
  }

  return {
    vendorId: null,
    vendor: null,
  };
};

// Apply coupon
exports.applyCoupon = async (req, res) => {
  try {
    const { code, subtotal, items = [] } = req.body;
    const validation = await validateCouponForSubtotal(code, subtotal, items);

    if (!validation.success) {
      return res.status(validation.status).json({
        success: false,
        message: validation.message,
      });
    }

    res.json({
      success: true,
      message: "Coupon applied successfully",
      code: validation.code,
      offerType: validation.offerType || validation.coupon.offerType || "discount",
      freeShipping: Boolean(validation.freeShipping),
      discount: validation.discount,
      finalAmount: validation.finalAmount,
      eligibleSubtotal: validation.eligibleSubtotal,
      appliesToVendor: validation.appliesToVendor,
      coupon: {
        _id: validation.coupon._id,
        code: validation.coupon.code,
        offerType: validation.coupon.offerType || "discount",
        freeShipping: validation.coupon.offerType === "free_shipping",
        discountType: validation.coupon.discountType,
        discountValue: validation.coupon.discountValue,
        vendor: validation.coupon.vendor || null,
      },
    });
  } catch (error) {
    console.error("Apply coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while applying coupon",
    });
  }
};

// Create coupon (admin/vendor)
exports.createCoupon = async (req, res) => {
  try {
    if (!ensureCouponManager(req, res)) return;

    const {
      code,
      discountType,
      offerType,
      discountValue,
      minPurchase,
      maxDiscount,
      validUntil,
      usageLimit,
      isActive,
      vendorId,
      requiredProducts,
      applicabilityMode,
      targetCategoryTypes,
      targetCategories,
      targetProducts,
    } = req.body;

    if (!code || !validUntil) {
      return res.status(400).json({
        success: false,
        message: "Code and valid until date are required",
      });
    }

    const normalizedCode = normalizeCouponCode(code);
    if (!normalizedCode) {
      return res.status(400).json({
        success: false,
        message: "Valid coupon code is required",
      });
    }

    const normalizedOfferType = normalizeOfferType(offerType);
    const rawDiscountValue = toNumber(discountValue, NaN);
    const normalizedDiscountValue =
      normalizedOfferType === "free_shipping"
        ? Number.isFinite(rawDiscountValue) && rawDiscountValue >= 0
          ? rawDiscountValue
          : 0
        : rawDiscountValue;

    if (
      !Number.isFinite(normalizedDiscountValue) ||
      (normalizedOfferType !== "free_shipping" && normalizedDiscountValue <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message:
          normalizedOfferType === "free_shipping"
            ? "Discount value must be a valid number"
            : "Discount value must be greater than zero",
      });
    }

    const parsedValidUntil = new Date(validUntil);
    if (Number.isNaN(parsedValidUntil.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Valid expiry date is required",
      });
    }

    const usageLimitResult = parseUsageLimit(usageLimit);
    if (usageLimitResult.error) {
      return res.status(400).json({
        success: false,
        message: usageLimitResult.error,
      });
    }

    const vendorResolution = await resolveCouponVendorForPayload(req, vendorId);
    if (vendorResolution.error) {
      return res.status(400).json({
        success: false,
        message: vendorResolution.error,
      });
    }

    const catalogTargeting = await resolveCouponCatalogTargeting({
      applicabilityMode,
      targetCategoryTypes,
      targetCategories,
      targetProducts,
      vendorId: vendorResolution.vendorId,
    });
    if (catalogTargeting.error) {
      return res.status(400).json({
        success: false,
        message: catalogTargeting.error,
      });
    }

    const normalizedRequiredProducts = normalizeRequiredProducts(requiredProducts);
    if (normalizedOfferType === "combo" && normalizedRequiredProducts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Select at least one combo product",
      });
    }

    if (normalizedRequiredProducts.length > 0) {
      const products = await Product.find({ _id: { $in: normalizedRequiredProducts } })
        .select("_id vendor")
        .lean();

      if (products.length !== normalizedRequiredProducts.length) {
        return res.status(400).json({
          success: false,
          message: "One or more required products are invalid",
        });
      }

      if (vendorResolution.vendorId) {
        const mismatched = products.some(
          (product) => String(product.vendor || "") !== String(vendorResolution.vendorId),
        );
        if (mismatched) {
          return res.status(400).json({
            success: false,
            message: "Combo products must belong to the same vendor scope",
          });
        }
      }
    }

    const coupon = await Coupon.create({
      code: normalizedCode,
      discountType: discountType || "percentage",
      offerType: normalizedOfferType,
      discountValue: normalizedDiscountValue,
      minPurchase: toNumber(minPurchase, 0),
      maxDiscount:
        maxDiscount === null || maxDiscount === "" || maxDiscount === undefined
          ? null
          : toNumber(maxDiscount, 0),
      validUntil: parsedValidUntil,
      usageLimit: usageLimitResult.value,
      isActive: typeof isActive === "boolean" ? isActive : true,
      requiredProducts: normalizedRequiredProducts,
      applicabilityMode: catalogTargeting.applicabilityMode,
      targetCategoryTypes: catalogTargeting.targetCategoryTypes,
      targetCategories: catalogTargeting.targetCategories,
      targetProducts: catalogTargeting.targetProducts,
      createdBy: req.user.id || req.user._id,
    });

    const populatedCoupon = await Coupon.findById(coupon._id)
      .populate("requiredProducts", "title")
      .populate("targetCategories", "name type")
      .populate("targetProducts", "title")
      .lean();

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      coupon: populatedCoupon,
    });
  } catch (error) {
    console.error("Create coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating coupon",
    });
  }
};

// Get coupons (admin gets all, vendor gets own)
exports.getCoupons = async (req, res) => {
  try {
    if (!ensureCouponManager(req, res)) return;

    const query = {};

    if (isVendorUser(req.user) && !isAdminUser(req.user)) {
      const requesterVendor = await getVendorForRequester(req);
      if (!requesterVendor) {
        return res.status(404).json({
          success: false,
          message: "Vendor profile not found",
        });
      }
      query.vendor = requesterVendor._id;
    }

    const coupons = await Coupon.find(query)
      .populate("vendor", "storeName slug")
      .populate("requiredProducts", "title vendor")
      .populate("targetCategories", "name type")
      .populate("targetProducts", "title vendor")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      coupons,
    });
  } catch (error) {
    console.error("Get coupons error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching coupons",
    });
  }
};

const ensureCanManageCoupon = async (req, couponId) => {
  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    return {
      status: 404,
      message: "Coupon not found",
    };
  }

  if (isAdminUser(req.user)) {
    return { coupon };
  }

  if (!isVendorUser(req.user)) {
    return {
      status: 403,
      message: "Admin or vendor access required",
    };
  }

  const requesterVendor = await getVendorForRequester(req);
  if (!requesterVendor) {
    return {
      status: 404,
      message: "Vendor profile not found",
    };
  }

  if (String(coupon.vendor || "") !== String(requesterVendor._id)) {
    return {
      status: 403,
      message: "You can manage only your own vendor coupons",
    };
  }

  return { coupon, requesterVendor };
};

// Update coupon
exports.updateCoupon = async (req, res) => {
  try {
    if (!ensureCouponManager(req, res)) return;

    const permission = await ensureCanManageCoupon(req, req.params.id);
    if (!permission.coupon) {
      return res.status(permission.status).json({
        success: false,
        message: permission.message,
      });
    }

    const {
      code,
      discountType,
      offerType,
      discountValue,
      minPurchase,
      maxDiscount,
      validUntil,
      usageLimit,
      isActive,
      vendorId,
      requiredProducts,
      applicabilityMode,
      targetCategoryTypes,
      targetCategories,
      targetProducts,
    } = req.body;

    const updateData = {
      updatedAt: new Date(),
    };

    if (code !== undefined) {
      const normalizedCode = normalizeCouponCode(code);
      if (!normalizedCode) {
        return res.status(400).json({
          success: false,
          message: "Valid coupon code is required",
        });
      }
      updateData.code = normalizedCode;
    }

    if (offerType !== undefined) {
      updateData.offerType = normalizeOfferType(offerType);
    }

    if (discountType !== undefined) {
      updateData.discountType = discountType;
    }

    if (discountValue !== undefined) {
      const nextOfferType = normalizeOfferType(
        updateData.offerType || permission.coupon.offerType,
      );
      const normalizedDiscountValue = toNumber(discountValue, NaN);
      if (
        !Number.isFinite(normalizedDiscountValue) ||
        (nextOfferType !== "free_shipping" && normalizedDiscountValue <= 0)
      ) {
        return res.status(400).json({
          success: false,
          message:
            nextOfferType === "free_shipping"
              ? "Discount value must be a valid number"
              : "Discount value must be greater than zero",
        });
      }
      updateData.discountValue = normalizedDiscountValue;
    }

    if (minPurchase !== undefined) {
      updateData.minPurchase = toNumber(minPurchase, 0);
    }

    if (maxDiscount !== undefined) {
      updateData.maxDiscount =
        maxDiscount === null || maxDiscount === ""
          ? null
          : toNumber(maxDiscount, 0);
    }

    if (validUntil !== undefined) {
      const parsedValidUntil = new Date(validUntil);
      if (Number.isNaN(parsedValidUntil.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Valid expiry date is required",
        });
      }
      updateData.validUntil = parsedValidUntil;
    }

    if (usageLimit !== undefined) {
      const usageLimitResult = parseUsageLimit(usageLimit);
      if (usageLimitResult.error) {
        return res.status(400).json({
          success: false,
          message: usageLimitResult.error,
        });
      }
      updateData.usageLimit = usageLimitResult.value;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    if (
      applicabilityMode !== undefined ||
      targetCategoryTypes !== undefined ||
      targetCategories !== undefined ||
      targetProducts !== undefined
    ) {
      const catalogTargeting = await resolveCouponCatalogTargeting({
        applicabilityMode:
          applicabilityMode !== undefined
            ? applicabilityMode
            : updateData.applicabilityMode || permission.coupon.applicabilityMode,
        targetCategoryTypes:
          targetCategoryTypes !== undefined
            ? targetCategoryTypes
            : updateData.targetCategoryTypes || permission.coupon.targetCategoryTypes,
        targetCategories:
          targetCategories !== undefined
            ? targetCategories
            : updateData.targetCategories || permission.coupon.targetCategories,
        targetProducts:
          targetProducts !== undefined
            ? targetProducts
            : updateData.targetProducts || permission.coupon.targetProducts,
        vendorId: null,
      });

      if (catalogTargeting.error) {
        return res.status(400).json({
          success: false,
          message: catalogTargeting.error,
        });
      }

      updateData.applicabilityMode = catalogTargeting.applicabilityMode;
      updateData.targetCategoryTypes = catalogTargeting.targetCategoryTypes;
      updateData.targetCategories = catalogTargeting.targetCategories;
      updateData.targetProducts = catalogTargeting.targetProducts;
    }

    if (requiredProducts !== undefined) {
      const normalizedRequiredProducts = normalizeRequiredProducts(requiredProducts);
      const nextOfferType = normalizeOfferType(
        updateData.offerType || permission.coupon.offerType,
      );

      if (nextOfferType === "combo" && normalizedRequiredProducts.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Select at least one combo product",
        });
      }

      if (normalizedRequiredProducts.length > 0) {
        const products = await Product.find({ _id: { $in: normalizedRequiredProducts } })
          .select("_id vendor")
          .lean();

        if (products.length !== normalizedRequiredProducts.length) {
          return res.status(400).json({
            success: false,
            message: "One or more required products are invalid",
          });
        }

        const scopeVendorId = String(
          updateData.vendor !== undefined ? updateData.vendor : permission.coupon.vendor || "",
        );
        if (scopeVendorId) {
          const mismatched = products.some(
            (product) => String(product.vendor || "") !== scopeVendorId,
          );
          if (mismatched) {
            return res.status(400).json({
              success: false,
              message: "Combo products must belong to the same vendor scope",
            });
          }
        }
      }

      updateData.requiredProducts = normalizedRequiredProducts;
    }

    if (
      updateData.offerType === "combo" &&
      requiredProducts === undefined &&
      !Array.isArray(permission.coupon.requiredProducts)
    ) {
      return res.status(400).json({
        success: false,
        message: "Select at least one combo product",
      });
    }

    if (
      updateData.offerType === "combo" &&
      requiredProducts === undefined &&
      Array.isArray(permission.coupon.requiredProducts) &&
      permission.coupon.requiredProducts.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Select at least one combo product",
      });
    }

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("vendor", "storeName slug")
      .populate("requiredProducts", "title vendor")
      .populate("targetCategories", "name type")
      .populate("targetProducts", "title vendor");

    res.json({
      success: true,
      message: "Coupon updated successfully",
      coupon,
    });
  } catch (error) {
    console.error("Update coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating coupon",
    });
  }
};

// Delete coupon
exports.deleteCoupon = async (req, res) => {
  try {
    if (!ensureCouponManager(req, res)) return;

    const permission = await ensureCanManageCoupon(req, req.params.id);
    if (!permission.coupon) {
      return res.status(permission.status).json({
        success: false,
        message: permission.message,
      });
    }

    await permission.coupon.deleteOne();

    res.json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Delete coupon error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting coupon",
    });
  }
};
