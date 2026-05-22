const COURIER_PROVIDER_DEFINITIONS = {
  steadfast: { label: "Steadfast" },
  pathao: { label: "Pathao" },
  ecourier: { label: "eCourier" },
  carrybee: { label: "CarryBee" },
  redx: { label: "RedX" },
};

const safeString = (value) => String(value || "").trim();

const normalizeCourierConfig = (value = {}, fallbackLabel = "Courier") => ({
  providerName: safeString(value?.providerName || fallbackLabel),
  enabled: value?.enabled === undefined ? false : Boolean(value.enabled),
  apiBaseUrl: safeString(value?.apiBaseUrl || ""),
  apiToken: safeString(value?.apiToken || value?.token || ""),
  apiKey: safeString(value?.apiKey || ""),
  apiSecret: safeString(value?.apiSecret || ""),
  consignmentPath: safeString(value?.consignmentPath || "/consignments"),
  trackingPath: safeString(value?.trackingPath || "/track"),
  labelPath: safeString(value?.labelPath || "/label"),
  timeoutMs: Math.max(1000, parseInt(value?.timeoutMs, 10) || 12000),
});

const normalizeCourierMap = (value = {}) => {
  const source = value && typeof value === "object" ? value : {};

  return Object.fromEntries(
    Object.entries(COURIER_PROVIDER_DEFINITIONS).map(([key, meta]) => [
      key,
      normalizeCourierConfig(source[key] || {}, meta.label),
    ]),
  );
};

const getActiveCourierConfigs = (settings = {}) => {
  const couriers = normalizeCourierMap(settings?.couriers || {});

  return Object.entries(couriers)
    .filter(([, config]) => Boolean(config?.enabled))
    .map(([courierKey, courierConfig]) => ({
      courierKey,
      ...courierConfig,
      couriers,
    }));
};

const resolvePrimaryCourierConfig = (settings = {}) => {
  const couriers = normalizeCourierMap(settings?.couriers || {});
  const activeEntry = getActiveCourierConfigs(settings)[0];

  if (activeEntry) {
    return activeEntry;
  }

  const legacyCourier = normalizeCourierConfig(
    settings?.courier || {},
    settings?.courier?.providerName || "Courier",
  );

  return {
    courierKey: "legacy",
    ...legacyCourier,
    couriers,
  };
};

const resolveCourierConfigByKey = (settings = {}, courierKey = "") => {
  const normalizedKey = safeString(courierKey).toLowerCase();

  if (!normalizedKey) {
    return resolvePrimaryCourierConfig(settings);
  }

  const couriers = normalizeCourierMap(settings?.couriers || {});
  const selectedCourier = couriers[normalizedKey];

  if (selectedCourier?.enabled) {
    return {
      courierKey: normalizedKey,
      ...selectedCourier,
      couriers,
    };
  }

  return null;
};

module.exports = {
  COURIER_PROVIDER_DEFINITIONS,
  normalizeCourierConfig,
  normalizeCourierMap,
  getActiveCourierConfigs,
  resolvePrimaryCourierConfig,
  resolveCourierConfigByKey,
};
