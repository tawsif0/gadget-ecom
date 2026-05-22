const express = require("express");
const auth = require("../middlewares/auth");
const { ensureMultiVendorMode } = require("../middlewares/marketplaceMode");
const { upload, handleMulterError } = require("../middlewares/upload");
const {
  registerVendor,
  getMyVendorProfile,
  updateMyVendorProfile,
  uploadMyVendorAsset,
  getPublicVendors,
  getNearbyVendors,
  getVendorStore,
  getAdminVendors,
  updateVendorStatus,
  updateVendorCommission,
  getVendorDashboardStats,
  getVendorOrders,
  getAdminVendorReports,
} = require("../controllers/vendorController");
const {
  getVendorReviews,
  createVendorReview,
  deleteMyVendorReview,
  createVendorContactMessage,
  getMyVendorMessages,
  updateMyVendorMessageStatus,
  getAdminVendorReviews,
  updateVendorReviewStatus,
} = require("../controllers/vendorEngagementController");

const router = express.Router();

// Public route
router.get("/", ensureMultiVendorMode, getPublicVendors);
router.get("/nearby", ensureMultiVendorMode, getNearbyVendors);

// Authenticated vendor routes
router.post("/register", auth, ensureMultiVendorMode, registerVendor);
router.get("/me/profile", auth, ensureMultiVendorMode, getMyVendorProfile);
router.put("/me/profile", auth, ensureMultiVendorMode, updateMyVendorProfile);
router.post(
  "/me/assets/upload",
  auth,
  ensureMultiVendorMode,
  upload.single("image"),
  handleMulterError,
  uploadMyVendorAsset,
);
router.get("/me/stats", auth, ensureMultiVendorMode, getVendorDashboardStats);
router.get("/me/orders", auth, ensureMultiVendorMode, getVendorOrders);
router.get(
  "/me/contact-messages",
  auth,
  ensureMultiVendorMode,
  getMyVendorMessages,
);
router.patch(
  "/me/contact-messages/:id/status",
  auth,
  ensureMultiVendorMode,
  updateMyVendorMessageStatus,
);

// Admin routes
router.get("/admin/all", auth, ensureMultiVendorMode, getAdminVendors);
router.get("/admin/reports", auth, ensureMultiVendorMode, getAdminVendorReports);
router.get("/admin/reviews", auth, ensureMultiVendorMode, getAdminVendorReviews);
router.patch("/admin/:id/status", auth, ensureMultiVendorMode, updateVendorStatus);
router.patch(
  "/admin/:id/commission",
  auth,
  ensureMultiVendorMode,
  updateVendorCommission,
);
router.patch(
  "/admin/reviews/:id/status",
  auth,
  ensureMultiVendorMode,
  updateVendorReviewStatus,
);

// Public store routes
router.get("/:slug/store", ensureMultiVendorMode, getVendorStore);
router.get("/:slug/reviews", ensureMultiVendorMode, getVendorReviews);
router.post("/:slug/contact", ensureMultiVendorMode, createVendorContactMessage);

// Authenticated customer review routes
router.post("/:slug/reviews", auth, ensureMultiVendorMode, createVendorReview);
router.delete("/:slug/reviews/me", auth, ensureMultiVendorMode, deleteMyVendorReview);

module.exports = router;
