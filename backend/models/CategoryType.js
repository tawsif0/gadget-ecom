const mongoose = require("mongoose");

const normalizeTypeName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

const categoryTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Type name is required"],
    trim: true,
    maxlength: [60, "Type name cannot exceed 60 characters"],
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

const CategoryType = mongoose.model("CategoryType", categoryTypeSchema);

module.exports = { CategoryType, normalizeTypeName };

