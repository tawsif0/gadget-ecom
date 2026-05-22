const normalizeString = (value) => String(value || "").trim();
const isHexColorValue = (value) =>
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalizeString(value));
const GENERIC_COLOR_LABELS = new Set([
  "color",
  "colors",
  "custom color",
  "custom colours",
  "custom colors",
  "choose color",
  "select color",
]);
const COLOR_NAME_BY_HEX = {
  "#000000": "Black",
  "#ffffff": "White",
  "#dc2626": "Red",
  "#ef4444": "Red",
  "#b91c1c": "Red",
  "#2563eb": "Blue",
  "#1d4ed8": "Blue",
  "#3b82f6": "Blue",
  "#16a34a": "Green",
  "#22c55e": "Green",
  "#15803d": "Green",
  "#ca8a04": "Yellow",
  "#eab308": "Yellow",
  "#facc15": "Yellow",
  "#ea580c": "Orange",
  "#f97316": "Orange",
  "#fb923c": "Orange",
  "#9333ea": "Purple",
  "#a855f7": "Purple",
  "#7e22ce": "Purple",
  "#db2777": "Pink",
  "#ec4899": "Pink",
  "#be185d": "Pink",
  "#6b7280": "Gray",
  "#9ca3af": "Gray",
  "#4b5563": "Gray",
  "#f0deba": "Beige",
  "#d4b996": "Beige",
  "#a16207": "Brown",
  "#92400e": "Brown",
  "#14b8a6": "Teal",
  "#06b6d4": "Cyan",
  "#0ea5e9": "Sky Blue",
};

const normalizeColorHex = (value) => {
  const raw = normalizeString(value);
  if (!raw) return "";

  const prefixed = raw.startsWith("#") ? raw : `#${raw}`;
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(prefixed)) {
    return "";
  }

  return prefixed.toLowerCase();
};

const getReadableColorLabel = (value, fallback = "Color") => {
  const normalizedHex = normalizeColorHex(value);
  if (normalizedHex && COLOR_NAME_BY_HEX[normalizedHex]) {
    return COLOR_NAME_BY_HEX[normalizedHex];
  }

  const normalizedValue = normalizeString(value);
  if (normalizedValue && !isHexColorValue(normalizedValue)) {
    return normalizedValue;
  }

  return fallback;
};

const getReadableVariantOptionLabel = (variant = {}) => {
  const preset = normalizeString(variant?.preset).toLowerCase();
  const label = normalizeString(variant?.label);
  const value = normalizeString(variant?.value);
  const colorHex = normalizeColorHex(variant?.colorHex || value || label);
  const normalizedLabel = label.toLowerCase();
  const normalizedValue = value.toLowerCase();
  const shouldSkipLabel =
    !label ||
    isHexColorValue(label) ||
    GENERIC_COLOR_LABELS.has(normalizedLabel);
  const shouldSkipValue =
    !value ||
    isHexColorValue(value) ||
    GENERIC_COLOR_LABELS.has(normalizedValue);

  if (preset === "color") {
    if (!shouldSkipLabel) return label;
    if (!shouldSkipValue) return value;
    return getReadableColorLabel(colorHex || value || label);
  }

  return label || value || "Option";
};

const normalizeVariantPrice = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const normalizeVariantPriceMode = (value, option = {}) => {
  const raw = normalizeString(value).toLowerCase();
  const price = normalizeVariantPrice(option?.price);
  const comparePrice = normalizeVariantPrice(option?.comparePrice);
  const hasDirect = price !== null;
  const hasCompare = comparePrice !== null && comparePrice > price;

  if (raw === "compare" && hasDirect && hasCompare) {
    return "compare";
  }

  if (raw === "direct" && hasDirect) {
    return "direct";
  }

  if (hasDirect && hasCompare) {
    return "compare";
  }

  if (hasDirect) {
    return "direct";
  }

  return "default";
};

const normalizeVariantPricing = (option = {}) => {
  const price = normalizeVariantPrice(option?.price);
  const comparePrice = normalizeVariantPrice(option?.comparePrice);
  const priceMode = normalizeVariantPriceMode(option?.priceMode, {
    price,
    comparePrice,
  });

  if (priceMode === "compare") {
    return {
      priceMode,
      price,
      comparePrice,
    };
  }

  if (priceMode === "direct") {
    return {
      priceMode,
      price,
      comparePrice: null,
    };
  }

  return {
    priceMode: "default",
    price: null,
    comparePrice: null,
  };
};

