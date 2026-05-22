const mongoose = require("mongoose");

const vendorContactMessageSchema = new mongoose.Schema(
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
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 40,
    },
    subject: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    status: {
      type: String,
      enum: ["new", "read", "replied", "closed"],
      default: "new",
      index: true,
    },
  },
  { timestamps: true },
);

vendorContactMessageSchema.index({ vendor: 1, createdAt: -1 });

const VendorContactMessage = mongoose.model(
  "VendorContactMessage",
  vendorContactMessageSchema,
);

module.exports = VendorContactMessage;
