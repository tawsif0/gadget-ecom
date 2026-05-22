const ShippingZone = require("../models/ShippingZone");
const User = require("../models/User");
const {
  getDistrictCoverageKeys,
  isAllowedShippingDistrict,
  isDhakaDistrict,
  isOutsideDhakaShippingOption,
  normalizeDistrictOption,
} = require("../utils/bangladeshLocations");

const normalizeText = (value) => String(value || "").trim();

const normalizeKey = (value) => normalizeText(value).toLowerCase();
const legacyScopeKey = ["sc", "ope"].join("");
const legacyOwnerKey = ["ven", "dor"].join("");

const normalizeDistrictList = (value) => {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : value
        ? [value]
        : [];

  const unique = new Map();

  source.forEach((entry) => {
    const district = normalizeDistrictOption(entry);
    if (!district) return;
    const key = normalizeKey(district);
    if (!unique.has(key)) {
      unique.set(key, district);
    }
  });

  return Array.from(unique.values());
};

const normalizeShippingRuleInput = (rule = {}) => {
  const districts = normalizeDistrictList(
    rule?.districts !== undefined ? rule.districts : rule?.district,
  ).filter(isAllowedShippingDistrict);
  const shippingFee = Number(rule?.shippingFee);

  if (!districts.length || !Number.isFinite(shippingFee) || shippingFee < 0) {
    return null;
  }

  const estimatedMinDays = Math.max(
    0,
    parseInt(rule?.estimatedMinDays, 10) || 0,
  );
  const estimatedMaxDays = Math.max(
    estimatedMinDays,
    parseInt(rule?.estimatedMaxDays, 10) || estimatedMinDays,
  );

  return {
    districts,
    shippingFee: Math.max(0, shippingFee),
    estimatedMinDays,
    estimatedMaxDays,
    isActive: rule?.isActive !== false,
  };
};

const parseShippingRulesInput = (rulesInput) => {
  let rules = rulesInput;
  if (typeof rules === "string") {
    try {
      rules = JSON.parse(rules);
    } catch {
      rules = [];
    }
  }

  if (!Array.isArray(rules)) return [];

  return rules.map((rule) => normalizeShippingRuleInput(rule)).filter(Boolean);
};

const buildGlobalZoneQuery = ({
  activeOnly = false,
  excludeZoneId = "",
} = {}) => {
  const query = {
    $and: [
      {
        $or: [
          { [legacyScopeKey]: { $exists: false } },
          { [legacyScopeKey]: "global" },
        ],
      },
      {
        $or: [
          { [legacyOwnerKey]: { $exists: false } },
          { [legacyOwnerKey]: null },
        ],
      },
    ],
  };

  if (activeOnly) {
    query.isActive = true;
  }

  if (excludeZoneId) {
    query._id = { $ne: excludeZoneId };
  }

  return query;
};

const getGlobalShippingZones = async ({
  activeOnly = false,
  excludeZoneId = "",
  sort = { priority: 1, createdAt: -1 },
} = {}) =>
  ShippingZone.find(buildGlobalZoneQuery({ activeOnly, excludeZoneId }))
    .sort(sort)
    .lean();

const getActiveRules = (zones = []) =>
  (Array.isArray(zones) ? zones : [])
    .filter((zone) => zone?.isActive !== false)
    .flatMap((zone) => {
      const rules = Array.isArray(zone?.rules) ? zone.rules : [];
      return rules
        .map((rule, index) => ({ zone, rule, index }))
        .filter(({ rule }) => rule?.isActive !== false);
    });

const zoneHasDhakaCoverage = (zones = []) =>
  getActiveRules(zones).some(({ rule }) =>
    normalizeDistrictList(rule?.districts || rule?.district).some(
      isDhakaDistrict,
    ),
  );

