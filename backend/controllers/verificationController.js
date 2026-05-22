const VendorVerification = require("../models/VendorVerification");
const Vendor = require("../models/Vendor");
const { isAdmin, getUserId, getVendorForUser } = require("../utils/marketplaceAccess");

const normalizeDocuments = (documents) => {
  if (!Array.isArray(documents)) return [];

  return documents
    .map((doc) => ({
      label: String(doc?.label || "").trim(),
      url: String(doc?.url || "").trim(),
    }))
    .filter((doc) => doc.url);
};

const ensureVerificationAccess = async (req, res, options = {}) => {
  const access = await getVendorForUser(req.user, {
    approvedOnly: false,
    allowStaff: true,
  });

  if (!access?.vendor) {
    res.status(404).json({
      success: false,
      message: "Vendor profile not found",
    });
    return null;
  }

  if (access.source === "staff") {
    const canManageSettings = Boolean(access.staffMember?.permissions?.manageSettings);
    if (!canManageSettings && !options.allowReadonly) {
      res.status(403).json({
        success: false,
        message: "Staff permission denied for vendor verification",
      });
      return null;
    }
  }

  return access;
};

exports.getMyVerification = async (req, res) => {
  try {
    const access = await ensureVerificationAccess(req, res, { allowReadonly: true });
    if (!access) return;

    const verification = await VendorVerification.findOne({
      vendor: access.vendor._id,
    }).populate("reviewedBy", "name email");

    res.json({
      success: true,
      verification,
      vendor: {
        _id: access.vendor._id,
        storeName: access.vendor.storeName,
        status: access.vendor.status,
        isVerified: access.vendor.isVerified,
      },
    });
  } catch (error) {
    console.error("Get my verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching verification",
    });
  }
};

exports.submitMyVerification = async (req, res) => {
  try {
    const access = await ensureVerificationAccess(req, res);
    if (!access) return;

    const {
      verificationType = "mixed",
      businessName = "",
      tradeLicenseNo = "",
      nationalIdNo = "",
      tinNo = "",
      address = "",
      documents = [],
      socialProfiles = {},
      submitForReview = true,
    } = req.body || {};

    const payload = {
      submittedBy: getUserId(req.user),
      verificationType,
      businessName: String(businessName || "").trim(),
      tradeLicenseNo: String(tradeLicenseNo || "").trim(),
      nationalIdNo: String(nationalIdNo || "").trim(),
      tinNo: String(tinNo || "").trim(),
      address: String(address || "").trim(),
      documents: normalizeDocuments(documents),
      socialProfiles: {
        facebook: String(socialProfiles?.facebook || "").trim(),
        instagram: String(socialProfiles?.instagram || "").trim(),
        youtube: String(socialProfiles?.youtube || "").trim(),
        website: String(socialProfiles?.website || "").trim(),
      },
      status: submitForReview ? "pending" : "draft",
      submittedAt: submitForReview ? new Date() : null,
      reviewedAt: null,
      reviewedBy: null,
      adminNote: "",
    };

    let verification = await VendorVerification.findOne({ vendor: access.vendor._id });

    if (!verification) {
      verification = await VendorVerification.create({
        vendor: access.vendor._id,
        ...payload,
      });
    } else {
      Object.assign(verification, payload);
      await verification.save();
    }

    if (submitForReview && access.vendor.isVerified) {
      access.vendor.isVerified = false;
      await access.vendor.save();
    }

    const populated = await VendorVerification.findById(verification._id).populate(
      "reviewedBy",
      "name email",
    );

    res.json({
      success: true,
      message: submitForReview
        ? "Verification submitted for admin review"
        : "Verification draft saved",
      verification: populated,
    });
  } catch (error) {
    console.error("Submit verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while submitting verification",
    });
  }
};

exports.getAdminVerifications = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const verifications = await VendorVerification.find(query)
      .populate("vendor", "storeName slug status isVerified")
      .populate("submittedBy", "name email")
      .populate("reviewedBy", "name email")
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      verifications,
    });
  } catch (error) {
    console.error("Get admin verifications error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching verifications",
    });
  }
};

exports.reviewVerification = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { status, adminNote = "" } = req.body || {};

    if (!["approved", "rejected", "pending"].includes(String(status || ""))) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification status",
      });
    }

    const verification = await VendorVerification.findById(req.params.id).populate("vendor");
    if (!verification) {
      return res.status(404).json({
        success: false,
        message: "Verification request not found",
      });
    }

    verification.status = status;
    verification.adminNote = String(adminNote || "").trim();
    verification.reviewedAt = new Date();
    verification.reviewedBy = getUserId(req.user);

    await verification.save();

    if (verification.vendor) {
      verification.vendor.isVerified = status === "approved";
      await verification.vendor.save();
    }

    const populated = await VendorVerification.findById(verification._id)
      .populate("vendor", "storeName slug status isVerified")
      .populate("submittedBy", "name email")
      .populate("reviewedBy", "name email");

    res.json({
      success: true,
      message: "Verification status updated",
      verification: populated,
    });
  } catch (error) {
    console.error("Review verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while reviewing verification",
    });
  }
};
