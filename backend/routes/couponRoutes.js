// routes/couponRoutes.js
const express = require("express");
const {
  createCoupon,
  getCoupons,
  applyCoupon,
  updateCoupon,
  deleteCoupon,
} = require("../controllers/couponController.js");
const auth = require("../middlewares/auth.js");

const router = express.Router();

// Public route
router.post("/apply", applyCoupon);

// Admin routes
router.post("/", auth, createCoupon);
router.get("/", auth, getCoupons);
router.put("/:id", auth, updateCoupon);
router.delete("/:id", auth, deleteCoupon);

module.exports = router;
