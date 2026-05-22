const Vendor = require("../models/Vendor");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { uploadImageBuffer } = require("../config/cloudinary");
const { attachImageDataToProducts } = require("../utils/imageUtils");
const { buildUniqueStoreSlug, isAdmin } = require("../utils/vendorUtils");

const getVendorForUser = async (userId) =>
  Vendor.findOne({ user: userId }).populate("user", "name email phone userType");

const ensureVendor = async (req, res) => {
  const vendor = await getVendorForUser(req.user.id || req.user._id);
  if (!vendor) {
    res.status(404).json({
      success: false,
      message: "Vendor profile not found",
    });
    return null;
  }

  return vendor;
};

const ensureAdmin = (req, res) => {
  if (!isAdmin(req.user)) {
    res.status(403).json({
      success: false,
      message: "Admin access required",
    });
    return false;
  }

  return true;
};

const roundMoney = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

exports.registerVendor = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      storeName,
      description = "",
      phone = "",
      email = "",
      address = "",
      city = "",
      country = "Bangladesh",
    } = req.body || {};

    if (!String(storeName || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Store name is required",
      });
    }

    const existingVendor = await Vendor.findOne({ user: userId });
    if (existingVendor) {
      return res.status(400).json({
        success: false,
        message: "Vendor profile already exists",
      });
    }

    const slug = await buildUniqueStoreSlug(Vendor, storeName);

    const vendor = await Vendor.create({
      user: userId,
      storeName: String(storeName).trim(),
      slug,
      description: String(description || "").trim(),
      phone: String(phone || "").trim(),
      email: String(email || "").trim().toLowerCase(),
      address: String(address || "").trim(),
      city: String(city || "").trim(),
      country: String(country || "Bangladesh").trim(),
      status: "pending",
    });

    if (req.user.userType !== "admin") {
      req.user.userType = "vendor";
      await req.user.save();
    }

    const populatedVendor = await Vendor.findById(vendor._id).populate(
      "user",
      "name email phone userType",
    );

    res.status(201).json({
      success: true,
      message: "Vendor registration submitted for approval",
      vendor: populatedVendor,
    });
  } catch (error) {
    console.error("Register vendor error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating vendor profile",
    });
  }
};

exports.getMyVendorProfile = async (req, res) => {
  try {
    const vendor = await ensureVendor(req, res);
    if (!vendor) return;

    res.json({
      success: true,
      vendor,
    });
  } catch (error) {
    console.error("Get my vendor profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vendor profile",
    });
  }
};

exports.updateMyVendorProfile = async (req, res) => {
  try {
    const vendor = await ensureVendor(req, res);
    if (!vendor) return;

    const allowedFields = [
      "storeName",
      "description",
      "email",
      "phone",
      "address",
      "city",
      "country",
      "logo",
      "banner",
      "seoTitle",
      "seoDescription",
      "openingHours",
      "vacationMode",
      "socialLinks",
      "storePolicies",
      "contactFormEnabled",
      "storePrivacy",
      "locationMapUrl",
      "geoLocation",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        vendor[field] = req.body[field];
      }
    }

    if (req.body.storeName !== undefined) {
      const trimmedStoreName = String(req.body.storeName || "").trim();
      if (!trimmedStoreName) {
        return res.status(400).json({
          success: false,
          message: "Store name cannot be empty",
        });
      }
      vendor.storeName = trimmedStoreName;
      vendor.slug = await buildUniqueStoreSlug(Vendor, trimmedStoreName, vendor._id);
    }

    if (req.body.locationLat !== undefined || req.body.locationLng !== undefined) {
      const lat =
        req.body.locationLat === null || req.body.locationLat === ""
          ? null
          : Number(req.body.locationLat);
      const lng =
        req.body.locationLng === null || req.body.locationLng === ""
          ? null
          : Number(req.body.locationLng);
      const label = String(req.body.locationLabel || vendor.geoLocation?.label || "").trim();

      vendor.geoLocation = {
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        label,
      };
    }

    await vendor.save();
    await vendor.populate("user", "name email phone userType");

    res.json({
      success: true,
      message: "Vendor profile updated successfully",
      vendor,
    });
  } catch (error) {
    console.error("Update vendor profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating vendor profile",
    });
  }
};

