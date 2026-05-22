// controllers/orderController.js
const mongoose = require("mongoose");
const Order = require("../models/Order.js");
const Cart = require("../models/Cart.js");
const Product = require("../models/Product.js");
const Coupon = require("../models/Coupon.js");
const axios = require("axios");
const LandingPage = require("../models/LandingPage");
const User = require("../models/User");
const PaymentMethod = require("../models/PaymentMethod");
const {
  resolvePrimaryCourierConfig,
  resolveCourierConfigByKey,
} = require("../services/courierService");
const {
  sendOrderStatusEmail,
  sendOrderPlacedEmail,
} = require("../utils/emailTemplates");
const { attachImageDataToProducts } = require("../utils/imageUtils");
const {
  normalizeCouponCode,
  validateCouponForSubtotal,
  incrementCouponUsage,
  roundMoney,
  toNumber,
} = require("../utils/couponUtils");
const {
  createRecurringSubscriptionsFromOrder,
} = require("../utils/recurringSubscriptionUtils");
const {
  buildGatewayRedirectUrl,
  initiateGatewayPayment,
  verifyGatewayPayment,
} = require("../utils/paymentGatewayUtils");
const {
  calculateCustomerMetrics,
  getRiskLevel,
  shouldAutoBlacklistByCancellation,
} = require("../utils/customerRiskUtils");
const {
  pushNotificationsToOperationalUsers,
  pushNotificationsToUsers,
} = require("../utils/notificationUtils");
const {
  buildSelectedVariantSummary,
  normalizeSelectedVariantsForProduct,
  normalizeSelectedVariantsPayload,
  resolveProductPricingForSelection,
} = require("../utils/productVariants");
const {
  getGlobalShippingZones,
  getPrimaryAdminShippingSettings,
  resolveShippingQuote,
} = require("../services/shippingService");

// Generate order number
const generateOrderNumber = () => {
  const date = new Date();
  const timestamp = date.getTime();
  const random = Math.floor(Math.random() * 10000);
  return `ORD-${timestamp}-${random}`;
};

const safeString = (value) => String(value ?? "").trim();

const LEGACY_GATEWAY_CHANNELS = new Set([
  "stripe",
  "paypal",
  "sslcommerz",
  "bkash",
  "nagad",
]);
const CHECKOUT_GATEWAY_CHANNELS = new Set(["sslcommerz", "bkash", "nagad"]);
const SUPPORTED_PAYMENT_METHOD_CHANNELS = new Set([
  "manual",
  "cod",
  "sslcommerz",
  "bkash",
  "nagad",
]);

const ORDER_STATUS_FLOW = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

const ORDER_STATUS_TRANSITIONS = {
  pending: new Set(["confirmed", "cancelled"]),
  confirmed: new Set([
    "processing",
    "shipped",
    "delivered",
    "returned",
    "cancelled",
  ]),
  processing: new Set(["shipped", "delivered", "returned", "cancelled"]),
  shipped: new Set(["delivered", "returned"]),
  delivered: new Set(["returned"]),
  cancelled: new Set([]),
  returned: new Set([]),
};

const COURIER_STATUS_TO_ORDER_STATUS = {
  created: "confirmed",
  confirmed: "confirmed",
  pending: "pending",
  in_review: "confirmed",
  assigned: "processing",
  processing: "processing",
  picked: "processing",
  picked_up: "processing",
  out_for_pickup: "processing",
  in_transit: "shipped",
  shipped: "shipped",
  on_the_way: "shipped",
  dispatched: "shipped",
  ready_for_delivery: "shipped",
  out_for_delivery: "shipped",
  delivered: "delivered",
  returned: "returned",
  cancelled: "cancelled",
  failed: "cancelled",
};

const normalizeOrderStatus = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const canTransitionOrderStatus = (fromStatus, toStatus) => {
  const from = normalizeOrderStatus(fromStatus);
  const to = normalizeOrderStatus(toStatus);

  if (!from || !to) return false;
  if (from === to) return true;

  const allowed = ORDER_STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.has(to);
};

const getOrderEstimatedDeliveryWindow = (order = {}) => {
  const shippingMeta =
    order?.shippingMeta && typeof order.shippingMeta === "object"
      ? order.shippingMeta
      : {};
  const currentMinDays = Math.max(
    0,
    parseInt(shippingMeta.estimatedMinDays, 10) || 0,
  );
  const currentMaxDays = Math.max(
    currentMinDays,
    parseInt(shippingMeta.estimatedMaxDays, 10) || currentMinDays,
  );

  if (currentMaxDays > 0) {
    return {
      estimatedMinDays: currentMinDays,
      estimatedMaxDays: currentMaxDays,
    };
  }

  let estimatedMinDays = 0;
  let estimatedMaxDays = 0;

  (Array.isArray(order?.items) ? order.items : []).forEach((item) => {
    const product =
      item?.product && typeof item.product === "object" ? item.product : {};
    const itemMinDays = Math.max(0, parseInt(product.deliveryMinDays, 10) || 0);
    const itemMaxDays = Math.max(
      itemMinDays,
      parseInt(product.deliveryMaxDays, 10) || itemMinDays,
    );

    if (!itemMaxDays) return;

    estimatedMinDays = Math.max(estimatedMinDays, itemMinDays);
    estimatedMaxDays = Math.max(estimatedMaxDays, itemMaxDays);
  });

  return {
    estimatedMinDays,
    estimatedMaxDays,
  };
};

const buildOrderStatusTimelineEntry = ({
  status,
  note = "",
  user = null,
  changedAt = new Date(),
} = {}) => ({
  status: normalizeOrderStatus(status),
  note: String(note || "")
    .trim()
    .slice(0, 1000),
  changedAt,
  changedBy: user?._id || user?.id || null,
  changedByRole: String(user?.userType || user?.role || "system")
    .trim()
    .toLowerCase(),
});

const appendOrderStatusTimelineEntry = ({
  order,
  status,
  note = "",
  user = null,
  changedAt = new Date(),
} = {}) => {
  if (!order) return;

  if (!Array.isArray(order.statusTimeline)) {
    order.statusTimeline = [];
  }

  order.statusTimeline.push(
    buildOrderStatusTimelineEntry({
      status,
      note,
      user,
      changedAt,
    }),
  );
};

const getOrderStatusTimeline = (order = {}) => {
  const existing = Array.isArray(order?.statusTimeline)
    ? order.statusTimeline.filter((entry) => String(entry?.status || "").trim())
    : [];

  if (existing.length > 0) {
    return existing;
  }

  const createdAt = order?.createdAt ? new Date(order.createdAt) : new Date();
  const currentStatus =
    normalizeOrderStatus(order?.orderStatus || "pending") || "pending";
  const timeline = [
    {
      status: "pending",
      note: "Order created",
      changedAt: createdAt,
      changedBy: null,
      changedByRole: "system",
    },
  ];

  if (currentStatus !== "pending") {
    timeline.push({
      status: currentStatus,
      note: `Current status: ${currentStatus}`,
      changedAt: createdAt,
      changedBy: null,
      changedByRole: "system",
    });
  }

  return timeline;
};

const isAdminUser = (user) =>
  String(user?.role || user?.userType || "")
    .trim()
    .toLowerCase() === "admin";

const toStartCase = (value) =>
  String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const uniqueNotificationUserIds = (values = []) => [
  ...new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
];

const getOrderCustomerNotificationUserIds = (order = {}) =>
  uniqueNotificationUserIds([order?.user?._id || order?.user || ""]);

const formatOrderMoneyLabel = (value) =>
  `Tk ${roundMoney(value || 0).toFixed(2)}`;

const getOrderCustomerName = (order = {}) => {
  const shipping = order?.shippingAddress || {};
  const fullName = `${String(shipping.firstName || "").trim()} ${String(
    shipping.lastName || "",
  ).trim()}`.trim();
  return fullName || String(order?.user?.name || "").trim() || "Customer";
};

const buildOrderNotificationMeta = (
  order = {},
  targetTab = "dashboard",
  extra = {},
) => ({
  targetTab,
  orderId: String(order?._id || "").trim(),
  orderNumber: String(order?.orderNumber || "").trim(),
  ...extra,
});

const notifyAdminsAboutOrderCreated = async (order = {}) => {
  const isManualReviewOrder =
    isManualPaymentOrder(order) && !isCashOnDeliveryOrder(order);

  return pushNotificationsToOperationalUsers({
    type: "admin_order_created",
    title: isManualReviewOrder
      ? "Manual payment order received"
      : "New order received",
    message: `${String(order?.orderNumber || "").trim()} from ${getOrderCustomerName(
      order,
    )} for ${formatOrderMoneyLabel(order?.total || 0)}${
      isManualReviewOrder
        ? ". Admin payment verification is still pending."
        : "."
    }`,
    link: "/dashboard",
    meta: buildOrderNotificationMeta(order, "order-list", {
      paymentMethod: String(order?.paymentMethod || "").trim(),
    }),
  });
};

const notifyCustomerAboutOrderCreated = async (order = {}) => {
  const customerIds = getOrderCustomerNotificationUserIds(order);
  if (!customerIds.length) return [];

  return pushNotificationsToUsers(customerIds, {
    type: "order_created",
    title: "Order placed successfully",
    message: `${String(order?.orderNumber || "").trim()} has been placed for ${formatOrderMoneyLabel(
      order?.total || 0,
    )}.`,
    link: "/dashboard",
    meta: buildOrderNotificationMeta(order, "my-orders"),
  });
};

const notifyOrderStatusUpdated = async (
  order = {},
  oldStatus = "",
  newStatus = "",
  { notifyCustomers = true } = {},
) => {
  const nextStatus = normalizeOrderStatus(newStatus);
  if (!nextStatus) return [];

  const tasks = [];
  const title = `Order ${toStartCase(nextStatus)}`;
  const message = `${String(order?.orderNumber || "").trim()} moved from ${toStartCase(
    oldStatus || "pending",
  )} to ${toStartCase(nextStatus)}.`;

  if (notifyCustomers) {
    const customerIds = getOrderCustomerNotificationUserIds(order);
    if (customerIds.length) {
      tasks.push(
        pushNotificationsToUsers(customerIds, {
          type: "order_status_updated",
          title,
          message,
          link: "/dashboard",
          meta: buildOrderNotificationMeta(order, "my-orders", {
            oldStatus: normalizeOrderStatus(oldStatus),
            status: nextStatus,
          }),
        }),
      );
    }
  }

  return Promise.all(tasks);
};

const notifyCustomerAboutPaymentStatusUpdated = async (
  order = {},
  paymentStatus = "",
) => {
  const customerIds = getOrderCustomerNotificationUserIds(order);
  if (!customerIds.length) return [];

  const normalizedPaymentStatus = String(paymentStatus || "")
    .trim()
    .toLowerCase();

  return pushNotificationsToUsers(customerIds, {
    type: "payment_status_updated",
    title: `Payment ${toStartCase(normalizedPaymentStatus || "updated")}`,
    message: `${String(order?.orderNumber || "").trim()} payment is now ${toStartCase(
      normalizedPaymentStatus || "updated",
    )}.`,
    link: "/dashboard",
    meta: buildOrderNotificationMeta(order, "my-orders", {
      paymentStatus: normalizedPaymentStatus,
    }),
  });
};

const notifyAdminsAboutCancellationRequest = async (
  order = {},
  source = "customer",
  action = "requested",
) =>
  pushNotificationsToOperationalUsers({
    type:
      String(action || "")
        .trim()
        .toLowerCase() === "cancelled"
        ? "order_cancelled"
        : "order_cancellation_requested",
    title:
      String(action || "")
        .trim()
        .toLowerCase() === "cancelled"
        ? "Order cancelled"
        : "Cancellation request received",
    message:
      String(action || "")
        .trim()
        .toLowerCase() === "cancelled"
        ? `${String(order?.orderNumber || "").trim()} was cancelled from ${source}.`
        : `${String(order?.orderNumber || "").trim()} has a pending cancellation request from ${source}.`,
    link: "/dashboard",
    meta: buildOrderNotificationMeta(order, "order-list", {
      requestStatus:
        String(action || "")
          .trim()
          .toLowerCase() === "cancelled"
          ? "cancelled"
          : "pending",
      requestSource: source,
    }),
  });

const notifyCustomerAboutCancellationUpdate = async (
  order = {},
  resolution = "updated",
  note = "",
) => {
  const customerIds = getOrderCustomerNotificationUserIds(order);
  if (!customerIds.length) return [];

  const normalizedResolution = String(resolution || "")
    .trim()
    .toLowerCase();
  const title =
    normalizedResolution === "rejected"
      ? "Cancellation request rejected"
      : normalizedResolution === "approved"
        ? "Order cancelled"
        : "Cancellation updated";

  return pushNotificationsToUsers(customerIds, {
    type: "order_cancellation_updated",
    title,
    message:
      normalizedResolution === "rejected"
        ? `${String(order?.orderNumber || "").trim()} cancellation request was rejected.${note ? ` ${note}` : ""}`
        : `${String(order?.orderNumber || "").trim()} cancellation is now ${toStartCase(
            normalizedResolution || "updated",
          )}.${note ? ` ${note}` : ""}`,
    link: "/dashboard",
    meta: buildOrderNotificationMeta(order, "my-orders", {
      resolution: normalizedResolution,
    }),
  });
};

const CANCELLABLE_ORDER_STATUSES = new Set(["pending"]);
const TERMINAL_ORDER_STATUSES = new Set(["cancelled", "delivered", "returned"]);
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizeLongText = (value, maxLength = 1200) =>
  String(value || "")
    .trim()
    .slice(0, maxLength);

const getCancellationSettings = async () => {
  const admin = await User.findOne({ userType: "admin" })
    .select("adminSettings.policies")
    .lean();

  const policies = admin?.adminSettings?.policies || {};
  const rawWindow = Number(policies?.cancellationWindowDays);

  return {
    windowDays: Number.isFinite(rawWindow)
      ? Math.max(0, Math.round(rawWindow))
      : 1,
    policyHtml: normalizeLongText(policies?.cancellationPolicy, 10000),
  };
};

const getCancellationExpiryDate = (createdAt, windowDays) => {
  if (!createdAt || windowDays <= 0) return null;
  return new Date(new Date(createdAt).getTime() + windowDays * DAY_IN_MS);
};

const getPrimaryAdminCourierSettings = async () => {
  const admin = await User.findOne({ userType: "admin" })
    .select("adminSettings.courier adminSettings.couriers")
    .lean();

  return resolvePrimaryCourierConfig(admin?.adminSettings || {});
};

const getCourierSettingsByKey = async (courierKey = "") => {
  const admin = await User.findOne({ userType: "admin" })
    .select("adminSettings.courier adminSettings.couriers")
    .lean();

  return resolveCourierConfigByKey(admin?.adminSettings || {}, courierKey);
};

const buildCourierHeaders = (courierConfig = {}) => {
  const headers = {};

  if (courierConfig.apiToken) {
    headers.Authorization = `Bearer ${courierConfig.apiToken}`;
  }

  if (courierConfig.apiKey) {
    headers["x-api-key"] = courierConfig.apiKey;
    headers["api-key"] = courierConfig.apiKey;
  }

  if (courierConfig.apiSecret) {
    headers["x-api-secret"] = courierConfig.apiSecret;
    headers["secret-key"] = courierConfig.apiSecret;
  }

  return headers;
};

const resolveCourierApiErrorMessage = (error) => {
  const responseData = error?.response?.data;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData.trim();
  }

  if (responseData && typeof responseData === "object") {
    const message = String(
      responseData?.message ||
        responseData?.error ||
        responseData?.detail ||
        "",
    ).trim();

    if (message) {
      return message;
    }
  }

  return String(error?.message || "").trim() || "Courier API request failed";
};

const joinBaseUrlWithPath = (baseUrl, path) => {
  const base = String(baseUrl || "")
    .trim()
    .replace(/\/+$/, "");
  const suffix = String(path || "")
    .trim()
    .replace(/^\/+/, "");
  if (!base) return "";
  if (!suffix) return base;
  return `${base}/${suffix}`;
};

const resolveResponseCandidates = (payload = null) => {
  const candidates = [payload];
  if (payload && typeof payload === "object") {
    candidates.push(
      payload.data,
      payload.result,
      payload.payload,
      payload.response,
      payload.consignment,
      payload.parcel,
      payload.tracking,
      payload.order,
    );

    [payload.data, payload.result, payload.payload, payload.response].forEach(
      (entry) => {
        if (entry && typeof entry === "object") {
          candidates.push(
            entry.consignment,
            entry.parcel,
            entry.tracking,
            entry.order,
          );
        }
      },
    );
  }

  return candidates.filter((entry) => entry && typeof entry === "object");
};

const pickResponseValue = (payload, keys = []) => {
  const candidates = resolveResponseCandidates(payload);
  const normalizedKeys = keys.map((key) => String(key || "").trim());

  for (const candidate of candidates) {
    for (const key of normalizedKeys) {
      if (!key) continue;
      if (
        candidate[key] !== undefined &&
        candidate[key] !== null &&
        candidate[key] !== ""
      ) {
        return candidate[key];
      }
    }
  }

  return null;
};