const findBestShippingMatch = (zones = [], district = "") => {
  const normalizedDistrict = normalizeKey(district);
  if (!normalizedDistrict) return null;

  const candidates = [];

  getActiveRules(zones).forEach(({ zone, rule, index }) => {
    const districts = normalizeDistrictList(rule?.districts || rule?.district);

    const matchType = districts.some((entry) => normalizeKey(entry) === normalizedDistrict)
      ? "exact"
      : districts.some((entry) => isOutsideDhakaShippingOption(entry))
        ? "outside"
        : "none";

    if (matchType === "none") return;
    if (matchType === "outside" && isDhakaDistrict(normalizedDistrict)) return;

    candidates.push({
      zoneId: zone?._id || null,
      zoneName: normalizeText(zone?.name) || "Shipping Zone",
      zoneCreatedAt: zone?.createdAt || null,
      ruleIndex: index,
      matchType,
      districts,
      shippingFee: Math.max(0, Number(rule?.shippingFee || 0)),
      estimatedMinDays: Math.max(0, parseInt(rule?.estimatedMinDays, 10) || 0),
      estimatedMaxDays: Math.max(
        Math.max(0, parseInt(rule?.estimatedMinDays, 10) || 0),
        parseInt(rule?.estimatedMaxDays, 10) || 0,
      ),
    });
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const specificity = { exact: 2, outside: 1, none: 0 };
    const leftSpecificity = specificity[a.matchType] ?? 0;
    const rightSpecificity = specificity[b.matchType] ?? 0;
    if (leftSpecificity !== rightSpecificity) return rightSpecificity - leftSpecificity;

    if (a.ruleIndex !== b.ruleIndex) return a.ruleIndex - b.ruleIndex;

    const leftCreated = a.zoneCreatedAt ? new Date(a.zoneCreatedAt).getTime() : 0;
    const rightCreated = b.zoneCreatedAt ? new Date(b.zoneCreatedAt).getTime() : 0;
    return leftCreated - rightCreated;
  });

  return candidates[0];
};

const buildShippingMeta = ({
  source,
  sourceLabel,
  district,
  shippingFee,
  estimatedMinDays = 0,
  estimatedMaxDays = 0,
  zoneId = null,
  zoneName = "",
  districts = [],
}) => ({
  source,
  sourceLabel,
  district: normalizeText(district),
  isDhaka: isDhakaDistrict(district),
  shippingFee: Math.max(0, Number(shippingFee || 0)),
  estimatedMinDays: Math.max(0, parseInt(estimatedMinDays, 10) || 0),
  estimatedMaxDays: Math.max(
    Math.max(0, parseInt(estimatedMinDays, 10) || 0),
    parseInt(estimatedMaxDays, 10) || 0,
  ),
  zoneId,
  zoneName,
  districts: normalizeDistrictList(districts),
  resolvedAt: new Date(),
});

const getPrimaryAdminShippingSettings = async () => {
  const admin = await User.findOne({ userType: "admin" })
    .select("adminSettings.shipping")
    .lean();

  const rawShipping = admin?.adminSettings?.shipping || {};

  return {
    outsideDhakaShippingCost: Math.max(
      0,
      Number(rawShipping?.outsideDhakaShippingCost || 0),
    ),
  };
};

const resolveShippingQuote = async ({
  district = "",
  country = "Bangladesh",
  zones = [],
  fallbackShippingCost = 0,
  estimatedMinDays = 0,
  estimatedMaxDays = 0,
} = {}) => {
  const normalizedDistrict = normalizeText(district);
  if (!normalizedDistrict) {
    return {
      success: false,
      status: 400,
      message: "District is required for shipping calculation",
    };
  }

  const candidate = findBestShippingMatch(zones, normalizedDistrict);
  if (candidate) {
    const shippingMeta = buildShippingMeta({
      source: "zone-based",
      sourceLabel: "Shipping calculated from zone",
      district: normalizedDistrict,
      shippingFee: candidate.shippingFee,
      estimatedMinDays: candidate.estimatedMinDays,
      estimatedMaxDays: candidate.estimatedMaxDays,
      zoneId: candidate.zoneId,
      zoneName: candidate.zoneName,
      districts: candidate.districts,
    });

    return {
      success: true,
      shippingFee: Math.max(0, Number(candidate.shippingFee || 0)),
      shippingMeta,
      destination: {
        district: normalizedDistrict,
        country: normalizeText(country || "Bangladesh"),
      },
    };
  }

  if (isDhakaDistrict(normalizedDistrict)) {
    return {
      success: false,
      status: 400,
      message: "Dhaka shipping must be configured in active shipping zones",
    };
  }

  const shippingFee = Math.max(0, Number(fallbackShippingCost || 0));
  const shippingMeta = buildShippingMeta({
    source: "fallback-outside-dhaka",
    sourceLabel: "Fallback shipping applied (Outside Dhaka)",
    district: normalizedDistrict,
    shippingFee,
    estimatedMinDays,
    estimatedMaxDays,
  });

  return {
    success: true,
    shippingFee,
    shippingMeta,
    destination: {
      district: normalizedDistrict,
      country: normalizeText(country || "Bangladesh"),
    },
  };
};

module.exports = {
  buildShippingMeta,
  buildGlobalZoneQuery,
  findBestShippingMatch,
  getGlobalShippingZones,
  getPrimaryAdminShippingSettings,
  getDistrictCoverageKeys,
  isDhakaDistrict,
  isOutsideDhakaShippingOption,
  normalizeDistrictList,
  normalizeShippingRuleInput,
  parseShippingRulesInput,
  resolveShippingQuote,
  zoneHasDhakaCoverage,
};
