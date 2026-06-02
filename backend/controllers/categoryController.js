const Category = require("../models/Category");
const {
  CategoryType,
  ensureLatestCategoryType,
  normalizeTypeName,
} = require("../models/CategoryType");
const { uploadImageBuffer, deleteImage } = require("../config/cloudinary");
const { clearResponseCacheByPrefix } = require("../middlewares/responseCache");

const CATEGORY_IMAGE_OPTIONS = {
  folder: "ecommerce/categories",
  resource_type: "image",
  transformation: [{ quality: "auto:best", fetch_format: "auto" }],
};

const invalidatePublicCategoryCache = () => {
  clearResponseCacheByPrefix("/api/categories/public");
  clearResponseCacheByPrefix("/api/products/public");
};

const normalizeCategoryImage = (value) => {
  const normalized = String(value || "").trim();
  return normalized;
};

const normalizeCategoryName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const normalizeCategoryType = (value) => {
  const normalized = normalizeTypeName(value);
  return normalized || "Latest";
};

const uploadCategoryImage = async (file) => {
  if (!file?.buffer) return null;
  return uploadImageBuffer(file.buffer, CATEGORY_IMAGE_OPTIONS);
};

// @desc    Create new category
// @route   POST /api/categories
// @access  Private (Admin only)
const createCategory = async (req, res) => {
  let uploadedImagePublicId = "";
  try {
    await ensureLatestCategoryType();
    const name = normalizeCategoryName(req.body?.name);
    const type = normalizeCategoryType(req.body?.type);
    const description = String(req.body?.description || "").trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Sub category is required",
      });
    }

    const typeExists = await CategoryType.findOne({
      normalizedName: type.toLowerCase(),
    });
    if (!typeExists && type.toLowerCase() !== "latest") {
      return res.status(400).json({
        success: false,
        message: "Category name not found",
      });
    }

    const categoryExists = await Category.findOne({
      normalizedType: type.toLowerCase(),
      normalizedName: name.toLowerCase(),
    });
    if (categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Sub category already exists under this category name",
      });
    }

    let image = "";
    let imagePublicId = "";

    if (req.file) {
      const uploadedImage = await uploadCategoryImage(req.file);
      if (uploadedImage?.secure_url) {
        image = uploadedImage.secure_url;
        imagePublicId = uploadedImage.public_id || "";
        uploadedImagePublicId = imagePublicId;
      }
    }

    // Create new category
    const category = await Category.create({
      name,
      type,
      description,
      image: normalizeCategoryImage(image),
      imagePublicId,
      isActive: true,
      updatedAt: Date.now(),
    });
    invalidatePublicCategoryCache();

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    if (uploadedImagePublicId) {
      await deleteImage(uploadedImagePublicId);
    }
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Sub category already exists under this category name",
      });
    }
    console.error("Create category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get all categories (Public)
// @route   GET /api/categories/public
// @access  Public
const getPublicCategories = async (req, res) => {
  try {
    await ensureLatestCategoryType();
    const categories = await Category.find({ isActive: true })
      .select("name type description image _id normalizedType normalizedName")
      .sort({ name: 1 })
      .lean();

    const categoryTypes = await CategoryType.find()
      .select("name createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const latestExists = categoryTypes.some(
      (entry) => String(entry?.name || "").trim().toLowerCase() === "latest",
    );
    if (!latestExists) {
      categoryTypes.unshift({
        _id: "latest",
        name: "Latest",
        createdAt: null,
      });
    }

    res.json({
      success: true,
      count: categories.length,
      categories,
      categoryTypes,
    });
  } catch (error) {
    console.error("Get public categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get all categories (Admin)
// @route   GET /api/categories
// @access  Private (Admin only)
const getCategories = async (req, res) => {
  try {
    await ensureLatestCategoryType();
    const categories = await Category.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get single category
// @route   GET /api/categories/:id
// @access  Private (Admin only)
const getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      category,
    });
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private (Admin only)
const updateCategory = async (req, res) => {
  let uploadedImagePublicId = "";
  try {
    await ensureLatestCategoryType();
    const nextName = normalizeCategoryName(req.body?.name);
    const nextType = normalizeCategoryType(req.body?.type);
    const description = req.body?.description;
    const { isActive } = req.body;

    let category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const typeExists = await CategoryType.findOne({
      normalizedName: nextType.toLowerCase(),
    });
    if (!typeExists && nextType.toLowerCase() !== "latest") {
      return res.status(400).json({
        success: false,
        message: "Category name not found",
      });
    }

    if (nextName || nextType) {
      const resolvedName = nextName || category.name;
      const nameExists = await Category.findOne({
        _id: { $ne: category._id },
        normalizedType: nextType.toLowerCase(),
        normalizedName: resolvedName.toLowerCase(),
      });
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: "Sub category already exists under this category name",
        });
      }
    }

    const previousType = String(category.type || "Latest").trim();

    const previousImagePublicId = category.imagePublicId || "";
    let nextImage = category.image || "";
    let nextImagePublicId = previousImagePublicId;

    if (req.file) {
      const uploadedImage = await uploadCategoryImage(req.file);
      if (uploadedImage?.secure_url) {
        nextImage = uploadedImage.secure_url;
        nextImagePublicId = uploadedImage.public_id || "";
        uploadedImagePublicId = nextImagePublicId;
      }
    }

    category = await Category.findByIdAndUpdate(
      req.params.id,
      {
        name: nextName || category.name,
        type: nextType || category.type,
        description:
          description !== undefined
            ? String(description || "").trim()
            : category.description || "",
        image: normalizeCategoryImage(nextImage),
        imagePublicId: nextImagePublicId,
        isActive: isActive !== undefined ? isActive : category.isActive,
        updatedAt: Date.now(),
      },
      { new: true, runValidators: true }
    );

    if (req.file && previousImagePublicId && previousImagePublicId !== nextImagePublicId) {
      await deleteImage(previousImagePublicId);
    }
    if (previousType.toLowerCase() !== String(category.type || "").trim().toLowerCase()) {
      await require("../models/Product").updateMany(
        { category: category._id },
        {
          $set: {
            productType: category.type,
            updatedAt: Date.now(),
          },
        },
      );
    }
    invalidatePublicCategoryCache();

    res.json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    if (uploadedImagePublicId) {
      await deleteImage(uploadedImagePublicId);
    }
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Sub category already exists under this category name",
      });
    }
    console.error("Update category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private (Admin only)
const deleteCategory = async (req, res) => {
  try {
    await ensureLatestCategoryType();
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    if (category.imagePublicId) {
      await deleteImage(category.imagePublicId);
    }

    const linkedProducts = await require("../models/Product").countDocuments({
      category: category._id,
    });
    if (linkedProducts > 0) {
      return res.status(400).json({
        success: false,
        message: "This sub category is in use and cannot be deleted",
      });
    }

    await category.deleteOne();
    invalidatePublicCategoryCache();

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  createCategory,
  getPublicCategories,
  getCategories,
  getCategory,
  updateCategory,
  deleteCategory,
};