const normalizeCourierMeta = (courierMeta = {}) => ({
  providerKey: String(courierMeta?.providerKey || "").trim(),
  providerName: String(courierMeta?.providerName || "").trim(),
  consignmentId: String(courierMeta?.consignmentId || "").trim(),
  trackingNumber: String(courierMeta?.trackingNumber || "").trim(),
  trackingUrl: String(courierMeta?.trackingUrl || "").trim(),
  labelUrl: String(courierMeta?.labelUrl || "").trim(),
  status: String(courierMeta?.status || "")
    .trim()
    .toLowerCase(),
  note: String(courierMeta?.note || "").trim(),
  syncedFromApi: Boolean(courierMeta?.syncedFromApi),
  generatedBy: String(courierMeta?.generatedBy || "")
    .trim()
    .toLowerCase(),
  createdAt: courierMeta?.createdAt || null,
  updatedAt: courierMeta?.updatedAt || null,
  lastSyncedAt: courierMeta?.lastSyncedAt || null,
  events: Array.isArray(courierMeta?.events) ? courierMeta.events : [],
});

const getOrderCourierMeta = (order = {}) =>
  normalizeCourierMeta(order?.shippingMeta?.courier || {});

const setOrderCourierMeta = (order, courierPatch = {}) => {
  const shippingMeta =
    order?.shippingMeta && typeof order.shippingMeta === "object"
      ? order.shippingMeta
      : {};
  const existingCourier =
    shippingMeta?.courier && typeof shippingMeta.courier === "object"
      ? shippingMeta.courier
      : {};

  const merged = {
    ...existingCourier,
    ...courierPatch,
    createdAt:
      existingCourier.createdAt || courierPatch.createdAt || new Date(),
    updatedAt: new Date(),
  };

  order.shippingMeta = {
    ...shippingMeta,
    courier: merged,
  };

  return normalizeCourierMeta(merged);
};

const generateFallbackConsignmentId = (order = {}) => {
  const orderKey = String(order?.orderNumber || Date.now())
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-14)
    .toUpperCase();
  const suffix = Math.floor(100 + Math.random() * 900);
  return `CSG-${orderKey}-${suffix}`;
};

const resolveCourierCollectionDetails = (order = {}) => {
  const isCashOnDelivery = isCashOnDeliveryOrder(order);
  const orderStatus = String(order?.orderStatus || "pending")
    .trim()
    .toLowerCase();
  const normalizedPaymentStatus = String(order?.paymentStatus || "pending")
    .trim()
    .toLowerCase();

  const effectivePaymentStatus = isCashOnDelivery
    ? orderStatus === "delivered"
      ? "completed"
      : orderStatus === "cancelled"
        ? "failed"
        : "pending"
    : ["pending", "completed", "failed"].includes(normalizedPaymentStatus)
      ? normalizedPaymentStatus
      : "pending";

  const productAmount = Math.max(
    roundMoney((order?.total || 0) - (order?.shippingFee || 0)),
    0,
  );
  const deliveryCharge = roundMoney(order?.shippingFee || 0);
  const collectDeliveryChargeOnly =
    effectivePaymentStatus === "completed" && !isCashOnDelivery;

  return {
    isCashOnDelivery,
    paymentStatus: effectivePaymentStatus,
    productAmount,
    deliveryCharge,
    amountToCollect: collectDeliveryChargeOnly
      ? deliveryCharge
      : roundMoney(order?.total || 0),
    collectDeliveryChargeOnly,
  };
};

const buildCourierConsignmentPayload = (order = {}, courierConfig = {}) => {
  const shipping = order?.shippingAddress || {};
  const items = Array.isArray(order?.items) ? order.items : [];
  const collection = resolveCourierCollectionDetails(order);
  const customerName = `${String(shipping?.firstName || "").trim()} ${String(
    shipping?.lastName || "",
  ).trim()}`.trim();
  const providerName = String(
    courierConfig?.courierKey || courierConfig?.providerName || "",
  )
    .trim()
    .toLowerCase();
  const fullShippingAddress = [
    shipping?.address,
    shipping?.subCity,
    shipping?.city,
    shipping?.district,
    shipping?.postalCode,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

  if (providerName === "steadfast") {
    const invoice = String(
      order?.orderNumber || generateFallbackConsignmentId(order),
    ).trim();
    const itemDescription = items
      .map((item) =>
        String(item?.product?.title || item?.title || "Product").trim(),
      )
      .filter(Boolean)
      .join(", ");

    return {
      invoice,
      recipient_name: customerName || "Customer",
      recipient_phone: String(shipping?.phone || "").trim(),
      recipient_address:
        fullShippingAddress || String(shipping?.address || "").trim(),
      district: String(shipping?.district || shipping?.subCity || "").trim(),
      delivery_type: 0,
      recipient_email: String(shipping?.email || "").trim(),
      alternative_phone: String(
        shipping?.alternativePhone || shipping?.altPhone || "",
      ).trim(),
      cod_amount: collection.amountToCollect,
      note: String(order?.adminNotes || "").trim(),
      item_description: itemDescription,
    };
  }

  return {
    orderNumber: order?.orderNumber,
    amountToCollect: collection.amountToCollect,
    deliveryCharge: collection.deliveryCharge,
    productAmount: collection.productAmount,
    collectDeliveryChargeOnly: collection.collectDeliveryChargeOnly,
    paymentStatus: collection.paymentStatus,
    customerName,
    customerPhone: String(shipping?.phone || "").trim(),
    customerAddress: String(shipping?.address || "").trim(),
    city: String(shipping?.city || "").trim(),
    district: String(shipping?.district || "").trim(),
    postalCode: String(shipping?.postalCode || "").trim(),
    country: String(shipping?.country || "Bangladesh").trim(),
    note: String(order?.adminNotes || "").trim(),
    items: items.map((item) => ({
      title: String(item?.product?.title || item?.title || "Product").trim(),
      quantity: Number(item?.quantity || 0),
      unitPrice: roundMoney(item?.price || 0),
      subtotal: roundMoney(
        Number(item?.quantity || 0) * Number(item?.price || 0),
      ),
      sku: String(item?.sku || "").trim(),
      variation: String(item?.variationLabel || "").trim(),
    })),
  };
};

const parseConsignmentResponse = (payload = {}) => {
  const consignmentId = String(
    pickResponseValue(payload, [
      "consignmentId",
      "consignment_id",
      "consignmentNo",
      "consignment_no",
      "id",
      "reference",
    ]) || "",
  ).trim();

  const trackingNumber = String(
    pickResponseValue(payload, [
      "trackingNumber",
      "tracking_number",
      "trackingCode",
      "tracking_code",
      "trackingNo",
      "tracking_no",
      "trackingId",
      "tracking_id",
      "waybill",
      "waybillNo",
    ]) || "",
  ).trim();

  const trackingUrl = String(
    pickResponseValue(payload, [
      "trackingUrl",
      "tracking_url",
      "trackingLink",
      "tracking_link",
      "trackUrl",
      "track_url",
      "url",
    ]) || "",
  ).trim();

  const labelUrl = String(
    pickResponseValue(payload, [
      "labelUrl",
      "label_url",
      "labelLink",
      "label_link",
    ]) || "",
  ).trim();

  const status = normalizeCourierStatusLabel(
    pickResponseValue(payload, [
      "status",
      "state",
      "currentStatus",
      "current_status",
    ]),
    "created",
  );

  return {
    consignmentId,
    trackingNumber,
    trackingUrl,
    labelUrl,
    status,
  };
};

const parseTrackingResponse = (payload = {}) => {
  const trackingUrl = String(
    pickResponseValue(payload, [
      "trackingUrl",
      "tracking_url",
      "trackingLink",
      "tracking_link",
      "trackUrl",
      "track_url",
      "url",
    ]) || "",
  ).trim();

  const status = normalizeCourierStatusLabel(
    pickResponseValue(payload, [
      "status",
      "currentStatus",
      "current_status",
      "deliveryStatus",
      "delivery_status",
      "state",
    ]),
    "",
  );

  const eventsValue = pickResponseValue(payload, [
    "events",
    "history",
    "trackingEvents",
    "tracking_events",
    "steps",
    "timeline",
  ]);

  const events = Array.isArray(eventsValue)
    ? eventsValue.map((entry) => ({
        status: String(entry?.status || entry?.state || "").trim(),
        note: String(
          entry?.note || entry?.description || entry?.message || "",
        ).trim(),
        time: entry?.time || entry?.date || entry?.createdAt || null,
        location: String(
          entry?.location || entry?.district || entry?.city || "",
        ).trim(),
      }))
    : [];

  return {
    trackingUrl,
    status,
    events,
  };
};

const normalizeCourierStatusKey = (status = "") =>
  String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeCourierStatusLabel = (status = "", fallback = "") => {
  const rawValue = String(status || "").trim();
  if (!rawValue) return fallback;
  if (/^\d+$/.test(rawValue)) return fallback;

  const normalized = normalizeCourierStatusKey(rawValue);
  return normalized || fallback;
};

const mapCourierStatusToOrderStatus = (status = "") => {
  const normalized = normalizeCourierStatusKey(status);
  return COURIER_STATUS_TO_ORDER_STATUS[normalized] || "";
};

const escapeRegExp = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findBlacklistedCustomerByShippingAddress = async (
  shippingAddress = {},
) => {
  const email = String(shippingAddress?.email || "")
    .trim()
    .toLowerCase();
  const phone = User.normalizePhone
    ? User.normalizePhone(String(shippingAddress?.phone || "").trim())
    : String(shippingAddress?.phone || "").trim();

  const conditions = [];
  if (email) conditions.push({ email });
  if (phone) {
    conditions.push({ phone });
    conditions.push({
      originalPhone: String(shippingAddress?.phone || "").trim(),
    });
  }

  if (!conditions.length) return null;

  return User.findOne({
    isBlacklisted: true,
    $or: conditions,
  })
    .select("_id name email phone originalPhone isBlacklisted blacklistReason")
    .lean();
};

const buildPhoneVariants = (...values) => {
  const variants = new Set();

  values.flat().forEach((raw) => {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return;

    variants.add(trimmed);

    const normalized = User.normalizePhone
      ? User.normalizePhone(trimmed)
      : trimmed;
    if (normalized) {
      variants.add(normalized);

      if (normalized.startsWith("0") && normalized.length >= 11) {
        variants.add(`+88${normalized}`);
        variants.add(`880${normalized.slice(1)}`);
      }
    }
  });

  return Array.from(variants);
};

const classifyCustomerRiskLevel = ({
  successRate = 0,
  totalOrders = 0,
  isBlacklisted = false,
  cancelledOrders = 0,
  returnedOrders = 0,
} = {}) => {
  return getRiskLevel({
    successRate,
    totalOrders,
    isBlacklisted,
    cancelledOrders,
    returnedOrders,
  });
};

const getCustomerOrderInsights = async ({
  email = "",
  phone = "",
  alternativePhone = "",
  userId = "",
} = {}) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const phoneVariants = buildPhoneVariants(phone, alternativePhone);
  const normalizedUserId = String(userId || "").trim();
  const validUserId = mongoose.Types.ObjectId.isValid(normalizedUserId)
    ? normalizedUserId
    : "";

  const userConditions = [];
  if (normalizedEmail) userConditions.push({ email: normalizedEmail });
  if (phoneVariants.length) {
    userConditions.push({ phone: { $in: phoneVariants } });
    userConditions.push({ originalPhone: { $in: phoneVariants } });
  }
  if (validUserId) {
    userConditions.push({ _id: validUserId });
  }

  const matchedUsers = userConditions.length
    ? await User.find({ $or: userConditions })
        .select(
          "_id name email phone originalPhone isBlacklisted blacklistReason addressBook",
        )
        .limit(10)
        .lean()
    : [];

  const matchedUserIds = matchedUsers.map((entry) => entry._id);
  if (
    validUserId &&
    !matchedUserIds.some((entry) => String(entry) === validUserId)
  ) {
    matchedUserIds.push(validUserId);
  }

  const orderConditions = [];
  if (matchedUserIds.length) {
    orderConditions.push({ user: { $in: matchedUserIds } });
  }
  if (normalizedEmail) {
    orderConditions.push({ "shippingAddress.email": normalizedEmail });
  }
  phoneVariants.forEach((variant) => {
    orderConditions.push({ "shippingAddress.phone": variant });
    orderConditions.push({ "shippingMeta.alternativePhone": variant });
  });

  const orders = orderConditions.length
    ? await Order.find({ $or: orderConditions })
        .select(
          "orderNumber orderStatus total createdAt user shippingAddress shippingMeta",
        )
        .sort({ createdAt: -1 })
        .limit(300)
        .lean()
    : [];

  const dedupedOrdersMap = new Map();
  orders.forEach((entry) => {
    dedupedOrdersMap.set(String(entry._id), entry);
  });

  const dedupedOrders = Array.from(dedupedOrdersMap.values()).sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime(),
  );

  const metrics = calculateCustomerMetrics(dedupedOrders);
  const totalRevenue = roundMoney(
    dedupedOrders.reduce((sum, order) => {
      const status = String(order?.orderStatus || "")
        .trim()
        .toLowerCase();
      return status === "delivered" ? sum + toNumber(order?.total, 0) : sum;
    }, 0),
  );

  const blacklistedUser = matchedUsers.find((entry) =>
    Boolean(entry?.isBlacklisted),
  );
  const isBlacklisted = Boolean(blacklistedUser);
  const blacklistReason = String(blacklistedUser?.blacklistReason || "").trim();
  const normalizeCustomerNameParts = (fullName = "") => {
    const nameParts = String(fullName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return {
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" "),
    };
  };
  const findRecentOrderForUser = (entry = {}) =>
    dedupedOrders.find(
      (orderEntry) =>
        String(orderEntry?.user || "") === String(entry?._id || ""),
    );
  const buildCustomerAutofill = ({ user = null, recentOrder = null } = {}) => {
    const defaultAddress =
      (Array.isArray(user?.addressBook) ? user.addressBook : []).find(
        (entry) => entry?.isDefault,
      ) ||
      (Array.isArray(user?.addressBook) ? user.addressBook[0] : null) ||
      null;
    const shipping = recentOrder?.shippingAddress || {};
    const recentOrderName =
      `${String(shipping?.firstName || "").trim()} ${String(
        shipping?.lastName || "",
      ).trim()}`.trim();
    const fallbackName = String(
      defaultAddress?.recipientName || recentOrderName || user?.name || "",
    ).trim();
    const nameParts = normalizeCustomerNameParts(fallbackName);

    return {
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      email: String(user?.email || shipping?.email || "")
        .trim()
        .toLowerCase(),
      phone: String(
        user?.originalPhone || user?.phone || shipping?.phone || "",
      ).trim(),
      alternativePhone: String(
        defaultAddress?.alternativePhone ||
          shipping?.alternativePhone ||
          recentOrder?.shippingMeta?.alternativePhone ||
          "",
      ).trim(),
      address: String(
        defaultAddress?.address || shipping?.address || "",
      ).trim(),
      city: String(defaultAddress?.city || shipping?.city || "").trim(),
      subCity: String(
        defaultAddress?.subCity || shipping?.subCity || "",
      ).trim(),
      district: String(
        defaultAddress?.district || shipping?.district || "",
      ).trim(),
      postalCode: String(
        defaultAddress?.postalCode || shipping?.postalCode || "",
      ).trim(),
      country: String(
        defaultAddress?.country || shipping?.country || "Bangladesh",
      ).trim(),
    };
  };
  const matchedCustomers = matchedUsers.slice(0, 5).map((entry) => {
    const recentOrder = findRecentOrderForUser(entry);
    return {
      _id: entry._id,
      name: entry.name || "",
      email: entry.email || "",
      phone: entry.originalPhone || entry.phone || "",
      isBlacklisted: Boolean(entry.isBlacklisted),
      blacklistReason: String(entry.blacklistReason || ""),
      autofill: buildCustomerAutofill({
        user: entry,
        recentOrder,
      }),
    };
  });
  const knownCustomerKeys = new Set(
    matchedCustomers.map(
      (entry) =>
        `${String(entry?.email || "")
          .trim()
          .toLowerCase()}|${
          User.normalizePhone
            ? User.normalizePhone(String(entry?.phone || "").trim())
            : String(entry?.phone || "").trim()
        }`,
    ),
  );
  const guestMatches = dedupedOrders
    .map((entry) => {
      const shipping = entry?.shippingAddress || {};
      const emailValue = String(shipping?.email || "")
        .trim()
        .toLowerCase();
      const phoneValue = User.normalizePhone
        ? User.normalizePhone(String(shipping?.phone || "").trim())
        : String(shipping?.phone || "").trim();
      const dedupeKey = `${emailValue}|${phoneValue}`;
      if (!emailValue && !phoneValue) return null;
      if (knownCustomerKeys.has(dedupeKey)) return null;

      const displayName = `${String(shipping?.firstName || "").trim()} ${String(
        shipping?.lastName || "",
      ).trim()}`.trim();

      knownCustomerKeys.add(dedupeKey);

      return {
        _id: "",
        name: displayName || "Guest customer",
        email: emailValue,
        phone: String(shipping?.phone || "").trim(),
        isBlacklisted: false,
        blacklistReason: "",
        autofill: buildCustomerAutofill({
          recentOrder: entry,
        }),
      };
    })
    .filter(Boolean)
    .slice(0, 5);

  return {
    totalOrders: metrics.totalOrders,
    deliveredOrders: metrics.deliveredOrders,
    cancelledOrders: metrics.cancelledOrders,
    returnedOrders: metrics.returnedOrders,
    successRate: roundMoney(metrics.successRate),
    totalRevenue,
    riskLevel: classifyCustomerRiskLevel({
      successRate: metrics.successRate,
      totalOrders: metrics.totalOrders,
      isBlacklisted,
      cancelledOrders: metrics.cancelledOrders,
      returnedOrders: metrics.returnedOrders,
    }),
    isBlacklisted,
    blacklistReason,
    lastOrderDate: dedupedOrders[0]?.createdAt || null,
    recentOrders: dedupedOrders.slice(0, 5).map((entry) => ({
      orderNumber: entry.orderNumber,
      orderStatus: entry.orderStatus,
      total: roundMoney(entry.total),
      createdAt: entry.createdAt,
    })),
    matchedCustomers: [...matchedCustomers, ...guestMatches].slice(0, 5),
  };
};

