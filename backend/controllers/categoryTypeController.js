const { CategoryType, normalizeTypeName } = require("../models/CategoryType");
const Category = require("../models/Category");
const Product = require("../models/Product");

const toRegexExactInsensitive = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
};

// @desc    Get all category types
// @route   GET /api/category-types
// @access  Private
const getCategoryTypes = async (req, res) => {
  try {
    const types = await CategoryType.find()
      .select("name normalizedName createdAt updatedAt")
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, count: types.length, types });
  } catch (error) {
    console.error("Get category types error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Create category type
// @route   POST /api/category-types
// @access  Private
const createCategoryType = async (req, res) => {
  try {
    const name = normalizeTypeName(req.body?.name);
    if (!name) {
      return res.status(400).json({ success: false, message: "Type name is required" });
    }

    const exists = await CategoryType.findOne({ normalizedName: name.toLowerCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: "Type already exists" });
    }

    const type = await CategoryType.create({ name });

    res.status(201).json({ success: true, message: "Type created", type });
  } catch (error) {
    console.error("Create category type error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update category type (renames everywhere)
// @route   PUT /api/category-types/:id
// @access  Private
const updateCategoryType = async (req, res) => {
  try {
    const existing = await CategoryType.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Type not found" });
    }

    const nextName = normalizeTypeName(req.body?.name);
    if (!nextName) {
      return res.status(400).json({ success: false, message: "Type name is required" });
    }

    const normalizedNext = nextName.toLowerCase();
    const conflict = await CategoryType.findOne({
      normalizedName: normalizedNext,
      _id: { $ne: existing._id },
    });
    if (conflict) {
      return res.status(400).json({ success: false, message: "Type already exists" });
    }

    const oldName = existing.name;
    existing.name = nextName;
    await existing.save();

    const oldNameRegex = toRegexExactInsensitive(oldName);
    if (oldNameRegex) {
      await Promise.all([
        Category.updateMany({ type: oldNameRegex }, { $set: { type: nextName, updatedAt: Date.now() } }),
        Product.updateMany({ productType: oldNameRegex }, { $set: { productType: nextName, updatedAt: Date.now() } }),
      ]);
    }

    res.json({ success: true, message: "Type updated", type: existing });
  } catch (error) {
    console.error("Update category type error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete category type (reassigns everywhere to Latest)
// @route   DELETE /api/category-types/:id
// @access  Private
const deleteCategoryType = async (req, res) => {
  try {
    const existing = await CategoryType.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Type not found" });
    }

    const oldNameRegex = toRegexExactInsensitive(existing.name);
    if (oldNameRegex) {
      await Promise.all([
        Category.updateMany({ type: oldNameRegex }, { $set: { type: "Latest", updatedAt: Date.now() } }),
        Product.updateMany({ productType: oldNameRegex }, { $set: { productType: "Latest", updatedAt: Date.now() } }),
      ]);
    }

    await CategoryType.deleteOne({ _id: existing._id });

    res.json({ success: true, message: "Type deleted" });
  } catch (error) {
    console.error("Delete category type error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getCategoryTypes,
  createCategoryType,
  updateCategoryType,
  deleteCategoryType,
};

