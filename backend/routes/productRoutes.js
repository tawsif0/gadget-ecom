const express = require("express");
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getActiveProducts,
  getHomeCatalog,
  getProductsByType,
  toggleProductActive,
  duplicateProduct,
  updateProductApprovalStatus,
  searchProducts,
  getSearchSuggestions,
} = require("../controllers/productController.js");
const {
  getProductReviews,
  getMyProductReview,
  createOrUpdateProductReview,
  deleteMyProductReview,
  getAdminProductReviews,
  updateProductReviewStatus,
} = require("../controllers/productEngagementController.js");
const auth = require("../middlewares/auth.js");
const { upload, handleMulterError } = require("../middlewares/upload.js");
const responseCache = require("../middlewares/responseCache");

const router = express.Router();

// Public routes - SPECIFIC ROUTES FIRST
router.get("/public/search", responseCache(15000), searchProducts);
router.get("/public/suggestions", responseCache(15000), getSearchSuggestions);
router.get("/public/home-catalog", responseCache(120000), getHomeCatalog);
router.get("/public/:id/reviews", getProductReviews);
router.post("/public/:id/reviews", createOrUpdateProductReview);
router.get("/public", responseCache(30000), getActiveProducts);
router.get("/public/type/:productType", responseCache(30000), getProductsByType);
router.get("/public/:id", responseCache(30000), getProduct); // Parameterized routes LAST

// Protected routes
router.get("/admin/reviews", auth, getAdminProductReviews);
router.patch("/admin/reviews/:id/status", auth, updateProductReviewStatus);
router.get("/:id/reviews/me", auth, getMyProductReview);
router.post("/:id/reviews", auth, createOrUpdateProductReview);
router.delete("/:id/reviews/me", auth, deleteMyProductReview);
router.post(
  "/",
  auth,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "videos", maxCount: 3 },
    { name: "video", maxCount: 1 },
  ]),
  handleMulterError,
  createProduct
);
router.get("/", auth, getProducts);
router.get("/:id", auth, getProduct);
router.put(
  "/:id",
  auth,
  upload.fields([
    { name: "images", maxCount: 5 },
    { name: "videos", maxCount: 3 },
    { name: "video", maxCount: 1 },
  ]),
  handleMulterError,
  updateProduct
);
router.delete("/:id", auth, deleteProduct);
router.patch("/:id/toggle-active", auth, toggleProductActive);
router.post("/:id/duplicate", auth, duplicateProduct);
router.patch("/:id/approval-status", auth, updateProductApprovalStatus);

module.exports = router;
