const mongoose = require("mongoose");
const Purchase = require("../models/Purchase");
const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const { AccountEntry } = require("../models/AccountEntry");
const { isAdmin, getVendorForUser, getUserId } = require("../utils/marketplaceAccess");

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

const resolveScope = async (req, res) => {
  if (isAdmin(req.user)) {
    const vendorId = String(req.query?.vendorId || req.body?.vendorId || "").trim();
    return {
      admin: true,
      vendorId: mongoose.Types.ObjectId.isValid(vendorId) ? vendorId : null,
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
    admin: false,
    vendorId: String(access.vendor._id),
    access,
  };
};

const applyScope = (query, scope) => {
  if (scope.vendorId) {
    query.vendor = scope.vendorId;
  } else if (!scope.admin) {
    query.vendor = null;
  }

  return query;
};

const resolveItemVariation = (product, variationId) => {
  const normalized = String(variationId || "").trim();
  if (!normalized || !mongoose.Types.ObjectId.isValid(normalized)) {
    return null;
  }

  if (!Array.isArray(product.variations)) return null;

  return (
    product.variations.find((entry) => String(entry?._id || "") === normalized) ||
    null
  );
};

exports.createPurchase = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const supplierId = String(req.body?.supplierId || req.body?.supplier || "").trim();
    const invoiceNumber = String(req.body?.invoiceNumber || "").trim();
    const notes = String(req.body?.notes || "").trim();
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({
        success: false,
        message: "Valid supplier is required",
      });
    }

    if (!invoiceNumber) {
      return res.status(400).json({
        success: false,
        message: "Invoice number is required",
      });
    }

    if (!rawItems.length) {
      return res.status(400).json({
        success: false,
        message: "At least one purchase item is required",
      });
    }

    const supplierQuery = { _id: supplierId };
    applyScope(supplierQuery, scope);

    const supplier = await Supplier.findOne(supplierQuery);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    const productIds = [...new Set(
      rawItems
        .map((item) => String(item?.productId || item?.product || "").trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id)),
    )];

    if (!productIds.length) {
      return res.status(400).json({
        success: false,
        message: "Valid products are required in purchase items",
      });
    }

    const productQuery = { _id: { $in: productIds } };
    if (scope.vendorId) {
      productQuery.vendor = scope.vendorId;
    }

    const products = await Product.find(productQuery);
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const purchaseItems = [];
    const touchedProducts = new Set();
    let totalAmount = 0;

    for (const item of rawItems) {
      const productId = String(item?.productId || item?.product || "").trim();
      const quantity = Math.max(1, Number.parseInt(item?.quantity, 10) || 1);
      const purchasePrice = Math.max(0, parseNumber(item?.purchasePrice, NaN));
      const variationId = String(item?.variationId || "").trim();

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({
          success: false,
          message: "Each purchase item must include a valid product",
        });
      }

      if (!Number.isFinite(purchasePrice)) {
        return res.status(400).json({
          success: false,
          message: "Each purchase item must include a valid purchase price",
        });
      }

      const product = productMap.get(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "One or more products were not found for this supplier/vendor scope",
        });
      }

      const variation = resolveItemVariation(product, variationId);
      if (variationId && !variation) {
        return res.status(400).json({
          success: false,
          message: `Selected variation is invalid for ${product.title || "product"}`,
        });
      }

      if (variation) {
        variation.stock = Math.max(0, Number(variation.stock || 0)) + quantity;
      } else {
        product.stock = Math.max(0, Number(product.stock || 0)) + quantity;
      }

      touchedProducts.add(String(product._id));

      const lineTotal = Number((quantity * purchasePrice).toFixed(2));
      totalAmount += lineTotal;

      purchaseItems.push({
        product: product._id,
        title: String(product.title || "").trim(),
        sku: String(variation?.sku || product.sku || "").trim(),
        variationId: variation ? variation._id : null,
        variationLabel: String(variation?.label || "").trim(),
        quantity,
        purchasePrice,
        lineTotal,
      });
    }

    totalAmount = Number(totalAmount.toFixed(2));
    const paidAmount = Math.min(totalAmount, Math.max(0, parseNumber(req.body?.paidAmount, 0)));
    const dueAmount = Number((totalAmount - paidAmount).toFixed(2));

    for (const productId of touchedProducts) {
      const product = productMap.get(String(productId));
      if (product) {
        await product.save();
      }
    }

    const purchase = await Purchase.create({
      vendor: scope.vendorId || null,
      supplier: supplier._id,
      invoiceNumber,
      purchaseDate: parseDate(req.body?.purchaseDate, new Date()),
      items: purchaseItems,
      totalAmount,
      paidAmount,
      dueAmount,
      notes,
      createdBy: getUserId(req.user),
    });

    supplier.currentDue = Number((Number(supplier.currentDue || 0) + dueAmount).toFixed(2));
    supplier.totalPaid = Number((Number(supplier.totalPaid || 0) + paidAmount).toFixed(2));
    await supplier.save();

    await AccountEntry.create({
      vendor: scope.vendorId || null,
      type: "expense",
      title: `Purchase ${invoiceNumber}`,
      category: "Inventory Purchase",
      amount: totalAmount,
      note: notes,
      entryDate: parseDate(req.body?.purchaseDate, new Date()),
      referenceModel: "Purchase",
      referenceId: purchase._id,
      createdBy: getUserId(req.user),
    }).catch(() => null);

    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate("supplier", "name phone email")
      .populate("vendor", "storeName slug")
      .populate("items.product", "title sku stock")
      .populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Purchase saved and stock updated",
      purchase: populatedPurchase,
    });
  } catch (error) {
    console.error("Create purchase error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating purchase",
    });
  }
};

