const Vendor = require("../models/Vendor");
const StaffMember = require("../models/StaffMember");

const getUserId = (user) => user?.id || user?._id || null;

const normalizeRole = (user) =>
  String(user?.userType || user?.role || "")
    .toLowerCase()
    .trim();

const isAdmin = (user) => normalizeRole(user) === "admin";
const isVendor = (user) => normalizeRole(user) === "vendor";
const isStaff = (user) => normalizeRole(user) === "staff";

const getVendorForUser = async (user, options = {}) => {
  const { approvedOnly = false, allowStaff = true, requireActiveStaff = true } =
    options;

  const userId = getUserId(user);
  if (!userId) {
    return null;
  }

  const vendorStatusFilter = approvedOnly ? { status: "approved" } : {};

  if (isVendor(user)) {
    const vendor = await Vendor.findOne({ user: userId, ...vendorStatusFilter });
    if (!vendor) return null;
    return { vendor, source: "vendor", staffMember: null };
  }

  if (allowStaff && isStaff(user)) {
    const staffMember = await StaffMember.findOne({
      user: userId,
      ...(requireActiveStaff ? { status: "active" } : {}),
    })
      .populate("vendor")
      .lean();

    if (!staffMember?.vendor) {
      return null;
    }

    if (approvedOnly && String(staffMember.vendor.status) !== "approved") {
      return null;
    }

    const vendor = await Vendor.findById(staffMember.vendor._id);
    if (!vendor) return null;

    return { vendor, source: "staff", staffMember };
  }

  return null;
};

module.exports = {
  getUserId,
  isAdmin,
  isVendor,
  isStaff,
  getVendorForUser,
};
