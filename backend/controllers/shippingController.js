const mongoose = require("mongoose");
const ShippingZone = require("../models/ShippingZone");
const Product = require("../models/Product");
const {
  buildGlobalZoneQuery,
  getGlobalShippingZones,
  getPrimaryAdminShippingSettings,
  getDistrictCoverageKeys,
  normalizeDistrictList,
  parseShippingRulesInput,
  resolveShippingQuote,
  zoneHasDhakaCoverage,
} = require("../services/shippingService");
const {
  getDistrictNameFromKey,
  isDhakaDistrict,
} = require("../utils/bangladeshLocations");

const isAdmin = (user) =>
  String(user?.role || user?.userType || "")
    .trim()
    .toLowerCase() === "admin";

const normalizeZoneId = (value) => {
  const zoneId = String(value || "").trim();
  return mongoose.isValidObjectId(zoneId) ? zoneId : "";
};

const ensureAdmin = (req, res) => {
  if (!isAdmin(req.user)) {
    res.status(403).json({
      success: false,
      message: "Admin access required",
    });
    return false;
  }
  return true;
};
const legacyOwnerKey = ["ven", "dor"].join("");

const getRequestedItemsDeliveryWindow = async (items = []) => {
  const productIds = [
    ...new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => String(item?.productId || item?.product || "").trim())
        .filter((value) => mongoose.isValidObjectId(value)),
    ),
  ];

  if (!productIds.length) {
    return {
      estimatedMinDays: 0,
      estimatedMaxDays: 0,
    };
  }

  const products = await Product.find({ _id: { $in: productIds } })
    .select("deliveryMinDays deliveryMaxDays")
    .lean();
  const productMap = new Map(
    products.map((product) => [String(product._id), product]),
  );

  let estimatedMinDays = 0;
  let estimatedMaxDays = 0;

  (Array.isArray(items) ? items : []).forEach((item) => {
    const product = productMap.get(
      String(item?.productId || item?.product || ""),
    );
    if (!product) return;

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

const sanitizeZone = (zone) => {
  const source = typeof zone?.toObject === "function" ? zone.toObject() : zone;
  if (!source) return source;

  const {
    scope: _scope,
    [legacyOwnerKey]: _legacyOwner,
    __v: _version,
    ...safeZone
  } = source;
  safeZone._id = String(source?._id || "");
  if (safeZone.createdBy) safeZone.createdBy = String(safeZone.createdBy);
  if (safeZone.updatedBy) safeZone.updatedBy = String(safeZone.updatedBy);
  safeZone.rules = (Array.isArray(source.rules) ? source.rules : []).map(
    (rule) => {
      const {
        district: _district,
        __v: _ruleVersion,
        ...safeRule
      } = typeof rule?.toObject === "function" ? rule.toObject() : rule;

      return {
        ...safeRule,
        _id: String(rule?._id || safeRule?._id || ""),
        districts: normalizeDistrictList(safeRule.districts || _district),
      };
    },
  );

  return safeZone;
};

const getGlobalZones = (excludeZoneId = "") =>
  getGlobalShippingZones({ excludeZoneId });

const getRuleCoverageKeys = (rules = []) => {
  const keys = [];

  (Array.isArray(rules) ? rules : []).forEach((rule) => {
    getDistrictCoverageKeys(rule?.districts || rule?.district).forEach((key) =>
      keys.push(key),
    );
  });

  return keys;
};

const getZoneCoverageKeys = (zone = {}) =>
  getRuleCoverageKeys(Array.isArray(zone?.rules) ? zone.rules : []);

const formatDuplicateCoverage = (keys = []) => {
  const uniqueNames = [...new Set(keys)]
    .slice(0, 8)
    .map((key) => getDistrictNameFromKey(key))
    .filter(Boolean);

  if (!uniqueNames.length) return "selected districts";

  const suffix = keys.length > uniqueNames.length ? " and more" : "";
  return `${uniqueNames.join(", ")}${suffix}`;
};

const findDuplicateCoverageWithinRules = (rules = []) => {
  const seen = new Set();
  const duplicates = new Set();

  getRuleCoverageKeys(rules).forEach((key) => {
    if (seen.has(key)) {
      duplicates.add(key);
      return;
    }
    seen.add(key);
  });

  return [...duplicates];
};

const findDuplicateCoverageAgainstZones = (rules = [], zones = []) => {
  const proposedKeys = new Set(getRuleCoverageKeys(rules));
  const existingKeys = new Set();

  (Array.isArray(zones) ? zones : []).forEach((zone) => {
    getZoneCoverageKeys(zone).forEach((key) => existingKeys.add(key));
  });

  return [...proposedKeys].filter((key) => existingKeys.has(key));
};

const rulesHaveDhaka = (rules = []) =>
  (Array.isArray(rules) ? rules : []).some((rule) =>
    normalizeDistrictList(rule?.districts || rule?.district).some(
      isDhakaDistrict,
    ),
  );

const rulesOnlyCoverDhaka = (rules = []) => {
  const keys = new Set(getRuleCoverageKeys(rules));
  return keys.size === 1 && keys.has("dhaka");
};

const validateZoneRules = async ({
  rules,
  excludeZoneId = "",
  zoneIsActive = true,
}) => {
  const duplicateWithinRules = findDuplicateCoverageWithinRules(rules);
  if (duplicateWithinRules.length) {
    return {
      success: false,
      status: 400,
      message: `Each district can be used only once per zone. Duplicate: ${formatDuplicateCoverage(
        duplicateWithinRules,
      )}`,
    };
  }

  const otherZones = await getGlobalZones(excludeZoneId);
  const otherActiveZones = otherZones.filter(
    (zone) => zone?.isActive !== false,
  );
  const otherZonesHaveDhaka = zoneHasDhakaCoverage(otherActiveZones);

  if (zoneIsActive && !otherZonesHaveDhaka) {
    if (!rulesHaveDhaka(rules)) {
      return {
        success: false,
        status: 400,
        message: "Create the Dhaka shipping zone first",
      };
    }

    if (!rulesOnlyCoverDhaka(rules)) {
      return {
        success: false,
        status: 400,
        message: "The first shipping zone can only include Dhaka",
      };
    }
  }

  const duplicateAgainstZones = findDuplicateCoverageAgainstZones(
    rules,
    otherActiveZones,
  );
  if (zoneIsActive && duplicateAgainstZones.length) {
    return {
      success: false,
      status: 400,
      message: `These districts are already covered by another zone: ${formatDuplicateCoverage(
        duplicateAgainstZones,
      )}`,
    };
  }

  if (!zoneIsActive && !otherZonesHaveDhaka) {
    return {
      success: false,
      status: 400,
      message: "At least one active Dhaka shipping zone is required",
    };
  }

  return { success: true };
};

const computeShippingEstimate = async ({ district, country, items = [] }) => {
  const shippingSettings = await getPrimaryAdminShippingSettings();
  const globalZones = await getGlobalShippingZones({
    activeOnly: true,
    sort: { createdAt: 1 },
  });
  const itemDeliveryWindow = await getRequestedItemsDeliveryWindow(items);

  const quote = await resolveShippingQuote({
    district,
    country,
    zones: globalZones,
    fallbackShippingCost: shippingSettings.outsideDhakaShippingCost,
    estimatedMinDays: itemDeliveryWindow.estimatedMinDays,
    estimatedMaxDays: itemDeliveryWindow.estimatedMaxDays,
  });

  if (!quote.success) {
    return quote;
  }

  return {
    success: true,
    shippingFee:
      Math.round((Number(quote.shippingFee || 0) + Number.EPSILON) * 100) / 100,
    shippingMeta: {
      ...(quote.shippingMeta || {}),
      estimatedMinDays:
        quote.shippingMeta?.estimatedMinDays ||
        itemDeliveryWindow.estimatedMinDays ||
        0,
      estimatedMaxDays:
        quote.shippingMeta?.estimatedMaxDays ||
        itemDeliveryWindow.estimatedMaxDays ||
        0,
    },
    estimatedMinDays:
      quote.shippingMeta?.estimatedMinDays ||
      itemDeliveryWindow.estimatedMinDays ||
      0,
    estimatedMaxDays:
      quote.shippingMeta?.estimatedMaxDays ||
      itemDeliveryWindow.estimatedMaxDays ||
      0,
    destination: quote.destination,
  };
};

exports.estimateShipping = async (req, res) => {
  try {
    const {
      district = "",
      country = "Bangladesh",
      items = [],
    } = req.body || {};

    const estimate = await computeShippingEstimate({
      district,
      country,
      items,
    });

    if (!estimate.success) {
      return res.status(estimate.status).json({
        success: false,
        message: estimate.message,
      });
    }

    res.json({
      success: true,
      ...estimate,
    });
  } catch (error) {
    console.error("Estimate shipping error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while estimating shipping",
    });
  }
};

exports.getAdminShippingZones = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const zones = await getGlobalZones();

    res.json({
      success: true,
      zones: zones.map(sanitizeZone),
    });
  } catch (error) {
    console.error("Get admin shipping zones error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching shipping zones",
    });
  }
};

