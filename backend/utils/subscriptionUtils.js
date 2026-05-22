const Product = require("../models/Product");
const SubscriptionPlan = require("../models/SubscriptionPlan");
const VendorSubscription = require("../models/VendorSubscription");

const getCurrentPeriodKey = (date = new Date()) => date.toISOString().slice(0, 7);

const expireOutdatedSubscriptions = async (vendorId) => {
  const now = new Date();

  await VendorSubscription.updateMany(
    {
      vendor: vendorId,
      status: "active",
      expiresAt: { $lt: now },
    },
    {
      $set: { status: "expired" },
    },
  );
};

const syncMonthlyCounter = async (subscription) => {
  if (!subscription) return null;

  const currentPeriod = getCurrentPeriodKey();
  if (subscription.monthlyUploadPeriod !== currentPeriod) {
    subscription.monthlyUploadPeriod = currentPeriod;
    subscription.monthlyUploadCount = 0;
    await subscription.save();
  }

  return subscription;
};

const getActiveVendorSubscription = async (vendorId) => {
  if (!vendorId) return null;

  await expireOutdatedSubscriptions(vendorId);

  const subscription = await VendorSubscription.findOne({
    vendor: vendorId,
    status: "active",
    expiresAt: { $gte: new Date() },
  })
    .sort({ expiresAt: -1, createdAt: -1 })
    .populate("plan");

  if (!subscription) return null;

  return syncMonthlyCounter(subscription);
};

const getVendorSubscriptionLimits = async (vendorId) => {
  const subscription = await getActiveVendorSubscription(vendorId);

  if (!subscription) {
    const hasAnyPlan = (await SubscriptionPlan.countDocuments({ isActive: true })) > 0;

    return {
      hasAnyPlan,
      hasActiveSubscription: false,
      subscription: null,
      maxProducts: 0,
      maxUploadsPerMonth: 0,
      featuredProductAccess: false,
      commissionType: "inherit",
      commissionValue: 0,
    };
  }

  return {
    hasAnyPlan: true,
    hasActiveSubscription: true,
    subscription,
    maxProducts: Number(subscription.maxProducts || 0),
    maxUploadsPerMonth: Number(subscription.maxUploadsPerMonth || 0),
    featuredProductAccess: Boolean(subscription.featuredProductAccess),
    commissionType: subscription.commissionType || "inherit",
    commissionValue: Number(subscription.commissionValue || 0),
  };
};

const assertVendorCanUploadProducts = async (vendorId, additionalCount = 1) => {
  const amount = Math.max(1, Number.parseInt(additionalCount, 10) || 1);
  const limits = await getVendorSubscriptionLimits(vendorId);

  if (!limits.hasActiveSubscription && limits.hasAnyPlan) {
    return {
      allowed: false,
      status: 403,
      message:
        "You need an active subscription plan to upload products. Please subscribe first.",
      limits,
    };
  }

  if (!limits.hasActiveSubscription) {
    return {
      allowed: true,
      status: 200,
      message: "No active subscription plans configured. Upload is allowed.",
      limits,
    };
  }

  const currentProductCount = await Product.countDocuments({
    vendor: vendorId,
  });

  if (limits.maxProducts > 0 && currentProductCount + amount > limits.maxProducts) {
    const available = Math.max(0, limits.maxProducts - currentProductCount);
    return {
      allowed: false,
      status: 400,
      message: `Plan product limit reached. Remaining slots: ${available}`,
      limits,
      currentProductCount,
      available,
    };
  }

  const monthlyUploadCount = Number(limits.subscription.monthlyUploadCount || 0);
  if (
    limits.maxUploadsPerMonth > 0 &&
    monthlyUploadCount + amount > limits.maxUploadsPerMonth
  ) {
    const available = Math.max(0, limits.maxUploadsPerMonth - monthlyUploadCount);
    return {
      allowed: false,
      status: 400,
      message: `Monthly upload limit reached. Remaining uploads this month: ${available}`,
      limits,
      monthlyUploadCount,
      available,
    };
  }

  return {
    allowed: true,
    status: 200,
    message: "Upload allowed",
    limits,
    currentProductCount,
    monthlyUploadCount,
  };
};

const incrementVendorUploadCount = async (vendorSubscription, count = 1) => {
  if (!vendorSubscription) return;

  const amount = Math.max(0, Number.parseInt(count, 10) || 0);
  if (amount <= 0) return;

  await syncMonthlyCounter(vendorSubscription);

  vendorSubscription.monthlyUploadCount =
    Number(vendorSubscription.monthlyUploadCount || 0) + amount;

  await vendorSubscription.save();
};

module.exports = {
  getCurrentPeriodKey,
  getActiveVendorSubscription,
  getVendorSubscriptionLimits,
  assertVendorCanUploadProducts,
  incrementVendorUploadCount,
};
