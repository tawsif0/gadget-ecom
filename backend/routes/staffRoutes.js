const express = require("express");
const auth = require("../middlewares/auth");
const { ensureMultiVendorMode } = require("../middlewares/marketplaceMode");
const {
  getStaffPermissions,
  getVendorStaff,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
} = require("../controllers/staffController");

const router = express.Router();

router.get("/me/permissions", auth, ensureMultiVendorMode, getStaffPermissions);
router.get("/", auth, ensureMultiVendorMode, getVendorStaff);
router.post("/", auth, ensureMultiVendorMode, createStaffMember);
router.put("/:id", auth, ensureMultiVendorMode, updateStaffMember);
router.delete("/:id", auth, ensureMultiVendorMode, deleteStaffMember);

module.exports = router;
