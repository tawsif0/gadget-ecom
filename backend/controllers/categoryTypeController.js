const {
  CategoryType,
  normalizeTypeName,
  ensureLatestCategoryType,
} = require("../models/CategoryType");
const Category = require("../models/Category");
const Product = require("../models/Product");
const { clearResponseCacheByPrefix } = require("../middlewares/responseCache");

const invalidatePublicCatalogCache = () => {
  clearResponseCacheByPrefix("/api/categories/public");
  clearResponseCacheByPrefix("/api/products/public");
};

const toRegexExactInsensitive = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
};

const resolveLatestCategoryName = () => "Latest";

// @desc    Get all category names
// @route   GET /api/category-types
// @access  Private
const getCategoryTypes = async (req, res) => {
  try {
    await ensureLatestCategoryType();
    const types = await CategoryType.find()
      .select("name normalizedName createdAt updatedAt")
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, count: types.length, types });
  } catch (error) {
    console.error("Get category names error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create category name
// @route   POST /api/category-types
// @access  Private
const createCategoryType = async (req, res) => {
  try {
    const name = normalizeTypeName(req.body?.name);
    if (!name) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    if (name.toLowerCase() === resolveLatestCategoryName().toLowerCase()) {
      await ensureLatestCategoryType();
      return res.status(200).json({
        success: true,
        message: "Category name already exists",
        type: await CategoryType.findOne({ normalizedName: "latest" }).lean(),
      });
    }

    const exists = await CategoryType.findOne({ normalizedName: name.toLowerCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: "Category name already exists" });
    }

    const type = await CategoryType.create({ name });
    invalidatePublicCatalogCache();

    res.status(201).json({ success: true, message: "Category name created", type });
  } catch (error) {
    console.error("Create category name error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update category name (renames everywhere)
// @route   PUT /api/category-types/:id
// @access  Private
const updateCategoryType = async (req, res) => {
  try {
    await ensureLatestCategoryType();
    const existing = await CategoryType.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Category name not found" });
    }

    const nextName = normalizeTypeName(req.body?.name);
    if (!nextName) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    if (existing.normalizedName === "latest" && nextName.toLowerCase() !== "latest") {
      return res.status(400).json({
        success: false,
        message: "Latest category name must always exist",
      });
    }

    const normalizedNext = nextName.toLowerCase();
    const conflict = await CategoryType.findOne({
      normalizedName: normalizedNext,
      _id: { $ne: existing._id },
    });
    if (conflict) {
      return res.status(400).json({ success: false, message: "Category name already exists" });
    }

    const oldName = existing.name;
    existing.name = nextName;
    await existing.save();

    const oldNameRegex = toRegexExactInsensitive(oldName);
    if (oldNameRegex) {
      await Promise.all([
        Category.updateMany(
          { type: oldNameRegex },
          {
            $set: {
              type: nextName,
              normalizedType: nextName.toLowerCase(),
              updatedAt: Date.now(),
            },
          },
        ),
        Product.updateMany(
          { productType: oldNameRegex },
          { $set: { productType: nextName, updatedAt: Date.now() } },
        ),
      ]);
    }
    invalidatePublicCatalogCache();

    res.json({ success: true, message: "Category name updated", type: existing });
  } catch (error) {
    console.error("Update category name error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete category name (reassigns everywhere to Latest)
// @route   DELETE /api/category-types/:id
// @access  Private
const deleteCategoryType = async (req, res) => {
  try {
    await ensureLatestCategoryType();
    const existing = await CategoryType.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Category name not found" });
    }

    if (existing.normalizedName === "latest") {
      return res.status(400).json({
        success: false,
        message: "Latest category name cannot be deleted",
      });
    }

    const oldNameRegex = toRegexExactInsensitive(existing.name);
    if (oldNameRegex) {
      await Promise.all([
        Category.updateMany(
          { type: oldNameRegex },
          {
            $set: {
              type: "Latest",
              normalizedType: "latest",
              updatedAt: Date.now(),
            },
          },
        ),
        Product.updateMany(
          { productType: oldNameRegex },
          { $set: { productType: "Latest", updatedAt: Date.now() } },
        ),
      ]);
    }

    await CategoryType.deleteOne({ _id: existing._id });
    invalidatePublicCatalogCache();

    res.json({ success: true, message: "Category name deleted" });
  } catch (error) {
    console.error("Delete category name error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getCategoryTypes,
  createCategoryType,
  updateCategoryType,
  deleteCategoryType,
};
