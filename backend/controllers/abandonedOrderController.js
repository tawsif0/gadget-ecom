const mongoose = require("mongoose");
const AbandonedOrder = require("../models/AbandonedOrder");
const Product = require("../models/Product");
const Order = require("../models/Order");
const LandingPage = require("../models/LandingPage");
const {
  normalizeSelectedVariantsForProduct,
  normalizeSelectedVariantsPayload,
  resolveProductPricingForSelection,
} = require("../utils/productVariants");
const {
  isAdmin,
  getVendorForUser,
  getUserId,
} = require("../utils/marketplaceAccess");

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const parseDate = (value, fallback = null) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
};

const normalizeString = (value, max = 500) =>
  String(value || "")
    .trim()
    .slice(0, max);

const normalizeSessionKey = (value) => normalizeString(value, 160);

const generateOrderNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `ORD-${timestamp}-${random}`;
};

const buildScope = async (req, res, { allowPublic = false } = {}) => {
  if (allowPublic && !req.user) {
    return {
      public: true,
      admin: false,
      vendorId: null,
    };
  }

  if (isAdmin(req.user)) {
    return {
      public: false,
      admin: true,
      vendorId: null,
    };
  }

  const access = await getVendorForUser(req.user, {
    approvedOnly: false,
    allowStaff: true,
  });

  if (!access?.vendor) {
    res.status(403).json({
      success: false,
      message: "Vendor or admin access required",
    });
    return null;
  }

  return {
    public: false,
    admin: false,
    vendorId: String(access.vendor._id),
    access,
  };
};

const applyScope = (query, scope) => {
  if (scope?.vendorId) {
    query.vendorIds = new mongoose.Types.ObjectId(scope.vendorId);
  }
  return query;
};

const getProductImage = (product) => {
  const first = Array.isArray(product?.images) ? product.images[0] : null;
  if (!first) return "";

  if (typeof first === "string") return first;
  if (typeof first === "object") {
    return String(
      first?.data || first?.url || first?.secure_url || first?.src || first?.path || "",
    );
  }

  return "";
};

const getBasePrice = (product, variation = null) => {
  if (variation) {
    if (variation.salePrice !== null && variation.salePrice !== undefined) {
      return Math.max(0, parseNumber(variation.salePrice, parseNumber(variation.price, 0)));
    }
    return Math.max(0, parseNumber(variation.price, 0));
  }

  if (
    String(product?.priceType || "single") === "best" &&
    product?.salePrice !== null &&
    product?.salePrice !== undefined
  ) {
    return Math.max(0, parseNumber(product.salePrice, parseNumber(product.price, 0)));
  }

  return Math.max(0, parseNumber(product?.price, 0));
};

const getBaseComparePrice = (product, variation = null) => {
  if (variation) {
    if (variation.salePrice !== null && variation.salePrice !== undefined) {
      return Math.max(0, parseNumber(variation.price, 0));
    }
    return null;
  }

  if (
    String(product?.priceType || "single") === "best" &&
    product?.salePrice !== null &&
    product?.salePrice !== undefined
  ) {
    return Math.max(0, parseNumber(product.price, 0));
  }

  return null;
};

