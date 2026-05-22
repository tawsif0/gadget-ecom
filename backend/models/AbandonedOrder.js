const mongoose = require("mongoose");

const selectedVariantSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", trim: true },
    preset: {
      type: String,
      enum: ["size", "color", "custom"],
      default: "custom",
    },
    label: { type: String, default: "", trim: true },
    value: { type: String, default: "", trim: true },
    colorHex: { type: String, default: "", trim: true },
    priceMode: {
      type: String,
      enum: ["default", "direct", "compare"],
      default: "default",
    },
    price: { type: Number, default: null, min: 0 },
    comparePrice: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);

const abandonedOrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 220,
    },
    image: {
      type: String,
      default: "",
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    variationId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    variationLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
    selectedVariants: {
      type: [selectedVariantSchema],
      default: [],
    },
  },
  { _id: false },
);

const abandonedOrderSchema = new mongoose.Schema(
  {
    sessionKey: {
      type: String,
      required: true,
      trim: true,
      index: true,
      maxlength: 160,
    },
    source: {
      type: String,
      default: "checkout",
      trim: true,
      maxlength: 120,
    },
    landingPageSlug: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 180,
    },
    customer: {
      name: { type: String, default: "", trim: true, maxlength: 180 },
      email: { type: String, default: "", trim: true, lowercase: true, maxlength: 180 },
      phone: { type: String, default: "", trim: true, maxlength: 60 },
      alternativePhone: { type: String, default: "", trim: true, maxlength: 60 },
      address: { type: String, default: "", trim: true, maxlength: 320 },
      city: { type: String, default: "", trim: true, maxlength: 120 },
      subCity: { type: String, default: "", trim: true, maxlength: 120 },
      district: { type: String, default: "", trim: true, maxlength: 120 },
      notes: { type: String, default: "", trim: true, maxlength: 2000 },
    },
    items: {
      type: [abandonedOrderItemSchema],
      default: [],
    },
    vendorIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Vendor",
          index: true,
        },
      ],
      default: [],
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["new", "follow_up", "converted", "discarded"],
      default: "new",
      index: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 3000,
    },
    convertedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    createdByUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    capturedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

abandonedOrderSchema.index({ sessionKey: 1, status: 1 });
abandonedOrderSchema.index({ "customer.phone": 1 });
abandonedOrderSchema.index({ "customer.email": 1 });

const AbandonedOrder = mongoose.model("AbandonedOrder", abandonedOrderSchema);

module.exports = AbandonedOrder;
