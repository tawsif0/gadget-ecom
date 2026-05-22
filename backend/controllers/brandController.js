const mongoose = require("mongoose");
const Brand = require("../models/Brand");
const Product = require("../models/Product");
const User = require("../models/User");
const { isAdmin, getVendorForUser, getUserId } = require("../utils/marketplaceAccess");
const { uploadImageBuffer } = require("../config/cloudinary");

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);

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

const normalizeBrandName = (value) => String(value || "").trim();

const getDefaultBrandSeederId = async () => {
  const adminUser = await User.findOne({ userType: "admin" }).select("_id").lean();
  return adminUser?._id || null;
};

const seedBrandsFromProducts = async ({ createdByUserId = null } = {}) => {
  const productBrandNames = await Product.distinct("brand");
  const normalizedNames = Array.from(
    new Set(
      productBrandNames
        .map((name) => normalizeBrandName(name))
        .filter(Boolean),
    ),
  );

  if (!normalizedNames.length) {
    return { createdCount: 0 };
  }

  const existingBrands = await Brand.find({
    vendor: null,
    name: { $in: normalizedNames },
  })
    .select("name")
    .lean();

  const existingNames = new Set(
    existingBrands.map((brand) => normalizeBrandName(brand.name).toLowerCase()),
  );

  const creatorId = createdByUserId || (await getDefaultBrandSeederId());
  if (!creatorId) {
    return { createdCount: 0 };
  }

  const brandsToCreate = [];

  for (const name of normalizedNames) {
    if (existingNames.has(name.toLowerCase())) continue;

    const slug = await ensureUniqueSlug({
      scope: { admin: true, vendorId: null },
      slug: name,
    });

    brandsToCreate.push({
      vendor: null,
      createdBy: creatorId,
      name,
      slug,
      description: "",
      logoUrl: "",
      isActive: true,
    });
  }

  if (!brandsToCreate.length) {
    return { createdCount: 0 };
  }

  await Brand.insertMany(brandsToCreate, { ordered: false });
  return { createdCount: brandsToCreate.length };
};

const ensureUniqueSlug = async ({ scope, slug, excludeId = null }) => {
  const baseSlug = slugify(slug) || `brand-${Date.now()}`;
  let candidate = baseSlug;
  let suffix = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = {
      slug: candidate,
      ...(excludeId && mongoose.Types.ObjectId.isValid(excludeId)
        ? { _id: { $ne: excludeId } }
        : {}),
    };
    applyScope(query, scope);

    const existing = await Brand.findOne(query).select("_id").lean();
    if (!existing) return candidate;

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

exports.createBrand = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Brand name is required",
      });
    }

    const slug = await ensureUniqueSlug({
      scope,
      slug: name,
    });

    const brand = await Brand.create({
      vendor: scope.vendorId || null,
      createdBy: getUserId(req.user),
      name,
      slug,
      description: String(req.body?.description || "").trim(),
      logoUrl: String(req.body?.logoUrl || "").trim(),
      isActive: req.body?.isActive === undefined ? true : Boolean(req.body?.isActive),
    });

    const populated = await Brand.findById(brand._id)
      .populate("vendor", "storeName")
      .populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Brand created",
      brand: populated,
    });
  } catch (error) {
    console.error("Create brand error:", error);
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Brand already exists in this scope",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while creating brand",
    });
  }
};

exports.getBrands = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    await seedBrandsFromProducts({ createdByUserId: getUserId(req.user) });

    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query?.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    applyScope(query, scope);

    const search = String(req.query?.search || "").trim();
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const active = String(req.query?.active || "").trim().toLowerCase();
    if (active === "true") query.isActive = true;
    if (active === "false") query.isActive = false;

    const [brands, total] = await Promise.all([
      Brand.find(query)
        .populate("vendor", "storeName")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Brand.countDocuments(query),
    ]);

    res.json({
      success: true,
      brands,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Get brands error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching brands",
    });
  }
};

exports.updateBrand = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const query = { _id: req.params.id };
    applyScope(query, scope);

    const brand = await Brand.findOne(query);
    if (!brand) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    if (req.body?.name !== undefined) {
      const name = String(req.body?.name || "").trim();
      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Brand name is required",
        });
      }
      brand.name = name;
    }

    if (req.body?.description !== undefined) {
      brand.description = String(req.body?.description || "").trim();
    }
    if (req.body?.logoUrl !== undefined) {
      brand.logoUrl = String(req.body?.logoUrl || "").trim();
    }
    if (req.body?.isActive !== undefined) {
      brand.isActive = Boolean(req.body?.isActive);
    }

    if (scope.admin && req.body?.vendorId !== undefined) {
      const vendorId = String(req.body?.vendorId || "").trim();
      brand.vendor = mongoose.Types.ObjectId.isValid(vendorId) ? vendorId : null;
    }

    brand.slug = await ensureUniqueSlug({
      scope: {
        admin: true,
        vendorId: brand.vendor ? String(brand.vendor) : null,
      },
      slug: brand.name,
      excludeId: brand._id,
    });

    await brand.save();
    await brand.populate("vendor", "storeName");
    await brand.populate("createdBy", "name email");

    res.json({
      success: true,
      message: "Brand updated",
      brand,
    });
  } catch (error) {
    console.error("Update brand error:", error);
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Brand already exists in this scope",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while updating brand",
    });
  }
};

exports.deleteBrand = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const query = { _id: req.params.id };
    applyScope(query, scope);

    const deleted = await Brand.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Brand not found",
      });
    }

    res.json({
      success: true,
      message: "Brand deleted",
    });
  } catch (error) {
    console.error("Delete brand error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting brand",
    });
  }
};

exports.getPublicBrands = async (req, res) => {
  try {
    await seedBrandsFromProducts();

    const requestedVendorId = String(req.query?.vendorId || "").trim();
    const query = {
      isActive: true,
    };

    if (mongoose.Types.ObjectId.isValid(requestedVendorId)) {
      query.vendor = requestedVendorId;
    }

    const brands = await Brand.find(query)
      .select("name logoUrl description vendor")
      .populate("vendor", "storeName businessName")
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      brands,
    });
  } catch (error) {
    console.error("Get public brands error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching public brands",
    });
  }
};

exports.uploadBrandLogo = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Brand logo image file is required",
      });
    }

    const uploaded = await uploadImageBuffer(req.file.buffer, {
      folder: "marketplace/brands",
      resource_type: "image",
    });

    if (!uploaded?.secure_url) {
      return res.status(500).json({
        success: false,
        message: "Brand logo upload failed",
      });
    }

    return res.json({
      success: true,
      message: "Brand logo uploaded successfully",
      logoUrl: String(uploaded.secure_url || "").trim(),
    });
  } catch (error) {
    console.error("Upload brand logo error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while uploading brand logo",
    });
  }
};
