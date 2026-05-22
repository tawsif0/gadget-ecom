const COMMISSION_TYPES = ["inherit", "percentage", "fixed", "hybrid"];

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeCommissionType = (value, fallback = "inherit") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (COMMISSION_TYPES.includes(normalized)) return normalized;

  const normalizedFallback = String(fallback || "inherit").trim().toLowerCase();
  if (COMMISSION_TYPES.includes(normalizedFallback)) return normalizedFallback;
  return "inherit";
};

const normalizeCommissionConfig = (input = {}, fallback = {}) => {
  const type = normalizeCommissionType(
    input?.commissionType,
    fallback?.commissionType || "inherit",
  );

  const value = Math.max(
    0,
    toNumber(
      input?.commissionValue,
      Math.max(0, toNumber(fallback?.commissionValue, 0)),
    ),
  );
  const fixed = Math.max(
    0,
    toNumber(
      input?.commissionFixed,
      Math.max(0, toNumber(fallback?.commissionFixed, 0)),
    ),
  );

  return {
    commissionType: type,
    commissionValue: value,
    commissionFixed: fixed,
  };
};

const getFixedAmount = (config = {}) => {
  const fromFixed = Math.max(0, toNumber(config?.commissionFixed, 0));
  if (fromFixed > 0) return fromFixed;
  return Math.max(0, toNumber(config?.commissionValue, 0));
};

const pickCommissionSource = ({
  product = null,
  category = null,
  vendor = null,
  globalConfig = null,
} = {}) => {
  const productRule = normalizeCommissionConfig(product || {}, {
    commissionType: "inherit",
    commissionValue: 0,
    commissionFixed: 0,
  });
  if (productRule.commissionType !== "inherit") {
    return {
      source: "product",
      ...productRule,
    };
  }

  const categoryRule = normalizeCommissionConfig(category || {}, {
    commissionType: "inherit",
    commissionValue: 0,
    commissionFixed: 0,
  });
  if (categoryRule.commissionType !== "inherit") {
    return {
      source: "category",
      ...categoryRule,
    };
  }

  const vendorRule = normalizeCommissionConfig(vendor || {}, {
    commissionType: "inherit",
    commissionValue: 0,
    commissionFixed: 0,
  });
  if (vendorRule.commissionType !== "inherit") {
    return {
      source: "vendor",
      ...vendorRule,
    };
  }

  const globalRule = normalizeCommissionConfig(globalConfig || {}, {
    commissionType: "percentage",
    commissionValue: 10,
    commissionFixed: 0,
  });

  if (globalRule.commissionType === "inherit") {
    return {
      source: "none",
      commissionType: "inherit",
      commissionValue: 0,
      commissionFixed: 0,
    };
  }

  return {
    source: "global",
    ...globalRule,
  };
};

const calculateCommissionAmount = (itemTotalInput, rule = {}) => {
  const itemTotal = Math.max(0, toNumber(itemTotalInput, 0));
  const commissionType = normalizeCommissionType(rule?.commissionType, "inherit");
  const commissionValue = Math.max(0, toNumber(rule?.commissionValue, 0));
  const commissionFixed = Math.max(0, toNumber(rule?.commissionFixed, 0));

  let commission = 0;

  if (commissionType === "percentage") {
    commission = (itemTotal * commissionValue) / 100;
  } else if (commissionType === "fixed") {
    commission = getFixedAmount({ commissionValue, commissionFixed });
  } else if (commissionType === "hybrid") {
    const fixedPart = getFixedAmount({ commissionValue: 0, commissionFixed });
    const percentPart = (itemTotal * commissionValue) / 100;
    commission = fixedPart + percentPart;
  }

  commission = Math.min(Math.max(commission, 0), itemTotal);

  return {
    commission,
    net: Math.max(itemTotal - commission, 0),
    commissionType,
    commissionValue,
    commissionFixed,
  };
};

module.exports = {
  COMMISSION_TYPES,
  normalizeCommissionType,
  normalizeCommissionConfig,
  pickCommissionSource,
  calculateCommissionAmount,
};
