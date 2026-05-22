const mongoose = require("mongoose");

const ACCOUNT_ENTRY_TYPES = [
  "income",
  "expense",
  "fund_transfer",
  "salary",
  "bill",
  "payout",
  "adjustment",
];

const accountEntrySchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ACCOUNT_ENTRY_TYPES,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    entryDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    referenceModel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
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

accountEntrySchema.index({ vendor: 1, type: 1, entryDate: -1 });

const AccountEntry = mongoose.model("AccountEntry", accountEntrySchema);

module.exports = {
  AccountEntry,
  ACCOUNT_ENTRY_TYPES,
};
