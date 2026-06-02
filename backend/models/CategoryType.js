const mongoose = require("mongoose");

const normalizeTypeName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const categoryTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Category name is required"],
    trim: true,
    maxlength: [60, "Category name cannot exceed 60 characters"],
  },
  normalizedName: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true,
    maxlength: 60,
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

categoryTypeSchema.pre("validate", function setNormalizedName(next) {
  const normalized = normalizeTypeName(this.name);
  this.name = normalized;
  this.normalizedName = normalized.toLowerCase();
  this.updatedAt = Date.now();
  next();
});

categoryTypeSchema.index({ normalizedName: 1 }, { unique: true });

const CategoryType = mongoose.model("CategoryType", categoryTypeSchema);

const ensureLatestCategoryType = async () => {
  const normalizedLatest = normalizeTypeName("Latest").toLowerCase();
  const latest = await CategoryType.findOne({ normalizedName: normalizedLatest });
  if (latest) {
    if (latest.name !== "Latest") {
      latest.name = "Latest";
      await latest.save();
    }
    return latest;
  }

  return CategoryType.create({ name: "Latest" });
};

module.exports = { CategoryType, normalizeTypeName, ensureLatestCategoryType };

