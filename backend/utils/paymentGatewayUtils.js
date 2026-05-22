const axios = require("axios");
const crypto = require("crypto");

const toBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeString = (value) => String(value || "").trim();

const stripTrailingSlash = (value) => safeString(value).replace(/\/+$/, "");
const joinUrl = (baseUrl, path = "") => {
  const normalizedBase = stripTrailingSlash(baseUrl);
  const normalizedPath = safeString(path).replace(/^\/+/, "");
  if (!normalizedBase) return "";
  return normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase;
};

const appendQueryParams = (url, params = {}) => {
  const normalizedUrl = safeString(url);
  if (!normalizedUrl) return "";

  try {
    const parsedUrl = new URL(normalizedUrl);
    Object.entries(params).forEach(([key, value]) => {
      const nextValue = safeString(value);
      if (nextValue) {
        parsedUrl.searchParams.set(key, nextValue);
      }
    });
    return parsedUrl.toString();
  } catch (_error) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      const nextValue = safeString(value);
      if (nextValue) {
        searchParams.set(key, nextValue);
      }
    });

    if (!Array.from(searchParams.keys()).length) {
      return normalizedUrl;
    }

    return `${normalizedUrl}${normalizedUrl.includes("?") ? "&" : "?"}${searchParams.toString()}`;
  }
};

const SUPPORTED_PAYMENT_CHANNELS = new Set([
  "manual",
  "cod",
  "sslcommerz",
  "bkash",
  "nagad",
]);

const resolveGatewayConfig = (paymentMethod) =>
  paymentMethod?.gatewayConfig &&
  typeof paymentMethod.gatewayConfig === "object"
    ? paymentMethod.gatewayConfig
    : {};

const getFrontendBaseUrl = () =>
  stripTrailingSlash(process.env.FRONTEND_URL) || "http://localhost:5173";

const resolveBackendBaseUrl = ({ paymentMethod, requestBaseUrl = "" } = {}) => {
  const config = resolveGatewayConfig(paymentMethod);
  const backendBaseUrl = stripTrailingSlash(
    config.callbackBaseUrl ||
      process.env.BACKEND_PUBLIC_URL ||
      requestBaseUrl ||
      "",
  );

  if (!backendBaseUrl) {
    throw new Error(
      "A public backend callback URL is required for gateway payments",
    );
  }

  return backendBaseUrl;
};

const buildRedirectUrls = (order, paymentMethod) => {
  const config = resolveGatewayConfig(paymentMethod);
  const frontendBase = getFrontendBaseUrl();
  const channelType = safeString(
    paymentMethod?.channelType || "manual",
  ).toLowerCase();

  return {
    successUrl:
      safeString(config.successUrl) ||
      `${frontendBase}/thank-you?orderId=${order._id}&payment=success&provider=${channelType}`,
    cancelUrl:
      safeString(config.cancelUrl) ||
      `${frontendBase}/thank-you?orderId=${order._id}&payment=cancel&provider=${channelType}`,
    failUrl:
      safeString(config.failUrl) ||
      `${frontendBase}/thank-you?orderId=${order._id}&payment=failed&provider=${channelType}`,
  };
};

const buildGatewayRedirectUrl = ({
  order,
  paymentMethod,
  provider = "",
  status = "success",
}) => {
  const { successUrl, cancelUrl, failUrl } = buildRedirectUrls(
    order,
    paymentMethod,
  );

  const redirectUrl =
    status === "success"
      ? successUrl
      : status === "cancel"
        ? cancelUrl
        : failUrl;

  if (status !== "success") {
    const frontendBase = getFrontendBaseUrl();
    return appendQueryParams(`${frontendBase}/checkout`, {
      orderId: order?._id,
      payment: status,
      provider: safeString(provider || paymentMethod?.channelType).toLowerCase(),
    });
  }

  return appendQueryParams(redirectUrl, {
    orderId: order?._id,
    payment: status,
    provider: safeString(provider || paymentMethod?.channelType).toLowerCase(),
  });
};

