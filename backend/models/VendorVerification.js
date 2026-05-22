const mongoose = require("mongoose");

const verificationDocumentSchema = new mongoose.Schema(
  {
    label: { type: String, default: "", trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const vendorVerificationSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      unique: true,
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    verificationType: {
      type: String,
      enum: ["nid", "trade_license", "social", "mixed"],
      default: "mixed",
    },
    businessName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    tradeLicenseNo: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    nationalIdNo: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    tinNo: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    address: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    documents: {
      type: [verificationDocumentSchema],
      default: [],
    },
    socialProfiles: {
      facebook: { type: String, default: "", trim: true },
      instagram: { type: String, default: "", trim: true },
      youtube: { type: String, default: "", trim: true },
      website: { type: String, default: "", trim: true },
    },
    status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected"],
      default: "draft",
      index: true,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

vendorVerificationSchema.index({ status: 1, updatedAt: -1 });

const VendorVerification = mongoose.model(
  "VendorVerification",
  vendorVerificationSchema,
);

module.exports = VendorVerification;