const getOrderInventoryState = (order = {}) => {
  const inventory = order?.shippingMeta?.inventory || {};
  return {
    deducted: Boolean(inventory?.deducted),
    deductedAt: inventory?.deductedAt || null,
    restored: Boolean(inventory?.restored),
    restoredAt: inventory?.restoredAt || null,
    restoredReason: String(inventory?.restoredReason || "").trim(),
  };
};

const setOrderInventoryState = (order, patch = {}) => {
  if (!order) return;

  const shippingMeta =
    order.shippingMeta && typeof order.shippingMeta === "object"
      ? order.shippingMeta
      : {};

  order.shippingMeta = {
    ...shippingMeta,
    inventory: {
      ...getOrderInventoryState(order),
      ...patch,
    },
  };
};

const applyInventoryAdjustmentForItem = async ({ item, direction = -1 }) => {
  const quantity = Math.max(1, parseInt(item?.quantity, 10) || 1);
  const rawProductId = item?.product?._id || item?.product;
  const productId = String(rawProductId || "").trim();
  const variationId = String(item?.variationId || "").trim();

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new Error("Invalid product for inventory adjustment");
  }

  const product = await Product.findById(productId)
    .select("_id title allowBackorder")
    .lean();
  if (!product) {
    throw new Error("Product not found while updating inventory");
  }

  if (direction < 0 && product.allowBackorder) {
    return {
      applied: false,
      productId: String(product._id),
      variationId: "",
      quantity,
    };
  }

  const query = { _id: product._id };
  const update = { $inc: { stock: direction * quantity } };

  if (variationId && mongoose.Types.ObjectId.isValid(variationId)) {
    query.variations = {
      $elemMatch:
        direction < 0
          ? { _id: variationId, stock: { $gte: quantity } }
          : { _id: variationId },
    };
    update.$inc["variations.$.stock"] = direction * quantity;
  } else if (direction < 0) {
    query.stock = { $gte: quantity };
  }

  if (direction < 0 && !query.stock) {
    query.stock = { $gte: quantity };
  }

  const result = await Product.updateOne(query, update);
  const modified = Number(result?.modifiedCount || result?.nModified || 0);
  if (modified <= 0) {
    throw new Error(`${product.title || "Product"} has insufficient stock`);
  }

  return {
    applied: true,
    productId: String(product._id),
    variationId:
      variationId && mongoose.Types.ObjectId.isValid(variationId)
        ? variationId
        : "",
    quantity,
  };
};

const rollbackInventoryAdjustments = async (adjustments = []) => {
  const queue = Array.isArray(adjustments) ? [...adjustments].reverse() : [];
  for (const adjustment of queue) {
    if (!adjustment?.applied || !adjustment?.productId) continue;

    const update = { $inc: { stock: Number(adjustment.quantity || 0) } };
    const query = { _id: adjustment.productId };

    if (adjustment.variationId) {
      query.variations = { $elemMatch: { _id: adjustment.variationId } };
      update.$inc["variations.$.stock"] = Number(adjustment.quantity || 0);
    }

    await Product.updateOne(query, update).catch(() => null);
  }
};

const applyOrderInventoryAdjustment = async ({
  items = [],
  direction = -1,
} = {}) => {
  const adjustments = [];
  const normalizedDirection = direction >= 0 ? 1 : -1;

  for (const item of Array.isArray(items) ? items : []) {
    try {
      const entry = await applyInventoryAdjustmentForItem({
        item,
        direction: normalizedDirection,
      });
      if (entry?.applied) {
        adjustments.push(entry);
      }
    } catch (error) {
      if (normalizedDirection < 0 && adjustments.length > 0) {
        await rollbackInventoryAdjustments(adjustments);
      }

      return {
        success: false,
        message: error.message || "Failed to update inventory",
      };
    }
  }

  return {
    success: true,
    adjustments,
  };
};

const restoreCouponUsageForOrderDeletion = async (order = {}) => {
  const couponCode = normalizeCouponCode(order?.couponCode);
  if (!couponCode) {
    return { restored: false };
  }

  const coupon = await Coupon.findOne({ code: couponCode })
    .select("_id usedCount")
    .lean();

  if (!coupon || Number(coupon.usedCount || 0) <= 0) {
    return { restored: false };
  }

  const result = await Coupon.updateOne(
    { _id: coupon._id, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
  );

  const modified = Number(result?.modifiedCount || result?.nModified || 0);
  return {
    restored: modified > 0,
  };
};

const maybeAutoBlacklistUserForCancellations = async (order = {}) => {
  const userId = String(order?.user?._id || order?.user || "").trim();
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;

  try {
    const user = await User.findById(userId).select(
      "isBlacklisted blacklistReason adminNotes",
    );
    if (!user || user.isBlacklisted) return;

    const orders = await Order.find({ user: user._id })
      .select("orderStatus total")
      .lean();
    const metrics = calculateCustomerMetrics(orders);

    if (!shouldAutoBlacklistByCancellation(metrics)) {
      return;
    }

    const note = `Auto-blacklisted on ${new Date().toISOString().slice(0, 10)} due to repeated cancellations (${metrics.cancelledOrders}/${metrics.totalOrders} orders cancelled).`;

    user.isBlacklisted = true;
    user.blacklistReason =
      user.blacklistReason || "Repeated order cancellations";
    user.adminNotes = user.adminNotes ? `${user.adminNotes}\n${note}` : note;
    await user.save();
  } catch (error) {
    console.error("Failed to auto-blacklist customer:", error);
  }
};

const finalizeOrderCancellation = async (
  order,
  {
    reason = "",
    resolutionNote = "",
    markRequestApproved = false,
    requestedBy = null,
    requestSource = "",
    actorUser = null,
  } = {},
) => {
  const oldStatus = normalizeOrderStatus(order?.orderStatus || "pending");
  const inventoryState = getOrderInventoryState(order);

  if (
    oldStatus !== "cancelled" &&
    inventoryState.deducted &&
    !inventoryState.restored
  ) {
    const inventoryRestore = await applyOrderInventoryAdjustment({
      items: order.items,
      direction: 1,
    });

    if (!inventoryRestore.success) {
      const error = new Error(
        inventoryRestore.message ||
          "Failed to restore stock for cancelled order",
      );
      error.statusCode = 400;
      throw error;
    }

    setOrderInventoryState(order, {
      restored: true,
      restoredAt: new Date(),
      restoredReason: "cancelled",
    });
  }

  order.orderStatus = "cancelled";
  order.paymentStatus = "failed";
  order.cancelledAt = new Date();

  const noteParts = [
    resolutionNote ? normalizeLongText(resolutionNote) : "",
    reason ? `Reason: ${normalizeLongText(reason)}` : "",
  ].filter(Boolean);

  if (
    order.cancellationRequest?.status &&
    order.cancellationRequest.status !== "none"
  ) {
    if (markRequestApproved || order.cancellationRequest.status === "pending") {
      order.cancellationRequest.status = "approved";
      order.cancellationRequest.resolvedAt = new Date();
      if (reason && !order.cancellationRequest.reason) {
        order.cancellationRequest.reason = normalizeLongText(reason);
      }
      if (resolutionNote) {
        order.cancellationRequest.resolutionNote =
          normalizeLongText(resolutionNote);
      }
    }
  } else {
    order.cancellationRequest = {
      status: markRequestApproved ? "approved" : "none",
      reason: normalizeLongText(reason),
      requestSource: String(requestSource || "").trim(),
      requestedAt: markRequestApproved ? new Date() : null,
      requestedBy: requestedBy || null,
      resolutionNote: normalizeLongText(resolutionNote),
      resolvedAt: markRequestApproved ? new Date() : null,
    };
  }

  appendOrderStatusTimelineEntry({
    order,
    status: "cancelled",
    note:
      noteParts.join(" | ") ||
      (markRequestApproved
        ? "Cancellation request approved by admin"
        : "Order cancelled"),
    user: actorUser,
  });

  await order.save();

  try {
    await sendOrderStatusEmail(order, "cancelled", oldStatus);
  } catch (emailError) {
    console.error("Failed to send cancellation email:", emailError);
  }

  await maybeAutoBlacklistUserForCancellations(order);

  return order;
};

const extractPaymentMethod = (paymentMethod, paymentDetails = {}) => {
  const candidates = [
    paymentDetails?.method,
    paymentDetails?.paymentMethod,
    paymentMethod,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (typeof candidate === "string") {
      const value = candidate.trim();
      if (value) return value;
      continue;
    }

    if (typeof candidate === "object") {
      const value = String(
        candidate.method ||
          candidate.type ||
          candidate.name ||
          candidate.value ||
          "",
      ).trim();
      if (value) return value;
    }
  }

  return "";
};

const isCashOnDeliveryValue = (value) =>
  /\bcod\b|cash[\s_-]*on[\s_-]*delivery/i.test(String(value || "").trim());

const isCashOnDeliveryOrder = (order = {}) => {
  const paymentCategory = String(order?.paymentDetails?.paymentCategory || "")
    .trim()
    .toLowerCase();
  const providerType = getPaymentProviderType(order);
  const paymentLookup = `${order?.paymentMethod || ""} ${order?.paymentDetails?.method || ""}`;

  const hasExplicitCodSignal =
    paymentCategory === "cash_on_delivery" || providerType === "cod";
  const hasExplicitNonCodSignal =
    paymentCategory === "online" || (providerType && providerType !== "cod");

  if (hasExplicitNonCodSignal) {
    return false;
  }

  if (hasExplicitCodSignal) {
    return true;
  }

  return isCashOnDeliveryValue(paymentLookup);
};

const getPaymentProviderType = (order = {}) =>
  String(
    order?.paymentDetails?.providerType ||
      order?.paymentDetails?.meta?.channelType ||
      "",
  )
    .trim()
    .toLowerCase();

const isGatewayOrder = (order = {}) =>
  LEGACY_GATEWAY_CHANNELS.has(getPaymentProviderType(order));

const isManualPaymentOrder = (order = {}) =>
  !isCashOnDeliveryOrder(order) && !isGatewayOrder(order);

const normalizeStoredPaymentStatus = (value) => {
  const normalized = String(value || "pending")
    .trim()
    .toLowerCase();
  return ["pending", "completed", "failed"].includes(normalized)
    ? normalized
    : "pending";
};

const syncStoredPaymentStatusForLifecycle = (order, nextOrderStatus = "") => {
  if (!order) return "pending";

  const normalizedStatus = normalizeOrderStatus(
    nextOrderStatus || order.orderStatus || "pending",
  );
  const currentPaymentStatus = normalizeStoredPaymentStatus(
    order.paymentStatus,
  );

  if (["cancelled", "returned"].includes(normalizedStatus)) {
    order.paymentStatus = "failed";
    return order.paymentStatus;
  }

  if (isCashOnDeliveryOrder(order)) {
    order.paymentStatus =
      normalizedStatus === "delivered" ? "completed" : "pending";
    return order.paymentStatus;
  }

  if (isGatewayOrder(order)) {
    order.paymentStatus = currentPaymentStatus;
    return order.paymentStatus;
  }

  order.paymentStatus = currentPaymentStatus;
  return order.paymentStatus;
};

const resolveEffectivePaymentStatus = (order = {}) => {
  if (isCashOnDeliveryOrder(order)) {
    if (
      String(order?.orderStatus || "")
        .trim()
        .toLowerCase() === "delivered"
    ) {
      return "completed";
    }
    if (
      String(order?.orderStatus || "")
        .trim()
        .toLowerCase() === "cancelled"
    ) {
      return "failed";
    }
  }

  return (
    String(order?.paymentStatus || "pending")
      .trim()
      .toLowerCase() || "pending"
  );
};

const getOrderCancellationMeta = (order = {}, settings = {}) => {
  const request = order?.cancellationRequest || {};
  const requestStatus =
    String(request?.status || "none")
      .trim()
      .toLowerCase() || "none";
  const orderStatus =
    String(order?.orderStatus || "pending")
      .trim()
      .toLowerCase() || "pending";
  const paymentStatus = resolveEffectivePaymentStatus(order);
  const isPaid = paymentStatus === "completed" && !isCashOnDeliveryOrder(order);
  const windowDays = Number.isFinite(Number(settings?.windowDays))
    ? Math.max(0, Math.round(Number(settings.windowDays)))
    : 1;
  const expiresAt = getCancellationExpiryDate(order?.createdAt, windowDays);
  const withinWindow = expiresAt ? Date.now() <= expiresAt.getTime() : false;
  const isTerminal = TERMINAL_ORDER_STATUSES.has(orderStatus);
  const isCancellableStage = CANCELLABLE_ORDER_STATUSES.has(orderStatus);

  const canDirectCancel =
    isCancellableStage &&
    withinWindow &&
    !isTerminal &&
    !isPaid &&
    requestStatus !== "pending";
  const canRequestCancellation =
    isCancellableStage &&
    withinWindow &&
    !isTerminal &&
    isPaid &&
    !["pending", "approved"].includes(requestStatus);

  let disabledReason = "";
  if (orderStatus === "cancelled") {
    disabledReason = "Order already cancelled";
  } else if (isTerminal) {
    disabledReason = "Cancellation is no longer available for this order";
  } else if (!isCancellableStage) {
    disabledReason =
      "Cancellation is only available while the order is still pending";
  } else if (!withinWindow) {
    disabledReason =
      windowDays > 0
        ? `Cancellation window expired after ${windowDays} day${windowDays === 1 ? "" : "s"}`
        : "Customer cancellation is disabled";
  } else if (requestStatus === "pending") {
    disabledReason = "Cancellation request is pending admin approval";
  } else if (requestStatus === "approved") {
    disabledReason = "Cancellation request was approved";
  } else if (requestStatus === "rejected") {
    disabledReason = "Cancellation request was rejected";
  }

  return {
    windowDays,
    expiresAt,
    isWindowExpired: !withinWindow,
    showExpiryInfo: isCancellableStage,
    expiryLabel: withinWindow
      ? "Cancellation window ends on"
      : "Cancellation window ended on",
    requiresApproval: isPaid,
    actionType: canDirectCancel
      ? "direct_cancel"
      : canRequestCancellation
        ? "request_cancel"
        : "none",
    canDirectCancel,
    canRequestCancellation,
    requestStatus,
    requestReason: String(request?.reason || "").trim(),
    requestSource: String(request?.requestSource || "").trim(),
    requestedAt: request?.requestedAt || null,
    requestedBy: request?.requestedBy || null,
    resolutionNote: String(request?.resolutionNote || "").trim(),
    resolvedAt: request?.resolvedAt || null,
    policyHtml: String(settings?.policyHtml || "").trim(),
    disabledReason,
  };
};

const decorateOrderForClient = (order, cancellationSettings = {}) => {
  const orderData = order?.toObject ? order.toObject() : { ...order };
  orderData.paymentStatus = resolveEffectivePaymentStatus(orderData);
  orderData.cancellationRequest = orderData.cancellationRequest || {
    status: "none",
    reason: "",
    requestSource: "",
    requestedAt: null,
    requestedBy: null,
    resolutionNote: "",
    resolvedAt: null,
  };
  orderData.cancellation = getOrderCancellationMeta(
    orderData,
    cancellationSettings,
  );
  return orderData;
};

const decorateOrdersForClient = (orders = [], cancellationSettings = {}) =>
  (Array.isArray(orders) ? orders : [orders]).map((order) =>
    decorateOrderForClient(order, cancellationSettings),
  );

const buildTrackedOrderResponse = async (order, cancellationSettings = {}) => {
  const orderData = decorateOrderForClient(order, cancellationSettings);
  const estimatedDeliveryWindow = getOrderEstimatedDeliveryWindow(orderData);
  const products = (orderData.items || [])
    .map((item) => item.product)
    .filter(Boolean);
  await attachImageDataToProducts(products);

  return {
    _id: orderData._id,
    orderNumber: orderData.orderNumber,
    createdAt: orderData.createdAt,
    orderStatus: orderData.orderStatus,
    paymentStatus: orderData.paymentStatus,
    paymentMethod: orderData.paymentMethod,
    transactionId: orderData.paymentDetails?.transactionId || "N/A",
    shippingMeta: {
      ...(orderData.shippingMeta && typeof orderData.shippingMeta === "object"
        ? orderData.shippingMeta
        : {}),
      estimatedMinDays: estimatedDeliveryWindow.estimatedMinDays,
      estimatedMaxDays: estimatedDeliveryWindow.estimatedMaxDays,
    },
    items: (orderData.items || []).map((item) => ({
      product: item.product
        ? {
            _id: item.product._id,
            title: item.product.title,
            image: item.product.images?.[0] || null,
            price: item.price,
            deliveryMinDays: item.product.deliveryMinDays || 0,
            deliveryMaxDays: item.product.deliveryMaxDays || 0,
          }
        : {
            title: "Product information not available",
            price: item.price,
          },
      quantity: item.quantity,
      variationLabel: item.variationLabel || "",
      selectedVariants: item.selectedVariants || [],
      sku: item.sku || "",
      color: item.color,
      dimensions: item.dimensions,
      itemTotal: item.quantity * item.price,
    })),
    shippingAddress: orderData.shippingAddress,
    subtotal: orderData.subtotal,
    shippingFee: orderData.shippingFee,
    discount: orderData.discount,
    total: orderData.total,
    isGuest: !orderData.user,
    customerName: orderData.user?.name
      ? orderData.user.name
      : `${orderData.shippingAddress?.firstName || ""} ${orderData.shippingAddress?.lastName || ""}`.trim(),
    courier: getOrderCourierMeta(orderData),
    statusTimeline: getOrderStatusTimeline(orderData),
    adminNotes: String(orderData.adminNotes || ""),
    cancellation: orderData.cancellation,
    cancellationRequest: orderData.cancellationRequest,
  };
};

const normalizePaymentDetails = (
  paymentMethod,
  paymentDetails = {},
  { providerType = "", defaultAccountNo = "" } = {},
) => {
  const resolvedMethod = extractPaymentMethod(paymentMethod, paymentDetails);
  const normalizedProviderType = String(providerType || "")
    .trim()
    .toLowerCase();
  const isCashOnDelivery =
    normalizedProviderType === "cod" ||
    (!normalizedProviderType && isCashOnDeliveryValue(resolvedMethod));

  return {
    method: resolvedMethod,
    paymentCategory: isCashOnDelivery ? "cash_on_delivery" : "online",
    providerType: normalizedProviderType,
    transactionId: String(paymentDetails?.transactionId || "").trim(),
    gatewayPaymentId: String(paymentDetails?.gatewayPaymentId || "").trim(),
    paymentUrl: String(paymentDetails?.paymentUrl || "").trim(),
    accountNo: String(
      paymentDetails?.accountNo || defaultAccountNo || "",
    ).trim(),
    sentFrom: String(paymentDetails?.sentFrom || "").trim(),
    sentTo: String(paymentDetails?.sentTo || "").trim(),
    meta:
      paymentDetails?.meta && typeof paymentDetails.meta === "object"
        ? paymentDetails.meta
        : {},
  };
};

const normalizeOrderSource = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 120);
  return normalized || "shop";
};