const sanitizePaymentMethodForPublic = (method) => {
  if (!method) return null;
  const config = resolveGatewayConfig(method);
  const channelType = safeString(method.channelType || "manual").toLowerCase();
  if (!SUPPORTED_PAYMENT_CHANNELS.has(channelType)) return null;
  const methodType = safeString(
    method.type ||
      (channelType === "cod"
        ? "Cash on Delivery"
        : channelType === "manual"
          ? "Manual Payment"
          : channelType === "bkash"
            ? "bKash"
            : channelType === "nagad"
              ? "Nagad"
              : ""),
  );
  const publicConfig = {};

  if (["sslcommerz", "bkash", "nagad"].includes(channelType)) {
    publicConfig.sandbox = toBoolean(config.sandbox, true);
  }

  if (channelType === "sslcommerz") {
    publicConfig.storeId = safeString(config.storeId);
  }

  return {
    _id: method._id,
    code: method.code,
    type: methodType,
    channelType,
    accountNo: method.accountNo || "",
    instructions: method.instructions || "",
    requiresTransactionProof: Boolean(method.requiresTransactionProof),
    displayOrder: Number(method.displayOrder || 0),
    isActive: Boolean(method.isActive),
    createdAt: method.createdAt,
    gatewayConfig: publicConfig,
  };
};

const createSslCommerzSession = async ({
  order,
  paymentMethod,
  customer,
  requestBaseUrl = "",
}) => {
  const config = resolveGatewayConfig(paymentMethod);
  const storeId = safeString(config.storeId);
  const storePassword = safeString(config.storePassword);
  if (!storeId || !storePassword) {
    throw new Error("SSLCommerz credentials are missing");
  }

  const sandbox = toBoolean(config.sandbox, true);
  const baseUrl = sandbox
    ? "https://sandbox.sslcommerz.com"
    : "https://securepay.sslcommerz.com";

  const backendBaseUrl = resolveBackendBaseUrl({
    paymentMethod,
    requestBaseUrl,
  });
  const callbackBase = joinUrl(
    backendBaseUrl,
    "api/orders/payments/sslcommerz/callback",
  );
  const successUrl = appendQueryParams(callbackBase, {
    orderId: String(order._id || ""),
    gatewayStatus: "success",
  });
  const cancelUrl = appendQueryParams(callbackBase, {
    orderId: String(order._id || ""),
    gatewayStatus: "cancel",
  });
  const failUrl = appendQueryParams(callbackBase, {
    orderId: String(order._id || ""),
    gatewayStatus: "failed",
  });

  const body = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePassword,
    total_amount: toNumber(order.total, 0).toFixed(2),
    currency: safeString(config.currency || "BDT").toUpperCase(),
    tran_id: String(order.orderNumber || order._id),
    success_url: successUrl,
    fail_url: failUrl,
    cancel_url: cancelUrl,
    ipn_url: safeString(config.ipnUrl),
    shipping_method: "NO",
    product_name: `Order ${order.orderNumber}`,
    product_category: "ecommerce",
    product_profile: "general",
    cus_name: safeString(
      customer?.name ||
        `${customer?.firstName || ""} ${customer?.lastName || ""}`,
    ),
    cus_email: safeString(customer?.email),
    cus_phone: safeString(customer?.phone),
    cus_add1: safeString(customer?.address),
    cus_city: safeString(customer?.city),
    cus_country: safeString(customer?.country || "Bangladesh"),
    cus_postcode: safeString(customer?.postalCode),
    value_a: String(order._id),
    value_b: String(order.orderNumber),
  });

  const response = await axios.post(`${baseUrl}/gwprocess/v4/api.php`, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    timeout: 20000,
  });

  const payload = response.data || {};
  const paymentUrl = safeString(
    payload.GatewayPageURL || payload.gatewayPageURL,
  );

  if (!paymentUrl) {
    throw new Error("SSLCommerz did not return gateway URL");
  }

  return {
    providerType: "sslcommerz",
    gatewayPaymentId: safeString(
      payload.sessionkey || payload.session_id || "",
    ),
    paymentUrl,
    meta: {
      sandbox,
      status: safeString(payload.status),
    },
  };
};

const getBkashBaseUrl = (config = {}) =>
  stripTrailingSlash(
    config.apiBaseUrl ||
      (toBoolean(config.sandbox, true)
        ? "https://tokenized.sandbox.bka.sh/v1.2.0-beta"
        : "https://tokenized.pay.bka.sh/v1.2.0-beta"),
  );

