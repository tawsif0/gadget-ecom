const SubscriptionPlan = require("../models/SubscriptionPlan");
const VendorSubscription = require("../models/VendorSubscription");
const ProductSubscription = require("../models/ProductSubscription");
const { isAdmin, getVendorForUser } = require("../utils/marketplaceAccess");
const { getVendorSubscriptionLimits } = require("../utils/subscriptionUtils");
const { processRecurringRenewals } = require("../utils/recurringSubscriptionUtils");
const { attachImageDataToProducts } = require("../utils/imageUtils");

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getPlanDurationMonths = (billingCycle) => {
  if (billingCycle === "yearly") return 12;
  if (billingCycle === "quarterly") return 3;
  return 1;
};

const ensureAdmin = (req, res) => {
  if (isAdmin(req.user)) return true;

  res.status(403).json({
    success: false,
    message: "Admin access required",
  });
  return false;
};

const ensureVendorSettingsAccess = (access, res) => {
  if (!access?.vendor) {
    res.status(404).json({
      success: false,
      message: "Vendor profile not found",
    });
    return false;
  }

  if (access.source === "staff") {
    const canManageSettings = Boolean(access.staffMember?.permissions?.manageSettings);
    if (!canManageSettings) {
      res.status(403).json({
        success: false,
        message: "Staff permission denied for subscription settings",
      });
      return false;
    }
  }

  return true;
};

exports.getPublicPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("Get public plans error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching plans",
    });
  }
};

exports.getAdminPlans = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const plans = await SubscriptionPlan.find().sort({ sortOrder: 1, createdAt: -1 });

    res.json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("Get admin plans error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching plans",
    });
  }
};

exports.createPlan = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const {
      name,
      description = "",
      billingCycle = "monthly",
      price = 0,
      productLimit = 0,
      uploadLimitPerMonth = 0,
      featuredProductAccess = false,
      commissionType = "inherit",
      commissionValue = 0,
      isActive = true,
      sortOrder = 0,
    } = req.body || {};

    if (!String(name || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Plan name is required",
      });
    }

    const plan = await SubscriptionPlan.create({
      name: String(name).trim(),
      description: String(description || "").trim(),
      billingCycle,
      price: Math.max(0, toNumber(price, 0)),
      productLimit: Math.max(0, Math.floor(toNumber(productLimit, 0))),
      uploadLimitPerMonth: Math.max(0, Math.floor(toNumber(uploadLimitPerMonth, 0))),
      featuredProductAccess: Boolean(featuredProductAccess),
      commissionType,
      commissionValue: Math.max(0, toNumber(commissionValue, 0)),
      isActive: Boolean(isActive),
      sortOrder: Number.parseInt(sortOrder, 10) || 0,
    });

    res.status(201).json({
      success: true,
      message: "Subscription plan created",
      plan,
    });
  } catch (error) {
    console.error("Create plan error:", error);
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Plan name already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while creating plan",
    });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const updates = { ...req.body };

    if (updates.name !== undefined) updates.name = String(updates.name || "").trim();
    if (updates.description !== undefined) {
      updates.description = String(updates.description || "").trim();
    }
    if (updates.price !== undefined) updates.price = Math.max(0, toNumber(updates.price, 0));
    if (updates.productLimit !== undefined) {
      updates.productLimit = Math.max(0, Math.floor(toNumber(updates.productLimit, 0)));
    }
    if (updates.uploadLimitPerMonth !== undefined) {
      updates.uploadLimitPerMonth = Math.max(
        0,
        Math.floor(toNumber(updates.uploadLimitPerMonth, 0)),
      );
    }
    if (updates.commissionValue !== undefined) {
      updates.commissionValue = Math.max(0, toNumber(updates.commissionValue, 0));
    }
    if (updates.sortOrder !== undefined) {
      updates.sortOrder = Number.parseInt(updates.sortOrder, 10) || 0;
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    res.json({
      success: true,
      message: "Subscription plan updated",
      plan,
    });
  } catch (error) {
    console.error("Update plan error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating plan",
    });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const plan = await SubscriptionPlan.findByIdAndDelete(req.params.id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    await VendorSubscription.updateMany(
      {
        plan: plan._id,
        status: "active",
      },
      {
        $set: { status: "cancelled" },
      },
    );

    res.json({
      success: true,
      message: "Subscription plan deleted",
    });
  } catch (error) {
    console.error("Delete plan error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting plan",
    });
  }
};

