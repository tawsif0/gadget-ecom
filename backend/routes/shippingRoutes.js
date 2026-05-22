const express = require("express");
const auth = require("../middlewares/auth");
const {
  estimateShipping,
  getAdminShippingZones,
  createAdminShippingZone,
  updateAdminShippingZone,
  deleteAdminShippingZone,
} = require("../controllers/shippingController");

const router = express.Router();

// Public
router.post("/estimate", estimateShipping);

// Admin
router.get("/admin/zones", auth, getAdminShippingZones);
router.post("/admin/zones", auth, createAdminShippingZone);
router.put("/admin/zones/:id", auth, updateAdminShippingZone);
router.delete("/admin/zones/:id", auth, deleteAdminShippingZone);

module.exports = router;