const joinBkashApiUrl = (baseUrl, path = "") => {
  const normalizedBase = stripTrailingSlash(baseUrl);
  const baseIncludesTokenized = /\/tokenized(?:\/|$)/i.test(normalizedBase);
  const normalizedPath = safeString(path)
    .replace(/^\/+/, "")
    .replace(baseIncludesTokenized ? /^tokenized\/+/i : /^/, "");
  return joinUrl(normalizedBase, normalizedPath);
};

const requestBkashToken = async (config = {}) => {
  const appKey = safeString(config.appKey);
  const appSecret = safeString(config.appSecret);
  const username = safeString(config.username);
  const password = safeString(config.password);
  const baseUrl = getBkashBaseUrl(config);

  if (!baseUrl || !appKey || !appSecret || !username || !password) {
    throw new Error("bKash credentials are missing");
  }

  const response = await axios.post(
    joinBkashApiUrl(baseUrl, "tokenized/checkout/token/grant"),
    {
      app_key: appKey,
      app_secret: appSecret,
    },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        username,
        password,
      },
      timeout: 30000,
    },
  );

  const payload = response.data || {};
  const idToken = safeString(payload.id_token || payload.idToken);

  if (!idToken) {
    throw new Error(
      safeString(payload.statusMessage || payload.message) ||
        "bKash token request failed",
    );
  }

  return {
    baseUrl,
    appKey,
    idToken,
    payload,
  };
};

const parseBkashStatusCode = (payload = {}) =>
  safeString(payload.statusCode || payload.status_code);

const parseBkashTransactionStatus = (payload = {}) =>
  safeString(
    payload.transactionStatus || payload.transaction_status || payload.status,
  ).toLowerCase();

const isBkashCompletedResponse = (payload = {}) =>
  parseBkashStatusCode(payload) === "0000" &&
  parseBkashTransactionStatus(payload) === "completed";

const createBkashPayment = async ({
  order,
  paymentMethod,
  customer,
  requestBaseUrl = "",
}) => {
  const config = resolveGatewayConfig(paymentMethod);
  const { baseUrl, appKey, idToken } = await requestBkashToken(config);
  const backendBaseUrl = resolveBackendBaseUrl({
    paymentMethod,
    requestBaseUrl,
  });
  const callbackUrl = `${joinUrl(
    backendBaseUrl,
    "api/orders/payments/bkash/callback",
  )}?orderId=${encodeURIComponent(String(order._id || ""))}`;

  const response = await axios.post(
    joinBkashApiUrl(baseUrl, "tokenized/checkout/create"),
    {
      mode: "0011",
      payerReference: safeString(
        customer?.phone ||
          customer?.mobile ||
          order?.shippingAddress?.phone ||
          order?._id,
      ),
      callbackURL: callbackUrl,
      amount: toNumber(order.total, 0).toFixed(2),
      currency: safeString(config.currency || "BDT").toUpperCase(),
      intent: "sale",
      merchantInvoiceNumber: safeString(order.orderNumber || order._id),
    },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        authorization: idToken,
        "x-app-key": appKey,
      },
      timeout: 30000,
    },
  );

  const payload = response.data || {};
  const paymentId = safeString(payload.paymentID || payload.paymentId);
  const paymentUrl = safeString(payload.bkashURL || payload.paymentURL);

  if (!paymentId || !paymentUrl) {
    throw new Error(
      safeString(payload.statusMessage || payload.message) ||
        "bKash did not return a payment URL",
    );
  }

  return {
    providerType: "bkash",
    gatewayPaymentId: paymentId,
    paymentUrl,
    meta: {
      sandbox: toBoolean(config.sandbox, true),
      callbackUrl,
      createStatusCode: parseBkashStatusCode(payload),
    },
  };
};

const executeBkashPayment = async ({ paymentMethod, paymentId }) => {
  const config = resolveGatewayConfig(paymentMethod);
  const { baseUrl, appKey, idToken } = await requestBkashToken(config);
  const response = await axios.post(
    joinBkashApiUrl(baseUrl, "tokenized/checkout/execute"),
    { paymentID: safeString(paymentId) },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        authorization: idToken,
        "x-app-key": appKey,
      },
      timeout: 30000,
    },
  );

  return response.data || {};
};