exports.uploadMyVendorAsset = async (req, res) => {
  try {
    const vendor = await ensureVendor(req, res);
    if (!vendor) return;

    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Image file is required",
      });
    }

    const assetType =
      String(req.body?.assetType || req.query?.assetType || "logo").trim().toLowerCase() ===
      "banner"
        ? "banner"
        : "logo";

    const uploaded = await uploadImageBuffer(req.file.buffer, {
      folder: `marketplace/vendors/${assetType}`,
      resource_type: "image",
    });

    if (!uploaded?.secure_url) {
      return res.status(500).json({
        success: false,
        message: "Vendor image upload failed",
      });
    }

    return res.json({
      success: true,
      message: `${assetType === "banner" ? "Banner" : "Logo"} uploaded successfully`,
      assetType,
      url: String(uploaded.secure_url || "").trim(),
    });
  } catch (error) {
    console.error("Upload vendor asset error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while uploading vendor asset",
    });
  }
};

exports.getPublicVendors = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {
      status: "approved",
      storePrivacy: { $ne: "private" },
    };

    if (String(search || "").trim()) {
      query.$or = [
        { storeName: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [vendors, total] = await Promise.all([
      Vendor.find(query)
        .populate("user", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Vendor.countDocuments(query),
    ]);

    const vendorsWithCounts = await Promise.all(
      vendors.map(async (vendor) => {
        const productCount = await Product.countDocuments({
          vendor: vendor._id,
          isActive: true,
          approvalStatus: { $in: ["approved", null] },
        });

        return {
          ...vendor.toObject(),
          productCount,
        };
      }),
    );

    res.json({
      success: true,
      vendors: vendorsWithCounts,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Get public vendors error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vendors",
    });
  }
};

exports.getNearbyVendors = async (req, res) => {
  try {
    const lat = Number(req.query?.lat);
    const lng = Number(req.query?.lng);
    const radiusKm = Math.max(1, Math.min(200, Number(req.query?.radiusKm || 10)));
    const limit = Math.max(1, Math.min(50, Number(req.query?.limit || 20)));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        success: false,
        message: "Valid lat and lng query params are required",
      });
    }

    const vendors = await Vendor.find({
      status: "approved",
      storePrivacy: { $ne: "private" },
      "geoLocation.lat": { $ne: null },
      "geoLocation.lng": { $ne: null },
    })
      .populate("user", "name")
      .select(
        "storeName slug description logo banner city country ratingAverage ratingCount geoLocation user",
      )
      .lean();

    const toRadians = (value) => (value * Math.PI) / 180;
    const distanceKm = (lat1, lng1, lat2, lng2) => {
      const earth = 6371;
      const dLat = toRadians(lat2 - lat1);
      const dLng = toRadians(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
          Math.cos(toRadians(lat2)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return earth * c;
    };

    const nearbyVendors = vendors
      .map((vendor) => {
        const vendorLat = Number(vendor?.geoLocation?.lat);
        const vendorLng = Number(vendor?.geoLocation?.lng);
        if (!Number.isFinite(vendorLat) || !Number.isFinite(vendorLng)) return null;

        const distance = distanceKm(lat, lng, vendorLat, vendorLng);
        if (distance > radiusKm) return null;

        return {
          ...vendor,
          distanceKm: Math.round((distance + Number.EPSILON) * 100) / 100,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    res.json({
      success: true,
      center: { lat, lng },
      radiusKm,
      count: nearbyVendors.length,
      vendors: nearbyVendors,
    });
  } catch (error) {
    console.error("Get nearby vendors error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching nearby vendors",
    });
  }
};

exports.getVendorStore = async (req, res) => {
  try {
    const { slug } = req.params;

    const vendor = await Vendor.findOne({
      slug: String(slug || "").toLowerCase().trim(),
      status: "approved",
    }).populate("user", "name");

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor store not found",
      });
    }

    if (vendor.storePrivacy === "private") {
      return res.status(403).json({
        success: false,
        message: "This vendor store is private",
      });
    }

    const products = await Product.find({
      vendor: vendor._id,
      isActive: true,
      approvalStatus: { $in: ["approved", null] },
    })
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .lean();

    await attachImageDataToProducts(products);

    res.json({
      success: true,
      vendor,
      products,
    });
  } catch (error) {
    console.error("Get vendor store error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vendor store",
    });
  }
};