const buildCapturedItems = async (rawItems = []) => {
  const normalized = rawItems
    .map((entry) => ({
      productId: String(entry?.productId || entry?.product || "").trim(),
      quantity: Math.max(1, Number.parseInt(entry?.quantity, 10) || 1),
      price: Math.max(0, parseNumber(entry?.price ?? entry?.unitPrice, NaN)),
      title: normalizeString(entry?.title || "", 220),
      image: normalizeString(entry?.image || "", 1000),
      variationId: String(entry?.variationId || "").trim(),
      variationLabel: normalizeString(entry?.variationLabel || "", 180),
      selectedVariants: normalizeSelectedVariantsPayload(entry?.selectedVariants || []),
    }))
    .filter((entry) => mongoose.Types.ObjectId.isValid(entry.productId));

  if (!normalized.length) {
    return {
      items: [],
      vendorIds: [],
      subtotal: 0,
    };
  }

  const productIds = [...new Set(normalized.map((entry) => entry.productId))];
  const products = await Product.find({ _id: { $in: productIds } })
    .select("_id vendor title price salePrice priceType images variations variantDefinitions")
    .lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const items = [];
  const vendorIds = new Set();
  let subtotal = 0;

  for (const entry of normalized) {
    const product = productMap.get(entry.productId);
    if (!product) continue;

    const variationId = mongoose.Types.ObjectId.isValid(entry.variationId)
      ? String(entry.variationId)
      : "";
    const variation = variationId
      ? Array.isArray(product.variations)
        ? product.variations.find((row) => String(row?._id || "") === variationId) || null
        : null
      : null;
    const selectedVariantContext =
      entry.selectedVariants.length > 0
        ? normalizeSelectedVariantsForProduct(product, entry.selectedVariants)
        : { selectedVariants: [], variationLabel: "" };
    const selectedVariants = Array.isArray(selectedVariantContext?.selectedVariants)
      ? selectedVariantContext.selectedVariants
      : [];
    const pricing = resolveProductPricingForSelection({
      basePrice: getBasePrice(product, variation),
      baseComparePrice: getBaseComparePrice(product, variation),
      selectedVariants,
    });

    const price = Number.isFinite(entry.price)
      ? Math.max(0, entry.price)
      : Math.max(0, Number(pricing?.price || 0));

    const row = {
      product: product._id,
      vendor: product.vendor || null,
      title: entry.title || String(product.title || ""),
      image: entry.image || getProductImage(product),
      quantity: entry.quantity,
      price,
      variationId: variation ? variation._id : null,
      variationLabel:
        entry.variationLabel ||
        [String(variation?.label || ""), String(selectedVariantContext?.variationLabel || "")]
          .filter(Boolean)
          .join(" | "),
      selectedVariants,
    };

    if (row.vendor) {
      vendorIds.add(String(row.vendor));
    }

    items.push(row);
    subtotal += Number((row.quantity * row.price).toFixed(2));
  }

  return {
    items,
    vendorIds: [...vendorIds],
    subtotal: Number(subtotal.toFixed(2)),
  };
};

exports.captureAbandonedOrder = async (req, res) => {
  try {
    const scope = await buildScope(req, res, { allowPublic: true });
    if (!scope) return;

    const sessionKey = normalizeSessionKey(req.body?.sessionKey);
    if (!sessionKey) {
      return res.status(400).json({
        success: false,
        message: "Session key is required",
      });
    }

    const { items, vendorIds, subtotal: computedSubtotal } = await buildCapturedItems(
      Array.isArray(req.body?.items) ? req.body.items : [],
    );

    if (!items.length) {
      return res.status(400).json({
        success: false,
        message: "At least one valid cart item is required",
      });
    }

    const subtotal =
      req.body?.subtotal !== undefined
        ? Math.max(0, parseNumber(req.body.subtotal, computedSubtotal))
        : computedSubtotal;
    const total =
      req.body?.total !== undefined
        ? Math.max(0, parseNumber(req.body.total, subtotal))
        : subtotal;

    const customerName = normalizeString(
      req.body?.customer?.name ||
        [req.body?.customer?.firstName, req.body?.customer?.lastName].filter(Boolean).join(" "),
      180,
    );

    const customer = {
      name: customerName,
      email: normalizeString(req.body?.customer?.email, 180).toLowerCase(),
      phone: normalizeString(req.body?.customer?.phone, 60),
      address: normalizeString(req.body?.customer?.address, 320),
      city: normalizeString(req.body?.customer?.city, 120),
      district: normalizeString(req.body?.customer?.district, 120),
      notes: normalizeString(req.body?.customer?.notes, 2000),
    };

    const source = normalizeString(req.body?.source || "checkout", 120) || "checkout";
    const landingPageSlug = normalizeString(req.body?.landingPageSlug || "", 180).toLowerCase();

    const existing = await AbandonedOrder.findOne({
      sessionKey,
      status: { $in: ["new", "follow_up"] },
    });

    if (existing) {
      existing.items = items;
      existing.vendorIds = vendorIds;
      existing.customer = customer;
      existing.source = source;
      existing.landingPageSlug = landingPageSlug;
      existing.subtotal = subtotal;
      existing.total = total;
      existing.lastActivityAt = new Date();
      if (!existing.createdByUser && req.user) {
        existing.createdByUser = getUserId(req.user);
      }
      await existing.save();

      return res.json({
        success: true,
        message: "Abandoned checkout updated",
        abandonedOrder: existing,
      });
    }

    const abandonedOrder = await AbandonedOrder.create({
      sessionKey,
      source,
      landingPageSlug,
      customer,
      items,
      vendorIds,
      subtotal,
      total,
      createdByUser: req.user ? getUserId(req.user) : null,
      capturedAt: new Date(),
      lastActivityAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Abandoned checkout captured",
      abandonedOrder,
    });
  } catch (error) {
    console.error("Capture abandoned order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while capturing abandoned order",
    });
  }
};

