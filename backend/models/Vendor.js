const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    storeName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
      maxlength: 300,
    },
    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    country: {
      type: String,
      default: "Bangladesh",
      trim: true,
      maxlength: 120,
    },
    logo: {
      type: String,
      default: "",
      trim: true,
    },
    banner: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
      index: true,
    },
    commissionType: {
      type: String,
      enum: ["inherit", "percentage", "fixed", "hybrid"],
      default: "inherit",
    },
    commissionValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    commissionFixed: {
      type: Number,
      default: 0,
      min: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    seoTitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    seoDescription: {
      type: String,
      default: "",
      trim: true,
      maxlength: 320,
    },
    openingHours: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    vacationMode: {
      type: Boolean,
      default: false,
    },
    socialLinks: {
      facebook: { type: String, default: "", trim: true },
      instagram: { type: String, default: "", trim: true },
      website: { type: String, default: "", trim: true },
    },
    storePolicies: {
      shippingPolicy: { type: String, default: "", trim: true, maxlength: 4000 },
      refundPolicy: { type: String, default: "", trim: true, maxlength: 4000 },
      privacyPolicy: { type: String, default: "", trim: true, maxlength: 4000 },
      termsConditions: { type: String, default: "", trim: true, maxlength: 4000 },
    },
    contactFormEnabled: {
      type: Boolean,
      default: true,
    },
    storePrivacy: {
      type: String,
      enum: ["public", "private"],
      default: "public",
    },
    locationMapUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    geoLocation: {
      lat: {
        type: Number,
        default: null,
        min: -90,
        max: 90,
      },
      lng: {
        type: Number,
        default: null,
        min: -180,
        max: 180,
      },
      label: {
        type: String,
        default: "",
        trim: true,
        maxlength: 200,
      },
    },
    ratingAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

vendorSchema.index({ storeName: 1 });

const Vendor = mongoose.model("Vendor", vendorSchema);

module.exports = Vendor;