exports.getAdminVendors = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const vendors = await Vendor.find(query)
      .populate("user", "name email phone userType createdAt")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      vendors,
    });
  } catch (error) {
    console.error("Get admin vendors error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vendors",
    });
  }
};

exports.updateVendorStatus = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { status } = req.body || {};
    const validStatuses = ["pending", "approved", "rejected", "suspended"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const vendor = await Vendor.findById(req.params.id).populate("user");
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    vendor.status = status;
    await vendor.save();

    // If approved, ensure user role is vendor
    if (status === "approved" && vendor.user) {
      if (vendor.user.userType !== "vendor") {
        vendor.user.userType = "vendor";
        await vendor.user.save();
      }
    }

    res.json({
      success: true,
      message: "Vendor status updated successfully",
      vendor,
    });
  } catch (error) {
    console.error("Update vendor status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating vendor status",
    });
  }
};

exports.updateVendorCommission = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { commissionType, commissionValue, commissionFixed } = req.body || {};
    const normalizedType = String(commissionType || "").trim().toLowerCase();

    if (!["inherit", "percentage", "fixed", "hybrid"].includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: "Commission type must be inherit, percentage, fixed or hybrid",
      });
    }

    const numericValue = Number(commissionValue ?? 0);
    const numericFixed =
      commissionFixed === undefined || commissionFixed === null || commissionFixed === ""
        ? 0
        : Number(commissionFixed);

    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Commission percentage/value must be 0 or greater",
      });
    }

    if (!Number.isFinite(numericFixed) || numericFixed < 0) {
      return res.status(400).json({
        success: false,
        message: "Fixed commission must be 0 or greater",
      });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    vendor.commissionType = normalizedType;
    if (normalizedType === "inherit") {
      vendor.commissionValue = 0;
      vendor.commissionFixed = 0;
    } else if (normalizedType === "percentage") {
      vendor.commissionValue = numericValue;
      vendor.commissionFixed = 0;
    } else if (normalizedType === "fixed") {
      vendor.commissionValue = 0;
      vendor.commissionFixed = numericFixed > 0 ? numericFixed : numericValue;
    } else {
      vendor.commissionValue = numericValue;
      vendor.commissionFixed = numericFixed;
    }
    await vendor.save();

    res.json({
      success: true,
      message: "Vendor commission updated successfully",
      vendor,
    });
  } catch (error) {
    console.error("Update vendor commission error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating vendor commission",
    });
  }
};