const resolveOrderType = (order = {}) => {
  const explicitType = String(order?.orderType || "")
    .trim()
    .toLowerCase();

  if (explicitType === "manual" || explicitType === "online") {
    return explicitType;
  }

  const source = String(order?.source || "")
    .trim()
    .toLowerCase();

  return source.includes("manual") ? "manual" : "online";
};

const resolveLandingAttribution = async ({
  source = "shop",
  landingPageSlug = "",
} = {}) => {
  const normalizedSource = normalizeOrderSource(source);
  const normalizedSlug = String(landingPageSlug || "")
    .trim()
    .toLowerCase()
    .slice(0, 220);

  if (!normalizedSlug) {
    return {
      source: normalizedSource,
      landingPage: null,
      landingPageSlug: "",
    };
  }

  const page = await LandingPage.findOne({
    slug: normalizedSlug,
    isActive: true,
  })
    .select("_id slug")
    .lean();

  return {
    source: normalizedSource,
    landingPage: page?._id || null,
    landingPageSlug: page?.slug || normalizedSlug,
  };
};

const resolvePaymentMethodSelection = async ({
  paymentMethodId,
  paymentMethod,
  paymentDetails,
}) => {
  const requestedMethod = extractPaymentMethod(paymentMethod, paymentDetails);
  const requestedCanonical = String(requestedMethod || "")
    .trim()
    .toLowerCase();
  const requestedDashed = requestedCanonical.replace(/[\s_]+/g, "-");
  const requestedSpaced = requestedCanonical.replace(/[_-]+/g, " ");
  let methodDoc = null;

  const normalizedMethodId = String(paymentMethodId || "").trim();
  if (/^[0-9a-fA-F]{24}$/.test(normalizedMethodId)) {
    methodDoc = await PaymentMethod.findOne({
      _id: normalizedMethodId,
      isActive: true,
      channelType: { $in: Array.from(SUPPORTED_PAYMENT_METHOD_CHANNELS) },
    }).lean();
  }

  if (!methodDoc && requestedCanonical) {
    const escapedCanonical = escapeRegExp(requestedCanonical);
    const escapedSpaced = escapeRegExp(requestedSpaced);
    methodDoc = await PaymentMethod.findOne({
      isActive: true,
      channelType: { $in: Array.from(SUPPORTED_PAYMENT_METHOD_CHANNELS) },
      $or: [
        { code: requestedCanonical },
        { code: requestedDashed },
        { type: { $regex: `^${escapedCanonical}$`, $options: "i" } },
        { type: { $regex: `^${escapedSpaced}$`, $options: "i" } },
      ],
    }).lean();
  }

  const channelType = String(methodDoc?.channelType || "manual")
    .trim()
    .toLowerCase();
  if (
    (!methodDoc && (normalizedMethodId || requestedCanonical)) ||
    (methodDoc && !SUPPORTED_PAYMENT_METHOD_CHANNELS.has(channelType))
  ) {
    const error = new Error(
      "Selected payment method is not active or is no longer available",
    );
    error.statusCode = 400;
    throw error;
  }

  const inferredChannel = methodDoc ? channelType : "manual";
  const resolvedMethodName = String(
    methodDoc?.type || requestedMethod || "",
  ).trim();

  return {
    methodDoc,
    methodName: resolvedMethodName,
    channelType: inferredChannel,
    methodCode: safeString(methodDoc?.code),
    defaultAccountNo: String(methodDoc?.accountNo || "").trim(),
    requiresTransactionProof: methodDoc
      ? methodDoc.requiresTransactionProof === undefined
        ? true
        : Boolean(methodDoc.requiresTransactionProof)
      : true,
  };
};

const rollbackTemporaryGatewayOrder = async ({
  order,
  inventoryDeduction = null,
} = {}) => {
  if (!order) return;

  if (inventoryDeduction?.adjustments?.length) {
    await rollbackInventoryAdjustments(inventoryDeduction.adjustments);
  } else {
    const inventoryState = getOrderInventoryState(order);
    if (inventoryState.deducted && !inventoryState.restored) {
      await applyOrderInventoryAdjustment({
        items: order.items,
        direction: 1,
      }).catch(() => null);
    }
  }

  await restoreCouponUsageForOrderDeletion(order).catch(() => null);
  await Order.findByIdAndDelete(order._id).catch(() => null);
};

const getRequestBaseUrl = (req) => {
  const forwardedProto = safeString(
    String(req?.headers?.["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim(),
  );
  const forwardedHost = safeString(
    String(req?.headers?.["x-forwarded-host"] || "")
      .split(",")[0]
      .trim(),
  );
  const host = forwardedHost || safeString(req?.get?.("host") || "");
  const protocol = forwardedProto || safeString(req?.protocol || "http");

  if (!host) return "";
  return `${protocol}://${host}`;
};

const buildOrderPaymentMeta = ({
  paymentSelection,
  paymentDetails = {},
  gatewayMeta = {},
}) => {
  const baseMeta =
    paymentDetails?.meta && typeof paymentDetails.meta === "object"
      ? paymentDetails.meta
      : {};

  const nextGatewayMeta =
    gatewayMeta && typeof gatewayMeta === "object" ? gatewayMeta : {};

  return {
    ...baseMeta,
    ...nextGatewayMeta,
    paymentMethodId: safeString(paymentSelection?.methodDoc?._id),
    paymentMethodCode: safeString(paymentSelection?.methodCode),
    channelType: safeString(paymentSelection?.channelType).toLowerCase(),
  };
};

const findPaymentMethodForOrder = async (order = {}, provider = "") => {
  const normalizedProvider = safeString(
    provider || order?.paymentDetails?.providerType,
  ).toLowerCase();
  const paymentMeta =
    order?.paymentDetails?.meta && typeof order.paymentDetails.meta === "object"
      ? order.paymentDetails.meta
      : {};
  const storedMethodId = safeString(paymentMeta.paymentMethodId);

  if (mongoose.Types.ObjectId.isValid(storedMethodId)) {
    const methodById = await PaymentMethod.findById(storedMethodId);
    if (methodById) return methodById;
  }

  const storedMethodCode = safeString(paymentMeta.paymentMethodCode);
  const paymentMethodName = safeString(
    order?.paymentDetails?.method || order?.paymentMethod,
  );
  const conditions = [];

  if (storedMethodCode) {
    conditions.push({ code: storedMethodCode });
  }

  if (paymentMethodName) {
    conditions.push({ type: paymentMethodName });
  }

  if (normalizedProvider) {
    conditions.push({ channelType: normalizedProvider });
  }

  if (!conditions.length) return null;

  return PaymentMethod.findOne({ $or: conditions }).sort({
    updatedAt: -1,
    createdAt: -1,
  });
};

const applyGatewayVerificationResultToOrder = ({
  order,
  verification = {},
  provider = "",
  paymentSelection = null,
  notePrefix = "",
} = {}) => {
  if (!order) return false;

  const normalizedProvider = safeString(
    provider ||
      verification?.providerType ||
      order?.paymentDetails?.providerType,
  ).toLowerCase();
  const existingPaymentDetails =
    order.paymentDetails?.toObject?.() || order.paymentDetails || {};
  const existingMeta =
    existingPaymentDetails?.meta &&
    typeof existingPaymentDetails.meta === "object"
      ? existingPaymentDetails.meta
      : {};
  const providerMeta =
    verification?.meta && typeof verification.meta === "object"
      ? verification.meta
      : {};
  const nextPaymentStatus = normalizeStoredPaymentStatus(
    verification?.paymentStatus || order.paymentStatus,
  );

  order.paymentStatus = nextPaymentStatus;
  order.paymentDetails = {
    ...existingPaymentDetails,
    method:
      existingPaymentDetails.method ||
      order.paymentMethod ||
      paymentSelection?.type ||
      "",
    paymentCategory: isCashOnDeliveryOrder(order)
      ? "cash_on_delivery"
      : "online",
    providerType:
      normalizedProvider ||
      safeString(existingPaymentDetails.providerType).toLowerCase(),
    transactionId:
      safeString(verification?.transactionId) ||
      safeString(existingPaymentDetails.transactionId),
    gatewayPaymentId:
      safeString(verification?.gatewayPaymentId) ||
      safeString(existingPaymentDetails.gatewayPaymentId),
    paymentUrl: "",
    accountNo: safeString(existingPaymentDetails.accountNo),
    sentFrom: safeString(existingPaymentDetails.sentFrom),
    sentTo: safeString(existingPaymentDetails.sentTo),
    meta: {
      ...existingMeta,
      ...providerMeta,
      ...(paymentSelection?._id
        ? { paymentMethodId: safeString(paymentSelection._id) }
        : {}),
      ...(paymentSelection?.code
        ? { paymentMethodCode: safeString(paymentSelection.code) }
        : {}),
      channelType:
        normalizedProvider ||
        safeString(existingMeta.channelType).toLowerCase(),
      lastGatewaySyncAt: new Date(),
    },
  };

  const noteBase = safeString(notePrefix) || "Gateway payment updated";
  const noteParts = [
    `${noteBase} via ${toStartCase(normalizedProvider || "gateway")}`,
    verification?.transactionId
      ? `Txn: ${safeString(verification.transactionId)}`
      : "",
    verification?.message ? safeString(verification.message) : "",
  ].filter(Boolean);

  appendOrderStatusTimelineEntry({
    order,
    status: normalizeOrderStatus(order.orderStatus || "pending") || "pending",
    note: noteParts.join(" | "),
    user: null,
  });

  return true;
};

const resolveOrderShippingQuote = async (shippingAddress = {}) => {
  const shippingSettings = await getPrimaryAdminShippingSettings();
  const zones = await getGlobalShippingZones({
    activeOnly: true,
    sort: { priority: 1, createdAt: 1 },
  });

  return resolveShippingQuote({
    district: shippingAddress?.district,
    country: shippingAddress?.country || "Bangladesh",
    zones,
    fallbackShippingCost: shippingSettings.outsideDhakaShippingCost,
  });
};

const hasManualDeliveryAddress = (shippingAddress = {}) =>
  Boolean(String(shippingAddress?.address || "").trim());

const normalizeOrderItem = (item) => ({
  productId: item?.productId || item?.product?._id || item?.product,
  quantity: Math.max(1, parseInt(item?.quantity, 10) || 1),
  variationId:
    item?.variationId || item?.variantId || item?.variation?._id || null,
  variationLabel: String(
    item?.variationLabel || item?.variantLabel || "",
  ).trim(),
  selectedVariants: normalizeSelectedVariantsPayload(
    item?.selectedVariants || [],
  ),
  color: item?.color || "",
  dimensions: item?.dimensions || "",
});

const normalizeVariationId = (value) => {
  const parsed = String(value || "").trim();
  return /^[0-9a-fA-F]{24}$/.test(parsed) ? parsed : "";
};

const getBaseProductPrice = (product) => {
  const hasSalePrice =
    String(product?.priceType || "single") === "best" &&
    product?.salePrice !== null &&
    product?.salePrice !== undefined &&
    String(product.salePrice).trim() !== "";
  if (hasSalePrice) {
    const salePrice = toNumber(product.salePrice, NaN);
    if (Number.isFinite(salePrice) && salePrice >= 0) return salePrice;
  }

  const regularPrice = toNumber(product?.price, NaN);
  if (Number.isFinite(regularPrice) && regularPrice >= 0) return regularPrice;

  return 0;
};

const getVariationContext = (product, variationId) => {
  const normalizedVariationId = normalizeVariationId(variationId);
  if (!normalizedVariationId || !Array.isArray(product?.variations)) {
    return null;
  }

  const variation =
    product.variations.find(
      (entry) =>
        String(entry?._id || "") === normalizedVariationId &&
        entry?.isActive !== false,
    ) || null;

  if (!variation) return null;

  const price =
    variation.salePrice !== null && variation.salePrice !== undefined
      ? toNumber(variation.salePrice, 0)
      : toNumber(variation.price, 0);

  return {
    variationId: normalizedVariationId,
    variationLabel: String(variation.label || "").trim(),
    sku: String(variation.sku || "").trim(),
    stock: Math.max(parseInt(variation.stock, 10) || 0, 0),
    price: roundMoney(Math.max(price, 0)),
  };
};

const buildOrderItems = async (rawItems = []) => {
  const normalizedItems = rawItems
    .map((item) => normalizeOrderItem(item))
    .filter((item) => item.productId);

  if (!normalizedItems.length || normalizedItems.length !== rawItems.length) {
    return {
      success: false,
      status: 400,
      message: "Invalid product data found in checkout items",
    };
  }

  const orderItems = [];
  const nonPurchasableTypes = new Set(["grouped"]);
  let estimatedMinDays = 0;
  let estimatedMaxDays = 0;

  for (const item of normalizedItems) {
    const product = await Product.findById(item.productId).select(
      "title price salePrice priceType isActive approvalStatus marketplaceType stock allowBackorder variations variantDefinitions deliveryMinDays deliveryMaxDays",
    );

    if (!product) {
      return {
        success: false,
        status: 400,
        message: "One or more products are no longer available",
      };
    }

    if (
      !product.isActive ||
      !["approved", undefined, null].includes(product.approvalStatus)
    ) {
      return {
        success: false,
        status: 400,
        message: "One or more products are not currently available",
      };
    }

    const marketplaceType = String(product.marketplaceType || "simple");
    const priceType = String(product.priceType || "single");
    if (nonPurchasableTypes.has(marketplaceType)) {
      return {
        success: false,
        status: 400,
        message: "Grouped products cannot be purchased directly",
      };
    }
    if (priceType === "tba") {
      return {
        success: false,
        status: 400,
        message: `${product.title || "Product"} is currently marked as TBA and cannot be purchased`,
      };
    }

    let variationContext = null;
    if (marketplaceType === "variable") {
      variationContext = getVariationContext(product, item.variationId);
      if (!variationContext) {
        return {
          success: false,
          status: 400,
          message: "Please select a valid variation for variable products",
        };
      }
    }

    const rawFallbackItem = rawItems?.find((raw) => {
      const rawProductId = raw?.productId || raw?.product?._id || raw?.product;
      const rawVariationId = normalizeVariationId(
        raw?.variationId || raw?.variantId || raw?.variation?._id,
      );
      if (String(rawProductId || "") !== String(item.productId)) return false;
      if (marketplaceType !== "variable") return true;
      return (
        String(rawVariationId || "") ===
        String(variationContext?.variationId || "")
      );
    });

    const selectedVariantResult = normalizeSelectedVariantsForProduct(
      product,
      item.selectedVariants || rawFallbackItem?.selectedVariants || [],
    );
    if (selectedVariantResult.error) {
      return {
        success: false,
        status: 400,
        message: selectedVariantResult.error,
      };
    }

    const fallbackPrice = toNumber(rawFallbackItem?.price, NaN);
    const resolvedPricing = resolveProductPricingForSelection({
      basePrice: variationContext
        ? variationContext.price
        : getBaseProductPrice(product),
      baseComparePrice:
        !variationContext && String(product?.priceType || "single") === "best"
          ? toNumber(product?.price, null)
          : null,
      selectedVariants: selectedVariantResult.selectedVariants,
    });
    const resolvedPrice = resolvedPricing.price;

    const unitPrice = Number.isFinite(resolvedPrice)
      ? resolvedPrice
      : Number.isFinite(fallbackPrice)
        ? roundMoney(Math.max(fallbackPrice, 0))
        : 0;
    const allowBackorder = Boolean(product.allowBackorder);
    const availableStock = variationContext
      ? variationContext.stock
      : Math.max(parseInt(product.stock, 10) || 0, 0);
    const itemDeliveryMinDays = Math.max(
      0,
      parseInt(product.deliveryMinDays, 10) || 0,
    );
    const itemDeliveryMaxDays = Math.max(
      itemDeliveryMinDays,
      parseInt(product.deliveryMaxDays, 10) || itemDeliveryMinDays,
    );

    if (!allowBackorder && item.quantity > availableStock) {
      return {
        success: false,
        status: 400,
        message: `${product.title || "Product"} has only ${availableStock} item(s) in stock`,
      };
    }

    orderItems.push({
      product: item.productId,
      quantity: item.quantity,
      price: roundMoney(Math.max(unitPrice, 0)),
      variationId: variationContext?.variationId || null,
      variationLabel: buildCombinedVariationLabel(
        item.variationLabel || variationContext?.variationLabel || "",
        selectedVariantResult.selectedVariants,
      ),
      selectedVariants: selectedVariantResult.selectedVariants,
      sku: variationContext?.sku || "",
      color: item.color,
      dimensions: item.dimensions,
      title: product?.title || "",
    });

    estimatedMinDays = Math.max(estimatedMinDays, itemDeliveryMinDays);
    estimatedMaxDays = Math.max(estimatedMaxDays, itemDeliveryMaxDays);
  }

  const subtotal = roundMoney(
    orderItems.reduce(
      (sum, item) => sum + toNumber(item.price, 0) * toNumber(item.quantity, 1),
      0,
    ),
  );

  return {
    success: true,
    orderItems,
    subtotal,
    estimatedMinDays,
    estimatedMaxDays,
  };
};

const buildCombinedVariationLabel = (
  variationLabel = "",
  selectedVariants = [],
) =>
  [
    String(variationLabel || "").trim(),
    buildSelectedVariantSummary(selectedVariants),
  ]
    .filter(Boolean)
    .join(" | ");

const mergeEstimatedDeliveryIntoShippingMeta = (
  shippingMeta = {},
  orderItemsMeta = {},
) => {
  const normalizedShippingMeta =
    shippingMeta && typeof shippingMeta === "object" ? { ...shippingMeta } : {};

  const currentMinDays = Math.max(
    0,
    parseInt(normalizedShippingMeta.estimatedMinDays, 10) || 0,
  );
  const currentMaxDays = Math.max(
    currentMinDays,
    parseInt(normalizedShippingMeta.estimatedMaxDays, 10) || currentMinDays,
  );

  if (currentMaxDays > 0) {
    normalizedShippingMeta.estimatedMinDays = currentMinDays;
    normalizedShippingMeta.estimatedMaxDays = currentMaxDays;
    return normalizedShippingMeta;
  }

  const fallbackMinDays = Math.max(
    0,
    parseInt(orderItemsMeta?.estimatedMinDays, 10) || 0,
  );
  const fallbackMaxDays = Math.max(
    fallbackMinDays,
    parseInt(orderItemsMeta?.estimatedMaxDays, 10) || fallbackMinDays,
  );

  if (fallbackMaxDays > 0) {
    normalizedShippingMeta.estimatedMinDays = fallbackMinDays;
    normalizedShippingMeta.estimatedMaxDays = fallbackMaxDays;
  }

  return normalizedShippingMeta;
};

const calculateOrderPricing = async ({
  subtotal,
  shippingFee,
  couponCode,
  items = [],
}) => {
  const normalizedSubtotal = roundMoney(Math.max(toNumber(subtotal, 0), 0));
  const normalizedShippingFee = roundMoney(
    Math.max(toNumber(shippingFee, 0), 0),
  );

  let discount = 0;
  let appliedCouponCode = "";
  let couponDoc = null;
  let freeShipping = false;

  if (couponCode) {
    const validation = await validateCouponForSubtotal(
      couponCode,
      normalizedSubtotal,
      items,
    );

    if (!validation.success) {
      return {
        success: false,
        status: validation.status,
        message: validation.message,
      };
    }

    discount = validation.discount;
    appliedCouponCode = validation.code;
    couponDoc = validation.coupon;
    freeShipping = Boolean(validation.freeShipping);
  }

  const effectiveShippingFee = freeShipping ? 0 : normalizedShippingFee;

  const total = roundMoney(
    Math.max(normalizedSubtotal + effectiveShippingFee - discount, 0),
  );

  return {
    success: true,
    subtotal: normalizedSubtotal,
    shippingFee: effectiveShippingFee,
    discount,
    couponCode: appliedCouponCode,
    total,
    couponDoc,
    freeShipping,
  };
};

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const {
      shippingAddress,
      items,
      shippingFee = 0,
      shippingMeta = {},
      couponCode = "",
      source = "shop",
      landingPageSlug = "",
      paymentMethodId,
      paymentMethod,
      paymentDetails,
    } = req.body;

    const paymentSelection = await resolvePaymentMethodSelection({
      paymentMethodId,
      paymentMethod,
      paymentDetails,
    });

    const shippingQuote = await resolveOrderShippingQuote(shippingAddress);
    if (!shippingQuote.success) {
      return res.status(shippingQuote.status || 400).json({
        success: false,
        message: shippingQuote.message || "Unable to resolve shipping",
      });
    }

    const normalizedPaymentDetails = normalizePaymentDetails(
      paymentSelection.methodName,
      paymentDetails,
      {
        providerType: paymentSelection.channelType,
        defaultAccountNo: paymentSelection.defaultAccountNo,
      },
    );
    normalizedPaymentDetails.meta = buildOrderPaymentMeta({
      paymentSelection,
      paymentDetails: normalizedPaymentDetails,
    });
    normalizedPaymentDetails.meta = buildOrderPaymentMeta({
      paymentSelection,
      paymentDetails: normalizedPaymentDetails,
    });

    // Validate required fields
    if (!shippingAddress || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Shipping address and items are required",
      });
    }

    if (req.user?.isBlacklisted) {
      return res.status(403).json({
        success: false,
        message: "This account is blacklisted and cannot place orders",
      });
    }

    const blacklistedByContact =
      await findBlacklistedCustomerByShippingAddress(shippingAddress);
    if (blacklistedByContact) {
      return res.status(403).json({
        success: false,
        message: "This customer is blacklisted and cannot place orders",
      });
    }

    if (!normalizedPaymentDetails.method) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    if (
      paymentSelection.requiresTransactionProof &&
      !String(normalizedPaymentDetails.transactionId || "").trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required for this payment method",
      });
    }

    const builtItems = await buildOrderItems(items);
    if (!builtItems.success) {
      return res.status(builtItems.status).json({
        success: false,
        message: builtItems.message,
      });
    }

    const pricing = await calculateOrderPricing({
      subtotal: builtItems.subtotal,
      shippingFee: shippingQuote.shippingFee,
      couponCode: normalizeCouponCode(couponCode),
      items: builtItems.orderItems,
    });

    if (!pricing.success) {
      return res.status(pricing.status).json({
        success: false,
        message: pricing.message,
      });
    }

    const orderNumber = generateOrderNumber();
    const attribution = await resolveLandingAttribution({
      source,
      landingPageSlug,
    });
    const mergedShippingMeta = mergeEstimatedDeliveryIntoShippingMeta(
      shippingQuote.shippingMeta,
      builtItems,
    );

    const order = await Order.create({
      orderNumber,
      user: req.user?.id || null,
      items: builtItems.orderItems,
      shippingAddress,
      subtotal: pricing.subtotal,
      shippingFee: pricing.shippingFee,
      shippingMeta: mergedShippingMeta,
      discount: pricing.discount,
      couponCode: pricing.couponCode,
      total: pricing.total,
      paymentMethod:
        paymentSelection.methodName || normalizedPaymentDetails.method,
      paymentDetails: normalizedPaymentDetails,
      paymentStatus: "pending",
      orderStatus: "pending",
      statusTimeline: [
        buildOrderStatusTimelineEntry({
          status: "pending",
          note: "Order created from checkout",
          user: req.user,
        }),
      ],
      source: attribution.source,
      landingPage: attribution.landingPage,
      landingPageSlug: attribution.landingPageSlug,
    });

    const inventoryDeduction = await applyOrderInventoryAdjustment({
      items: order.items,
      direction: -1,
    });
    if (!inventoryDeduction.success) {
      await Order.findByIdAndDelete(order._id).catch(() => null);
      return res.status(400).json({
        success: false,
        message:
          inventoryDeduction.message || "Failed to reserve product stock",
      });
    }

    if (pricing.couponDoc) {
      try {
        await incrementCouponUsage(pricing.couponDoc);
      } catch (couponError) {
        if (inventoryDeduction.adjustments?.length) {
          await rollbackInventoryAdjustments(inventoryDeduction.adjustments);
        }
        await Order.findByIdAndDelete(order._id).catch(() => null);

        return res.status(400).json({
          success: false,
          message: couponError.message || "Coupon is no longer valid",
        });
      }
    }

    setOrderInventoryState(order, {
      deducted:
        Array.isArray(inventoryDeduction.adjustments) &&
        inventoryDeduction.adjustments.length > 0,
      deductedAt: new Date(),
      restored: false,
      restoredAt: null,
      restoredReason: "",
    });
    await order.save();

    let paymentRedirectUrl = "";
    let gatewayInitError = "";
    const isGatewayCheckout =
      paymentSelection.methodDoc &&
      CHECKOUT_GATEWAY_CHANNELS.has(paymentSelection.channelType);

    if (isGatewayCheckout) {
      try {
        const gatewaySession = await initiateGatewayPayment({
          order,
          paymentMethod: paymentSelection.methodDoc,
          customer: shippingAddress,
          requestBaseUrl: getRequestBaseUrl(req),
          requestIp:
            req.headers["x-forwarded-for"] ||
            req.ip ||
            req.socket?.remoteAddress,
        });

        order.paymentDetails = {
          ...(order.paymentDetails?.toObject
            ? order.paymentDetails.toObject()
            : order.paymentDetails || {}),
          ...normalizedPaymentDetails,
          providerType:
            gatewaySession?.providerType || paymentSelection.channelType,
          gatewayPaymentId: String(gatewaySession?.gatewayPaymentId || ""),
          paymentUrl: String(gatewaySession?.paymentUrl || ""),
          meta: buildOrderPaymentMeta({
            paymentSelection,
            paymentDetails: normalizedPaymentDetails,
            gatewayMeta: gatewaySession?.meta,
          }),
        };
        await order.save();

        paymentRedirectUrl = String(gatewaySession?.paymentUrl || "");
      } catch (gatewayError) {
        console.error(
          "Create order gateway initialization error:",
          gatewayError,
        );
        await rollbackTemporaryGatewayOrder({
          order,
          inventoryDeduction,
        });
        gatewayInitError =
          gatewayError?.message || "Failed to initialize payment gateway";

        return res.status(400).json({
          success: false,
          message: gatewayInitError,
          paymentProvider: paymentSelection.channelType || "manual",
        });
      }
    }

    // Clear user's cart immediately for manual and COD orders only.
    if (!isGatewayCheckout && req.user?.id) {
      await Cart.findOneAndUpdate({ user: req.user.id }, { items: [] });
    }

    await createRecurringSubscriptionsFromOrder(order).catch(() => null);

    // Fetch the order with populated product data
    const populatedOrder = await Order.findById(order._id)
      .populate({
        path: "items.product",
        select: "title images price dimensions deliveryMinDays deliveryMaxDays",
      })
      .lean();

    if (populatedOrder?.items?.length) {
      const products = populatedOrder.items
        .map((item) => item.product)
        .filter(Boolean);
      await attachImageDataToProducts(products);
    }

    sendOrderPlacedEmail(populatedOrder).catch((emailError) => {
      console.error("Order confirmation email error:", emailError);
    });

    await Promise.allSettled([
      notifyAdminsAboutOrderCreated(populatedOrder),
      notifyCustomerAboutOrderCreated(populatedOrder),
    ]);

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: populatedOrder,
      paymentRedirectUrl: paymentRedirectUrl || null,
      paymentProvider: paymentSelection.channelType || "manual",
      gatewayInitError: gatewayInitError || null,
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating order",
    });
  }
};