const queryBkashPayment = async ({ paymentMethod, paymentId }) => {
  const config = resolveGatewayConfig(paymentMethod);
  const { baseUrl, appKey, idToken } = await requestBkashToken(config);
  const response = await axios.post(
    joinBkashApiUrl(baseUrl, "tokenized/checkout/payment/status"),
    { paymentID: safeString(paymentId) },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        authorization: idToken,
        "x-app-key": appKey,
      },
      timeout: 30000,
    },
  );

  return response.data || {};
};

const verifyBkashCallbackPayment = async ({
  paymentMethod,
  callbackData = {},
}) => {
  const paymentId = safeString(
    callbackData.paymentID || callbackData.paymentId || callbackData.payment_id,
  );
  const callbackStatus = safeString(
    callbackData.status || callbackData.paymentStatus,
  ).toLowerCase();

  if (!paymentId) {
    return {
      success: false,
      redirectState: "failed",
      paymentStatus: "failed",
      message: "bKash payment ID is missing from callback",
      gatewayPaymentId: "",
      transactionId: "",
      meta: {},
    };
  }

  if (callbackStatus === "cancel") {
    return {
      success: false,
      redirectState: "cancel",
      paymentStatus: "pending",
      message: "Customer cancelled the bKash payment",
      gatewayPaymentId: paymentId,
      transactionId: "",
      meta: {
        callbackStatus,
      },
    };
  }

  let payload = {};
  let message = "";

  if (callbackStatus === "success") {
    try {
      payload = await executeBkashPayment({ paymentMethod, paymentId });
    } catch (error) {
      message =
        safeString(error?.response?.data?.statusMessage) ||
        safeString(error?.response?.data?.message) ||
        safeString(error?.message);
    }
  }

  if (!isBkashCompletedResponse(payload)) {
    try {
      const queryPayload = await queryBkashPayment({ paymentMethod, paymentId });
      if (isBkashCompletedResponse(queryPayload)) {
        payload = queryPayload;
      } else if (!payload || !Object.keys(payload).length) {
        payload = queryPayload;
      }
    } catch (error) {
      if (!message) {
        message =
          safeString(error?.response?.data?.statusMessage) ||
          safeString(error?.response?.data?.message) ||
          safeString(error?.message);
      }
    }
  }

  if (!isBkashCompletedResponse(payload)) {
    return {
      success: false,
      redirectState: callbackStatus === "failure" ? "failed" : "failed",
      paymentStatus: "failed",
      message:
        safeString(payload.statusMessage || payload.message) ||
        message ||
        "bKash payment verification failed",
      gatewayPaymentId: paymentId,
      transactionId: safeString(payload.trxID || payload.trxId),
      meta: {
        callbackStatus,
        statusCode: parseBkashStatusCode(payload),
        transactionStatus: parseBkashTransactionStatus(payload),
      },
    };
  }

  return {
    success: true,
    redirectState: "success",
    paymentStatus: "completed",
    message: "bKash payment verified successfully",
    gatewayPaymentId: paymentId,
    transactionId: safeString(payload.trxID || payload.trxId),
    meta: {
      callbackStatus,
      statusCode: parseBkashStatusCode(payload),
      transactionStatus: parseBkashTransactionStatus(payload),
      payerReference: safeString(payload.payerReference),
      amount: safeString(payload.amount),
      currency: safeString(payload.currency),
      paymentExecuteTime: safeString(
        payload.paymentExecuteTime || payload.completedTime,
      ),
      signature: safeString(callbackData.signature),
    },
  };
};