exports.subscribeToPlan = async (req, res) => {
  try {
    const access = await getVendorForUser(req.user, { approvedOnly: true, allowStaff: true });
    if (!ensureVendorSettingsAccess(access, res)) return;

    const { planId, durationCount = 1, notes = "" } = req.body || {};

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Plan ID is required",
      });
    }

    const plan = await SubscriptionPlan.findById(planId).lean();
    if (!plan || !plan.isActive) {
      return res.status(404).json({
        success: false,
        message: "Active plan not found",
      });
    }

    const multiplier = Math.max(1, Number.parseInt(durationCount, 10) || 1);
    const cycleMonths = getPlanDurationMonths(plan.billingCycle);
    const totalMonths = cycleMonths * multiplier;

    const startsAt = new Date();
    const expiresAt = new Date(startsAt);
    expiresAt.setMonth(expiresAt.getMonth() + totalMonths);

    await VendorSubscription.updateMany(
      {
        vendor: access.vendor._id,
        status: "active",
      },
      {
        $set: { status: "cancelled" },
      },
    );

    const subscription = await VendorSubscription.create({
      vendor: access.vendor._id,
      plan: plan._id,
      status: "active",
      startsAt,
      expiresAt,
      maxProducts: Number(plan.productLimit || 0),
      maxUploadsPerMonth: Number(plan.uploadLimitPerMonth || 0),
      featuredProductAccess: Boolean(plan.featuredProductAccess),
      commissionType: plan.commissionType || "inherit",
      commissionValue: Number(plan.commissionValue || 0),
      monthlyUploadCount: 0,
      monthlyUploadPeriod: new Date().toISOString().slice(0, 7),
      createdBy: req.user.id || req.user._id,
      notes: String(notes || "").trim(),
    });

    const populated = await VendorSubscription.findById(subscription._id)
      .populate("plan")
      .populate("vendor", "storeName slug");

    res.status(201).json({
      success: true,
      message: "Subscription activated successfully",
      subscription: populated,
    });
  } catch (error) {
    console.error("Subscribe to plan error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while activating subscription",
    });
  }
};

exports.getMySubscription = async (req, res) => {
  try {
    const access = await getVendorForUser(req.user, { approvedOnly: false, allowStaff: true });
    if (!access?.vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    const current = await VendorSubscription.findOne({
      vendor: access.vendor._id,
      status: "active",
      expiresAt: { $gte: new Date() },
    })
      .sort({ expiresAt: -1, createdAt: -1 })
      .populate("plan");

    const history = await VendorSubscription.find({ vendor: access.vendor._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("plan");

    const limits = await getVendorSubscriptionLimits(access.vendor._id);

    res.json({
      success: true,
      current,
      history,
      limits,
    });
  } catch (error) {
    console.error("Get my subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching subscription",
    });
  }
};

exports.getAdminSubscriptions = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const subscriptions = await VendorSubscription.find(query)
      .populate("vendor", "storeName slug status")
      .populate("plan")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error("Get admin subscriptions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching subscriptions",
    });
  }
};

exports.updateSubscriptionStatus = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { status } = req.body || {};
    if (!["active", "expired", "cancelled", "pending"].includes(String(status || ""))) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription status",
      });
    }

    const subscription = await VendorSubscription.findById(req.params.id)
      .populate("plan")
      .populate("vendor", "storeName slug status");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    subscription.status = status;
    await subscription.save();

    res.json({
      success: true,
      message: "Subscription status updated",
      subscription,
    });
  } catch (error) {
    console.error("Update subscription status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating subscription",
    });
  }
};

const RECURRING_STATUSES = ["active", "paused", "cancelled", "completed", "expired"];

const normalizeRecurringStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return RECURRING_STATUSES.includes(normalized) ? normalized : "";
};

const attachSubscriptionProductImages = async (subscriptions = []) => {
  const products = subscriptions
    .map((entry) => entry?.product)
    .filter((product) => product && Array.isArray(product.images));

  if (products.length) {
    await attachImageDataToProducts(products);
  }
};

exports.getMyRecurringSubscriptions = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const email = String(req.user.email || "").trim().toLowerCase();
    const status = normalizeRecurringStatus(req.query?.status);

    const query = {
      $or: [{ user: userId }],
    };

    if (email) {
      query.$or.push({ guestEmail: email });
    }

    if (status) {
      query.status = status;
    }

    const subscriptions = await ProductSubscription.find(query)
      .populate("product", "title images price priceType marketplaceType")
      .populate("vendor", "storeName slug logo status")
      .populate("sourceOrder", "orderNumber createdAt total")
      .sort({ createdAt: -1 })
      .lean();

    await attachSubscriptionProductImages(subscriptions);

    res.json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error("Get my recurring subscriptions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching recurring subscriptions",
    });
  }
};

