// models/Order.js
const mongoose = require("mongoose");

const selectedVariantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
      trim: true,
    },
    preset: {
      type: String,
      enum: ["size", "color", "custom"],
      default: "custom",
    },
    label: {
      type: String,
      default: "",
      trim: true,
    },
    value: {
      type: String,
      default: "",
      trim: true,
    },
    colorHex: {
      type: String,
      default: "",
      trim: true,
    },
    priceMode: {
      type: String,
      enum: ["default", "direct", "compare"],
      default: "default",
    },
    price: {
      type: Number,
      default: null,
      min: 0,
    },
    comparePrice: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  { _id: false },
);

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  variationId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  variationLabel: {
    type: String,
    default: "",
    trim: true,
  },
  selectedVariants: {
    type: [selectedVariantSchema],
    default: [],
  },
  sku: {
    type: String,
    default: "",
    trim: true,
  },
  color: {
    type: String,
    default: "",
  },
  dimensions: {
    type: String,
    default: "",
  },
});

const addressSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  alternativePhone: {
    type: String,
    trim: true,
    default: "",
  },
  address: {
    type: String,
    trim: true,
    default: "",
  },
  city: {
    type: String,
    trim: true,
    default: "",
  },
  subCity: {
    type: String,
    trim: true,
    default: "",
  },
  district: {
    type: String,
    trim: true,
    default: "",
  },
  postalCode: {
    type: String,
    trim: true,
    default: "",
  },
  country: {
    type: String,
    trim: true,
    default: "Bangladesh",
  },
  notes: {
    type: String,
    trim: true,
    default: "",
  },
});
const paymentDetailsSchema = new mongoose.Schema({
  method: {
    type: String,
    required: true,
  },
  paymentCategory: {
    type: String,
    enum: ["cash_on_delivery", "online"],
    default: "online",
    trim: true,
  },
  providerType: {
    type: String,
    default: "",
    trim: true,
  },
  transactionId: {
    type: String,
    default: "",
  },
  gatewayPaymentId: {
    type: String,
    default: "",
    trim: true,
  },
  paymentUrl: {
    type: String,
    default: "",
    trim: true,
  },
  accountNo: {
    type: String,
    default: "",
  },
  sentFrom: {
    type: String,
    default: "",
  },
  sentTo: {
    type: String,
    default: "",
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
});

const cancellationRequestSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    reason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    requestSource: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },
    requestedAt: {
      type: Date,
      default: null,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolutionNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1200,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const ORDER_STATUS_FLOW = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

const orderStatusTimelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ORDER_STATUS_FLOW,
      required: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    changedByRole: {
      type: String,
      default: "system",
      trim: true,
      maxlength: 40,
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  items: [orderItemSchema],
  shippingAddress: addressSchema,
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  shippingFee: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  shippingMeta: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  couponCode: {
    type: String,
    default: "",
    trim: true,
    uppercase: true,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
  paymentMethod: {
    type: String,
    required: true,
    // REMOVE ENUM - Get from database
  },
  paymentDetails: paymentDetailsSchema,
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  orderStatus: {
    type: String,
    enum: ORDER_STATUS_FLOW,
    default: "pending",
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  cancellationRequest: {
    type: cancellationRequestSchema,
    default: () => ({
      status: "none",
      reason: "",
      requestSource: "",
      requestedAt: null,
      requestedBy: null,
      resolutionNote: "",
      resolvedAt: null,
    }),
  },
  adminNotes: {
    type: String,
    default: "",
    trim: true,
    maxlength: 3000,
  },
  statusTimeline: {
    type: [orderStatusTimelineSchema],
    default: [],
  },
  source: {
    type: String,
    default: "shop",
    trim: true,
    maxlength: 120,
    index: true,
  },
  landingPage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LandingPage",
    default: null,
    index: true,
  },
  landingPageSlug: {
    type: String,
    default: "",
    trim: true,
    lowercase: true,
    maxlength: 220,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

orderSchema.pre("validate", function preValidate(next) {
  if (!this.paymentDetails) {
    this.paymentDetails = {};
  }

  if (!this.paymentDetails.method && this.paymentMethod) {
    this.paymentDetails.method = this.paymentMethod;
  }

  if (!this.paymentMethod && this.paymentDetails?.method) {
    this.paymentMethod = this.paymentDetails.method;
  }

  const paymentLookup = `${this.paymentMethod || ""} ${this.paymentDetails?.method || ""} ${this.paymentDetails?.providerType || ""}`;
  if (!this.paymentDetails.paymentCategory) {
    this.paymentDetails.paymentCategory = /\bcod\b|cash[\s_-]*on[\s_-]*delivery/i.test(
      paymentLookup,
    )
      ? "cash_on_delivery"
      : "online";
  }

  if (this.isNew && (!Array.isArray(this.statusTimeline) || this.statusTimeline.length === 0)) {
    this.statusTimeline = [
      {
        status: this.orderStatus || "pending",
        note: "Order created",
        changedAt: this.createdAt || new Date(),
        changedBy: null,
        changedByRole: "system",
      },
    ];
  }

  next();
});

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
orderSchema.index({ source: 1, createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
