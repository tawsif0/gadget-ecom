const mongoose = require("mongoose");

const landingPageSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 180,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 220,
      index: true,
    },
    headline: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
    },
    subheadline: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    bannerImage: {
      type: String,
      default: "",
      trim: true,
    },
    pixelId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    metaPixelId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    googleAnalyticsId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    gtmId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    tiktokPixelId: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    customTrackingCode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 12000,
    },
    products: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
      ],
      default: [],
    },
    theme: {
      type: String,
      default: "clean",
      trim: true,
      maxlength: 80,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

landingPageSchema.index({ vendor: 1, createdAt: -1 });

const LandingPage = mongoose.model("LandingPage", landingPageSchema);

module.exports = LandingPage;