exports.getVendorRecurringSubscriptions = async (req, res) => {
  try {
    const access = await getVendorForUser(req.user, {
      approvedOnly: false,
      allowStaff: true,
    });

    if (!access?.vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor profile not found",
      });
    }

    if (access.source === "staff") {
      const canView = Boolean(access.staffMember?.permissions?.manageOrders);
      if (!canView) {
        return res.status(403).json({
          success: false,
          message: "Staff permission denied for recurring subscriptions",
        });
      }
    }

    const status = normalizeRecurringStatus(req.query?.status);
    const query = { vendor: access.vendor._id };
    if (status) {
      query.status = status;
    }

    const subscriptions = await ProductSubscription.find(query)
      .populate("product", "title images price priceType marketplaceType")
      .populate("user", "name email originalPhone phone")
      .populate("sourceOrder", "orderNumber createdAt total")
      .sort({ createdAt: -1 })
      .lean();

    await attachSubscriptionProductImages(subscriptions);

    res.json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error("Get vendor recurring subscriptions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching recurring subscriptions",
    });
  }
};

exports.getAdminRecurringSubscriptions = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const status = normalizeRecurringStatus(req.query?.status);
    const query = {};
    if (status) query.status = status;
    if (req.query?.vendorId) query.vendor = req.query.vendorId;

    const subscriptions = await ProductSubscription.find(query)
      .populate("product", "title images price priceType marketplaceType")
      .populate("vendor", "storeName slug status")
      .populate("user", "name email originalPhone phone")
      .populate("sourceOrder", "orderNumber createdAt total")
      .sort({ createdAt: -1 })
      .lean();

    await attachSubscriptionProductImages(subscriptions);

    res.json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error("Get admin recurring subscriptions error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching recurring subscriptions",
    });
  }
};

exports.updateRecurringSubscriptionStatus = async (req, res) => {
  try {
    const nextStatus = normalizeRecurringStatus(req.body?.status);
    if (!nextStatus) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription status",
      });
    }

    const subscription = await ProductSubscription.findById(req.params.id)
      .populate("vendor", "_id")
      .populate("user", "_id email");

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Recurring subscription not found",
      });
    }

    const requesterIsAdmin = isAdmin(req.user);
    let isAllowed = requesterIsAdmin;

    if (!requesterIsAdmin) {
      const access = await getVendorForUser(req.user, {
        approvedOnly: false,
        allowStaff: true,
      });

      if (access?.vendor && String(access.vendor._id) === String(subscription.vendor?._id)) {
        if (access.source === "staff") {
          const canManage = Boolean(access.staffMember?.permissions?.manageOrders);
          if (canManage) {
            isAllowed = true;
          }
        } else {
          isAllowed = true;
        }
      }
    }

    if (!isAllowed) {
      const requesterId = String(req.user.id || req.user._id || "");
      const requesterEmail = String(req.user.email || "").trim().toLowerCase();
      const ownsSubscription =
        String(subscription.user?._id || subscription.user || "") === requesterId ||
        (requesterEmail && requesterEmail === String(subscription.guestEmail || "").trim().toLowerCase());

      if (!ownsSubscription) {
        return res.status(403).json({
          success: false,
          message: "Access denied for this recurring subscription",
        });
      }

      if (!["active", "paused", "cancelled"].includes(nextStatus)) {
        return res.status(403).json({
          success: false,
          message: "Only active, paused, or cancelled status is allowed",
        });
      }
    }

    if (!requesterIsAdmin && nextStatus === "completed") {
      return res.status(403).json({
        success: false,
        message: "Only admin can mark subscription as completed",
      });
    }

    subscription.status = nextStatus;

    if (["cancelled", "completed", "expired"].includes(nextStatus)) {
      subscription.nextBillingAt = null;
    } else if (nextStatus === "active" && !subscription.nextBillingAt) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      subscription.nextBillingAt = tomorrow;
    }

    await subscription.save();

    const updated = await ProductSubscription.findById(subscription._id)
      .populate("product", "title images price priceType marketplaceType")
      .populate("vendor", "storeName slug status")
      .populate("user", "name email originalPhone phone")
      .populate("sourceOrder", "orderNumber createdAt total")
      .lean();

    if (updated) {
      await attachSubscriptionProductImages([updated]);
    }

    res.json({
      success: true,
      message: "Recurring subscription status updated",
      subscription: updated,
    });
  } catch (error) {
    console.error("Update recurring subscription status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating recurring subscription status",
    });
  }
};

exports.runRecurringRenewalCycle = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const limit = Math.max(1, Math.min(Number(req.body?.limit || 100), 300));
    const summary = await processRecurringRenewals({ limit });

    res.json({
      success: true,
      message: "Recurring renewal cycle executed",
      summary,
    });
  } catch (error) {
    console.error("Run recurring renewal cycle error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while running recurring renewal cycle",
    });
  }
};
