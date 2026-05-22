const mongoose = require("mongoose");

const ticketMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["customer", "vendor", "staff", "admin"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNo: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    category: {
      type: String,
      enum: ["general", "order", "payment", "technical", "vendor"],
      default: "general",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    messages: {
      type: [ticketMessageSchema],
      default: [],
    },
    assignedAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

supportTicketSchema.index({ vendor: 1, status: 1, updatedAt: -1 });
supportTicketSchema.index({ createdBy: 1, updatedAt: -1 });

supportTicketSchema.pre("validate", function preValidate(next) {
  if (!this.ticketNo) {
    this.ticketNo = `TK-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  if (!Array.isArray(this.messages)) {
    this.messages = [];
  }

  if (this.messages.length > 0) {
    this.lastMessageAt =
      this.messages[this.messages.length - 1].createdAt || new Date();
  }

  next();
});

const SupportTicket = mongoose.model("SupportTicket", supportTicketSchema);

module.exports = SupportTicket;
