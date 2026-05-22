// models/Coupon.js
const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  discountType: {
    type: String,
    enum: ["percentage", "fixed"],
    default: "percentage",
  },
  offerType: {
    type: String,
    enum: ["discount", "free_shipping", "combo"],
    default: "discount",
    index: true,
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },
  requiredProducts: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    default: [],
  },
  applicabilityMode: {
    type: String,
    enum: ["global", "targeted"],
    default: "global",
  },
  targetCategoryTypes: {
    type: [String],
    default: [],
  },
  targetCategories: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    default: [],
  },
  targetProducts: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    default: [],
  },
  minPurchase: {
    type: Number,
    default: 0,
  },
  maxDiscount: {
    type: Number,
    default: null,
  },
  validUntil: {
    type: Date,
    required: true,
  },
  usageLimit: {
    type: Number,
    default: null,
  },
  usedCount: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
    default: null,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

couponSchema.pre("save", function preSave(next) {
  this.updatedAt = Date.now();
  next();
});

const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;
