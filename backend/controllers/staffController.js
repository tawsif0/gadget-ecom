const StaffMember = require("../models/StaffMember");
const User = require("../models/User");
const Vendor = require("../models/Vendor");
const {
  isAdmin,
  getUserId,
  getVendorForUser,
} = require("../utils/marketplaceAccess");

const normalizePermissions = (permissions = {}) => ({
  manageProducts: Boolean(permissions.manageProducts),
  manageOrders: Boolean(permissions.manageOrders),
  manageCoupons: Boolean(permissions.manageCoupons),
  manageSupport: Boolean(permissions.manageSupport),
  manageSettings: Boolean(permissions.manageSettings),
});

const resolveVendorAccessForStaff = async (req) => {
  if (isAdmin(req.user)) {
    const vendorId = req.body?.vendorId || req.query?.vendorId;
    if (!vendorId) {
      return { error: "Vendor ID is required for admin staff operation" };
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return { error: "Vendor not found" };

    return { vendor, source: "admin" };
  }

  const access = await getVendorForUser(req.user, {
    approvedOnly: false,
    allowStaff: true,
  });
  if (!access?.vendor) {
    return { error: "Vendor profile not found" };
  }

  if (access.source === "staff") {
    const canManageSettings = Boolean(
      access.staffMember?.permissions?.manageSettings,
    );
    if (!canManageSettings) {
      return {
        error: "Staff permission denied for staff management",
        status: 403,
      };
    }
  }

  return access;
};

exports.getStaffPermissions = async (req, res) => {
  try {
    const userId = getUserId(req.user);

    const membership = await StaffMember.findOne({
      user: userId,
      status: "active",
    })
      .populate("vendor", "storeName slug status")
      .lean();

    if (!membership) {
      return res.json({
        success: true,
        isStaff: false,
      });
    }

    res.json({
      success: true,
      isStaff: true,
      membership,
    });
  } catch (error) {
    console.error("Get staff permissions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching staff permissions",
    });
  }
};

exports.getVendorStaff = async (req, res) => {
  try {
    const access = await resolveVendorAccessForStaff(req);
    if (access.error) {
      return res.status(access.status || 400).json({
        success: false,
        message: access.error,
      });
    }

    const staffMembers = await StaffMember.find({ vendor: access.vendor._id })
      .populate("user", "name email phone userType status")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      staffMembers,
    });
  } catch (error) {
    console.error("Get vendor staff error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching staff members",
    });
  }
};

exports.createStaffMember = async (req, res) => {
  try {
    const access = await resolveVendorAccessForStaff(req);
    if (access.error) {
      return res.status(access.status || 400).json({
        success: false,
        message: access.error,
      });
    }

    const {
      name,
      email,
      phone,
      password,
      roleName = "staff",
      permissions = {},
      notes = "",
      status = "active",
    } = req.body || {};

    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name, email and phone are required",
      });
    }

    let user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });

    if (!user) {
      if (!password || String(password).length < 8) {
        return res.status(400).json({
          success: false,
          message:
            "Password with minimum 8 characters is required for new staff",
        });
      }

      user = await User.create({
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: String(phone).trim(),
        password: String(password),
        userType: "staff",
        status: "active",
      });
    } else {
      const duplicatePhoneUser = await User.findOne({
        phone: User.normalizePhone
          ? User.normalizePhone(String(phone).trim())
          : String(phone).trim(),
        _id: { $ne: user._id },
      }).lean();

      if (duplicatePhoneUser) {
        return res.status(400).json({
          success: false,
          message: "Phone number already used by another user",
        });
      }

      user.name = String(name).trim() || user.name;
      user.phone = String(phone).trim() || user.phone;
      user.userType = "staff";
      if (password && String(password).trim()) {
        user.password = String(password);
      }
      await user.save();
    }

    const existingMembership = await StaffMember.findOne({
      vendor: access.vendor._id,
      user: user._id,
    });

    if (existingMembership) {
      return res.status(400).json({
        success: false,
        message: "User is already assigned as staff for this vendor",
      });
    }

    const staffMember = await StaffMember.create({
      vendor: access.vendor._id,
      user: user._id,
      roleName: String(roleName || "staff").trim(),
      permissions: normalizePermissions(permissions),
      status: ["active", "inactive", "suspended"].includes(status)
        ? status
        : "active",
      notes: String(notes || "").trim(),
      invitedBy: getUserId(req.user),
    });

    const populated = await StaffMember.findById(staffMember._id)
      .populate("vendor", "storeName slug")
      .populate("user", "name email phone userType status");

    res.status(201).json({
      success: true,
      message: "Staff member created successfully",
      staffMember: populated,
    });
  } catch (error) {
    console.error("Create staff member error:", error);
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate staff member or existing unique value conflict",
      });
    }

    if (error?.name === "ValidationError") {
      const messages = Object.values(error.errors || {}).map(
        (item) => item.message,
      );
      return res.status(400).json({
        success: false,
        message: messages.join(", ") || "Validation failed",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while creating staff member",
    });
  }
};

exports.updateStaffMember = async (req, res) => {
  try {
    const access = await resolveVendorAccessForStaff(req);
    if (access.error) {
      return res.status(access.status || 400).json({
        success: false,
        message: access.error,
      });
    }

    const staffMember = await StaffMember.findById(req.params.id).populate(
      "user",
    );
    if (!staffMember) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    if (String(staffMember.vendor) !== String(access.vendor._id)) {
      return res.status(403).json({
        success: false,
        message: "Cannot manage staff from another vendor",
      });
    }

    const { roleName, permissions, status, notes, name, phone } =
      req.body || {};

    if (roleName !== undefined) {
      staffMember.roleName = String(roleName || "staff").trim();
    }

    if (permissions !== undefined) {
      staffMember.permissions = normalizePermissions(permissions);
    }

    if (
      status !== undefined &&
      ["active", "inactive", "suspended"].includes(status)
    ) {
      staffMember.status = status;
    }

    if (notes !== undefined) {
      staffMember.notes = String(notes || "").trim();
    }

    if (staffMember.user) {
      if (name !== undefined) staffMember.user.name = String(name || "").trim();
      if (phone !== undefined)
        staffMember.user.phone = String(phone || "").trim();
      staffMember.user.userType = "staff";
      await staffMember.user.save();
    }

    await staffMember.save();

    const populated = await StaffMember.findById(staffMember._id)
      .populate("vendor", "storeName slug")
      .populate("user", "name email phone userType status");

    res.json({
      success: true,
      message: "Staff member updated",
      staffMember: populated,
    });
  } catch (error) {
    console.error("Update staff member error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating staff member",
    });
  }
};

exports.deleteStaffMember = async (req, res) => {
  try {
    const access = await resolveVendorAccessForStaff(req);
    if (access.error) {
      return res.status(access.status || 400).json({
        success: false,
        message: access.error,
      });
    }

    const staffMember = await StaffMember.findById(req.params.id).populate(
      "user",
    );
    if (!staffMember) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    if (String(staffMember.vendor) !== String(access.vendor._id)) {
      return res.status(403).json({
        success: false,
        message: "Cannot remove staff from another vendor",
      });
    }

    await staffMember.deleteOne();

    res.json({
      success: true,
      message: "Staff member removed",
    });
  } catch (error) {
    console.error("Delete staff member error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while removing staff member",
    });
  }
};