exports.createAdminShippingZone = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const rules = parseShippingRulesInput(req.body?.rules);
    if (!rules.length) {
      return res.status(400).json({
        success: false,
        message: "At least one active shipping rule is required",
      });
    }

    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Zone name is required",
      });
    }

    const validation = await validateZoneRules({
      rules,
      zoneIsActive: req.body?.isActive !== false,
    });
    if (!validation.success) {
      return res.status(validation.status).json({
        success: false,
        message: validation.message,
      });
    }

    const zone = await ShippingZone.create({
      name,
      isActive: req.body?.isActive !== false,
      rules,
      createdBy: req.user?._id || req.user?.id || null,
      updatedBy: req.user?._id || req.user?.id || null,
    });

    res.status(201).json({
      success: true,
      message: "Shipping zone created successfully",
      zone: sanitizeZone(zone),
    });
  } catch (error) {
    console.error("Create admin shipping zone error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating shipping zone",
    });
  }
};

exports.updateAdminShippingZone = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const zoneId = normalizeZoneId(req.params.id);
    if (!zoneId) {
      return res.status(400).json({
        success: false,
        message: "Invalid shipping zone id",
      });
    }

    const zone = await ShippingZone.findOne({
      _id: zoneId,
      ...buildGlobalZoneQuery(),
    }).lean();

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Shipping zone not found",
      });
    }

    const nextName =
      req.body?.name !== undefined
        ? String(req.body.name || "").trim()
        : String(zone.name || "").trim();
    if (!nextName) {
      return res.status(400).json({
        success: false,
        message: "Zone name is required",
      });
    }

    const nextRules =
      req.body?.rules !== undefined
        ? parseShippingRulesInput(req.body.rules)
        : parseShippingRulesInput(zone.rules || []);
    if (!nextRules.length) {
      return res.status(400).json({
        success: false,
        message: "At least one active shipping rule is required",
      });
    }

    const nextIsActive =
      req.body?.isActive !== undefined
        ? Boolean(req.body.isActive)
        : zone.isActive !== false;

    const validation = await validateZoneRules({
      rules: nextRules,
      excludeZoneId: zone._id,
      zoneIsActive: nextIsActive,
    });
    if (!validation.success) {
      return res.status(validation.status).json({
        success: false,
        message: validation.message,
      });
    }

    const updatedZone = await ShippingZone.findOneAndUpdate(
      {
        _id: zone._id,
        ...buildGlobalZoneQuery(),
      },
      {
        $set: {
          name: nextName,
          isActive: nextIsActive,
          rules: nextRules,
          updatedBy: req.user?._id || req.user?.id || null,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedZone) {
      return res.status(404).json({
        success: false,
        message: "Shipping zone not found",
      });
    }

    res.json({
      success: true,
      message: "Shipping zone updated successfully",
      zone: sanitizeZone(updatedZone),
    });
  } catch (error) {
    console.error("Update admin shipping zone error:", error);
    if (error?.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message:
          Object.values(error.errors || {})
            .map((entry) => entry?.message)
            .filter(Boolean)
            .join(", ") || "Invalid shipping zone data",
      });
    }
    res.status(500).json({
      success: false,
      message: "Server error while updating shipping zone",
    });
  }
};

exports.deleteAdminShippingZone = async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;
    const zoneId = normalizeZoneId(req.params.id);
    if (!zoneId) {
      return res.status(400).json({
        success: false,
        message: "Invalid shipping zone id",
      });
    }

    const existingZone = await ShippingZone.findOne({
      _id: zoneId,
      ...buildGlobalZoneQuery(),
    }).lean();

    if (!existingZone) {
      return res.status(404).json({
        success: false,
        message: "Shipping zone not found",
      });
    }

    const remainingZones = await getGlobalZones(existingZone._id);
    const remainingActiveZones = remainingZones.filter(
      (zone) => zone?.isActive !== false,
    );

    if (!zoneHasDhakaCoverage(remainingActiveZones)) {
      return res.status(400).json({
        success: false,
        message: "Dhaka shipping must stay defined in active shipping zones",
      });
    }

    await ShippingZone.findOneAndDelete({
      _id: zoneId,
      ...buildGlobalZoneQuery(),
    });

    res.json({
      success: true,
      message: "Shipping zone deleted successfully",
    });
  } catch (error) {
    console.error("Delete admin shipping zone error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting shipping zone",
    });
  }
};