exports.getVendorDashboardStats = async (req, res) => {
  try {
    const vendor = await ensureVendor(req, res);
    if (!vendor) return;

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalProducts, pendingProducts, approvedProducts, rejectedProducts, vendorProducts] =
      await Promise.all([
        Product.countDocuments({ vendor: vendor._id }),
        Product.countDocuments({ vendor: vendor._id, approvalStatus: "pending" }),
        Product.countDocuments({ vendor: vendor._id, approvalStatus: "approved" }),
        Product.countDocuments({ vendor: vendor._id, approvalStatus: "rejected" }),
        Product.find({ vendor: vendor._id })
          .select("stock lowStockThreshold")
          .lean(),
      ]);

    const orders = await Order.find({ "items.vendor": vendor._id })
      .select("orderNumber items orderStatus createdAt shippingAddress total")
      .lean();

    let grossSales = 0;
    let commissionTotal = 0;
    let netEarnings = 0;
    let pendingOrders = 0;
    let todaySales = 0;
    let monthlySales = 0;

    const orderStats = {
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
    };

    for (const order of orders) {
      const normalizedStatus = String(order.orderStatus || "").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(orderStats, normalizedStatus)) {
        orderStats[normalizedStatus] += 1;
      }

      if (["pending", "confirmed", "processing", "shipped"].includes(normalizedStatus)) {
        pendingOrders += 1;
      }
      if (["cancelled", "returned"].includes(normalizedStatus)) {
        continue;
      }

      for (const item of order.items || []) {
        if (String(item.vendor || "") !== String(vendor._id)) continue;

        const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);
        const itemCommission = Number(item.vendorCommissionAmount || 0);
        const itemNet = Number(item.vendorNetAmount || itemTotal - itemCommission);

        grossSales += itemTotal;
        commissionTotal += itemCommission;
        netEarnings += itemNet;

        if (normalizedStatus === "delivered") {
          const createdAt = order.createdAt ? new Date(order.createdAt) : null;
          if (createdAt && createdAt >= startOfToday) {
            todaySales += itemNet;
          }
          if (createdAt && createdAt >= startOfMonth) {
            monthlySales += itemNet;
          }
        }
      }
    }

    let totalStock = 0;
    let lowStockAlerts = 0;
    let outOfStock = 0;
    vendorProducts.forEach((product) => {
      const stock = Number(product.stock || 0);
      const threshold = Number(product.lowStockThreshold || 0);
      totalStock += stock;
      if (stock <= 0) {
        outOfStock += 1;
      } else if (stock <= threshold) {
        lowStockAlerts += 1;
      }
    });

    const recentOrders = orders.slice(0, 6).map((order) => ({
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      total: roundMoney(order.total),
      customerName: `${String(order?.shippingAddress?.firstName || "").trim()} ${String(
        order?.shippingAddress?.lastName || "",
      ).trim()}`.trim(),
      createdAt: order.createdAt,
    }));

    res.json({
      success: true,
      stats: {
        totalProducts,
        pendingProducts,
        approvedProducts,
        rejectedProducts,
        totalOrders: orders.length,
        pendingOrders,
        confirmedOrders: orderStats.confirmed,
        processingOrders: orderStats.processing,
        shippedOrders: orderStats.shipped,
        deliveredOrders: orderStats.delivered,
        cancelledOrders: orderStats.cancelled,
        returnedOrders: orderStats.returned,
        grossSales: roundMoney(grossSales),
        commissionTotal: roundMoney(commissionTotal),
        netEarnings: roundMoney(netEarnings),
        todaySales: roundMoney(todaySales),
        monthlySales: roundMoney(monthlySales),
        inventory: {
          totalStock: Math.max(0, Number(totalStock || 0)),
          lowStockAlerts,
          outOfStock,
        },
        recentOrders,
      },
    });
  } catch (error) {
    console.error("Get vendor dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vendor stats",
    });
  }
};

exports.getVendorOrders = async (req, res) => {
  try {
    const vendor = await ensureVendor(req, res);
    if (!vendor) return;

    const orders = await Order.find({ "items.vendor": vendor._id })
      .populate({
        path: "items.product",
        select: "title images price dimensions",
      })
      .populate({
        path: "user",
        select: "name email phone",
      })
      .sort({ createdAt: -1 })
      .lean();

    const vendorOrders = orders.map((order) => {
      const vendorItems = (order.items || []).filter(
        (item) => String(item.vendor || "") === String(vendor._id),
      );

      const vendorSubtotal = vendorItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
        0,
      );
      const vendorCommission = vendorItems.reduce(
        (sum, item) => sum + Number(item.vendorCommissionAmount || 0),
        0,
      );
      const vendorNet = vendorItems.reduce(
        (sum, item) => sum + Number(item.vendorNetAmount || 0),
        0,
      );

      return {
        ...order,
        items: vendorItems,
        vendorSubtotal,
        vendorCommission,
        vendorNet,
      };
    });

    const products = vendorOrders
      .flatMap((order) => order.items || [])
      .map((item) => item.product)
      .filter(Boolean);
    await attachImageDataToProducts(products);

    res.json({
      success: true,
      orders: vendorOrders,
    });
  } catch (error) {
    console.error("Get vendor orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vendor orders",
    });
  }
};

