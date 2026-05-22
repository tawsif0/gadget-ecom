const mongoose = require("mongoose");
const LandingPage = require("../models/LandingPage");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { attachImageDataToProducts } = require("../utils/imageUtils");
const { isAdmin, getVendorForUser, getUserId } = require("../utils/marketplaceAccess");

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);

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

const ensureUniqueSlug = async (inputSlug, pageId = null) => {
  const baseSlug = slugify(inputSlug) || `landing-${Date.now()}`;

  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await LandingPage.findOne({
      slug: candidate,
      ...(pageId && mongoose.Types.ObjectId.isValid(pageId)
        ? { _id: { $ne: pageId } }
        : {}),
    })
      .select("_id")
      .lean();

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

const normalizeProductIds = (value) => {
  const source = Array.isArray(value) ? value : [];
  const ids = source
    .map((entry) => String(entry || "").trim())
    .filter((entry) => mongoose.Types.ObjectId.isValid(entry));

  return [...new Set(ids)];
};

const normalizeTrackingFields = (payload = {}) => {
  const legacyPixelId = String(payload?.pixelId || "").trim();
  const metaPixelId = String(payload?.metaPixelId || legacyPixelId || "").trim();

  return {
    pixelId: legacyPixelId || metaPixelId,
    metaPixelId,
    googleAnalyticsId: String(payload?.googleAnalyticsId || "").trim(),
    gtmId: String(payload?.gtmId || "").trim(),
    tiktokPixelId: String(payload?.tiktokPixelId || "").trim(),
    customTrackingCode: String(payload?.customTrackingCode || "").trim(),
  };
};

const resolveProductsForScope = async ({ productIds, scope }) => {
  if (!productIds.length) return [];

  const query = {
    _id: { $in: productIds },
    isActive: true,
    approvalStatus: { $in: ["approved", null] },
  };

  if (scope.vendorId) {
    query.vendor = scope.vendorId;
  }

  const products = await Product.find(query)
    .select("_id title vendor")
    .lean();

  if (products.length !== productIds.length) {
    return null;
  }

  return products;
};

exports.createLandingPage = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const title = String(req.body?.title || "").trim();
    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Landing page title is required",
      });
    }

    const productIds = normalizeProductIds(req.body?.products);
    const products = await resolveProductsForScope({ productIds, scope });
    if (products === null) {
      return res.status(400).json({
        success: false,
        message: "One or more selected products are invalid for this scope",
      });
    }

    const slug = await ensureUniqueSlug(req.body?.slug || title);
    const trackingFields = normalizeTrackingFields(req.body);

    const landingPage = await LandingPage.create({
      vendor: scope.vendorId || null,
      createdBy: getUserId(req.user),
      title,
      slug,
      headline: String(req.body?.headline || "").trim(),
      subheadline: String(req.body?.subheadline || "").trim(),
      description: String(req.body?.description || "").trim(),
      bannerImage: String(req.body?.bannerImage || "").trim(),
      ...trackingFields,
      products: products.map((product) => product._id),
      theme: String(req.body?.theme || "clean").trim() || "clean",
      isActive: req.body?.isActive === undefined ? true : Boolean(req.body?.isActive),
    });

    const populated = await LandingPage.findById(landingPage._id)
      .populate("vendor", "storeName slug")
      .populate("createdBy", "name email")
      .populate("products", "title images price salePrice priceType stock");

    if (Array.isArray(populated?.products)) {
      await attachImageDataToProducts(populated.products);
    }

    res.status(201).json({
      success: true,
      message: "Landing page created",
      landingPage: populated,
    });
  } catch (error) {
    console.error("Create landing page error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating landing page",
    });
  }
};

exports.getLandingPages = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query?.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    applyScope(query, scope);

    const search = String(req.query?.search || "").trim();
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }

    const isActiveParam = String(req.query?.isActive || "").trim().toLowerCase();
    if (isActiveParam === "true") query.isActive = true;
    if (isActiveParam === "false") query.isActive = false;

    const [pages, total] = await Promise.all([
      LandingPage.find(query)
        .populate("vendor", "storeName slug")
        .populate("createdBy", "name email")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LandingPage.countDocuments(query),
    ]);

    res.json({
      success: true,
      landingPages: pages,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Get landing pages error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching landing pages",
    });
  }
};

