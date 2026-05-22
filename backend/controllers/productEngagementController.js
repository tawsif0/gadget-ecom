const mongoose = require("mongoose");
const Product = require("../models/Product");
const ProductReview = require("../models/ProductReview");
const Vendor = require("../models/Vendor");
const Order = require("../models/Order");
const {
  pushNotificationsToOperationalUsers,
  pushNotificationsToUsers,
} = require("../utils/notificationUtils");

const isObjectId = (value) => /^[0-9a-fA-F]{24}$/.test(String(value || "").trim());
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isApprovedProduct = (product) =>
  Boolean(
    product &&
      product.isActive &&
      ["approved", undefined, null].includes(product.approvalStatus),
  );

const isAdminUser = (user) =>
  ["admin"].includes(String(user?.userType || user?.role || "").trim().toLowerCase());

const normalizeReviewModerationStatus = (review = {}) => {
  const moderationStatus = String(review?.moderationStatus || "")
    .trim()
    .toLowerCase();

  if (["pending", "approved", "rejected"].includes(moderationStatus)) {
    return moderationStatus;
  }

  return review?.isApproved ? "approved" : "pending";
};

const decorateProductReview = (review = {}) => {
  const normalizedStatus = normalizeReviewModerationStatus(review);
  return {
    ...review,
    moderationStatus: normalizedStatus,
    isApproved: normalizedStatus === "approved",
  };
};

const buildApprovedReviewQuery = (productId) => ({
  product: productId,
  $or: [
    { moderationStatus: "approved" },
    {
      moderationStatus: { $exists: false },
      isApproved: true,
    },
  ],
});

const buildAdminReviewStatusQuery = (status) => {
  if (status === "approved") {
    return {
      $or: [
        { moderationStatus: "approved" },
        {
          moderationStatus: { $exists: false },
          isApproved: true,
        },
      ],
    };
  }

  if (status === "pending") {
    return {
      $or: [
        { moderationStatus: "pending" },
        {
          moderationStatus: { $exists: false },
          isApproved: false,
        },
      ],
    };
  }

  if (status === "rejected") {
    return { moderationStatus: "rejected" };
  }

  return {};
};

