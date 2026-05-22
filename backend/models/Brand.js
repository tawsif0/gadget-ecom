const mongoose = require("mongoose");

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);

const brandSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
      index: true,
      select: false,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    logoUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

brandSchema.index({ vendor: 1, slug: 1 }, { unique: true });

brandSchema.pre("validate", function preValidate(next) {
  if (!String(this.slug || "").trim()) {
    this.slug = slugify(this.name);
  } else {
    this.slug = slugify(this.slug);
  }

  next();
});

const Brand = mongoose.model("Brand", brandSchema);

module.exports = Brand;
