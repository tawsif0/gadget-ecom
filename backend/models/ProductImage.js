const mongoose = require("mongoose");

const productImageSchema = new mongoose.Schema({
  data: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    default: "",
  },
  mimeType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  format: {
    type: String,
    default: "",
  },
  width: {
    type: Number,
    default: 0,
  },
  height: {
    type: Number,
    default: 0,
  },
  resourceType: {
    type: String,
    default: "image",
  },
});

const ProductImage = mongoose.model("ProductImage", productImageSchema);

module.exports = ProductImage;