exports.getAdminVendorReports = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const fromDate = req.query.from ? new Date(req.query.from) : null;
    const toDate = req.query.to ? new Date(req.query.to) : null;

    const orderQuery = {};
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      orderQuery.createdAt = {
        ...(orderQuery.createdAt || {}),
        $gte: fromDate,
      };
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      orderQuery.createdAt = {
        ...(orderQuery.createdAt || {}),
        $lte: toDate,
      };
    }

    const [vendors, orders] = await Promise.all([
      Vendor.find().select("_id storeName slug status ratingAverage ratingCount").lean(),
      Order.find(orderQuery).select("items orderStatus createdAt").lean(),
    ]);

    const vendorStatsMap = new Map(
      vendors.map((vendor) => [
        String(vendor._id),
        {
          vendorId: vendor._id,
          storeName: vendor.storeName,
          slug: vendor.slug,
          status: vendor.status,
          ratingAverage: vendor.ratingAverage || 0,
          ratingCount: vendor.ratingCount || 0,
          totalOrders: 0,
          pendingOrders: 0,
          deliveredOrders: 0,
          grossSales: 0,
          commissionTotal: 0,
          netEarnings: 0,
          _orderSet: new Set(),
          _pendingOrderSet: new Set(),
          _deliveredOrderSet: new Set(),
        },
      ]),
    );

    for (const order of orders) {
      for (const item of order.items || []) {
        const vendorId = String(item.vendor || "");
        if (!vendorId || !vendorStatsMap.has(vendorId)) continue;

        const stat = vendorStatsMap.get(vendorId);
        const orderId = String(order._id);

        stat._orderSet.add(orderId);
        if (["pending", "confirmed", "processing", "shipped"].includes(order.orderStatus)) {
          stat._pendingOrderSet.add(orderId);
        }
        if (order.orderStatus === "delivered") {
          stat._deliveredOrderSet.add(orderId);
        }

        if (["cancelled", "returned"].includes(order.orderStatus)) {
          continue;
        }

        const itemTotal = Number(item.price || 0) * Number(item.quantity || 1);
        const commission = Number(item.vendorCommissionAmount || 0);
        const net = Number(item.vendorNetAmount || itemTotal - commission);

        stat.grossSales += itemTotal;
        stat.commissionTotal += commission;
        stat.netEarnings += net;
      }
    }

    const vendorReports = Array.from(vendorStatsMap.values()).map((stat) => ({
      vendorId: stat.vendorId,
      storeName: stat.storeName,
      slug: stat.slug,
      status: stat.status,
      ratingAverage: stat.ratingAverage,
      ratingCount: stat.ratingCount,
      totalOrders: stat._orderSet.size,
      pendingOrders: stat._pendingOrderSet.size,
      deliveredOrders: stat._deliveredOrderSet.size,
      grossSales: Math.round((stat.grossSales + Number.EPSILON) * 100) / 100,
      commissionTotal:
        Math.round((stat.commissionTotal + Number.EPSILON) * 100) / 100,
      netEarnings: Math.round((stat.netEarnings + Number.EPSILON) * 100) / 100,
    }));

    vendorReports.sort((a, b) => b.grossSales - a.grossSales);

    const summary = vendorReports.reduce(
      (acc, row) => {
        acc.totalVendors += 1;
        acc.totalOrders += row.totalOrders;
        acc.grossSales += row.grossSales;
        acc.commissionTotal += row.commissionTotal;
        acc.netEarnings += row.netEarnings;
        return acc;
      },
      {
        totalVendors: 0,
        totalOrders: 0,
        grossSales: 0,
        commissionTotal: 0,
        netEarnings: 0,
      },
    );

    summary.grossSales = Math.round((summary.grossSales + Number.EPSILON) * 100) / 100;
    summary.commissionTotal =
      Math.round((summary.commissionTotal + Number.EPSILON) * 100) / 100;
    summary.netEarnings =
      Math.round((summary.netEarnings + Number.EPSILON) * 100) / 100;

    res.json({
      success: true,
      summary,
      vendorReports,
    });
  } catch (error) {
    console.error("Get admin vendor reports error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vendor reports",
    });
  }
};
