const mongoose = require("mongoose");

const normalizeCategoryName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const normalizeCategoryGroup = (value) => {
  const normalized = normalizeCategoryName(value);
  return normalized || "Latest";
};

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Category name is required"],
    trim: true,
    minlength: [2, "Category name must be at least 2 characters"],
    maxlength: [50, "Category name cannot exceed 50 characters"],
  },
  type: {
    type: String,
    trim: true,
    default: "Latest",
    maxlength: [60, "Category type cannot exceed 60 characters"],
  },
  normalizedName: {
    type: String,
    trim: true,
    default: "",
    maxlength: 50,
  },
  normalizedType: {
    type: String,
    trim: true,
    default: "latest",
    maxlength: 60,
  },
  description: {
    type: String,
    trim: true,
    default: "",
    maxlength: [1000, "Category description cannot exceed 1000 characters"],
  },
  image: {
    type: String,
    trim: true,
    default: "",
  },
  imagePublicId: {
    type: String,
    trim: true,
    default: "",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

categorySchema.pre("validate", function syncNormalizedFields(next) {
  const normalizedName = normalizeCategoryName(this.name);
  const normalizedType = normalizeCategoryGroup(this.type);

  this.name = normalizedName;
  this.type = normalizedType;
  this.normalizedName = normalizedName.toLowerCase();
  this.normalizedType = normalizedType.toLowerCase();
  this.updatedAt = Date.now();
  next();
});

categorySchema.index({ normalizedType: 1, normalizedName: 1 }, { unique: true });

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
module.exports.normalizeCategoryName = normalizeCategoryName;
module.exports.normalizeCategoryGroup = normalizeCategoryGroup;
