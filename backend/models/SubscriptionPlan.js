const mongoose = require("mongoose");

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      unique: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"],
      default: "monthly",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    productLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    uploadLimitPerMonth: {
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

subscriptionPlanSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

const SubscriptionPlan = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);

module.exports = SubscriptionPlan;