exports.getLandingPageById = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const query = { _id: req.params.id };
    applyScope(query, scope);

    const page = await LandingPage.findOne(query)
      .populate("vendor", "storeName slug")
      .populate("createdBy", "name email")
      .populate(
        "products",
        "title images price salePrice priceType stock isActive approvalStatus vendor",
      );

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Landing page not found",
      });
    }

    if (Array.isArray(page?.products)) {
      await attachImageDataToProducts(page.products);
    }

    res.json({
      success: true,
      landingPage: page,
    });
  } catch (error) {
    console.error("Get landing page by id error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching landing page",
    });
  }
};

exports.updateLandingPage = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const query = { _id: req.params.id };
    applyScope(query, scope);

    const landingPage = await LandingPage.findOne(query);
    if (!landingPage) {
      return res.status(404).json({
        success: false,
        message: "Landing page not found",
      });
    }

    if (req.body?.title !== undefined) {
      const title = String(req.body.title || "").trim();
      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Landing page title cannot be empty",
        });
      }
      landingPage.title = title;
    }

    if (req.body?.slug !== undefined) {
      const slug = await ensureUniqueSlug(req.body.slug || landingPage.title, landingPage._id);
      landingPage.slug = slug;
    }

    const fields = [
      "headline",
      "subheadline",
      "description",
      "bannerImage",
      "theme",
    ];

    fields.forEach((field) => {
      if (req.body?.[field] !== undefined) {
        landingPage[field] = String(req.body[field] || "").trim();
      }
    });

    const trackingInputProvided =
      req.body?.pixelId !== undefined ||
      req.body?.metaPixelId !== undefined ||
      req.body?.googleAnalyticsId !== undefined ||
      req.body?.gtmId !== undefined ||
      req.body?.tiktokPixelId !== undefined ||
      req.body?.customTrackingCode !== undefined;

    if (trackingInputProvided) {
      const trackingFields = normalizeTrackingFields({
        pixelId:
          req.body?.pixelId !== undefined ? req.body.pixelId : landingPage.pixelId,
        metaPixelId:
          req.body?.metaPixelId !== undefined
            ? req.body.metaPixelId
            : landingPage.metaPixelId || landingPage.pixelId,
        googleAnalyticsId:
          req.body?.googleAnalyticsId !== undefined
            ? req.body.googleAnalyticsId
            : landingPage.googleAnalyticsId,
        gtmId: req.body?.gtmId !== undefined ? req.body.gtmId : landingPage.gtmId,
        tiktokPixelId:
          req.body?.tiktokPixelId !== undefined
            ? req.body.tiktokPixelId
            : landingPage.tiktokPixelId,
        customTrackingCode:
          req.body?.customTrackingCode !== undefined
            ? req.body.customTrackingCode
            : landingPage.customTrackingCode,
      });

      landingPage.pixelId = trackingFields.pixelId;
      landingPage.metaPixelId = trackingFields.metaPixelId;
      landingPage.googleAnalyticsId = trackingFields.googleAnalyticsId;
      landingPage.gtmId = trackingFields.gtmId;
      landingPage.tiktokPixelId = trackingFields.tiktokPixelId;
      landingPage.customTrackingCode = trackingFields.customTrackingCode;
    }

    if (req.body?.isActive !== undefined) {
      landingPage.isActive = Boolean(req.body.isActive);
    }

    if (req.body?.products !== undefined) {
      const productIds = normalizeProductIds(req.body.products);
      const products = await resolveProductsForScope({ productIds, scope });
      if (products === null) {
        return res.status(400).json({
          success: false,
          message: "One or more selected products are invalid for this scope",
        });
      }
      landingPage.products = products.map((product) => product._id);
    }

    if (scope.admin && req.body?.vendorId !== undefined) {
      const vendorId = String(req.body.vendorId || "").trim();
      landingPage.vendor = mongoose.Types.ObjectId.isValid(vendorId) ? vendorId : null;
    }

    await landingPage.save();

    const populated = await LandingPage.findById(landingPage._id)
      .populate("vendor", "storeName slug")
      .populate("createdBy", "name email")
      .populate("products", "title images price salePrice priceType stock");

    if (Array.isArray(populated?.products)) {
      await attachImageDataToProducts(populated.products);
    }

    res.json({
      success: true,
      message: "Landing page updated",
      landingPage: populated,
    });
  } catch (error) {
    console.error("Update landing page error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating landing page",
    });
  }
};

