const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
      maxlength: 220,
    },
    sku: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    variationId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    variationLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 180,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const purchaseSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    items: {
      type: [purchaseItemSchema],
      default: [],
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
      index: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

purchaseSchema.pre("validate", function preValidate(next) {
  const totalAmount = Number(this.totalAmount || 0);
  const paidAmount = Math.max(0, Number(this.paidAmount || 0));
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  this.paidAmount = Math.min(paidAmount, totalAmount);
  this.dueAmount = dueAmount;

  if (dueAmount <= 0) {
    this.paymentStatus = "paid";
  } else if (this.paidAmount > 0) {
    this.paymentStatus = "partial";
  } else {
    this.paymentStatus = "unpaid";
  }

  next();
});

purchaseSchema.index({ vendor: 1, invoiceNumber: 1 });

const Purchase = mongoose.model("Purchase", purchaseSchema);

module.exports = Purchase;
