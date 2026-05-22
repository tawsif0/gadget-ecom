const PaymentMethod = require("../models/PaymentMethod");
const {
  sanitizePaymentMethodForPublic,
} = require("../utils/paymentGatewayUtils");
const { clearResponseCacheByPrefix } = require("../middlewares/responseCache");

const CHANNEL_TYPES = ["manual", "cod", "sslcommerz", "bkash", "nagad"];
const CHANNEL_TYPE_FILTER = { $in: CHANNEL_TYPES };

const isAdminUser = (user) =>
  user &&
  (String(user.userType || "").toLowerCase() === "admin" ||
    user.role === "admin");

const toBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeString = (value) => String(value || "").trim();

const normalizeChannelType = (value, fallback = "manual") => {
  const normalized = safeString(value).toLowerCase();
  if (!normalized) return fallback;
  return CHANNEL_TYPES.includes(normalized) ? normalized : "";
};

const validateGatewayConfig = ({ channelType, gatewayConfig, isActive }) => {
  if (!isActive) return;

  if (channelType === "sslcommerz") {
    if (
      !safeString(gatewayConfig?.storeId) ||
      !safeString(gatewayConfig?.storePassword)
    ) {
      const error = new Error(
        "SSLCommerz store ID and store password are required before activating this method",
      );
      error.statusCode = 400;
      throw error;
    }
  }

  if (channelType === "bkash") {
    if (
      !safeString(gatewayConfig?.apiBaseUrl) ||
      !safeString(gatewayConfig?.appKey) ||
      !safeString(gatewayConfig?.appSecret) ||
      !safeString(gatewayConfig?.username) ||
      !safeString(gatewayConfig?.password)
    ) {
      const error = new Error(
        "bKash API base URL, app key, app secret, username, and password are required before activating this method",
      );
      error.statusCode = 400;
      throw error;
    }
  }

  if (channelType === "nagad") {
    if (
      !safeString(gatewayConfig?.merchantId) ||
      !safeString(gatewayConfig?.merchantPrivateKey) ||
      !safeString(gatewayConfig?.gatewayPublicKey)
    ) {
      const error = new Error(
        "Nagad merchant ID, merchant private key, and gateway public key are required before activating this method",
      );
      error.statusCode = 400;
      throw error;
    }
  }
};

const parseGatewayConfig = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value !== "string") return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const invalidatePublicPaymentMethodCache = () => {
  clearResponseCacheByPrefix("/api/auth/payment-methods");
};

const normalizeGenericGatewayConfig = (config = {}) => ({
  merchantId: safeString(config.merchantId),
  merchantNumber: safeString(config.merchantNumber),
  username: safeString(config.username),
  password: safeString(config.password),
  apiBaseUrl: safeString(config.apiBaseUrl),
  apiKey: safeString(config.apiKey),
  appKey: safeString(config.appKey),
  appSecret: safeString(config.appSecret),
  apiSecret: safeString(config.apiSecret),
  webhookSecret: safeString(config.webhookSecret),
  callbackBaseUrl: safeString(config.callbackBaseUrl),
  merchantPrivateKey: safeString(
    config.merchantPrivateKey || config.privateKey,
  ),
  gatewayPublicKey: safeString(
    config.gatewayPublicKey || config.nagadGatewayPublicKey,
  ),
  brandLogoUrl: safeString(config.brandLogoUrl || config.serviceLogoUrl),
  clientType: safeString(config.clientType || "PC_WEB"),
  apiVersion: safeString(config.apiVersion || "v-0.2.0"),
  currency: safeString(config.currency),
  successUrl: safeString(config.successUrl),
  cancelUrl: safeString(config.cancelUrl),
  failUrl: safeString(config.failUrl),
  ipnUrl: safeString(config.ipnUrl),
  sandbox: toBoolean(config.sandbox, true),
});