const recalculateProductRating = async (productId) => {
  const normalizedProductId = isObjectId(productId)
    ? new mongoose.Types.ObjectId(String(productId))
    : productId;
  const result = await ProductReview.aggregate([
    {
      $match: buildApprovedReviewQuery(normalizedProductId),
    },
    {
      $group: {
        _id: "$product",
        avgRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const average = result[0]?.avgRating || 0;
  const count = result[0]?.reviewCount || 0;

  await Product.findByIdAndUpdate(productId, {
    ratingAverage: Math.round((toNumber(average, 0) + Number.EPSILON) * 100) / 100,
    ratingCount: count,
  });

  return {
    ratingAverage: Math.round((toNumber(average, 0) + Number.EPSILON) * 100) / 100,
    ratingCount: count,
  };
};

exports.getProductReviews = async (req, res) => {
  try {
    const productId = String(req.params.id || "").trim();
    if (!isObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(productId)
      .select("title isActive approvalStatus ratingAverage ratingCount")
      .lean();

    if (!product || !isApprovedProduct(product)) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      ProductReview.find(buildApprovedReviewQuery(productId))
        .populate("user", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductReview.countDocuments(buildApprovedReviewQuery(productId)),
    ]);

    const summary = await recalculateProductRating(productId);
    const publicReviews = reviews.map((review) => ({
      ...decorateProductReview(review),
      reviewerEmail: "",
    }));

    res.json({
      success: true,
      product: {
        _id: productId,
        title: product.title,
      },
      summary,
      reviews: publicReviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Get product reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching product reviews",
    });
  }
};

exports.getMyProductReview = async (req, res) => {
  try {
    const productId = String(req.params.id || "").trim();
    if (!isObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const userId = req.user.id || req.user._id;
    const review = await ProductReview.findOne({
      product: productId,
      user: userId,
    })
      .populate("user", "name")
      .lean();

    return res.json({
      success: true,
      review: review ? decorateProductReview(review) : null,
    });
  } catch (error) {
    console.error("Get my product review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching your review",
    });
  }
};

exports.createOrUpdateProductReview = async (req, res) => {
  try {
    const productId = String(req.params.id || "").trim();
    if (!isObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const userId = req.user?.id || req.user?._id || null;
    const rating = Math.max(1, Math.min(5, parseInt(req.body?.rating, 10) || 0));
    const title = String(req.body?.title || "").trim();
    const comment = String(req.body?.comment || "").trim();
    const reviewerName = String(
      userId ? req.user?.name || "" : req.body?.reviewerName || "",
    ).trim();
    const reviewerEmail = String(
      userId ? req.user?.email || "" : req.body?.reviewerEmail || "",
    )
      .trim()
      .toLowerCase();

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

    if (!reviewerName) {
      return res.status(400).json({
        success: false,
        message: "Reviewer name is required",
      });
    }

    if (!reviewerEmail || !isValidEmail(reviewerEmail)) {
      return res.status(400).json({
        success: false,
        message: "A valid reviewer email is required",
      });
    }

    const product = await Product.findById(productId)
      .select("title vendor isActive approvalStatus")
      .lean();

    if (!product || !isApprovedProduct(product)) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.vendor) {
      const vendor = await Vendor.findById(product.vendor).select("user").lean();
      if (userId && vendor?.user && String(vendor.user) === String(userId)) {
        return res.status(400).json({
          success: false,
          message: "You cannot review your own product",
        });
      }
    }

    const verifiedOrderQuery = userId
      ? {
          user: userId,
          "items.product": productId,
          orderStatus: { $in: ["processing", "shipped", "delivered"] },
        }
      : {
          "shippingAddress.email": reviewerEmail,
          "items.product": productId,
          orderStatus: { $in: ["processing", "shipped", "delivered"] },
        };

    const verifiedOrder = await Order.findOne(verifiedOrderQuery)
      .select("_id")
      .lean();

    const existingReview = await ProductReview.findOne(
      userId
        ? {
            product: productId,
            user: userId,
          }
        : {
            product: productId,
            user: null,
            reviewerEmail,
          },
    );

    let review;
    if (existingReview) {
      existingReview.rating = rating;
      existingReview.title = title;
      existingReview.comment = comment;
      existingReview.reviewerName = reviewerName;
      existingReview.reviewerEmail = reviewerEmail;
      existingReview.verifiedPurchase = Boolean(verifiedOrder);
      existingReview.order = verifiedOrder?._id || null;
      existingReview.moderationStatus = "pending";
      existingReview.isApproved = false;
      existingReview.reviewedAt = null;
      existingReview.reviewedBy = null;
      review = await existingReview.save();
    } else {
      review = await ProductReview.create({
        product: productId,
        user: userId || null,
        order: verifiedOrder?._id || null,
        rating,
        title,
        comment,
        reviewerName,
        reviewerEmail,
        verifiedPurchase: Boolean(verifiedOrder),
        moderationStatus: "pending",
        isApproved: false,
        reviewedAt: null,
        reviewedBy: null,
      });
    }

    const summary = await recalculateProductRating(productId);

    await Promise.allSettled([
      pushNotificationsToOperationalUsers({
        type: "review_pending",
        title: "Product review pending approval",
        message: `${reviewerName} ${
          existingReview ? "updated" : "submitted"
        } a review for ${String(product?.title || "a product").trim()}.`,
        link: "/dashboard",
        meta: {
          targetTab: "product-reviews",
          reviewId: String(review?._id || ""),
          productId,
          moderationStatus: "pending",
        },
      }),
    ]);

    res.status(201).json({
      success: true,
      message: existingReview
        ? "Review updated and sent for admin approval"
        : "Review submitted and sent for admin approval",
      review: decorateProductReview(review?.toObject ? review.toObject() : review),
      summary,
    });
  } catch (error) {
    console.error("Create or update product review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while saving product review",
    });
  }
};

exports.getAdminProductReviews = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const status = String(req.query.status || "all").trim().toLowerCase();
    const search = String(req.query.search || "").trim();
    const conditions = [];
    const statusQuery = buildAdminReviewStatusQuery(status);

    if (Object.keys(statusQuery).length > 0) {
      conditions.push(statusQuery);
    }

    if (search) {
      const matchedProducts = await Product.find({
        title: { $regex: search, $options: "i" },
      })
        .select("_id")
        .limit(100)
        .lean();

      const matchedProductIds = matchedProducts.map((entry) => entry._id);

      conditions.push({
        $or: [
        { title: { $regex: search, $options: "i" } },
        { comment: { $regex: search, $options: "i" } },
        { reviewerName: { $regex: search, $options: "i" } },
        { reviewerEmail: { $regex: search, $options: "i" } },
        ...(matchedProductIds.length > 0 ? [{ product: { $in: matchedProductIds } }] : []),
        ],
      });
    }

    const query =
      conditions.length === 0
        ? {}
        : conditions.length === 1
          ? conditions[0]
          : { $and: conditions };

    const [reviews, total] = await Promise.all([
      ProductReview.find(query)
        .populate("product", "title category vendor")
        .populate("user", "name email")
        .populate("reviewedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductReview.countDocuments(query),
    ]);

    res.json({
      success: true,
      reviews: reviews.map((review) => decorateProductReview(review)),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Get admin product reviews error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching product reviews",
    });
  }
};

exports.updateProductReviewStatus = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const moderationStatus = String(req.body?.moderationStatus || "")
      .trim()
      .toLowerCase();

    if (!["pending", "approved", "rejected"].includes(moderationStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review status",
      });
    }

    const review = await ProductReview.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    review.moderationStatus = moderationStatus;
    review.isApproved = moderationStatus === "approved";
    review.reviewedAt = moderationStatus === "pending" ? null : new Date();
    review.reviewedBy =
      moderationStatus === "pending" ? null : req.user?._id || req.user?.id || null;
    await review.save();

    const summary = await recalculateProductRating(review.product);

    const product = await Product.findById(review.product).select("title").lean();
    const reviewerUserId = String(review.user || "").trim();

    if (reviewerUserId) {
      await Promise.allSettled([
        pushNotificationsToUsers([reviewerUserId], {
          type: "review_status_updated",
          title: `Review ${moderationStatus}`,
          message: `Your review for ${String(product?.title || "this product").trim()} is now ${moderationStatus}.`,
          link: `/product/${String(review.product || "").trim()}`,
          meta: {
            reviewId: String(review._id || ""),
            productId: String(review.product || ""),
            moderationStatus,
          },
        }),
      ]);
    }

    res.json({
      success: true,
      message: "Review moderation updated",
      review: decorateProductReview(review?.toObject ? review.toObject() : review),
      summary,
    });
  } catch (error) {
    console.error("Update product review status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating product review",
    });
  }
};

exports.deleteMyProductReview = async (req, res) => {
  try {
    const productId = String(req.params.id || "").trim();
    if (!isObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const userId = req.user.id || req.user._id;

    const deleted = await ProductReview.findOneAndDelete({
      product: productId,
      user: userId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    const summary = await recalculateProductRating(productId);

    res.json({
      success: true,
      message: "Review deleted successfully",
      summary,
    });
  } catch (error) {
    console.error("Delete my product review error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting product review",
    });
  }
};