exports.getAbandonedOrders = async (req, res) => {
  try {
    const scope = await buildScope(req, res);
    if (!scope) return;

    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query?.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    applyScope(query, scope);

    const status = normalizeString(req.query?.status || "", 50).toLowerCase();
    if (["new", "follow_up", "converted", "discarded"].includes(status)) {
      query.status = status;
    }

    const search = normalizeString(req.query?.search || "", 120);
    if (search) {
      query.$or = [
        { "customer.name": { $regex: search, $options: "i" } },
        { "customer.phone": { $regex: search, $options: "i" } },
        { "customer.email": { $regex: search, $options: "i" } },
        { "items.title": { $regex: search, $options: "i" } },
      ];
    }

    const fromDate = parseDate(req.query?.from, null);
    const toDate = parseDate(req.query?.to, null);
    if (fromDate || toDate) {
      query.capturedAt = {};
      if (fromDate) query.capturedAt.$gte = fromDate;
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.capturedAt.$lte = end;
      }
    }

    const [orders, total, summaryRows] = await Promise.all([
      AbandonedOrder.find(query)
        .populate("convertedOrder", "orderNumber orderStatus total createdAt")
        .sort({ lastActivityAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AbandonedOrder.countDocuments(query),
      AbandonedOrder.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalValue: { $sum: "$total" },
          },
        },
      ]),
    ]);

    const summary = summaryRows.reduce(
      (acc, row) => {
        acc[row._id] = {
          count: Number(row.count || 0),
          totalValue: Number(row.totalValue || 0),
        };
        return acc;
      },
      {},
    );

    res.json({
      success: true,
      abandonedOrders: orders,
      summary,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Get abandoned orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching abandoned orders",
    });
  }
};

exports.updateAbandonedOrder = async (req, res) => {
  try {
    const scope = await buildScope(req, res);
    if (!scope) return;

    const query = { _id: req.params.id };
    applyScope(query, scope);

    const abandonedOrder = await AbandonedOrder.findOne(query);
    if (!abandonedOrder) {
      return res.status(404).json({
        success: false,
        message: "Abandoned order not found",
      });
    }

    if (req.body?.status !== undefined) {
      const status = normalizeString(req.body.status, 50).toLowerCase();
      if (!["new", "follow_up", "converted", "discarded"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid abandoned order status",
        });
      }
      abandonedOrder.status = status;
    }

    if (req.body?.notes !== undefined) {
      abandonedOrder.notes = normalizeString(req.body.notes, 3000);
    }

    abandonedOrder.lastActivityAt = new Date();

    await abandonedOrder.save();

    res.json({
      success: true,
      message: "Abandoned order updated",
      abandonedOrder,
    });
  } catch (error) {
    console.error("Update abandoned order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating abandoned order",
    });
  }
};

