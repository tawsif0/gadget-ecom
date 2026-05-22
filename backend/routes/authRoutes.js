const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const paymentController = require("../controllers/paymentController");
const auth = require("../middlewares/auth");
const responseCache = require("../middlewares/responseCache");
const { upload, handleMulterError } = require("../middlewares/upload");

// Public routes
router.post("/register", authController.registerUser);
router.get(
  "/register/availability",
  authController.checkRegistrationAvailability,
);
router.post("/login", authController.loginUser); // Accepts email OR phone
router.get("/social/google", authController.startGoogleLogin);
router.get("/social/google/callback", authController.handleGoogleLoginCallback);
router.get("/social/facebook", authController.startFacebookLogin);
router.get(
  "/social/facebook/callback",
  authController.handleFacebookLoginCallback,
);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);
router.get(
  "/payment-methods",
  responseCache(60000),
  paymentController.getPaymentMethods,
);
router.get(
  "/public/settings",
  responseCache(60000),
  authController.getPublicSettings,
);
router.get("/notifications/stream", authController.streamUserNotifications);

// Protected routes - All users
router.get("/profile", auth, authController.getUserProfile);
router.put("/profile", auth, authController.updateUserProfile);
router.put("/change-password", auth, authController.changePassword);
router.get("/notifications", auth, authController.getUserNotifications);
router.patch(
  "/notifications/read-all",
  auth,
  authController.markAllUserNotificationsRead,
);
router.patch(
  "/notifications/:notificationId/read",
  auth,
  authController.markUserNotificationRead,
);
router.delete(
  "/notifications/:notificationId",
  auth,
  authController.deleteUserNotification,
);
router.delete(
  "/notifications",
  auth,
  authController.clearAllUserNotifications,
);
router.get("/addresses", auth, authController.getUserAddresses);
router.post("/addresses", auth, authController.createUserAddress);
router.put("/addresses/:addressId", auth, authController.updateUserAddress);
router.patch(
  "/addresses/:addressId/default",
  auth,
  authController.setDefaultUserAddress,
);
router.delete("/addresses/:addressId", auth, authController.deleteUserAddress);
router.get("/admin/settings", auth, authController.getSettings);

// Admin only routes
router.put("/admin/settings", auth, authController.updateSettings);
router.post(
  "/admin/settings/logo-upload",
  auth,
  upload.single("logo"),
  handleMulterError,
  authController.uploadWebsiteLogo,
);
router.post(
  "/admin/settings/header-icon-upload",
  auth,
  upload.single("icon"),
  handleMulterError,
  authController.uploadWebsiteHeaderIcon,
);
router.get(
  "/admin/settings/sitemap.xml",
  auth,
  authController.generateSitemapXml,
);
router.get(
  "/admin/marketplace-control",
  auth,
  authController.getMarketplaceControlOverview,
);
router.put(
  "/admin/marketplace-control",
  auth,
  authController.updateMarketplaceControl,
);
router.post("/admin/create-admin", auth, authController.createAdminUser);
router.get("/admin/all-users", auth, authController.getAllUsers);
router.patch("/admin/users/:userId", auth, authController.updateUserByAdmin);
router.get("/admin/system-stats", auth, authController.getSystemStats);
router.get(
  "/admin/customer-risk",
  auth,
  authController.getCustomerRiskProfiles,
);
router.get(
  "/admin/customers/:userId/profile",
  auth,
  authController.getCustomerProfileByAdmin,
);
router.patch(
  "/admin/customer-risk/:userId/blacklist",
  auth,
  authController.updateCustomerBlacklist,
);
router.get(
  "/admin/payment-methods",
  auth,
  paymentController.getAllPaymentMethods,
);
router.post("/admin/payment-methods", auth, paymentController.addPaymentMethod);
router.put(
  "/admin/payment-methods/:id",
  auth,
  paymentController.updatePaymentMethod,
);
router.delete(
  "/admin/payment-methods/:id",
  auth,
  paymentController.deletePaymentMethod,
);

module.exports = router;
