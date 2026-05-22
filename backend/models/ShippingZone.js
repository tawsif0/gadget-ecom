const mongoose = require("mongoose");

const shippingRuleSchema = new mongoose.Schema(
  {
    districts: {
      type: [String],
      default: [],
    },
    shippingFee: {
      type: Number,
      required: true,
      min: 0,
    },
    estimatedMinDays: {
      type: Number,
      default: 2,
      min: 0,
    },
    estimatedMaxDays: {
      type: Number,
      default: 5,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true },
);

const shippingZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    rules: {
      type: [shippingRuleSchema],
      default: [],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  { timestamps: true },
);

shippingZoneSchema.index({ isActive: 1 });

const ShippingZone = mongoose.model("ShippingZone", shippingZoneSchema);
module.exports = ShippingZone;