const normalizePemBlock = (value, type) => {
  const normalizedValue = safeString(value);
  if (!normalizedValue) return "";
  if (normalizedValue.includes("BEGIN")) return normalizedValue;

  const lines = normalizedValue.match(/.{1,64}/g) || [normalizedValue];
  return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----`;
};

const encryptWithPublicKey = (value, publicKeyValue) =>
  crypto
    .publicEncrypt(
      {
        key: normalizePemBlock(publicKeyValue, "PUBLIC KEY"),
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(
        typeof value === "string" ? value : JSON.stringify(value || {}),
        "utf8",
      ),
    )
    .toString("base64");

const decryptWithPrivateKey = (value, privateKeyValue) =>
  crypto
    .privateDecrypt(
      {
        key: normalizePemBlock(privateKeyValue, "RSA PRIVATE KEY"),
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(safeString(value), "base64"),
    )
    .toString("utf8");

const signWithPrivateKey = (value, privateKeyValue) =>
  crypto
    .sign(
      "RSA-SHA256",
      Buffer.from(
        typeof value === "string" ? value : JSON.stringify(value || {}),
        "utf8",
      ),
      normalizePemBlock(privateKeyValue, "RSA PRIVATE KEY"),
    )
    .toString("base64");

const createRandomAlphaNumeric = (length = 40) =>
  crypto
    .randomBytes(Math.max(length * 2, 32))
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, length);

const getCurrentBdTimestamp = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter
    .formatToParts(now)
    .reduce((accumulator, part) => {
      accumulator[part.type] = part.value;
      return accumulator;
    }, {});

  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
};

const normalizeIpv4 = (value) => {
  const rawValue = safeString(value);
  if (!rawValue) return "127.0.0.1";

  const firstCandidate = rawValue.split(",")[0].trim();
  if (/^::ffff:/i.test(firstCandidate)) {
    return firstCandidate.replace(/^::ffff:/i, "");
  }

  if (firstCandidate === "::1") {
    return "127.0.0.1";
  }

  return firstCandidate || "127.0.0.1";
};

const buildNagadHeaders = ({ requestIp = "", config = {} } = {}) => ({
  "Content-Type": "application/json",
  "X-KM-Api-Version": safeString(config.apiVersion || "v-0.2.0"),
  "X-KM-IP-V4": normalizeIpv4(requestIp),
  "X-KM-Client-Type": safeString(config.clientType || "PC_WEB"),
});

const getNagadBaseUrl = (config = {}) =>
  stripTrailingSlash(
    config.apiBaseUrl ||
      (toBoolean(config.sandbox, true)
        ? "https://sandbox-ssl.mynagad.com/api/dfs"
        : "https://api.mynagad.com/api/dfs"),
  );

const createNagadPayment = async ({
  order,
  paymentMethod,
  requestBaseUrl = "",
  requestIp = "",
}) => {
  const config = resolveGatewayConfig(paymentMethod);
  const merchantId = safeString(config.merchantId);
  const merchantPrivateKey = safeString(config.merchantPrivateKey);
  const gatewayPublicKey = safeString(config.gatewayPublicKey);
  const baseUrl = getNagadBaseUrl(config);

  if (!merchantId || !merchantPrivateKey || !gatewayPublicKey) {
    throw new Error("Nagad credentials are missing");
  }

  const gatewayOrderId = `${safeString(order.orderNumber || order._id)}${Math.floor(
    1000 + Math.random() * 9000,
  )}`;
  const initDateTime = getCurrentBdTimestamp();
  const initializePayloadSensitive = {
    merchantId,
    datetime: initDateTime,
    orderId: gatewayOrderId,
    challenge: createRandomAlphaNumeric(40),
  };
  const initializePayload = {
    dateTime: initDateTime,
    sensitiveData: encryptWithPublicKey(
      initializePayloadSensitive,
      gatewayPublicKey,
    ),
    signature: signWithPrivateKey(
      initializePayloadSensitive,
      merchantPrivateKey,
    ),
  };

  const initializeResponse = await axios.post(
    `${joinUrl(baseUrl, `check-out/initialize/${merchantId}`)}?locale=EN`,
    initializePayload,
    {
      headers: buildNagadHeaders({ requestIp, config }),
      timeout: 30000,
    },
  );

  const initializeData = initializeResponse.data || {};
  const encryptedSensitiveData = safeString(initializeData.sensitiveData);

  if (!encryptedSensitiveData) {
    throw new Error(
      safeString(initializeData.message) ||
        "Nagad checkout initialization failed",
    );
  }

  const decryptedInitializeResponse = JSON.parse(
    decryptWithPrivateKey(encryptedSensitiveData, merchantPrivateKey),
  );
  const paymentReferenceId = safeString(
    decryptedInitializeResponse.paymentReferenceId,
  );
  const challenge = safeString(decryptedInitializeResponse.challenge);

  if (!paymentReferenceId || !challenge) {
    throw new Error("Nagad initialization did not return payment reference");
  }

  const callbackUrl = joinUrl(
    resolveBackendBaseUrl({ paymentMethod, requestBaseUrl }),
    "api/orders/payments/nagad/callback",
  );
  const completeSensitiveData = {
    merchantId,
    orderId: gatewayOrderId,
    currencyCode: "050",
    amount: toNumber(order.total, 0).toFixed(2),
    challenge,
  };
  const completePayload = {
    sensitiveData: encryptWithPublicKey(completeSensitiveData, gatewayPublicKey),
    signature: signWithPrivateKey(completeSensitiveData, merchantPrivateKey),
    merchantCallbackURL: callbackUrl,
    additionalMerchantInfo: {
      order_no: safeString(order.orderNumber || order._id),
      serviceLogoURL: safeString(config.brandLogoUrl),
    },
  };

  const completeResponse = await axios.post(
    joinUrl(baseUrl, `check-out/complete/${paymentReferenceId}`),
    completePayload,
    {
      headers: buildNagadHeaders({ requestIp, config }),
      timeout: 30000,
    },
  );

  const completeData = completeResponse.data || {};
  const paymentUrl = safeString(
    completeData.callBackUrl ||
      completeData.callBackURL ||
      completeData.callbackUrl ||
      completeData.url,
  ).replace(/^"+|"+$/g, "");

  if (!paymentUrl) {
    throw new Error(
      safeString(completeData.message) ||
        "Nagad did not return a payment URL",
    );
  }

  return {
    providerType: "nagad",
    gatewayPaymentId: paymentReferenceId,
    paymentUrl,
    meta: {
      sandbox: toBoolean(config.sandbox, true),
      callbackUrl,
      gatewayOrderId,
    },
  };
};

const verifyNagadCallbackPayment = async ({
  paymentMethod,
  callbackData = {},
  requestIp = "",
}) => {
  const paymentReferenceId = safeString(
    callbackData.payment_ref_id ||
      callbackData.paymentRefId ||
      callbackData.payment_reference_id,
  );

  if (!paymentReferenceId) {
    return {
      success: false,
      redirectState: "failed",
      paymentStatus: "failed",
      message: "Nagad payment reference is missing from callback",
      gatewayPaymentId: "",
      transactionId: "",
      meta: {},
    };
  }

  const config = resolveGatewayConfig(paymentMethod);
  const verificationResponse = await axios.get(
    joinUrl(getNagadBaseUrl(config), `verify/payment/${paymentReferenceId}`),
    {
      headers: buildNagadHeaders({ requestIp, config }),
      timeout: 30000,
    },
  );

  const payload = verificationResponse.data || {};
  const paymentStatus = safeString(payload.status);
  const statusCode = safeString(payload.statusCode || payload.status_code);
  const success =
    paymentStatus.toLowerCase() === "success" &&
    ["000", "00_0000_000"].includes(statusCode);

  if (!success) {
    return {
      success: false,
      redirectState:
        paymentStatus.toLowerCase() === "cancel" ? "cancel" : "failed",
      paymentStatus:
        paymentStatus.toLowerCase() === "cancel" ? "pending" : "failed",
      message:
        safeString(payload.message) || "Nagad payment verification failed",
      gatewayPaymentId: paymentReferenceId,
      transactionId: safeString(payload.issuerPaymentRefNo),
      meta: {
        status: paymentStatus,
        statusCode,
        gatewayOrderId: safeString(payload.orderId),
      },
    };
  }

  return {
    success: true,
    redirectState: "success",
    paymentStatus: "completed",
    message: "Nagad payment verified successfully",
    gatewayPaymentId: paymentReferenceId,
    transactionId: safeString(payload.issuerPaymentRefNo),
    meta: {
      status: paymentStatus,
      statusCode,
      gatewayOrderId: safeString(payload.orderId),
      amount: safeString(payload.amount),
      orderDateTime: safeString(payload.orderDateTime),
      paymentDateTime: safeString(payload.issuerPaymentDateTime),
      additionalMerchantInfo:
        payload.additionalMerchantInfo &&
        typeof payload.additionalMerchantInfo === "object"
          ? payload.additionalMerchantInfo
          : safeString(payload.additionalMerchantInfo),
    },
  };
};

const verifyGatewayPayment = async ({
  provider = "",
  paymentMethod,
  callbackData = {},
  requestIp = "",
}) => {
  const normalizedProvider = safeString(provider).toLowerCase();

  if (normalizedProvider === "sslcommerz") {
    const callbackStatus = safeString(
      callbackData.status || callbackData.gatewayStatus,
    ).toLowerCase();
    const normalizedStatus = callbackStatus.toUpperCase();
    const gatewayPaymentId = safeString(
      callbackData.sessionkey || callbackData.session_id,
    );
    const transactionId = safeString(
      callbackData.bank_tran_id || callbackData.tran_id || callbackData.val_id,
    );

    if (["cancel", "cancelled", "canceled"].includes(callbackStatus)) {
      return {
        success: false,
        redirectState: "cancel",
        paymentStatus: "pending",
        message: "Customer cancelled the SSLCommerz payment",
        gatewayPaymentId,
        transactionId,
        meta: {
          status: normalizedStatus,
        },
      };
    }

    const isSuccess =
      ["valid", "validated", "success"].includes(callbackStatus) ||
      (callbackStatus === "success" && Boolean(safeString(callbackData.val_id)));

    if (!isSuccess) {
      return {
        success: false,
        redirectState: "failed",
        paymentStatus: "failed",
        message:
          safeString(callbackData.failedreason || callbackData.error) ||
          "SSLCommerz payment verification failed",
        gatewayPaymentId,
        transactionId,
        meta: {
          status: normalizedStatus,
          valId: safeString(callbackData.val_id),
          amount: safeString(callbackData.amount),
          currency: safeString(callbackData.currency),
        },
      };
    }

    return {
      success: true,
      redirectState: "success",
      paymentStatus: "completed",
      message: "SSLCommerz payment verified successfully",
      gatewayPaymentId,
      transactionId,
      meta: {
        status: normalizedStatus,
        valId: safeString(callbackData.val_id),
        amount: safeString(callbackData.amount),
        currency: safeString(callbackData.currency),
        cardType: safeString(callbackData.card_type),
        storeAmount: safeString(callbackData.store_amount),
        tranDate: safeString(callbackData.tran_date),
      },
    };
  }

  if (normalizedProvider === "bkash") {
    return verifyBkashCallbackPayment({ paymentMethod, callbackData });
  }

  if (normalizedProvider === "nagad") {
    return verifyNagadCallbackPayment({
      paymentMethod,
      callbackData,
      requestIp,
    });
  }

  return {
    success: false,
    redirectState: "failed",
    paymentStatus: "failed",
    message: "Unsupported payment provider",
    gatewayPaymentId: "",
    transactionId: "",
    meta: {},
  };
};

const initiateGatewayPayment = async ({
  order,
  paymentMethod,
  customer,
  requestBaseUrl = "",
  requestIp = "",
}) => {
  const channelType = safeString(
    paymentMethod?.channelType || "manual",
  ).toLowerCase();

  if (channelType === "sslcommerz") {
    return createSslCommerzSession({
      order,
      paymentMethod,
      customer,
      requestBaseUrl,
    });
  }

  if (channelType === "bkash") {
    return createBkashPayment({
      order,
      paymentMethod,
      customer,
      requestBaseUrl,
    });
  }

  if (channelType === "nagad") {
    return createNagadPayment({
      order,
      paymentMethod,
      requestBaseUrl,
      requestIp,
    });
  }

  return {
    providerType: channelType || "manual",
    gatewayPaymentId: "",
    paymentUrl: "",
    meta: {},
  };
};

module.exports = {
  buildGatewayRedirectUrl,
  initiateGatewayPayment,
  sanitizePaymentMethodForPublic,
  verifyGatewayPayment,
};
