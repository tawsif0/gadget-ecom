const express = require("express");
const auth = require("../middlewares/auth");
const { ensureMultiVendorMode } = require("../middlewares/marketplaceMode");
const {
  getMyVerification,
  submitMyVerification,
  getAdminVerifications,
  reviewVerification,
} = require("../controllers/verificationController");

const router = express.Router();

router.get("/me", auth, ensureMultiVendorMode, getMyVerification);
router.post("/me", auth, ensureMultiVendorMode, submitMyVerification);

router.get("/admin", auth, ensureMultiVendorMode, getAdminVerifications);
router.patch("/admin/:id/status", auth, ensureMultiVendorMode, reviewVerification);

module.exports = router;