exports.getPurchases = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query?.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    applyScope(query, scope);

    const supplierId = String(req.query?.supplierId || "").trim();
    if (mongoose.Types.ObjectId.isValid(supplierId)) {
      query.supplier = supplierId;
    }

    const paymentStatus = String(req.query?.paymentStatus || "").trim().toLowerCase();
    if (["unpaid", "partial", "paid"].includes(paymentStatus)) {
      query.paymentStatus = paymentStatus;
    }

    const fromDate = req.query?.from ? new Date(req.query.from) : null;
    const toDate = req.query?.to ? new Date(req.query.to) : null;
    if (fromDate || toDate) {
      query.purchaseDate = {};
      if (fromDate && !Number.isNaN(fromDate.getTime())) query.purchaseDate.$gte = fromDate;
      if (toDate && !Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        query.purchaseDate.$lte = toDate;
      }
      if (!Object.keys(query.purchaseDate).length) {
        delete query.purchaseDate;
      }
    }

    const search = String(req.query?.search || "").trim();
    if (search) {
      query.invoiceNumber = { $regex: search, $options: "i" };
    }

    const [purchases, total, summary] = await Promise.all([
      Purchase.find(query)
        .populate("supplier", "name phone email")
        .populate("vendor", "storeName slug")
        .populate("createdBy", "name email")
        .sort({ purchaseDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Purchase.countDocuments(query),
      Purchase.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$totalAmount" },
            paidAmount: { $sum: "$paidAmount" },
            dueAmount: { $sum: "$dueAmount" },
          },
        },
      ]),
    ]);

    res.json({
      success: true,
      purchases,
      summary: {
        count: total,
        totalAmount: Number(summary?.[0]?.totalAmount || 0),
        paidAmount: Number(summary?.[0]?.paidAmount || 0),
        dueAmount: Number(summary?.[0]?.dueAmount || 0),
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Get purchases error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching purchases",
    });
  }
};

exports.addPurchasePayment = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const query = { _id: req.params.id };
    applyScope(query, scope);

    const purchase = await Purchase.findOne(query);
    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    const amount = Math.max(0, parseNumber(req.body?.amount, NaN));
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Payment amount must be greater than 0",
      });
    }

    if (purchase.dueAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Purchase is already fully paid",
      });
    }

    const paymentAmount = Math.min(amount, Number(purchase.dueAmount || 0));

    purchase.paidAmount = Number((Number(purchase.paidAmount || 0) + paymentAmount).toFixed(2));
    purchase.dueAmount = Number((Number(purchase.totalAmount || 0) - purchase.paidAmount).toFixed(2));

    if (purchase.dueAmount <= 0) {
      purchase.paymentStatus = "paid";
      purchase.dueAmount = 0;
    } else {
      purchase.paymentStatus = "partial";
    }

    await purchase.save();

    const supplier = await Supplier.findById(purchase.supplier);
    if (supplier) {
      supplier.currentDue = Math.max(
        0,
        Number((Number(supplier.currentDue || 0) - paymentAmount).toFixed(2)),
      );
      supplier.totalPaid = Number((Number(supplier.totalPaid || 0) + paymentAmount).toFixed(2));
      await supplier.save();
    }

    await AccountEntry.create({
      vendor: scope.vendorId || purchase.vendor || null,
      type: "bill",
      title: `Purchase payment ${purchase.invoiceNumber}`,
      category: "Supplier Due Payment",
      amount: paymentAmount,
      note: String(req.body?.note || "").trim(),
      entryDate: parseDate(req.body?.entryDate, new Date()),
      referenceModel: "Purchase",
      referenceId: purchase._id,
      createdBy: getUserId(req.user),
    }).catch(() => null);

    await purchase.populate("supplier", "name phone email");

    res.json({
      success: true,
      message: "Payment recorded",
      purchase,
    });
  } catch (error) {
    console.error("Add purchase payment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while recording purchase payment",
    });
  }
};
