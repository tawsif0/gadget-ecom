const mongoose = require("mongoose");

const conversationMessageSchema = new mongoose.Schema(
  {
    senderUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["customer", "vendor", "admin"],
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
  { _id: true },
);

const vendorConversationSchema = new mongoose.Schema(
  {
    conversationNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
      index: true,
    },
    subject: {
      type: String,
      default: "",
      trim: true,
      maxlength: 220,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      index: true,
    },
    unreadByVendor: {
      type: Number,
      default: 0,
      min: 0,
    },
    unreadByCustomer: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    messages: {
      type: [conversationMessageSchema],
      default: [],
    },
  },
  { timestamps: true },
);

vendorConversationSchema.index({ vendor: 1, status: 1, lastMessageAt: -1 });
vendorConversationSchema.index({ customer: 1, status: 1, lastMessageAt: -1 });
vendorConversationSchema.index({
  vendor: 1,
  customer: 1,
  product: 1,
  status: 1,
});

vendorConversationSchema.pre("validate", function preValidate(next) {
  if (!this.conversationNumber) {
    this.conversationNumber = `CHAT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  if (Array.isArray(this.messages) && this.messages.length > 0) {
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage?.createdAt) {
      this.lastMessageAt = lastMessage.createdAt;
    } else {
      this.lastMessageAt = new Date();
    }
  }

  next();
});

const VendorConversation = mongoose.model("VendorConversation", vendorConversationSchema);

module.exports = VendorConversation;