// Get user's orders
exports.getUserOrders = async (req, res) => {
  try {
    const cancellationSettings = await getCancellationSettings();
    const orders = await Order.find({ user: req.user.id })
      .populate({
        path: "items.product",
        select: "title images price dimensions deliveryMinDays deliveryMaxDays",
      })
      .sort({ createdAt: -1 });

    const ordersData = decorateOrdersForClient(orders, cancellationSettings);
    const products = ordersData
      .flatMap((order) => order.items || [])
      .map((item) => item.product)
      .filter(Boolean);
    await attachImageDataToProducts(products);

    res.json({
      success: true,
      orders: ordersData,
    });
  } catch (error) {
    console.error("Get user orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching orders",
    });
  }
};

// Get single order
exports.getOrder = async (req, res) => {
  try {
    const cancellationSettings = await getCancellationSettings();
    const order = await Order.findById(req.params.id).populate({
      path: "items.product",
      select: "title images price dimensions deliveryMinDays deliveryMaxDays",
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check authorization
    const isAdmin = req.user.userType === "admin";
    const isOwner =
      order.user && String(order.user) === String(req.user._id || req.user.id);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this order",
      });
    }

    const orderData = decorateOrderForClient(order, cancellationSettings);
    const products = (orderData.items || [])
      .map((item) => item.product)
      .filter(Boolean);
    await attachImageDataToProducts(products);

    res.json({
      success: true,
      order: orderData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while fetching order",
    });
  }
};
// Get all orders (admin only)
exports.getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const cancellationSettings = await getCancellationSettings();
    const trimmedSearch = String(search || "").trim();

    if (req.user.role !== "admin" && req.user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    let query = {};

    // Filter by status
    if (status && status !== "all") {
      query.orderStatus = status;
    }

    // Search by order number, customer info, or payment reference
    if (trimmedSearch) {
      const searchFilters = [
        { orderNumber: { $regex: trimmedSearch, $options: "i" } },
        { "shippingAddress.email": { $regex: trimmedSearch, $options: "i" } },
        {
          "shippingAddress.firstName": { $regex: trimmedSearch, $options: "i" },
        },
        {
          "shippingAddress.lastName": { $regex: trimmedSearch, $options: "i" },
        },
        { "shippingAddress.phone": { $regex: trimmedSearch, $options: "i" } },
        {
          "shippingAddress.alternativePhone": {
            $regex: trimmedSearch,
            $options: "i",
          },
        },
        { paymentMethod: { $regex: trimmedSearch, $options: "i" } },
        { "paymentDetails.method": { $regex: trimmedSearch, $options: "i" } },
        {
          "paymentDetails.transactionId": {
            $regex: trimmedSearch,
            $options: "i",
          },
        },
        {
          "paymentDetails.gatewayPaymentId": {
            $regex: trimmedSearch,
            $options: "i",
          },
        },
        { "paymentDetails.sentFrom": { $regex: trimmedSearch, $options: "i" } },
        { "paymentDetails.sentTo": { $regex: trimmedSearch, $options: "i" } },
        { source: { $regex: trimmedSearch, $options: "i" } },
      ];

      if (mongoose.Types.ObjectId.isValid(trimmedSearch)) {
        searchFilters.push({ _id: new mongoose.Types.ObjectId(trimmedSearch) });
      }

      query.$or = searchFilters;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);

    // Get orders with user and product population
    const orders = await Order.find(query)
      .populate({
        path: "user",
        select: "name email phone",
      })
      .populate({
        path: "items.product",
        select: "title images price dimensions deliveryMinDays deliveryMaxDays",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Format response with payment method and transaction ID
    const formattedOrders = orders.map((order) => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      shippingMeta: {
        ...(order.shippingMeta && typeof order.shippingMeta === "object"
          ? order.shippingMeta
          : {}),
        ...getOrderEstimatedDeliveryWindow(order),
      },
      customer: order.user
        ? {
            name: `${order.shippingAddress?.firstName || ""} ${order.shippingAddress?.lastName || ""}`.trim(),
            email: order.shippingAddress?.email,
            phone: order.shippingAddress?.phone,
            accountType: "Registered",
          }
        : {
            name: `${order.shippingAddress?.firstName || ""} ${order.shippingAddress?.lastName || ""}`.trim(),
            email: order.shippingAddress?.email,
            phone: order.shippingAddress?.phone,
            accountType: "Guest",
          },
      items: order.items.map((item) => ({
        product: item.product?.title || "Product not found",
        quantity: item.quantity,
        price: item.price,
        variationLabel: item.variationLabel || "",
        selectedVariants: item.selectedVariants || [],
        sku: item.sku || "",
        color: item.color || "",
        dimensions: item.dimensions || "",
        total: item.quantity * item.price,
      })),
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      discount: order.discount,
      couponCode: order.couponCode || "",
      total: order.total,
      orderStatus: order.orderStatus,
      paymentStatus: resolveEffectivePaymentStatus(order),
      paymentMethod: order.paymentMethod,
      transactionId: order.paymentDetails?.transactionId || "N/A",
      orderType: resolveOrderType(order),
      source: order.source || "shop",
      shippingAddress: order.shippingAddress,
      paymentDetails: order.paymentDetails,
      courier: getOrderCourierMeta(order),
      adminNotes: order.adminNotes || "",
      statusTimeline: getOrderStatusTimeline(order),
      cancellation: getOrderCancellationMeta(order, cancellationSettings),
      cancellationRequest: order.cancellationRequest || {
        status: "none",
        reason: "",
        requestSource: "",
        requestedAt: null,
        requestedBy: null,
        resolutionNote: "",
        resolvedAt: null,
      },
    }));

    res.json({
      success: true,
      orders: formattedOrders,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalOrders / limitNum),
        totalOrders,
        hasNextPage: pageNum * limitNum < totalOrders,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching orders",
    });
  }
};

