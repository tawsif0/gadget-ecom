const mongoose = require("mongoose");

const productReviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: false,
      default: null,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 140,
    },
    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    reviewerName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    reviewerEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    verifiedPurchase: {
      type: Boolean,
      default: false,
    },
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    isApproved: {
      type: Boolean,
      default: false,
      index: true,
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

productReviewSchema.index(
  { product: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: "objectId" } },
  },
);

const ProductReview = mongoose.model("ProductReview", productReviewSchema);
module.exports = ProductReview;