const createOrderFromAbandoned = async (abandonedOrder) => {
  const productIds = [...new Set(
    (abandonedOrder.items || [])
      .map((item) => String(item?.product || "").trim())
      .filter((id) => mongoose.Types.ObjectId.isValid(id)),
  )];

  if (!productIds.length) {
    throw new Error("No valid products to convert into order");
  }

  const products = await Product.find({ _id: { $in: productIds } });
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const orderItems = [];
  const touchedProducts = new Set();
  let subtotal = 0;

  for (const item of abandonedOrder.items || []) {
    const productId = String(item?.product || "").trim();
    const product = productMap.get(productId);
    if (!product) {
      throw new Error("One or more products are no longer available");
    }

    const marketplaceType = String(product.marketplaceType || "simple");
    if (marketplaceType === "grouped") {
      throw new Error(`${product.title || "Product"} cannot be converted from grouped type`);
    }

    if (String(product.priceType || "single") === "tba") {
      throw new Error(`${product.title || "Product"} is marked as TBA`);
    }

    const quantity = Math.max(1, Number.parseInt(item?.quantity, 10) || 1);
    const variationId = mongoose.Types.ObjectId.isValid(String(item?.variationId || "").trim())
      ? String(item.variationId)
      : "";

    let variation = null;
    let unitPrice = Math.max(0, parseNumber(item?.price, NaN));
    let variationLabel = normalizeString(item?.variationLabel || "", 180);
    let selectedVariants = normalizeSelectedVariantsPayload(item?.selectedVariants || []);
    let sku = "";

    if (variationId) {
      variation =
        Array.isArray(product.variations)
          ? product.variations.find((entry) => String(entry?._id || "") === variationId) || null
          : null;

      if (!variation) {
        throw new Error(`Variation not found for ${product.title || "product"}`);
      }

      if (!product.allowBackorder) {
        const available = Math.max(0, Number(variation.stock || 0));
        if (quantity > available) {
          throw new Error(`${product.title || "Product"} has only ${available} variation stock`);
        }
        variation.stock = available - quantity;
      }

      if (!Number.isFinite(unitPrice)) {
        unitPrice = getBasePrice(product, variation);
      }

      if (!variationLabel) variationLabel = String(variation.label || "");
      sku = String(variation.sku || "");
    } else {
      if (!product.allowBackorder) {
        const available = Math.max(0, Number(product.stock || 0));
        if (quantity > available) {
          throw new Error(`${product.title || "Product"} has only ${available} stock`);
        }
        product.stock = available - quantity;
      }

      if (!Number.isFinite(unitPrice)) {
        unitPrice = getBasePrice(product, null);
      }

      sku = String(product.sku || "");
    }

    if (selectedVariants.length > 0) {
      const selectedVariantContext = normalizeSelectedVariantsForProduct(
        product,
        selectedVariants,
      );

      if (!selectedVariantContext?.error) {
        selectedVariants = Array.isArray(selectedVariantContext.selectedVariants)
          ? selectedVariantContext.selectedVariants
          : [];
        variationLabel = [variationLabel, selectedVariantContext.variationLabel]
          .filter(Boolean)
          .join(" | ");
        const pricing = resolveProductPricingForSelection({
          basePrice: Number.isFinite(unitPrice) ? unitPrice : getBasePrice(product, variation),
          baseComparePrice: getBaseComparePrice(product, variation),
          selectedVariants,
        });
        unitPrice = Math.max(0, Number(pricing?.price || unitPrice || 0));
      }
    }

    touchedProducts.add(String(product._id));

    const safePrice = Number(Math.max(0, unitPrice).toFixed(2));
    subtotal += safePrice * quantity;

    orderItems.push({
      product: product._id,
      vendor: product.vendor || null,
      quantity,
      price: safePrice,
      variationId: variation ? variation._id : null,
      variationLabel,
      selectedVariants,
      sku,
      color: "",
      dimensions: "",
      vendorCommissionAmount: 0,
      vendorCommissionSource: "none",
      vendorCommissionType: "inherit",
      vendorCommissionValue: 0,
      vendorCommissionFixed: 0,
      vendorNetAmount: Number((safePrice * quantity).toFixed(2)),
    });
  }

  for (const productId of touchedProducts) {
    const product = productMap.get(productId);
    if (product) {
      await product.save();
    }
  }

  const customerName = normalizeString(abandonedOrder?.customer?.name || "", 180) || "Guest Customer";
  const nameParts = customerName.split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() || "Guest";
  const lastName = nameParts.join(" ") || "Customer";

  const fallbackEmail = `guest-${Date.now()}@example.local`;

  let landingPageId = null;
  if (String(abandonedOrder.landingPageSlug || "").trim()) {
    const page = await LandingPage.findOne({ slug: abandonedOrder.landingPageSlug })
      .select("_id")
      .lean();
    if (page?._id) {
      landingPageId = page._id;
    }
  }

  subtotal = Number(subtotal.toFixed(2));

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: null,
    items: orderItems,
    shippingAddress: {
      firstName,
      lastName,
      email: normalizeString(abandonedOrder?.customer?.email || "", 180).toLowerCase() || fallbackEmail,
      phone: normalizeString(abandonedOrder?.customer?.phone || "", 60) || "01000000000",
      address: normalizeString(abandonedOrder?.customer?.address || "", 320) || "N/A",
      city: normalizeString(abandonedOrder?.customer?.city || "", 120) || "Dhaka",
      district: normalizeString(abandonedOrder?.customer?.district || "", 120),
      postalCode: "0000",
      country: "Bangladesh",
      notes: `Recovered from abandoned checkout (${abandonedOrder.sessionKey})`,
    },
    subtotal,
    shippingFee: 0,
    shippingMeta: {},
    discount: 0,
    couponCode: "",
    total: subtotal,
    paymentMethod: "Cash on Delivery",
    paymentDetails: {
      method: "Cash on Delivery",
      providerType: "cod",
      transactionId: "",
      accountNo: "",
      sentFrom: "",
      sentTo: "",
      meta: {
        recoveredFromAbandoned: true,
      },
    },
    paymentStatus: "pending",
    orderStatus: "pending",
    source: "abandoned_recovery",
    landingPage: landingPageId,
    landingPageSlug: String(abandonedOrder.landingPageSlug || "").trim().toLowerCase(),
  });

  return order;
};