exports.getAdminProductReports = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const fromDate = req.query.from ? new Date(req.query.from) : null;
    const toDate = req.query.to ? new Date(req.query.to) : null;

    const match = {
      orderStatus: { $nin: ["cancelled", "returned"] },
    };

    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      match.createdAt = {
        ...(match.createdAt || {}),
        $gte: fromDate,
      };
    }

    if (toDate && !Number.isNaN(toDate.getTime())) {
      match.createdAt = {
        ...(match.createdAt || {}),
        $lte: toDate,
      };
    }

    const reports = await Order.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          quantitySold: { $sum: "$items.quantity" },
          grossRevenue: {
            $sum: { $multiply: ["$items.quantity", "$items.price"] },
          },
          orders: { $addToSet: "$_id" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      {
        $unwind: {
          path: "$product",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          title: { $ifNull: ["$product.title", "Product Removed"] },
          quantitySold: 1,
          grossRevenue: 1,
          orderCount: { $size: "$orders" },
        },
      },
      { $sort: { grossRevenue: -1 } },
      { $limit: 200 },
    ]);

    const normalizedReports = reports.map((row) => ({
      ...row,
      quantitySold: Number(row.quantitySold || 0),
      grossRevenue: roundMoney(Number(row.grossRevenue || 0)),
      orderCount: Number(row.orderCount || 0),
    }));

    const summary = normalizedReports.reduce(
      (acc, row) => {
        acc.totalProducts += 1;
        acc.totalQuantitySold += row.quantitySold;
        acc.totalRevenue += row.grossRevenue;
        return acc;
      },
      {
        totalProducts: 0,
        totalQuantitySold: 0,
        totalRevenue: 0,
      },
    );

    summary.totalRevenue = roundMoney(summary.totalRevenue);

    res.json({
      success: true,
      summary,
      reports: normalizedReports,
    });
  } catch (error) {
    console.error("Get admin product reports error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching product reports",
    });
  }
};

exports.trackOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const cancellationSettings = await getCancellationSettings();

    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: "Order number is required",
      });
    }

    const order = await Order.findOne({ orderNumber })
      .populate({
        path: "items.product",
        select:
          "title images price category dimensions deliveryMinDays deliveryMaxDays",
      })
      .populate({
        path: "user",
        select: "name email",
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const trackingInfo = await buildTrackedOrderResponse(
      order,
      cancellationSettings,
    );

    res.json({
      success: true,
      order: trackingInfo,
    });
  } catch (error) {
    console.error("Track order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while tracking order",
    });
  }
};

// Search orders for navbar suggestions
exports.searchOrders = async (req, res) => {
  try {
    const query = String(req.query?.query || "").trim();

    if (!query || query.length < 3) {
      return res.json({
        success: true,
        suggestions: [],
      });
    }

    const orders = await Order.find({
      orderNumber: { $regex: query, $options: "i" },
    })
      .select("orderNumber shippingAddress items orderStatus createdAt")
      .populate({
        path: "items.product",
        select: "title",
      })
      .limit(10);

    const suggestions = orders.map((order) => ({
      type: "order",
      _id: order._id,
      orderNumber: order.orderNumber,
      customerName:
        `${order.shippingAddress?.firstName || ""} ${order.shippingAddress?.lastName || ""}`.trim(),
      productName: order.items[0]?.product?.title || "Product",
      status: order.orderStatus,
      date: order.createdAt,
    }));

    res.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error("Search orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while searching orders",
    });
  }
};
// Update order status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const cancellationSettings = await getCancellationSettings();
    const requestedStatus = normalizeOrderStatus(status);
    const noteText = String(notes || "").trim();

    if (!requestedStatus) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    if (!ORDER_STATUS_FLOW.includes(requestedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    // Check admin access
    if (req.user.role !== "admin" && req.user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const order = await Order.findById(id)
      .populate({
        path: "items.product",
        select: "title images price dimensions deliveryMinDays deliveryMaxDays",
      })
      .populate({
        path: "user",
        select: "email name",
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Store old status for logging
    const oldStatus = normalizeOrderStatus(order.orderStatus);

    if (!canTransitionOrderStatus(oldStatus, requestedStatus)) {
      const nextOptions = Array.from(ORDER_STATUS_TRANSITIONS[oldStatus] || []);
      return res.status(400).json({
        success: false,
        message:
          nextOptions.length > 0
            ? `Invalid transition from ${oldStatus} to ${requestedStatus}. Allowed: ${nextOptions.join(", ")}`
            : `Order status ${oldStatus} is terminal and cannot be changed`,
      });
    }

    if (requestedStatus === "cancelled" && oldStatus !== "cancelled") {
      const hadPendingCancellationRequest =
        String(order?.cancellationRequest?.status || "")
          .trim()
          .toLowerCase() === "pending";
      if (oldStatus !== "pending" && !hadPendingCancellationRequest) {
        return res.status(400).json({
          success: false,
          message:
            "Direct cancellation is only available while the order is pending",
        });
      }

      if (noteText) {
        order.adminNotes = noteText;
      }

      await finalizeOrderCancellation(order, {
        resolutionNote: noteText || "Order cancelled by admin",
        markRequestApproved: order.cancellationRequest?.status === "pending",
        actorUser: req.user,
      });

      await Promise.allSettled([
        notifyOrderStatusUpdated(order, oldStatus, "cancelled"),
        notifyCustomerAboutCancellationUpdate(
          order,
          hadPendingCancellationRequest ? "approved" : "cancelled",
          noteText ||
            (hadPendingCancellationRequest
              ? "Admin approved the cancellation request."
              : "Admin cancelled the order."),
        ),
      ]);

      const decoratedOrder = decorateOrderForClient(
        order,
        cancellationSettings,
      );

      return res.json({
        success: true,
        message:
          order.cancellationRequest?.status === "approved"
            ? "Cancellation request approved and order cancelled"
            : "Order cancelled successfully",
        order: {
          _id: decoratedOrder._id,
          orderNumber: decoratedOrder.orderNumber,
          status: decoratedOrder.orderStatus,
          orderStatus: decoratedOrder.orderStatus,
          paymentStatus: decoratedOrder.paymentStatus,
          courier: getOrderCourierMeta(decoratedOrder),
          customerEmail: decoratedOrder.shippingAddress?.email,
          updatedAt: new Date(),
          statusTimeline: getOrderStatusTimeline(decoratedOrder),
          adminNotes: decoratedOrder.adminNotes || "",
          cancellation: decoratedOrder.cancellation,
          cancellationRequest: decoratedOrder.cancellationRequest,
        },
      });
    }

    // Update order
    order.orderStatus = requestedStatus;

    if (requestedStatus === "shipped") {
      const courier = getOrderCourierMeta(order);
      if (!courier.consignmentId) {
        const fallbackConsignmentId = generateFallbackConsignmentId(order);
        setOrderCourierMeta(order, {
          providerName: courier.providerName || "Manual Courier",
          consignmentId: fallbackConsignmentId,
          trackingNumber: courier.trackingNumber || fallbackConsignmentId,
          status: courier.status || "shipped",
          generatedBy: courier.generatedBy || "local",
          syncedFromApi: Boolean(courier.syncedFromApi),
          note: "Consignment auto-generated after shipping status update",
        });
      }
    }

    syncStoredPaymentStatusForLifecycle(order, requestedStatus);

    if (
      oldStatus !== requestedStatus &&
      ["returned"].includes(requestedStatus)
    ) {
      const inventoryState = getOrderInventoryState(order);
      if (inventoryState.deducted && !inventoryState.restored) {
        const inventoryRestore = await applyOrderInventoryAdjustment({
          items: order.items,
          direction: 1,
        });

        if (!inventoryRestore.success) {
          return res.status(400).json({
            success: false,
            message:
              inventoryRestore.message ||
              "Failed to restore stock for cancelled/returned order",
          });
        }

        setOrderInventoryState(order, {
          restored: true,
          restoredAt: new Date(),
          restoredReason: requestedStatus,
        });
      }
    }

    if (noteText) {
      order.adminNotes = noteText;
    }

    if (oldStatus !== requestedStatus || noteText) {
      appendOrderStatusTimelineEntry({
        order,
        status: requestedStatus,
        note:
          noteText ||
          (oldStatus === requestedStatus
            ? `Status note updated at ${new Date().toLocaleString()}`
            : `Status changed from ${oldStatus} to ${requestedStatus}`),
        user: req.user,
      });
    }

    await order.save();

    // Send email notification
    if (oldStatus !== requestedStatus) {
      try {
        await sendOrderStatusEmail(order, requestedStatus, oldStatus);
      } catch (emailError) {
        console.error("Failed to send status email:", emailError);
        // Don't fail the request if email fails
      }

      await Promise.allSettled([
        notifyOrderStatusUpdated(order, oldStatus, requestedStatus),
      ]);
    }

    const decoratedOrder = decorateOrderForClient(order, cancellationSettings);

    res.json({
      success: true,
      message: `Order status updated to ${requestedStatus}`,
      order: {
        _id: decoratedOrder._id,
        orderNumber: decoratedOrder.orderNumber,
        status: decoratedOrder.orderStatus,
        orderStatus: decoratedOrder.orderStatus,
        paymentStatus: decoratedOrder.paymentStatus,
        courier: getOrderCourierMeta(decoratedOrder),
        customerEmail: decoratedOrder.shippingAddress?.email,
        updatedAt: new Date(),
        statusTimeline: getOrderStatusTimeline(decoratedOrder),
        adminNotes: decoratedOrder.adminNotes || "",
        cancellation: decoratedOrder.cancellation,
        cancellationRequest: decoratedOrder.cancellationRequest,
      },
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating order status",
    });
  }
};

exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const rawRequestedPaymentStatus = String(req.body?.paymentStatus || "")
      .trim()
      .toLowerCase();
    const requestedPaymentStatus = normalizeStoredPaymentStatus(
      rawRequestedPaymentStatus,
    );
    const noteText = String(req.body?.notes || "").trim();
    const cancellationSettings = await getCancellationSettings();

    if (!req.user || !isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    if (
      !["pending", "completed", "failed"].includes(rawRequestedPaymentStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }

    const order = await Order.findById(id)
      .populate({
        path: "items.product",
        select: "title images price dimensions deliveryMinDays deliveryMaxDays",
      })
      .populate({
        path: "user",
        select: "email name",
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (isCashOnDeliveryOrder(order)) {
      return res.status(400).json({
        success: false,
        message:
          "Cash on Delivery payment status is managed automatically from the order status",
      });
    }

    const orderStatus = normalizeOrderStatus(order.orderStatus || "pending");
    if (
      ["cancelled", "returned"].includes(orderStatus) &&
      requestedPaymentStatus === "completed"
    ) {
      return res.status(400).json({
        success: false,
        message: "Cancelled or returned orders cannot be marked as paid",
      });
    }

    if (
      requestedPaymentStatus === "completed" &&
      isManualPaymentOrder(order) &&
      !String(order?.paymentDetails?.transactionId || "").trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Manual payments need a transaction ID before they can be marked as paid",
      });
    }

    const previousPaymentStatus = normalizeStoredPaymentStatus(
      order.paymentStatus,
    );
    order.paymentStatus = requestedPaymentStatus;
    if (noteText) {
      order.adminNotes = noteText;
    }

    appendOrderStatusTimelineEntry({
      order,
      status: orderStatus || "pending",
      note: noteText
        ? `Payment status updated to ${requestedPaymentStatus}. ${noteText}`
        : `Payment status updated to ${requestedPaymentStatus}`,
      user: req.user,
    });

    await order.save();

    if (previousPaymentStatus !== requestedPaymentStatus) {
      await Promise.allSettled([
        notifyCustomerAboutPaymentStatusUpdated(order, requestedPaymentStatus),
      ]);
    }

    const decoratedOrder = decorateOrderForClient(order, cancellationSettings);

    return res.json({
      success: true,
      message: `Payment status updated to ${requestedPaymentStatus}`,
      order: {
        _id: decoratedOrder._id,
        orderNumber: decoratedOrder.orderNumber,
        status: decoratedOrder.orderStatus,
        orderStatus: decoratedOrder.orderStatus,
        paymentStatus: decoratedOrder.paymentStatus,
        courier: getOrderCourierMeta(decoratedOrder),
        customerEmail: decoratedOrder.shippingAddress?.email,
        updatedAt: new Date(),
        statusTimeline: getOrderStatusTimeline(decoratedOrder),
        adminNotes: decoratedOrder.adminNotes || "",
        cancellation: decoratedOrder.cancellation,
        cancellationRequest: decoratedOrder.cancellationRequest,
      },
    });
  } catch (error) {
    console.error("Update payment status error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating payment status",
    });
  }
};

exports.handleGatewayPaymentCallback = async (req, res) => {
  let order = null;
  let paymentMethod = null;

  try {
    const provider = safeString(req.params?.provider).toLowerCase();
    if (!["sslcommerz", "bkash", "nagad"].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported payment gateway callback provider",
      });
    }

    const callbackData = {
      ...(req.query || {}),
      ...(req.body && typeof req.body === "object" ? req.body : {}),
    };

    const directOrderId = safeString(
      callbackData.orderId ||
        callbackData.order_id ||
        callbackData.merchantInvoiceNumber ||
        callbackData.value_a,
    );
    const gatewayPaymentId = safeString(
      callbackData.paymentID ||
        callbackData.paymentId ||
        callbackData.payment_id ||
        callbackData.payment_ref_id ||
        callbackData.paymentRefId,
    );
    const gatewayOrderId = safeString(
      callbackData.gatewayOrderId || callbackData.order_id,
    );

    if (mongoose.Types.ObjectId.isValid(directOrderId)) {
      order = await Order.findById(directOrderId)
        .populate({
          path: "items.product",
          select:
            "title images price dimensions deliveryMinDays deliveryMaxDays",
        })
        .populate({
          path: "user",
          select: "email name",
        });
    }

    if (
      !order &&
      directOrderId &&
      !mongoose.Types.ObjectId.isValid(directOrderId)
    ) {
      order = await Order.findOne({ orderNumber: directOrderId })
        .populate({
          path: "items.product",
          select:
            "title images price dimensions deliveryMinDays deliveryMaxDays",
        })
        .populate({
          path: "user",
          select: "email name",
        });
    }

    if (!order) {
      const callbackOrderNumber = safeString(
        callbackData.tran_id || callbackData.value_b,
      );
      if (callbackOrderNumber) {
        order = await Order.findOne({ orderNumber: callbackOrderNumber })
          .populate({
            path: "items.product",
            select:
              "title images price dimensions deliveryMinDays deliveryMaxDays",
          })
          .populate({
            path: "user",
            select: "email name",
          });
      }
    }

    if (!order && gatewayPaymentId) {
      order = await Order.findOne({
        "paymentDetails.gatewayPaymentId": gatewayPaymentId,
      })
        .populate({
          path: "items.product",
          select:
            "title images price dimensions deliveryMinDays deliveryMaxDays",
        })
        .populate({
          path: "user",
          select: "email name",
        });
    }

    if (!order && gatewayOrderId) {
      order = await Order.findOne({
        "paymentDetails.meta.gatewayOrderId": gatewayOrderId,
      })
        .populate({
          path: "items.product",
          select:
            "title images price dimensions deliveryMinDays deliveryMaxDays",
        })
        .populate({
          path: "user",
          select: "email name",
        });
    }

    if (
      !order &&
      provider === "nagad" &&
      gatewayOrderId &&
      gatewayOrderId.length > 4
    ) {
      const inferredOrderNumber = gatewayOrderId.slice(0, -4);
      order = await Order.findOne({ orderNumber: inferredOrderNumber })
        .populate({
          path: "items.product",
          select:
            "title images price dimensions deliveryMinDays deliveryMaxDays",
        })
        .populate({
          path: "user",
          select: "email name",
        });
    }

    if (!order) {
      return res.status(404).send("Order not found for payment callback");
    }

    paymentMethod = await findPaymentMethodForOrder(order, provider);
    if (!paymentMethod) {
      return res.status(400).send("Payment method configuration not found");
    }

    const verification = await verifyGatewayPayment({
      provider,
      paymentMethod,
      callbackData,
      requestIp:
        req.headers["x-forwarded-for"] || req.ip || req.socket?.remoteAddress,
    });

    const previousPaymentStatus = normalizeStoredPaymentStatus(
      order.paymentStatus,
    );

    applyGatewayVerificationResultToOrder({
      order,
      verification,
      provider,
      paymentSelection: paymentMethod,
      notePrefix: verification.success
        ? "Payment confirmed"
        : verification.redirectState === "cancel"
          ? "Gateway payment cancelled"
          : "Gateway payment failed",
    });

    await order.save();

    if (previousPaymentStatus !== order.paymentStatus) {
      await Promise.allSettled([
        notifyCustomerAboutPaymentStatusUpdated(order, order.paymentStatus),
      ]);
    }

    if (verification.success && order?.user) {
      await Cart.findOneAndUpdate(
        { user: order.user._id || order.user },
        { items: [] },
      ).catch(() => null);
    }

    const redirectUrl = buildGatewayRedirectUrl({
      order,
      paymentMethod,
      provider,
      status: verification.redirectState || "failed",
    });

    return res.redirect(302, redirectUrl);
  } catch (error) {
    console.error("Handle gateway payment callback error:", error);

    if (order && paymentMethod) {
      const redirectUrl = buildGatewayRedirectUrl({
        order,
        paymentMethod,
        provider: safeString(req.params?.provider).toLowerCase(),
        status: "failed",
      });
      return res.redirect(302, redirectUrl);
    }

    return res.status(500).send("Payment callback processing failed");
  }
};