const dedupeByKey = (items, keyFn) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const normalizeOption = (option = {}, preset = "custom") => {
  if (!option || typeof option !== "object" || Array.isArray(option)) {
    return null;
  }

  const label = normalizeString(option.label || option.value || option.colorHex);
  const value = normalizeString(option.value || option.label || option.colorHex);
  const colorHex =
    preset === "color"
      ? normalizeColorHex(option.colorHex || option.value || option.label)
      : "";
  const pricing = normalizeVariantPricing(option);

  if (!label && !value && !colorHex) {
    return null;
  }

  return {
    label: label || value || colorHex,
    value: value || label || colorHex,
    colorHex,
    priceMode: pricing.priceMode,
    price: pricing.price,
    comparePrice: pricing.comparePrice,
  };
};

const normalizeVariantDefinitions = (product = {}) =>
  dedupeByKey(
    (Array.isArray(product?.variantDefinitions) ? product.variantDefinitions : [])
      .map((definition) => {
        const preset = ["size", "color", "custom"].includes(
          normalizeString(definition?.preset).toLowerCase(),
        )
          ? normalizeString(definition?.preset).toLowerCase()
          : "custom";
        const name =
          normalizeString(definition?.name || definition?.label) ||
          (preset === "size" ? "Size" : preset === "color" ? "Color" : "");
        const options = dedupeByKey(
          (Array.isArray(definition?.options) ? definition.options : [])
            .map((option) => normalizeOption(option, preset))
            .filter(Boolean),
          (option) =>
            preset === "color"
              ? option.colorHex || option.value.toLowerCase()
              : option.value.toLowerCase(),
        );

        if (!name || !options.length) return null;
        return {
          preset,
          name,
          options,
        };
      })
      .filter(Boolean),
    (definition) => definition.name.toLowerCase(),
  );

const normalizeSelectedVariantsPayload = (selectedVariants = []) =>
  dedupeByKey(
    (Array.isArray(selectedVariants) ? selectedVariants : [])
      .map((variant) => {
        const name = normalizeString(variant?.name);
        const preset = ["size", "color", "custom"].includes(
          normalizeString(variant?.preset || variant?.kind).toLowerCase(),
        )
          ? normalizeString(variant?.preset || variant?.kind).toLowerCase()
          : "custom";
        const label = normalizeString(variant?.label || variant?.value);
        const value = normalizeString(variant?.value || variant?.label);
        const colorHex =
          preset === "color"
            ? normalizeColorHex(variant?.colorHex || variant?.value || variant?.label)
            : "";
        const pricing = normalizeVariantPricing(variant);

        if (!name || !value) {
          return null;
        }

        return {
          name,
          preset,
          label: label || value,
          value,
          colorHex,
          priceMode: pricing.priceMode,
          price: pricing.price,
          comparePrice: pricing.comparePrice,
        };
      })
      .filter(Boolean),
    (variant) =>
      `${variant.name.toLowerCase()}:${variant.preset === "color" ? variant.colorHex || variant.value.toLowerCase() : variant.value.toLowerCase()}`,
  );

const findMatchingOption = (definition, selection = {}) => {
  const selectedValue = normalizeString(selection?.value || selection?.label);
  const selectedColorHex = normalizeColorHex(
    selection?.colorHex || selection?.value || selection?.label,
  );

  return (
    (Array.isArray(definition?.options) ? definition.options : []).find((option) => {
      if (String(definition?.preset || "").toLowerCase() === "color" && selectedColorHex) {
        return option.colorHex === selectedColorHex;
      }

      return (
        normalizeString(option?.value).toLowerCase() === selectedValue.toLowerCase() ||
        normalizeString(option?.label).toLowerCase() === selectedValue.toLowerCase()
      );
    }) || null
  );
};

const buildSelectedVariantSummary = (selectedVariants = []) =>
  normalizeSelectedVariantsPayload(selectedVariants)
    .filter((variant) => String(variant?.preset || "").toLowerCase() !== "color")
    .map((variant) => `${variant.name}: ${getReadableVariantOptionLabel(variant)}`)
    .filter(Boolean)
    .join(", ");

