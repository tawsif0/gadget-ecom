const mongoose = require("mongoose");

const normalizeCode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const paymentMethodSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    trim: true,
  },
  channelType: {
    type: String,
    enum: ["manual", "cod", "sslcommerz", "bkash", "nagad"],
    default: "manual",
    index: true,
  },
  accountNo: {
    type: String,
    default: "",
    trim: true,
  },
  instructions: {
    type: String,
    default: "",
    trim: true,
    maxlength: 2000,
  },
  requiresTransactionProof: {
    type: Boolean,
    default: true,
  },
  gatewayConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
  },
});

paymentMethodSchema.pre("validate", function preValidate(next) {
  if (!this.code) {
    this.code = normalizeCode(this.type || "");
  } else {
    this.code = normalizeCode(this.code);
  }

  const channel = String(this.channelType || "manual").toLowerCase();

  if (channel === "manual" && !String(this.accountNo || "").trim()) {
    this.invalidate(
      "accountNo",
      "Account number/details are required for manual methods",
    );
  }

  if (["cod", "sslcommerz", "bkash", "nagad"].includes(channel)) {
    this.requiresTransactionProof = false;
  }

  next();
});

const PaymentMethod = mongoose.model("PaymentMethod", paymentMethodSchema);
module.exports = PaymentMethod;
