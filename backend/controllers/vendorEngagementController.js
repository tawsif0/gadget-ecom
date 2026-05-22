const Vendor = require("../models/Vendor");
const VendorReview = require("../models/VendorReview");
const VendorContactMessage = require("../models/VendorContactMessage");
const Order = require("../models/Order");
const { isAdmin } = require("../utils/vendorUtils");
const {
  sendVendorContactEmail,
  sendVendorContactAcknowledgementEmail,
} = require("../utils/emailTemplates");

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const recalculateVendorRating = async (vendorId) => {
  const result = await VendorReview.aggregate([
    {
      $match: {
        vendor: vendorId,
        isApproved: true,
      },
    },
    {
      $group: {
        _id: "$vendor",
        avgRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const average = result[0]?.avgRating || 0;
  const count = result[0]?.reviewCount || 0;

  await Vendor.findByIdAndUpdate(vendorId, {
    ratingAverage: Math.round((toNumber(average, 0) + Number.EPSILON) * 100) / 100,
    ratingCount: count,
  });
};

const getVendorBySlug = async (slug) =>
  Vendor.findOne({
    slug: String(slug || "").trim().toLowerCase(),
    status: "approved",
  }).select(
    "_id user storeName slug email contactFormEnabled storePrivacy ratingAverage ratingCount",
  );

const getRequesterVendor = async (req) =>
  Vendor.findOne({ user: req.user.id || req.user._id })
    .select("_id storeName slug")
    .lean();

exports.getVendorReviews = async (req, res) => {
  try {
    const vendor = await getVendorBySlug(req.params.slug);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      VendorReview.find({
        vendor: vendor._id,
        isApproved: true,
      })
        .populate("user", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorReview.countDocuments({
        vendor: vendor._id,
        isApproved: true,
      }),
    ]);

    res.json({
      success: true,
      vendor: {
        _id: vendor._id,
        storeName: vendor.storeName,
        slug: vendor.slug,
        ratingAverage: vendor.ratingAverage || 0,
        ratingCount: vendor.ratingCount || 0,
      },
      reviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Get vendor reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vendor reviews",
    });
  }
};

exports.createVendorReview = async (req, res) => {
  try {
    const vendor = await getVendorBySlug(req.params.slug);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    if (String(vendor.user || "") === String(req.user.id || req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot review your own store",
      });
    }

    const rating = Math.max(1, Math.min(5, parseInt(req.body?.rating, 10) || 0));
    const title = String(req.body?.title || "").trim();
    const comment = String(req.body?.comment || "").trim();

    if (!rating) {
      return res.status(400).json({
        success: false,
        message: "Rating is required",
      });
    }

    if (!comment) {
      return res.status(400).json({
        success: false,
        message: "Review comment is required",
      });
    }

    const verifiedOrder = await Order.findOne({
      user: req.user.id || req.user._id,
      "items.vendor": vendor._id,
      orderStatus: { $in: ["processing", "shipped", "delivered"] },
    })
      .select("_id")
      .lean();

    const existingReview = await VendorReview.findOne({
      vendor: vendor._id,
      user: req.user.id || req.user._id,
    });

    let review;
    if (existingReview) {
      existingReview.rating = rating;
      existingReview.title = title;
      existingReview.comment = comment;
      existingReview.reviewerName = req.user.name || "";
      existingReview.reviewerEmail = req.user.email || "";
      existingReview.verifiedPurchase = Boolean(verifiedOrder);
      existingReview.order = verifiedOrder?._id || null;
      existingReview.isApproved = true;
      review = await existingReview.save();
    } else {
      review = await VendorReview.create({
        vendor: vendor._id,
        user: req.user.id || req.user._id,
        order: verifiedOrder?._id || null,
        rating,
        title,
        comment,
        reviewerName: req.user.name || "",
        reviewerEmail: req.user.email || "",
        verifiedPurchase: Boolean(verifiedOrder),
        isApproved: true,
      });
    }

    await recalculateVendorRating(vendor._id);

    res.status(201).json({
      success: true,
      message: existingReview
        ? "Review updated successfully"
        : "Review submitted successfully",
      review,
    });
  } catch (error) {
    console.error("Create vendor review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while submitting review",
    });
  }
};

exports.deleteMyVendorReview = async (req, res) => {
  try {
    const vendor = await getVendorBySlug(req.params.slug);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const deleted = await VendorReview.findOneAndDelete({
      vendor: vendor._id,
      user: req.user.id || req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    await recalculateVendorRating(vendor._id);

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete vendor review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting review",
    });
  }
};

exports.createVendorContactMessage = async (req, res) => {
  try {
    const vendor = await getVendorBySlug(req.params.slug);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    if (vendor.storePrivacy === "private") {
      return res.status(403).json({
        success: false,
        message: "This vendor store is private",
      });
    }

    if (!vendor.contactFormEnabled) {
      return res.status(403).json({
        success: false,
        message: "Vendor contact form is disabled",
      });
    }

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = String(req.body?.phone || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and message are required",
      });
    }

    const contact = await VendorContactMessage.create({
      vendor: vendor._id,
      name,
      email,
      phone,
      subject,
      message,
      user: null,
      status: "new",
    });

    const vendorEmail = String(vendor.email || "").trim().toLowerCase();
    if (vendorEmail) {
      sendVendorContactEmail({
        vendorName: vendor.storeName || "Vendor Store",
        vendorEmail,
        contact,
      }).catch(() => null);
    }

    sendVendorContactAcknowledgementEmail({
      recipientEmail: email,
      vendorName: vendor.storeName || "Vendor Store",
      subject: subject || "New inquiry",
    }).catch(() => null);

    res.status(201).json({
      success: true,
      message: "Message sent to vendor successfully",
      contact,
    });
  } catch (error) {
    console.error("Create vendor contact message error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while sending message",
    });
  }
};

