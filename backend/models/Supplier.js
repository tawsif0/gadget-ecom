const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: 180,
    },
    address: {
      type: String,
      default: "",
      trim: true,
      maxlength: 320,
    },
    openingDue: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentDue: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

supplierSchema.pre("validate", function preValidate(next) {
  if (this.isNew && (!Number.isFinite(this.currentDue) || this.currentDue < 0)) {
    this.currentDue = Number(this.openingDue || 0);
  }

  if (Number(this.currentDue || 0) < 0) {
    this.currentDue = 0;
  }

  if (Number(this.totalPaid || 0) < 0) {
    this.totalPaid = 0;
  }

  next();
});

supplierSchema.index({ vendor: 1, name: 1 });

const Supplier = mongoose.model("Supplier", supplierSchema);

module.exports = Supplier;