const normalizeGatewayConfig = (input, channelType) => {
  const config = parseGatewayConfig(input);

  if (channelType === "sslcommerz") {
    return {
      ...normalizeGenericGatewayConfig(config),
      storeId: safeString(config.storeId),
      storePassword: safeString(config.storePassword),
      sandbox: toBoolean(config.sandbox, true),
      currency: safeString(config.currency || "BDT"),
    };
  }

  if (channelType === "bkash") {
    return {
      ...normalizeGenericGatewayConfig(config),
      apiBaseUrl: safeString(config.apiBaseUrl),
      appKey: safeString(config.appKey),
      appSecret: safeString(config.appSecret),
      username: safeString(config.username),
      password: safeString(config.password),
      callbackBaseUrl: safeString(config.callbackBaseUrl),
      sandbox: toBoolean(config.sandbox, true),
      currency: safeString(config.currency || "BDT"),
    };
  }

  if (channelType === "nagad") {
    return {
      ...normalizeGenericGatewayConfig(config),
      merchantId: safeString(config.merchantId),
      merchantPrivateKey: safeString(
        config.merchantPrivateKey || config.privateKey,
      ),
      gatewayPublicKey: safeString(
        config.gatewayPublicKey || config.nagadGatewayPublicKey,
      ),
      callbackBaseUrl: safeString(config.callbackBaseUrl),
      brandLogoUrl: safeString(config.brandLogoUrl || config.serviceLogoUrl),
      clientType: safeString(config.clientType || "PC_WEB"),
      apiVersion: safeString(config.apiVersion || "v-0.2.0"),
      sandbox: toBoolean(config.sandbox, true),
      currency: safeString(config.currency || "BDT"),
    };
  }

  return normalizeGenericGatewayConfig(config);
};

const ensureAdminAccess = (req, res) => {
  if (isAdminUser(req.user)) return true;
  res.status(403).json({ error: "Admin access required" });
  return false;
};

