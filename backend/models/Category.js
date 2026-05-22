const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Category name is required"],
    trim: true,
    unique: true,
    minlength: [2, "Category name must be at least 2 characters"],
    maxlength: [50, "Category name cannot exceed 50 characters"],
  },
  type: {
    type: String,
    enum: [
      "General",
      "Popular",
      "Hot deals",
      "Best Selling",
      "Latest",
    ],
    default: "General",
  },
  description: {
    type: String,
    trim: true,
    default: "",
    maxlength: [1000, "Category description cannot exceed 1000 characters"],
  },
  image: {
    type: String,
    trim: true,
    default: "",
  },
  imagePublicId: {
    type: String,
    trim: true,
    default: "",
  },
  commissionType: {
    type: String,
    enum: ["inherit", "percentage", "fixed", "hybrid"],
    default: "inherit",
  },
  commissionValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  commissionFixed: {
    type: Number,
    default: 0,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
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

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
