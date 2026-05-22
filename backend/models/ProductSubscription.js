const mongoose = require("mongoose");

const renewalEventSchema = new mongoose.Schema(
  {
    billedAt: {
      type: Date,
      default: Date.now,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    status: {
      type: String,
      enum: ["created", "skipped", "failed"],
      default: "created",
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false },
);

const productSubscriptionSchema = new mongoose.Schema(
  {
    subscriptionNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    guestEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    sourceOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    sourceItemKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "BDT",
      trim: true,
      uppercase: true,
      maxlength: 12,
    },
    billingInterval: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
      default: "monthly",
      index: true,
    },
    billingIntervalCount: {
      type: Number,
      default: 1,
      min: 1,
      max: 24,
    },
    totalCycles: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedCycles: {
      type: Number,
      default: 0,
      min: 0,
    },
    trialDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    startsAt: {
      type: Date,
      required: true,
    },
    nextBillingAt: {
      type: Date,
      default: null,
      index: true,
    },
    lastBilledAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "paused", "cancelled", "completed", "expired"],
      default: "active",
      index: true,
    },
    paymentMethod: {
      type: String,
      required: true,
      trim: true,
    },
    shippingAddress: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    renewalHistory: {
      type: [renewalEventSchema],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: String,
      enum: ["order", "admin"],
      default: "order",
    },
  },
  { timestamps: true },
);

productSubscriptionSchema.index({ user: 1, status: 1, createdAt: -1 });
productSubscriptionSchema.index({ guestEmail: 1, status: 1, createdAt: -1 });

productSubscriptionSchema.pre("validate", function preValidate(next) {
  if (!this.subscriptionNumber) {
    this.subscriptionNumber = `SUB-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  if (!this.user && !String(this.guestEmail || "").trim()) {
    this.invalidate("guestEmail", "Guest email is required for guest subscriptions");
  }

  if (
    this.totalCycles > 0 &&
    Number(this.completedCycles || 0) >= Number(this.totalCycles || 0)
  ) {
    this.status = "completed";
    this.nextBillingAt = null;
  }

  next();
});

const ProductSubscription = mongoose.model(
  "ProductSubscription",
  productSubscriptionSchema,
);

module.exports = ProductSubscription;