exports.convertAbandonedOrder = async (req, res) => {
  try {
    const scope = await buildScope(req, res);
    if (!scope) return;

    const query = { _id: req.params.id };
    applyScope(query, scope);

    const abandonedOrder = await AbandonedOrder.findOne(query);
    if (!abandonedOrder) {
      return res.status(404).json({
        success: false,
        message: "Abandoned order not found",
      });
    }

    if (abandonedOrder.status === "converted" && abandonedOrder.convertedOrder) {
      return res.status(400).json({
        success: false,
        message: "Abandoned order is already converted",
      });
    }

    let order = null;
    const existingOrderId = String(req.body?.orderId || "").trim();
    if (mongoose.Types.ObjectId.isValid(existingOrderId)) {
      order = await Order.findById(existingOrderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Provided order ID was not found",
        });
      }
    } else {
      order = await createOrderFromAbandoned(abandonedOrder);
    }

    abandonedOrder.status = "converted";
    abandonedOrder.convertedOrder = order._id;
    abandonedOrder.lastActivityAt = new Date();

    const note = normalizeString(req.body?.notes || "", 1000);
    if (note) {
      abandonedOrder.notes = [abandonedOrder.notes, note].filter(Boolean).join("\n").slice(0, 3000);
    }

    await abandonedOrder.save();

    res.json({
      success: true,
      message: "Abandoned order converted successfully",
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        total: order.total,
      },
      abandonedOrder,
    });
  } catch (error) {
    console.error("Convert abandoned order error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to convert abandoned order",
    });
  }
};

exports.deleteAbandonedOrder = async (req, res) => {
  try {
    const scope = await buildScope(req, res);
    if (!scope) return;

    const query = { _id: req.params.id };
    applyScope(query, scope);

    const deleted = await AbandonedOrder.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Abandoned order not found",
      });
    }

    res.json({
      success: true,
      message: "Abandoned order deleted",
    });
  } catch (error) {
    console.error("Delete abandoned order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting abandoned order",
    });
  }
};
