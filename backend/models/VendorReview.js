const mongoose = require("mongoose");

const vendorReviewSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
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
    isApproved: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

vendorReviewSchema.index(
  { vendor: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: { user: { $type: "objectId" } },
  },
);

const VendorReview = mongoose.model("VendorReview", vendorReviewSchema);
module.exports = VendorReview;