exports.generateCourierConsignment = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const order = await Order.findById(req.params.id).populate({
      path: "items.product",
      select: "title",
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const currentOrderStatus = normalizeOrderStatus(
      order.orderStatus || "pending",
    );
    if (["cancelled", "returned"].includes(currentOrderStatus)) {
      return res.status(400).json({
        success: false,
        message:
          "Consignment cannot be created for cancelled or returned orders",
      });
    }

    const collection = resolveCourierCollectionDetails(order);
    if (
      !collection.isCashOnDelivery &&
      collection.paymentStatus !== "completed"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This prepaid order must be marked as paid before a courier consignment can be created",
      });
    }

    const requestedCourierKey = String(
      req.body?.courierProviderKey ||
        req.body?.courierProvider ||
        req.body?.providerKey ||
        "",
    )
      .trim()
      .toLowerCase();
    const courierConfig = requestedCourierKey
      ? await getCourierSettingsByKey(requestedCourierKey)
      : await getPrimaryAdminCourierSettings();

    if (
      !courierConfig ||
      !courierConfig.enabled ||
      !courierConfig.apiBaseUrl ||
      !courierConfig.consignmentPath
    ) {
      return res.status(400).json({
        success: false,
        message: requestedCourierKey
          ? "Selected courier provider is not active or not configured"
          : "Courier API is not configured",
      });
    }

    const currentCourier = getOrderCourierMeta(order);
    const previousStatus = normalizeOrderStatus(order.orderStatus || "pending");
    const cancellationSettings = await getCancellationSettings();
    const payload = buildCourierConsignmentPayload(order, courierConfig);

    let generatedCourier = null;

    try {
      const endpoint = joinBaseUrlWithPath(
        courierConfig.apiBaseUrl,
        courierConfig.consignmentPath,
      );

      const response = await axios.post(endpoint, payload, {
        timeout: courierConfig.timeoutMs,
        headers: {
          "Content-Type": "application/json",
          ...buildCourierHeaders(courierConfig),
        },
      });

      const parsed = parseConsignmentResponse(response.data || {});
      const generatedConsignmentId = String(
        parsed.consignmentId || parsed.trackingNumber || "",
      ).trim();

      if (!generatedConsignmentId) {
        return res.status(502).json({
          success: false,
          message: "Courier API did not return a consignment ID",
        });
      }

      generatedCourier = setOrderCourierMeta(order, {
        providerKey: courierConfig.courierKey || requestedCourierKey || "",
        providerName:
          courierConfig.providerName ||
          currentCourier.providerName ||
          "Courier",
        consignmentId: generatedConsignmentId,
        trackingNumber: String(
          parsed.trackingNumber || generatedConsignmentId,
        ).trim(),
        trackingUrl: parsed.trackingUrl || currentCourier.trackingUrl,
        labelUrl: parsed.labelUrl || currentCourier.labelUrl,
        status: parsed.status || currentCourier.status || "created",
        syncedFromApi: true,
        generatedBy: "api",
        note: "Consignment generated from courier API",
      });
    } catch (apiError) {
      return res.status(502).json({
        success: false,
        message: resolveCourierApiErrorMessage(apiError),
      });
    }

    if (previousStatus === "pending") {
      order.orderStatus = "confirmed";
      syncStoredPaymentStatusForLifecycle(order, "confirmed");
      appendOrderStatusTimelineEntry({
        order,
        status: "confirmed",
        note: `Courier consignment assigned: ${generatedCourier.consignmentId}`,
        user: req.user,
      });
    }

    await order.save();

    if (previousStatus === "pending") {
      await Promise.allSettled([
        notifyOrderStatusUpdated(order, previousStatus, "confirmed"),
      ]);
    }

    return res.json({
      success: true,
      message: collection.collectDeliveryChargeOnly
        ? "Courier consignment generated. Only delivery charge will be collected."
        : "Courier consignment generated",
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        status: order.orderStatus,
        paymentStatus: order.paymentStatus,
        courier: getOrderCourierMeta(order),
        courierCollection: collection,
        cancellation: getOrderCancellationMeta(order, cancellationSettings),
        cancellationRequest: order.cancellationRequest,
        statusTimeline: getOrderStatusTimeline(order),
      },
    });
  } catch (error) {
    console.error("Generate courier consignment error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while generating courier consignment",
    });
  }
};

exports.syncCourierTracking = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const currentCourier = getOrderCourierMeta(order);
    const courierSelectionKey = String(
      currentCourier.providerKey || currentCourier.providerName || "",
    )
      .trim()
      .toLowerCase();
    const courierConfig = courierSelectionKey
      ? await getCourierSettingsByKey(courierSelectionKey)
      : await getPrimaryAdminCourierSettings();

    if (!courierConfig || !courierConfig.enabled || !courierConfig.apiBaseUrl) {
      return res.status(400).json({
        success: false,
        message: "Courier API is not configured",
      });
    }

    const referenceId =
      currentCourier.consignmentId || currentCourier.trackingNumber || "";

    if (!referenceId) {
      return res.status(400).json({
        success: false,
        message: "Consignment ID or tracking number is missing",
      });
    }

    const generatedBy = String(currentCourier.generatedBy || "")
      .trim()
      .toLowerCase();

    if (generatedBy !== "api") {
      return res.status(400).json({
        success: false,
        message:
          "Tracking sync is only available for API-generated consignments. Generate consignment again.",
      });
    }

    let trackingUrl = joinBaseUrlWithPath(
      courierConfig.apiBaseUrl,
      courierConfig.trackingPath,
    );
    const params = {};

    if (trackingUrl.includes("{id}")) {
      trackingUrl = trackingUrl.replace(
        "{id}",
        encodeURIComponent(referenceId),
      );
    } else if (trackingUrl.includes(":id")) {
      trackingUrl = trackingUrl.replace(":id", encodeURIComponent(referenceId));
    } else {
      params.consignmentId = referenceId;
      params.orderNumber = order.orderNumber;
    }

    const response = await axios.get(trackingUrl, {
      timeout: courierConfig.timeoutMs,
      params,
      headers: {
        ...buildCourierHeaders(courierConfig),
      },
    });

    const parsed = parseTrackingResponse(response.data || {});
    const nextOrderStatus = mapCourierStatusToOrderStatus(parsed.status);
    const previousStatus = normalizeOrderStatus(order.orderStatus);

    const nextCourier = setOrderCourierMeta(order, {
      providerKey: currentCourier.providerKey || courierConfig.courierKey || "",
      providerName:
        currentCourier.providerName || courierConfig.providerName || "Courier",
      status: parsed.status || currentCourier.status || "",
      trackingUrl: parsed.trackingUrl || currentCourier.trackingUrl || "",
      events: parsed.events.length
        ? parsed.events
        : currentCourier.events || [],
      syncedFromApi: true,
      generatedBy: currentCourier.generatedBy || "api",
      lastSyncedAt: new Date(),
      note: "Tracking synced from courier API",
    });

    if (
      nextOrderStatus &&
      nextOrderStatus !== previousStatus &&
      canTransitionOrderStatus(previousStatus, nextOrderStatus)
    ) {
      order.orderStatus = nextOrderStatus;

      syncStoredPaymentStatusForLifecycle(order, nextOrderStatus);

      appendOrderStatusTimelineEntry({
        order,
        status: nextOrderStatus,
        note: `Status synced from courier tracking (${parsed.status || nextOrderStatus})`,
        user: req.user,
      });
    }

    await order.save();

    return res.json({
      success: true,
      message: "Courier tracking synced",
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        courier: nextCourier,
        statusTimeline: getOrderStatusTimeline(order),
      },
    });
  } catch (error) {
    console.error("Sync courier tracking error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while syncing courier tracking",
    });
  }
};

exports.getCourierLabel = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const order = await Order.findById(req.params.id).populate({
      path: "items.product",
      select: "title",
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const courier = getOrderCourierMeta(order);
    const shipping = order.shippingAddress || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const customerName = `${String(shipping?.firstName || "").trim()} ${String(
      shipping?.lastName || "",
    ).trim()}`.trim();

    const label = {
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      courierProvider: courier.providerName || "Courier",
      consignmentId: courier.consignmentId || "",
      trackingNumber: courier.trackingNumber || "",
      trackingUrl: courier.trackingUrl || "",
      labelUrl: courier.labelUrl || "",
      customer: {
        name: customerName,
        phone: String(shipping?.phone || "").trim(),
        address: String(shipping?.address || "").trim(),
        city: String(shipping?.city || "").trim(),
        district: String(shipping?.district || "").trim(),
        postalCode: String(shipping?.postalCode || "").trim(),
        country: String(shipping?.country || "Bangladesh").trim(),
      },
      amountToCollect: roundMoney(order.total || 0),
      items: items.map((item) => ({
        title: String(item?.product?.title || "Product").trim(),
        quantity: Number(item?.quantity || 0),
      })),
    };

    return res.json({
      success: true,
      message: "Courier label data generated",
      label,
    });
  } catch (error) {
    console.error("Get courier label error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while preparing courier label",
    });
  }
};

// Cancel order
exports.cancelOrder = async (req, res) => {
  try {
    const cancellationSettings = await getCancellationSettings();
    const order = await Order.findById(req.params.id)
      .populate({
        path: "items.product",
        select: "title images price dimensions deliveryMinDays deliveryMaxDays",
      })
      .populate({
        path: "user",
        select: "email name",
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if user owns this order
    if (
      !order.user ||
      String(order.user?._id || order.user) !==
        String(req.user._id || req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this order",
      });
    }

    const cancellation = getOrderCancellationMeta(order, cancellationSettings);
    if (cancellation.actionType === "none") {
      return res.status(400).json({
        success: false,
        message:
          cancellation.disabledReason ||
          "Cancellation is not available for this order",
      });
    }

    const reason = normalizeLongText(req.body?.reason || "");

    if (cancellation.actionType === "request_cancel") {
      order.cancellationRequest = {
        status: "pending",
        reason,
        requestSource: "customer",
        requestedAt: new Date(),
        requestedBy: req.user?._id || req.user?.id || null,
        resolutionNote: "",
        resolvedAt: null,
      };
      appendOrderStatusTimelineEntry({
        order,
        status: normalizeOrderStatus(order.orderStatus || "pending"),
        note: reason
          ? `Customer requested cancellation. Reason: ${reason}`
          : "Customer requested cancellation",
        user: req.user,
      });
      await order.save();

      await Promise.allSettled([
        notifyAdminsAboutCancellationRequest(order, "customer"),
      ]);

      return res.json({
        success: true,
        mode: "requested",
        message: "Cancellation request submitted successfully",
        order: await buildTrackedOrderResponse(order, cancellationSettings),
      });
    }

    await finalizeOrderCancellation(order, {
      reason,
      requestedBy: req.user?._id || req.user?.id || null,
      requestSource: "customer",
      actorUser: req.user,
    });

    await Promise.allSettled([
      notifyAdminsAboutCancellationRequest(order, "customer", "cancelled"),
      notifyOrderStatusUpdated(order, "pending", "cancelled", {
        notifyCustomers: false,
      }),
    ]);

    res.json({
      success: true,
      message: "Order cancelled successfully",
      mode: "cancelled",
      order: decorateOrderForClient(order, cancellationSettings),
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while cancelling order",
    });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const orderStatus = normalizeOrderStatus(order.orderStatus || "pending");
    if (!["pending", "cancelled", "returned"].includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message:
          "Orders can only be deleted while pending or after they have been cancelled/returned",
      });
    }

    const inventoryState = getOrderInventoryState(order);
    let couponRestored = false;
    let inventoryRestored = false;

    try {
      const couponRestore = await restoreCouponUsageForOrderDeletion(order);
      couponRestored = Boolean(couponRestore.restored);

      if (inventoryState.deducted && !inventoryState.restored) {
        const inventoryRestore = await applyOrderInventoryAdjustment({
          items: order.items,
          direction: 1,
        });

        if (!inventoryRestore.success) {
          throw new Error(
            inventoryRestore.message ||
              "Failed to restore stock before deletion",
          );
        }

        inventoryRestored = true;
      }

      const deleteResult = await Order.deleteOne({ _id: order._id });
      if (Number(deleteResult?.deletedCount || 0) <= 0) {
        throw new Error("Failed to delete order");
      }

      return res.json({
        success: true,
        message: "Order deleted successfully",
        orderId: String(order._id),
        orderNumber: String(order.orderNumber || "").trim(),
      });
    } catch (deleteError) {
      if (inventoryRestored) {
        await applyOrderInventoryAdjustment({
          items: order.items,
          direction: -1,
        }).catch(() => null);
      }

      if (couponRestored) {
        await Coupon.updateOne(
          { code: normalizeCouponCode(order.couponCode) },
          { $inc: { usedCount: 1 } },
        ).catch(() => null);
      }

      return res.status(500).json({
        success: false,
        message: deleteError.message || "Server error while deleting order",
      });
    }
  } catch (error) {
    console.error("Delete order error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting order",
    });
  }
};

exports.cancelTrackedOrder = async (req, res) => {
  try {
    const cancellationSettings = await getCancellationSettings();
    const order = await Order.findOne({ orderNumber: req.params.orderNumber })
      .populate({
        path: "items.product",
        select: "title images price dimensions deliveryMinDays deliveryMaxDays",
      })
      .populate({
        path: "user",
        select: "email name",
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const cancellation = getOrderCancellationMeta(order, cancellationSettings);
    if (cancellation.actionType === "none") {
      return res.status(400).json({
        success: false,
        message:
          cancellation.disabledReason ||
          "Cancellation is not available for this order",
      });
    }

    const reason = normalizeLongText(req.body?.reason || "");
    const trackedCancellationRequestedBy =
      order?.user?._id || order?.user?.id || null;
    const trackedCancellationRequesterLabel = trackedCancellationRequestedBy
      ? "Customer"
      : "Guest";

    if (cancellation.actionType === "request_cancel") {
      order.cancellationRequest = {
        status: "pending",
        reason,
        requestSource: "tracking",
        requestedAt: new Date(),
        requestedBy: trackedCancellationRequestedBy,
        resolutionNote: "",
        resolvedAt: null,
      };
      appendOrderStatusTimelineEntry({
        order,
        status: normalizeOrderStatus(order.orderStatus || "pending"),
        note: reason
          ? `${trackedCancellationRequesterLabel} requested cancellation from tracking. Reason: ${reason}`
          : `${trackedCancellationRequesterLabel} requested cancellation from tracking`,
        user: trackedCancellationRequestedBy ? order.user : null,
      });
      await order.save();

      await Promise.allSettled([
        notifyAdminsAboutCancellationRequest(order, "tracking"),
      ]);

      return res.json({
        success: true,
        mode: "requested",
        message: "Cancellation request submitted successfully",
        order: decorateOrderForClient(order, cancellationSettings),
      });
    }

    await finalizeOrderCancellation(order, {
      reason,
      requestSource: "tracking",
      actorUser: trackedCancellationRequestedBy ? order.user : null,
    });

    await Promise.allSettled([
      notifyAdminsAboutCancellationRequest(order, "tracking", "cancelled"),
      notifyOrderStatusUpdated(order, "pending", "cancelled", {
        notifyCustomers: false,
      }),
    ]);

    return res.json({
      success: true,
      mode: "cancelled",
      message: "Order cancelled successfully",
      order: await buildTrackedOrderResponse(order, cancellationSettings),
    });
  } catch (error) {
    console.error("Tracked cancel order error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while cancelling order",
    });
  }
};

exports.reviewCancellationRequest = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const action = String(req.body?.action || "")
      .trim()
      .toLowerCase();
    const notes = normalizeLongText(req.body?.notes || "");

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "A valid cancellation action is required",
      });
    }

    const order = await Order.findById(req.params.id)
      .populate({
        path: "items.product",
        select: "title images price dimensions deliveryMinDays deliveryMaxDays",
      })
      .populate({
        path: "user",
        select: "email name",
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (
      String(order?.cancellationRequest?.status || "")
        .trim()
        .toLowerCase() !== "pending"
    ) {
      return res.status(400).json({
        success: false,
        message: "This order does not have a pending cancellation request",
      });
    }

    const cancellationSettings = await getCancellationSettings();

    if (action === "reject") {
      order.cancellationRequest.status = "rejected";
      order.cancellationRequest.resolutionNote = notes;
      order.cancellationRequest.resolvedAt = new Date();
      if (notes) {
        order.adminNotes = notes;
      }
      appendOrderStatusTimelineEntry({
        order,
        status: normalizeOrderStatus(order.orderStatus || "pending"),
        note: notes
          ? `Cancellation request rejected. ${notes}`
          : "Cancellation request rejected",
        user: req.user,
      });
      await order.save();

      await Promise.allSettled([
        notifyCustomerAboutCancellationUpdate(order, "rejected", notes),
      ]);

      return res.json({
        success: true,
        message: "Cancellation request rejected",
        order: decorateOrderForClient(order, cancellationSettings),
      });
    }

    if (notes) {
      order.adminNotes = notes;
    }

    await finalizeOrderCancellation(order, {
      resolutionNote: notes,
      markRequestApproved: true,
      actorUser: req.user,
    });

    await Promise.allSettled([
      notifyOrderStatusUpdated(order, "pending", "cancelled"),
      notifyCustomerAboutCancellationUpdate(order, "approved", notes),
    ]);

    return res.json({
      success: true,
      message: "Cancellation request approved and order cancelled",
      order: decorateOrderForClient(order, cancellationSettings),
    });
  } catch (error) {
    console.error("Review cancellation request error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while reviewing cancellation request",
    });
  }
};

