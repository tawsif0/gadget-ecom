const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    default: "",
    maxlength: [200, "Banner title cannot exceed 200 characters"],
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
  buttonLabel: {
    type: String,
    trim: true,
    default: "",
    maxlength: [80, "Banner button label cannot exceed 80 characters"],
  },
  buttonLink: {
    type: String,
    trim: true,
    default: "",
    maxlength: [500, "Banner button link cannot exceed 500 characters"],
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
  thumb: {
    type: String,
    trim: true,
    default: "",
  },
  thumbPublicId: {
    type: String,
    trim: true,
    default: "",
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

bannerSchema.pre("findOneAndUpdate", function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

const Banner = mongoose.model("Banner", bannerSchema);

module.exports = Banner;