exports.deleteLandingPage = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const query = { _id: req.params.id };
    applyScope(query, scope);

    const deleted = await LandingPage.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Landing page not found",
      });
    }

    res.json({
      success: true,
      message: "Landing page deleted",
    });
  } catch (error) {
    console.error("Delete landing page error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting landing page",
    });
  }
};

exports.getPublicLandingPage = async (req, res) => {
  try {
    const slug = slugify(req.params?.slug || "");
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Landing page slug is required",
      });
    }

    const page = await LandingPage.findOne({
      slug,
      isActive: true,
    })
      .populate("vendor", "storeName slug logo banner description")
      .populate(
        "products",
        "title description images price salePrice priceType stock showStockToPublic isActive approvalStatus vendor brand colors",
      )
      .lean();

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Landing page not found",
      });
    }

    const products = Array.isArray(page.products)
      ? page.products.filter(
          (product) =>
            product &&
            product.isActive !== false &&
            ["approved", null, undefined].includes(product.approvalStatus),
        )
      : [];

    await attachImageDataToProducts(products);

    res.json({
      success: true,
      landingPage: {
        ...page,
        products,
      },
    });
  } catch (error) {
    console.error("Get public landing page error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching landing page",
    });
  }
};

exports.trackLandingPageView = async (req, res) => {
  try {
    const slug = slugify(req.params?.slug || "");
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Landing page slug is required",
      });
    }

    const page = await LandingPage.findOneAndUpdate(
      {
        slug,
        isActive: true,
      },
      { $inc: { viewCount: 1 } },
      { new: true },
    )
      .select("_id slug viewCount")
      .lean();

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Landing page not found",
      });
    }

    res.json({
      success: true,
      landingPageId: page._id,
      slug: page.slug,
      viewCount: page.viewCount,
    });
  } catch (error) {
    console.error("Track landing page view error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while tracking landing page view",
    });
  }
};

exports.getLandingPageStats = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const query = { _id: req.params.id };
    applyScope(query, scope);

    const page = await LandingPage.findOne(query).lean();
    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Landing page not found",
      });
    }

    const fromDate = parseDate(req.query?.from, null);
    const toDate = parseDate(req.query?.to, null);

    const orderDateRange = {};
    if (fromDate) orderDateRange.$gte = fromDate;
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      orderDateRange.$lte = end;
    }

    const orderMatch = {
      $or: [
        { landingPage: page._id },
        { landingPageSlug: page.slug },
      ],
    };

    if (Object.keys(orderDateRange).length) {
      orderMatch.createdAt = orderDateRange;
    }

    const [orderRows, orderSummary] = await Promise.all([
      Order.find(orderMatch)
        .select("orderNumber total orderStatus createdAt source")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
      Order.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: "$orderStatus",
            count: { $sum: 1 },
            revenue: { $sum: "$total" },
          },
        },
      ]),
    ]);

    const summaryMap = orderSummary.reduce((acc, item) => {
      acc[item._id || "unknown"] = {
        count: Number(item.count || 0),
        revenue: Number(item.revenue || 0),
      };
      return acc;
    }, {});

    const totalOrders = orderRows.length;
    const delivered = summaryMap.delivered?.count || 0;
    const revenue = Number(summaryMap.delivered?.revenue || 0);
    const conversionRate = page.viewCount > 0 ? (totalOrders / page.viewCount) * 100 : 0;

    res.json({
      success: true,
      stats: {
        viewCount: Number(page.viewCount || 0),
        totalOrders,
        deliveredOrders: delivered,
        deliveredRevenue: revenue,
        conversionRate,
        byStatus: summaryMap,
      },
      recentOrders: orderRows,
    });
  } catch (error) {
    console.error("Get landing page stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching landing page stats",
    });
  }
};