// Public: active payment methods for checkout
exports.getPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find({
      isActive: true,
      channelType: CHANNEL_TYPE_FILTER,
    })
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    const normalized = paymentMethods
      .map((method) => sanitizePaymentMethodForPublic(method))
      .filter(Boolean)
      .sort(
        (a, b) => Number(a?.displayOrder || 0) - Number(b?.displayOrder || 0),
      );

    res.json(normalized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin: all payment methods
exports.getAllPaymentMethods = async (req, res) => {
  try {
    if (!ensureAdminAccess(req, res)) return;

    const paymentMethods = await PaymentMethod.find({
      channelType: CHANNEL_TYPE_FILTER,
    }).sort({
      displayOrder: 1,
      createdAt: -1,
    });

    res.json(paymentMethods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin: create payment method
exports.addPaymentMethod = async (req, res) => {
  try {
    if (!ensureAdminAccess(req, res)) return;

    const type = safeString(req.body?.type);
    const channelType = normalizeChannelType(req.body?.channelType, "manual");
    const accountNo = safeString(req.body?.accountNo);
    const instructions = safeString(req.body?.instructions);
    const displayOrder = toInteger(req.body?.displayOrder, 0);
    const isActive = toBoolean(req.body?.isActive, true);

    if (!type) {
      return res.status(400).json({ error: "Type is required" });
    }

    if (req.body?.channelType !== undefined && !channelType) {
      return res.status(400).json({
        error:
          "Unsupported payment channel. Use manual, cod, sslcommerz, bkash, or nagad.",
      });
    }

    if (channelType === "manual" && !accountNo) {
      return res.status(400).json({
        error: "Account number/details are required for manual methods",
      });
    }

    const gatewayConfig = normalizeGatewayConfig(
      req.body?.gatewayConfig,
      channelType,
    );
    validateGatewayConfig({ channelType, gatewayConfig, isActive });

    const paymentMethod = new PaymentMethod({
      code: safeString(req.body?.code),
      type,
      channelType,
      accountNo: channelType === "manual" ? accountNo : "",
      instructions,
      requiresTransactionProof:
        channelType === "manual"
          ? toBoolean(req.body?.requiresTransactionProof, true)
          : false,
      gatewayConfig,
      displayOrder,
      isActive,
      createdBy: req.user._id,
    });

    await paymentMethod.save();
    invalidatePublicPaymentMethodCache();
    res.status(201).json(paymentMethod);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        error: "Payment method code already exists. Use a different code/type.",
      });
    }
    res.status(error?.statusCode || 500).json({ error: error.message });
  }
};

// Admin: update payment method
exports.updatePaymentMethod = async (req, res) => {
  try {
    if (!ensureAdminAccess(req, res)) return;

    const { id } = req.params;
    const paymentMethod = await PaymentMethod.findById(id);
    if (!paymentMethod) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    const channelType =
      req.body?.channelType !== undefined
        ? normalizeChannelType(req.body.channelType, "")
        : normalizeChannelType(paymentMethod.channelType, "manual");
    const type =
      req.body?.type !== undefined
        ? safeString(req.body.type)
        : paymentMethod.type;
    const accountNo =
      req.body?.accountNo !== undefined
        ? safeString(req.body.accountNo)
        : paymentMethod.accountNo;

    if (!type) {
      return res.status(400).json({ error: "Type is required" });
    }

    if (req.body?.channelType !== undefined && !channelType) {
      return res.status(400).json({
        error:
          "Unsupported payment channel. Use manual, cod, sslcommerz, bkash, or nagad.",
      });
    }

    if (channelType === "manual" && !accountNo) {
      return res.status(400).json({
        error: "Account number/details are required for manual methods",
      });
    }

    const nextGatewayConfig =
      req.body?.gatewayConfig !== undefined
        ? normalizeGatewayConfig(req.body.gatewayConfig, channelType)
        : paymentMethod.gatewayConfig;
    const nextIsActive =
      req.body?.isActive !== undefined
        ? toBoolean(req.body.isActive, paymentMethod.isActive)
        : paymentMethod.isActive;
    validateGatewayConfig({
      channelType,
      gatewayConfig: nextGatewayConfig,
      isActive: nextIsActive,
    });

    paymentMethod.code =
      req.body?.code !== undefined
        ? safeString(req.body.code)
        : paymentMethod.code;
    paymentMethod.type = type;
    paymentMethod.channelType = channelType;
    paymentMethod.accountNo = channelType === "manual" ? accountNo : "";
    paymentMethod.instructions =
      req.body?.instructions !== undefined
        ? safeString(req.body.instructions)
        : paymentMethod.instructions;
    paymentMethod.requiresTransactionProof =
      channelType === "manual"
        ? req.body?.requiresTransactionProof !== undefined
          ? toBoolean(req.body.requiresTransactionProof, true)
          : paymentMethod.requiresTransactionProof
        : false;
    paymentMethod.gatewayConfig = nextGatewayConfig;
    paymentMethod.displayOrder =
      req.body?.displayOrder !== undefined
        ? toInteger(req.body.displayOrder, paymentMethod.displayOrder || 0)
        : paymentMethod.displayOrder;
    paymentMethod.isActive = nextIsActive;
    paymentMethod.updatedBy = req.user._id;
    paymentMethod.updatedAt = new Date();

    await paymentMethod.save();
    invalidatePublicPaymentMethodCache();
    res.json(paymentMethod);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        error: "Payment method code already exists. Use a different code/type.",
      });
    }
    res.status(error?.statusCode || 500).json({ error: error.message });
  }
};

// Admin: delete payment method
exports.deletePaymentMethod = async (req, res) => {
  try {
    if (!ensureAdminAccess(req, res)) return;

    const { id } = req.params;
    const paymentMethod = await PaymentMethod.findById(id);
    if (!paymentMethod) {
      return res.status(404).json({ error: "Payment method not found" });
    }

    await paymentMethod.deleteOne();
    invalidatePublicPaymentMethodCache();
    res.json({ message: "Payment method deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
