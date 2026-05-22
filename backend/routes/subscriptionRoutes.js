const express = require("express");
const auth = require("../middlewares/auth");
const { ensureMultiVendorMode } = require("../middlewares/marketplaceMode");
const {
  getPublicPlans,
  getAdminPlans,
  createPlan,
  updatePlan,
  deletePlan,
  subscribeToPlan,
  getMySubscription,
  getAdminSubscriptions,
  updateSubscriptionStatus,
  getMyRecurringSubscriptions,
  getVendorRecurringSubscriptions,
  getAdminRecurringSubscriptions,
  updateRecurringSubscriptionStatus,
  runRecurringRenewalCycle,
} = require("../controllers/subscriptionController");

const router = express.Router();

router.get("/public/plans", ensureMultiVendorMode, getPublicPlans);

router.get("/plans", auth, ensureMultiVendorMode, getAdminPlans);
router.post("/plans", auth, ensureMultiVendorMode, createPlan);
router.put("/plans/:id", auth, ensureMultiVendorMode, updatePlan);
router.delete("/plans/:id", auth, ensureMultiVendorMode, deletePlan);

router.post("/me/subscribe", auth, ensureMultiVendorMode, subscribeToPlan);
router.get("/me", auth, ensureMultiVendorMode, getMySubscription);

router.get("/admin/subscriptions", auth, ensureMultiVendorMode, getAdminSubscriptions);
router.patch(
  "/admin/subscriptions/:id/status",
  auth,
  ensureMultiVendorMode,
  updateSubscriptionStatus,
);

router.get("/recurring/me", auth, getMyRecurringSubscriptions);
router.get("/recurring/vendor", auth, getVendorRecurringSubscriptions);
router.get("/recurring/admin", auth, getAdminRecurringSubscriptions);
router.patch("/recurring/:id/status", auth, updateRecurringSubscriptionStatus);
router.post("/recurring/admin/process", auth, runRecurringRenewalCycle);

module.exports = router;