const normalizeSelectedVariantsForProduct = (product, selectedVariants = []) => {
  const definitions = normalizeVariantDefinitions(product);
  if (!definitions.length) {
    return {
      selectedVariants: [],
      variationLabel: "",
    };
  }

  const requestedSelections = normalizeSelectedVariantsPayload(selectedVariants);
  if (!requestedSelections.length) {
    return {
      selectedVariants: [],
      variationLabel: "",
    };
  }

  const normalizedSelections = [];

  for (const selection of requestedSelections) {
    const definition =
      definitions.find(
        (entry) =>
          normalizeString(entry?.name).toLowerCase() ===
          normalizeString(selection?.name).toLowerCase(),
      ) ||
      (String(selection?.preset || "").toLowerCase() === "color"
        ? definitions.find((entry) => entry.preset === "color")
        : null);

    if (!definition) {
      return {
        error: `Selected ${normalizeString(selection?.name || "variant").toLowerCase()} is not available`,
      };
    }

    const matchedOption = findMatchingOption(definition, selection);
    if (!matchedOption) {
      return {
        error: `Selected ${definition.name.toLowerCase()} is not available`,
      };
    }

    normalizedSelections.push({
      name: definition.name,
      preset: definition.preset,
      label: matchedOption.label || matchedOption.value,
      value: matchedOption.value || matchedOption.label,
      colorHex:
        definition.preset === "color"
          ? normalizeColorHex(matchedOption.colorHex || matchedOption.value || matchedOption.label)
          : "",
      priceMode: normalizeVariantPriceMode(matchedOption.priceMode, matchedOption),
      price: normalizeVariantPrice(matchedOption.price),
      comparePrice: normalizeVariantPrice(matchedOption.comparePrice),
    });
  }

  return {
    selectedVariants: normalizedSelections,
    variationLabel: buildSelectedVariantSummary(normalizedSelections),
  };
};

const getVariantPriceOverride = (
  selectedVariants = [],
  { basePrice = 0, baseComparePrice = null } = {},
) => {
  let hasOverride = false;
  let hasCompareOverride = false;
  let price = normalizeVariantPrice(basePrice) || 0;
  let comparePrice = normalizeVariantPrice(baseComparePrice);
  const normalizedBasePrice = normalizeVariantPrice(basePrice) || 0;
  const normalizedBaseComparePrice = normalizeVariantPrice(baseComparePrice);
  if (!Number.isFinite(comparePrice) || comparePrice <= price) {
    comparePrice = normalizedBasePrice;
  } else {
    hasCompareOverride = true;
  }

  normalizeSelectedVariantsPayload(selectedVariants).forEach((variant) => {
    const pricing = normalizeVariantPricing(variant);
    const usesProductPrice = pricing.price === null;
    if (usesProductPrice) return;

    const effectivePrice = pricing.price;
    const effectiveComparePrice =
      pricing.priceMode === "compare" &&
      pricing.comparePrice !== null &&
      pricing.comparePrice > pricing.price
        ? pricing.comparePrice
        : null;

    if (effectivePrice === null) return;

    hasOverride = true;
    price += effectivePrice;

    if (effectiveComparePrice !== null && effectiveComparePrice > effectivePrice) {
      hasCompareOverride = true;
      comparePrice += effectiveComparePrice;
    } else {
      comparePrice += effectivePrice;
    }
  });

  if (!hasOverride) {
    return null;
  }

  return {
    price,
    comparePrice,
    hasCompareOverride,
  };
};

const resolveProductPricingForSelection = ({
  basePrice = 0,
  baseComparePrice = null,
  selectedVariants = [],
}) => {
  const normalizedBasePrice = normalizeVariantPrice(basePrice) || 0;
  const normalizedBaseComparePrice = normalizeVariantPrice(baseComparePrice);
  const override = getVariantPriceOverride(selectedVariants, {
    basePrice: normalizedBasePrice,
    baseComparePrice: normalizedBaseComparePrice,
  });

  if (!override) {
    return {
      price: normalizedBasePrice,
      comparePrice:
        normalizedBaseComparePrice !== null && normalizedBaseComparePrice > normalizedBasePrice
          ? normalizedBaseComparePrice
          : null,
    };
  }

  const resolvedPrice = override.price;
  const resolvedComparePrice = override.hasCompareOverride
    ? override.comparePrice
    : null;

  return {
    price: Math.round((resolvedPrice + Number.EPSILON) * 100) / 100,
    comparePrice:
      resolvedComparePrice !== null && resolvedComparePrice > resolvedPrice
        ? Math.round((resolvedComparePrice + Number.EPSILON) * 100) / 100
        : null,
  };
};

module.exports = {
  buildSelectedVariantSummary,
  getVariantPriceOverride,
  normalizeSelectedVariantsForProduct,
  normalizeSelectedVariantsPayload,
  normalizeVariantDefinitions,
  normalizeVariantPrice,
  normalizeVariantPriceMode,
  normalizeVariantPricing,
  resolveProductPricingForSelection,
};