exports.getMyVendorMessages = async (req, res) => {
  try {
    const vendor = await getRequesterVendor(req);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {
      vendor: vendor._id,
      ...(req.query.status ? { status: req.query.status } : {}),
    };

    const [messages, total] = await Promise.all([
      VendorContactMessage.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorContactMessage.countDocuments(query),
    ]);

    res.json({
      success: true,
      messages,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Get my vendor messages error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching messages",
    });
  }
};

exports.getAdminVendorReviews = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const status = String(req.query.status || "all")
      .trim()
      .toLowerCase();
    const vendorId = String(req.query.vendorId || "").trim();
    const search = String(req.query.search || "").trim();

    const query = {};

    if (status === "approved") {
      query.isApproved = true;
    } else if (status === "hidden") {
      query.isApproved = false;
    }

    if (vendorId) {
      query.vendor = vendorId;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { comment: { $regex: search, $options: "i" } },
        { reviewerName: { $regex: search, $options: "i" } },
        { reviewerEmail: { $regex: search, $options: "i" } },
      ];
    }

    const [reviews, total] = await Promise.all([
      VendorReview.find(query)
        .populate("vendor", "storeName slug status")
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorReview.countDocuments(query),
    ]);

    res.json({
      success: true,
      reviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Get admin vendor reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching vendor reviews",
    });
  }
};

exports.updateMyVendorMessageStatus = async (req, res) => {
  try {
    const vendor = await getRequesterVendor(req);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!["new", "read", "replied", "closed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message status",
      });
    }

    const message = await VendorContactMessage.findOne({
      _id: req.params.id,
      vendor: vendor._id,
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    message.status = status;
    await message.save();

    res.json({
      success: true,
      message: "Message status updated",
      contactMessage: message,
    });
  } catch (error) {
    console.error("Update vendor message status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating message status",
    });
  }
};

exports.updateVendorReviewStatus = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const review = await VendorReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    review.isApproved = Boolean(req.body?.isApproved);
    await review.save();
    await recalculateVendorRating(review.vendor);

    res.json({
      success: true,
      message: "Review moderation updated",
      review,
    });
  } catch (error) {
    console.error("Update vendor review status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating review status",
    });
  }
};
