const mongoose = require("mongoose");

const vendorSubscriptionSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled", "pending"],
      default: "active",
      index: true,
    },
    startsAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    maxProducts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxUploadsPerMonth: {
      type: Number,
      default: 0,
      min: 0,
    },
    featuredProductAccess: {
      type: Boolean,
      default: false,
    },
    commissionType: {
      type: String,
      enum: ["inherit", "percentage", "fixed"],
      default: "inherit",
    },
    commissionValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    monthlyUploadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    monthlyUploadPeriod: {
      type: String,
      default: () => new Date().toISOString().slice(0, 7),
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

vendorSubscriptionSchema.index({ vendor: 1, status: 1, expiresAt: -1 });
vendorSubscriptionSchema.index({ vendor: 1, createdAt: -1 });

const VendorSubscription = mongoose.model(
  "VendorSubscription",
  vendorSubscriptionSchema,
);

module.exports = VendorSubscription;