// In cartController.js - Add guest checkout endpoint
exports.guestCheckout = async (req, res) => {
  try {
    const {
      shippingAddress,
      items,
      shippingFee = 0,
      shippingMeta = {},
      couponCode = "",
      source = "shop",
      landingPageSlug = "",
      paymentMethodId,
      paymentMethod,
      paymentDetails,
    } = req.body;

    const paymentSelection = await resolvePaymentMethodSelection({
      paymentMethodId,
      paymentMethod,
      paymentDetails,
    });

    const shippingQuote = await resolveOrderShippingQuote(shippingAddress);
    if (!shippingQuote.success) {
      return res.status(shippingQuote.status || 400).json({
        success: false,
        message: shippingQuote.message || "Unable to resolve shipping",
      });
    }

    const normalizedPaymentDetails = normalizePaymentDetails(
      paymentSelection.methodName,
      paymentDetails,
      {
        providerType: paymentSelection.channelType,
        defaultAccountNo: paymentSelection.defaultAccountNo,
      },
    );

    // Validate required fields
    if (!shippingAddress || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Shipping address and items are required",
      });
    }

    const blacklistedByContact =
      await findBlacklistedCustomerByShippingAddress(shippingAddress);
    if (blacklistedByContact) {
      return res.status(403).json({
        success: false,
        message: "This customer is blacklisted and cannot place orders",
      });
    }

    // Validate payment method
    if (!normalizedPaymentDetails.method) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    if (
      paymentSelection.requiresTransactionProof &&
      !String(normalizedPaymentDetails.transactionId || "").trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required for this payment method",
      });
    }

    const builtItems = await buildOrderItems(items);
    if (!builtItems.success) {
      return res.status(builtItems.status).json({
        success: false,
        message: builtItems.message,
      });
    }

    const pricing = await calculateOrderPricing({
      subtotal: builtItems.subtotal,
      shippingFee: shippingQuote.shippingFee,
      couponCode: normalizeCouponCode(couponCode),
      items: builtItems.orderItems,
    });

    if (!pricing.success) {
      return res.status(pricing.status).json({
        success: false,
        message: pricing.message,
      });
    }

    const orderNumber = generateOrderNumber();
    const attribution = await resolveLandingAttribution({
      source,
      landingPageSlug,
    });
    const mergedShippingMeta = mergeEstimatedDeliveryIntoShippingMeta(
      shippingQuote.shippingMeta,
      builtItems,
    );

    // Create order for guest
    const order = await Order.create({
      orderNumber,
      items: builtItems.orderItems,
      shippingAddress,
      subtotal: pricing.subtotal,
      shippingFee: pricing.shippingFee,
      shippingMeta: mergedShippingMeta,
      discount: pricing.discount,
      couponCode: pricing.couponCode,
      total: pricing.total,
      paymentMethod:
        paymentSelection.methodName || normalizedPaymentDetails.method,
      paymentDetails: normalizedPaymentDetails,
      paymentStatus: "pending",
      orderStatus: "pending",
      statusTimeline: [
        buildOrderStatusTimelineEntry({
          status: "pending",
          note: "Order created from guest checkout",
          user: null,
        }),
      ],
      source: attribution.source,
      landingPage: attribution.landingPage,
      landingPageSlug: attribution.landingPageSlug,
    });

    const inventoryDeduction = await applyOrderInventoryAdjustment({
      items: order.items,
      direction: -1,
    });
    if (!inventoryDeduction.success) {
      await Order.findByIdAndDelete(order._id).catch(() => null);
      return res.status(400).json({
        success: false,
        message:
          inventoryDeduction.message || "Failed to reserve product stock",
      });
    }

    if (pricing.couponDoc) {
      try {
        await incrementCouponUsage(pricing.couponDoc);
      } catch (couponError) {
        if (inventoryDeduction.adjustments?.length) {
          await rollbackInventoryAdjustments(inventoryDeduction.adjustments);
        }
        await Order.findByIdAndDelete(order._id).catch(() => null);

        return res.status(400).json({
          success: false,
          message: couponError.message || "Coupon is no longer valid",
        });
      }
    }

    setOrderInventoryState(order, {
      deducted:
        Array.isArray(inventoryDeduction.adjustments) &&
        inventoryDeduction.adjustments.length > 0,
      deductedAt: new Date(),
      restored: false,
      restoredAt: null,
      restoredReason: "",
    });
    await order.save();

    let paymentRedirectUrl = "";
    let gatewayInitError = "";
    const isGatewayCheckout =
      paymentSelection.methodDoc &&
      CHECKOUT_GATEWAY_CHANNELS.has(paymentSelection.channelType);

    if (isGatewayCheckout) {
      try {
        const gatewaySession = await initiateGatewayPayment({
          order,
          paymentMethod: paymentSelection.methodDoc,
          customer: shippingAddress,
          requestBaseUrl: getRequestBaseUrl(req),
          requestIp:
            req.headers["x-forwarded-for"] ||
            req.ip ||
            req.socket?.remoteAddress,
        });

        order.paymentDetails = {
          ...(order.paymentDetails?.toObject
            ? order.paymentDetails.toObject()
            : order.paymentDetails || {}),
          ...normalizedPaymentDetails,
          providerType:
            gatewaySession?.providerType || paymentSelection.channelType,
          gatewayPaymentId: String(gatewaySession?.gatewayPaymentId || ""),
          paymentUrl: String(gatewaySession?.paymentUrl || ""),
          meta: buildOrderPaymentMeta({
            paymentSelection,
            paymentDetails: normalizedPaymentDetails,
            gatewayMeta: gatewaySession?.meta,
          }),
        };
        await order.save();

        paymentRedirectUrl = String(gatewaySession?.paymentUrl || "");
      } catch (gatewayError) {
        console.error(
          "Guest checkout gateway initialization error:",
          gatewayError,
        );
        await rollbackTemporaryGatewayOrder({
          order,
          inventoryDeduction,
        });
        gatewayInitError =
          gatewayError?.message || "Failed to initialize payment gateway";

        return res.status(400).json({
          success: false,
          message: gatewayInitError,
          paymentProvider: paymentSelection.channelType || "manual",
        });
      }
    }

    await createRecurringSubscriptionsFromOrder(order).catch(() => null);

    const populatedOrder = await Order.findById(order._id)
      .populate({
        path: "items.product",
        select: "title images price dimensions deliveryMinDays deliveryMaxDays",
      })
      .lean();

    if (populatedOrder?.items?.length) {
      const products = populatedOrder.items
        .map((item) => item.product)
        .filter(Boolean);
      await attachImageDataToProducts(products);
    }

    sendOrderPlacedEmail(populatedOrder).catch((emailError) => {
      console.error("Order confirmation email error:", emailError);
    });

    await Promise.allSettled([notifyAdminsAboutOrderCreated(populatedOrder)]);

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: populatedOrder,
      paymentRedirectUrl: paymentRedirectUrl || null,
      paymentProvider: paymentSelection.channelType || "manual",
      gatewayInitError: isGatewayCheckout ? null : gatewayInitError || null,
    });
  } catch (error) {
    console.error("Guest checkout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating order",
      error: error.message,
    });
  }
};

exports.getAdminCustomerInsights = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const {
      email = "",
      phone = "",
      alternativePhone = "",
      customerUserId = "",
    } = req.body || {};

    const hasAnyInput = Boolean(
      String(email || "").trim() ||
      String(phone || "").trim() ||
      String(alternativePhone || "").trim() ||
      String(customerUserId || "").trim(),
    );

    if (!hasAnyInput) {
      return res.status(400).json({
        success: false,
        message: "Customer phone, email, or user id is required",
      });
    }

    const insights = await getCustomerOrderInsights({
      email,
      phone,
      alternativePhone,
      userId: customerUserId,
    });

    return res.json({
      success: true,
      insights,
      blocked: Boolean(insights.isBlacklisted),
    });
  } catch (error) {
    console.error("Get admin customer insights error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching customer insights",
    });
  }
};

exports.createAdminOrder = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const {
      shippingAddress = {},
      items = [],
      shippingMeta = {},
      couponCode = "",
      landingPageSlug = "",
      paymentMethod,
      paymentDetails,
      customerUserId = "",
      adminNotes = "",
      courierProvider = "",
      courierTrackingNumber = "",
      courierConsignmentId = "",
    } = req.body || {};

    const normalizedShippingAddress = {
      firstName: String(shippingAddress?.firstName || "").trim(),
      lastName: String(shippingAddress?.lastName || "").trim(),
      email: String(shippingAddress?.email || "")
        .trim()
        .toLowerCase(),
      phone: String(shippingAddress?.phone || "").trim(),
      alternativePhone: String(
        shippingAddress?.alternativePhone || shippingAddress?.altPhone || "",
      ).trim(),
      address: String(shippingAddress?.address || "").trim(),
      city: String(shippingAddress?.city || "").trim(),
      subCity: String(shippingAddress?.subCity || "").trim(),
      district: String(
        shippingAddress?.district || shippingAddress?.subCity || "",
      ).trim(),
      postalCode: String(shippingAddress?.postalCode || "").trim(),
      country: String(shippingAddress?.country || "Bangladesh").trim(),
      notes: String(shippingAddress?.notes || "").trim(),
    };

    const isDeliveryOrder = hasManualDeliveryAddress(normalizedShippingAddress);

    if (
      !normalizedShippingAddress.firstName ||
      !normalizedShippingAddress.lastName ||
      !normalizedShippingAddress.email ||
      !normalizedShippingAddress.phone
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Customer name, email, and phone are required",
      });
    }

    if (
      isDeliveryOrder &&
      (!normalizedShippingAddress.address ||
        !normalizedShippingAddress.city ||
        !normalizedShippingAddress.district)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Address, city, and district are required for delivery orders",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product is required to create an order",
      });
    }

    const blacklistedByContact = await findBlacklistedCustomerByShippingAddress(
      normalizedShippingAddress,
    );
    if (blacklistedByContact) {
      return res.status(403).json({
        success: false,
        message: "This customer is blacklisted and cannot place orders",
      });
    }

    let linkedCustomerId = "";
    const normalizedCustomerUserId = String(customerUserId || "").trim();
    if (mongoose.Types.ObjectId.isValid(normalizedCustomerUserId)) {
      const linkedUser = await User.findById(normalizedCustomerUserId)
        .select("_id userType isBlacklisted blacklistReason")
        .lean();
      if (linkedUser) {
        if (String(linkedUser.userType || "").toLowerCase() === "admin") {
          return res.status(400).json({
            success: false,
            message: "Admin account cannot be assigned as order customer",
          });
        }
        if (linkedUser.isBlacklisted) {
          return res.status(403).json({
            success: false,
            message: "Selected customer is blacklisted",
          });
        }
        linkedCustomerId = String(linkedUser._id);
      }
    }

    const customerInsights = await getCustomerOrderInsights({
      email: normalizedShippingAddress.email,
      phone: normalizedShippingAddress.phone,
      alternativePhone: normalizedShippingAddress.alternativePhone,
      userId: linkedCustomerId,
    });

    if (customerInsights.isBlacklisted) {
      return res.status(403).json({
        success: false,
        message:
          customerInsights.blacklistReason ||
          "This customer is blacklisted and cannot place orders",
      });
    }

    const manualPaymentMode = String(
      paymentDetails?.paymentMode ||
        paymentDetails?.mode ||
        paymentMethod ||
        "cash",
    )
      .trim()
      .toLowerCase();
    const isManualCashOrder = manualPaymentMode === "cash";
    const manualMethodName = isManualCashOrder
      ? "Cash on Delivery"
      : String(
          paymentMethod ||
            paymentDetails?.methodName ||
            paymentDetails?.method ||
            "Manual Online Payment",
        ).trim();

    const shippingQuote = isDeliveryOrder
      ? await resolveOrderShippingQuote(normalizedShippingAddress)
      : {
          success: true,
          shippingFee: 0,
          shippingMeta: {
            source: "manual-walk-in",
            sourceLabel: "Walk-in order completed in shop",
            shippingFee: 0,
            manualOrder: true,
            deliveryRequired: false,
          },
        };
    if (!shippingQuote.success) {
      return res.status(shippingQuote.status || 400).json({
        success: false,
        message: shippingQuote.message || "Unable to resolve shipping",
      });
    }

    const normalizedPaymentDetails = normalizePaymentDetails(
      manualMethodName,
      paymentDetails,
      {
        providerType: isManualCashOrder ? "cod" : "manual_online",
        defaultAccountNo: String(
          paymentDetails?.transactionDetails ||
            paymentDetails?.paymentTransaction ||
            paymentDetails?.accountNo ||
            paymentDetails?.sentTo ||
            paymentDetails?.receiverPhone ||
            "",
        ).trim(),
      },
    );

    if (!normalizedPaymentDetails.method) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    const builtItems = await buildOrderItems(items);
    if (!builtItems.success) {
      return res.status(builtItems.status).json({
        success: false,
        message: builtItems.message,
      });
    }

    const pricing = await calculateOrderPricing({
      subtotal: builtItems.subtotal,
      shippingFee: shippingQuote.shippingFee,
      couponCode: normalizeCouponCode(couponCode),
      items: builtItems.orderItems,
    });
    if (!pricing.success) {
      return res.status(pricing.status).json({
        success: false,
        message: pricing.message,
      });
    }

    const attribution = await resolveLandingAttribution({
      source: "manual_admin",
      landingPageSlug,
    });

    const finalizedShippingMeta = isDeliveryOrder
      ? mergeEstimatedDeliveryIntoShippingMeta(
          {
            ...shippingQuote.shippingMeta,
            ...((shippingMeta && typeof shippingMeta === "object")
              ? shippingMeta
              : {}),
            alternativePhone: normalizedShippingAddress.alternativePhone,
            subCity: normalizedShippingAddress.subCity,
            createdByAdmin: true,
            createdByUser: req.user?._id || req.user?.id || null,
            manualOrder: true,
            deliveryRequired: true,
          },
          builtItems,
        )
      : {
          ...shippingQuote.shippingMeta,
          alternativePhone: normalizedShippingAddress.alternativePhone,
          subCity: normalizedShippingAddress.subCity,
          createdByAdmin: true,
          createdByUser: req.user?._id || req.user?.id || null,
          manualOrder: true,
          deliveryRequired: false,
        };

    const manualPaymentStatus = isDeliveryOrder
      ? isManualCashOrder
        ? "pending"
        : "completed"
      : "completed";
    const manualOrderStatus = isDeliveryOrder ? "pending" : "delivered";
    const manualTimelineNote = isDeliveryOrder
      ? "Manual delivery order created by admin"
      : "Manual walk-in order created and completed by admin";

    const order = await Order.create({
      orderNumber: generateOrderNumber(),
      user: linkedCustomerId || null,
      items: builtItems.orderItems,
      shippingAddress: normalizedShippingAddress,
      subtotal: pricing.subtotal,
      shippingFee: pricing.shippingFee,
      shippingMeta: finalizedShippingMeta,
      discount: pricing.discount,
      couponCode: pricing.couponCode,
      total: pricing.total,
      paymentMethod: normalizedPaymentDetails.method,
      paymentDetails: normalizedPaymentDetails,
      paymentStatus: manualPaymentStatus,
      orderStatus: manualOrderStatus,
      adminNotes: String(adminNotes || "").trim(),
      statusTimeline: [
        buildOrderStatusTimelineEntry({
          status: manualOrderStatus,
          note: manualTimelineNote,
          user: req.user,
        }),
      ],
      source: "manual_admin",
      landingPage: attribution.landingPage,
      landingPageSlug: attribution.landingPageSlug,
    });

    if (
      isDeliveryOrder &&
      (
        String(courierProvider || "").trim() ||
        String(courierTrackingNumber || "").trim() ||
        String(courierConsignmentId || "").trim()
      )
    ) {
      setOrderCourierMeta(order, {
        providerName: String(courierProvider || "").trim(),
        trackingNumber: String(courierTrackingNumber || "").trim(),
        consignmentId: String(courierConsignmentId || "").trim(),
        status: manualOrderStatus,
        generatedBy: "manual",
      });
    }

    const inventoryDeduction = await applyOrderInventoryAdjustment({
      items: order.items,
      direction: -1,
    });
    if (!inventoryDeduction.success) {
      await Order.findByIdAndDelete(order._id).catch(() => null);
      return res.status(400).json({
        success: false,
        message:
          inventoryDeduction.message || "Failed to reserve product stock",
      });
    }

    if (pricing.couponDoc) {
      try {
        await incrementCouponUsage(pricing.couponDoc);
      } catch (couponError) {
        if (inventoryDeduction.adjustments?.length) {
          await rollbackInventoryAdjustments(inventoryDeduction.adjustments);
        }
        await Order.findByIdAndDelete(order._id).catch(() => null);

        return res.status(400).json({
          success: false,
          message: couponError.message || "Coupon is no longer valid",
        });
      }
    }

    setOrderInventoryState(order, {
      deducted:
        Array.isArray(inventoryDeduction.adjustments) &&
        inventoryDeduction.adjustments.length > 0,
      deductedAt: new Date(),
      restored: false,
      restoredAt: null,
      restoredReason: "",
    });
    await order.save();

    await createRecurringSubscriptionsFromOrder(order).catch(() => null);

    const populatedOrder = await Order.findById(order._id)
      .populate({
        path: "items.product",
        select: "title images price dimensions deliveryMinDays deliveryMaxDays",
      })
      .lean();

    if (populatedOrder?.items?.length) {
      const products = populatedOrder.items
        .map((entry) => entry.product)
        .filter(Boolean);
      await attachImageDataToProducts(products);
    }

    sendOrderPlacedEmail(populatedOrder).catch((emailError) => {
      console.error("Manual order confirmation email error:", emailError);
    });

    await Promise.allSettled([
      notifyAdminsAboutOrderCreated(populatedOrder),
      notifyCustomerAboutOrderCreated(populatedOrder),
    ]);

    return res.status(201).json({
      success: true,
      message: "Manual order created successfully",
      order: populatedOrder,
      customerInsights,
    });
  } catch (error) {
    console.error("Create admin order error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating admin order",
    });
  }
};
