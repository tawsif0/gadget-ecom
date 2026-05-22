const mongoose = require("mongoose");

const staffPermissionSchema = new mongoose.Schema(
  {
    manageProducts: { type: Boolean, default: false },
    manageOrders: { type: Boolean, default: false },
    manageCoupons: { type: Boolean, default: false },
    manageSupport: { type: Boolean, default: false },
    manageSettings: { type: Boolean, default: false },
  },
  { _id: false },
);

const staffMemberSchema = new mongoose.Schema(
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
      required: true,
    },
    roleName: {
      type: String,
      required: true,
      default: "staff",
      trim: true,
      maxlength: 120,
    },
    permissions: {
      type: staffPermissionSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
      index: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

staffMemberSchema.index({ vendor: 1, user: 1 }, { unique: true });
staffMemberSchema.index({ vendor: 1, status: 1, createdAt: -1 });

const StaffMember = mongoose.model("StaffMember", staffMemberSchema);

module.exports = StaffMember;
