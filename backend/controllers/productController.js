const Product = require("../models/Product.js");
const Category = require("../models/Category.js");
const ProductImage = require("../models/ProductImage");
const Brand = require("../models/Brand");
const Vendor = require("../models/Vendor");
const {
  attachImageDataToProducts,
  normalizeImageString,
  isObjectIdLike,
} = require("../utils/imageUtils");
const {
  normalizeVariantPrice,
  normalizeVariantPriceMode,
} = require("../utils/productVariants");
const { uploadImageBuffer, deleteImage } = require("../config/cloudinary");
const { isAdmin } = require("../utils/vendorUtils");
const { clearResponseCacheByPrefix } = require("../middlewares/responseCache");
const {
  assertVendorCanUploadProducts,
  incrementVendorUploadCount,
} = require("../utils/subscriptionUtils");

const PRODUCT_UPLOAD_OPTIONS = {
  folder: "ecommerce/products",
  resource_type: "image",
  transformation: [{ quality: "auto:best", fetch_format: "auto" }],
};
const PRODUCT_VIDEO_UPLOAD_OPTIONS = {
  folder: "ecommerce/products/videos",
  resource_type: "video",
};
const MAX_PRODUCT_VIDEO_SIZE_BYTES = 9 * 1024 * 1024;

const uploadProductImage = async (file) => {
  if (!file?.buffer) return null;
  const result = await uploadImageBuffer(file.buffer, PRODUCT_UPLOAD_OPTIONS);
  return result;
};

const uploadProductVideo = async (file) => {
  if (!file?.buffer) return null;
  const result = await uploadImageBuffer(file.buffer, PRODUCT_VIDEO_UPLOAD_OPTIONS);
  return result;
};

const getUploadedImageFiles = (files) => {
  if (Array.isArray(files)) return files;
  return Array.isArray(files?.images) ? files.images : [];
};

const getUploadedVideoFiles = (files) => {
  const nextFiles = [];

  if (Array.isArray(files?.videos)) {
    nextFiles.push(...files.videos);
  }

  if (Array.isArray(files?.video) && files.video[0]) {
    nextFiles.push(files.video[0]);
  }

  return nextFiles.slice(0, 3);
};

const isVendorUser = () => false;

const PUBLIC_VENDOR_POPULATE_FIELDS =
  "storeName slug logo status storePrivacy vacationMode city country ratingAverage ratingCount openingHours";

const isPublicVendorVisible = (vendor) => {
  if (!vendor) return true;
  return (
    String(vendor.status || "") === "approved" &&
    String(vendor.storePrivacy || "public") !== "private"
  );
};

const filterPublicProductsByVendor = (products = []) =>
  products.filter((product) => isPublicVendorVisible(product?.vendor));
const invalidatePublicProductCache = () => {
  clearResponseCacheByPrefix("/api/products/public");
};
const HOME_CATALOG_PRODUCT_SELECT =
  "title price salePrice priceType showStockToPublic images videos video youtubeVideoUrls youtubeVideoUrl category brand description colors features dimensions vendor productType marketplaceType stock allowBackorder variations variantDefinitions deliveryMinDays deliveryMaxDays ratingAverage ratingCount createdAt";
const HOME_CATALOG_TYPES = [
  "Popular",
  "Hot deals",
  "General",
  "Best Selling",
  "Latest",
];
const HOME_CATALOG_PRODUCTS_PER_CATEGORY = 12;

const getApprovedVendorForUser = async (userId) => {
  if (!userId) return null;

  return Vendor.findOne({
    user: userId,
    status: "approved",
  });
};

const normalizeProductTypeLabel = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  const match = HOME_CATALOG_TYPES.find(
    (entry) => entry.toLowerCase() === raw,
  );
  return match || "General";
};

const resolveProductCategoryIdentity = (product) => {
  const productCategory = product?.category;

  if (productCategory && typeof productCategory === "object") {
    return {
      id: String(productCategory._id || "general"),
      name: String(productCategory.name || "General").trim() || "General",
    };
  }

  if (typeof productCategory === "string" && productCategory.trim()) {
    return {
      id: productCategory.trim(),
      name: "General",
    };
  }

  return {
    id: "general",
    name: "General",
  };
};

const buildHomeCatalogSections = (products = []) => {
  const sections = Object.fromEntries(
    HOME_CATALOG_TYPES.map((type) => [type, { categories: [] }]),
  );
  const groupedByType = new Map();

  products.forEach((product) => {
    const type = normalizeProductTypeLabel(
      product?.productType || product?.category?.type,
    );
    const category = resolveProductCategoryIdentity(product);
    const typeKey = `${type}::${category.id}`;

    if (!groupedByType.has(typeKey)) {
      groupedByType.set(typeKey, {
        type,
        categoryId: category.id,
        categoryName: category.name,
        products: [],
      });
    }

    const entry = groupedByType.get(typeKey);
    if (entry.products.length < HOME_CATALOG_PRODUCTS_PER_CATEGORY) {
      entry.products.push(product);
    }
  });

  groupedByType.forEach((entry) => {
    sections[entry.type].categories.push({
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      products: entry.products,
    });
  });

  HOME_CATALOG_TYPES.forEach((type) => {
    sections[type].categories.sort((left, right) =>
      String(left.categoryName || "").localeCompare(String(right.categoryName || "")),
    );
  });

  return sections;
};

const buildHomeCatalogBrands = async (products = []) => {
  const productBrandNames = Array.from(
    new Set(
      products
        .map((product) => String(product?.brand || "").trim())
        .filter(Boolean),
    ),
  );

  const brands = await Brand.find({ isActive: true })
    .select("name logoUrl description")
    .sort({ name: 1 })
    .lean();

  const merged = [];
  const seen = new Set();

  brands.forEach((brand) => {
    const name = String(brand?.name || "").trim();
    if (!name) return;

    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      name,
      logoUrl: String(brand?.logoUrl || "").trim(),
      description: String(brand?.description || "").trim(),
    });
  });

  productBrandNames.forEach((name) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({
      name,
      logoUrl: "",
      description: "Shop brand collection",
    });
  });

  return merged;
};

const MARKETPLACE_TYPES = new Set([
  "simple",
  "variable",
  "digital",
  "service",
  "grouped",
]);
const PRICE_TYPES = new Set(["single", "best", "tba"]);
const COMMISSION_TYPES = new Set(["inherit", "percentage", "fixed", "hybrid"]);
const RECURRING_INTERVALS = new Set(["weekly", "monthly", "quarterly", "yearly"]);

const asString = (value, fallback = "") =>
  value === undefined || value === null ? fallback : String(value);

const parseJsonMaybe = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return value;
  }
};

const asNonNegativeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const asNullableNonNegativeNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const asNonNegativeInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const asBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const normalizeMarketplaceType = (value, fallback = "simple") => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (MARKETPLACE_TYPES.has(normalizedValue)) return normalizedValue;

  const normalizedFallback = String(fallback || "simple").trim().toLowerCase();
  if (MARKETPLACE_TYPES.has(normalizedFallback)) return normalizedFallback;

  return "simple";
};

const normalizePriceType = (value, fallback = "single") => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (PRICE_TYPES.has(normalizedValue)) return normalizedValue;

  const normalizedFallback = String(fallback || "single").trim().toLowerCase();
  if (PRICE_TYPES.has(normalizedFallback)) return normalizedFallback;

  return "single";
};

const normalizeCommissionType = (value, fallback = "inherit") => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (COMMISSION_TYPES.has(normalizedValue)) return normalizedValue;

  const normalizedFallback = String(fallback || "inherit").trim().toLowerCase();
  if (COMMISSION_TYPES.has(normalizedFallback)) return normalizedFallback;

  return "inherit";
};

const normalizeRecurringInterval = (value, fallback = "monthly") => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (RECURRING_INTERVALS.has(normalizedValue)) return normalizedValue;

  const normalizedFallback = String(fallback || "monthly").trim().toLowerCase();
  if (RECURRING_INTERVALS.has(normalizedFallback)) return normalizedFallback;

  return "monthly";
};

const normalizeProductVideoEntries = (value, fallback = []) => {
  const parsedValue = parseJsonMaybe(value, fallback);
  const source = Array.isArray(parsedValue) ? parsedValue : [];

  return source
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          url: entry.trim(),
          publicId: "",
          mimeType: "",
        };
      }

      return {
        url: asString(entry?.url || entry?.src || entry?.video).trim(),
        publicId: asString(entry?.publicId).trim(),
        mimeType: asString(entry?.mimeType).trim(),
      };
    })
    .filter((entry) => Boolean(entry.url));
};

const normalizeYouTubeVideoUrls = (value, fallback = []) => {
  const parsedValue = parseJsonMaybe(value, fallback);
  const source = Array.isArray(parsedValue)
    ? parsedValue
    : value === undefined || value === null || value === ""
      ? fallback
      : [parsedValue];

  return [...new Set(source.map((entry) => asString(entry).trim()).filter(Boolean))];
};

const getExistingProductVideos = (product) => {
  const normalizedVideos = normalizeProductVideoEntries(product?.videos, []);
  if (normalizedVideos.length > 0) return normalizedVideos;

  const legacyUrl = asString(product?.video).trim();
  if (!legacyUrl) return [];

  return [
    {
      url: legacyUrl,
      publicId: asString(product?.videoPublicId).trim(),
      mimeType: asString(product?.videoMimeType).trim(),
    },
  ];
};

const syncLegacyVideoFields = (payload, videos = [], youtubeVideoUrls = []) => {
  const nextVideos = normalizeProductVideoEntries(videos, []);
  const nextYoutubeVideoUrls = normalizeYouTubeVideoUrls(youtubeVideoUrls, []);
  const primaryVideo = nextVideos[0] || null;

  return {
    ...payload,
    videos: nextVideos,
    video: primaryVideo?.url || "",
    videoPublicId: primaryVideo?.publicId || "",
    videoMimeType: primaryVideo?.mimeType || "",
    youtubeVideoUrls: nextYoutubeVideoUrls,
    youtubeVideoUrl: nextYoutubeVideoUrls[0] || "",
  };
};

const normalizePublicationStatus = (value, fallback = "draft") => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  if (["draft", "published"].includes(normalizedValue)) {
    return normalizedValue;
  }

  const normalizedFallback = String(fallback || "draft").trim().toLowerCase();
  if (["draft", "published"].includes(normalizedFallback)) {
    return normalizedFallback;
  }

  return "draft";
};

const normalizeStringArray = (value) => {
  const parsed = parseJsonMaybe(value, value);

  if (Array.isArray(parsed)) {
    return parsed.map((entry) => asString(entry).trim()).filter(Boolean);
  }

  if (typeof parsed === "string") {
    return parsed
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeSpecifications = (value) => {
  const parsed = parseJsonMaybe(value, value);

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry) => {
      if (!entry) return null;

      if (typeof entry === "string") {
        const [key, ...rest] = entry.split(":");
        return {
          key: asString(key).trim(),
          value: asString(rest.join(":")).trim(),
        };
      }

      return {
        key: asString(entry.key).trim(),
        value: asString(entry.value).trim(),
      };
    })
    .filter((entry) => entry && entry.key && entry.value);
};

const normalizeVariations = (value) => {
  const parsed = parseJsonMaybe(value, value);

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry) => {
      if (!entry) return null;

      const label = asString(entry.label).trim();
      if (!label) return null;

      const attributes = Array.isArray(entry.attributes)
        ? entry.attributes
            .map((attribute) => ({
              key: asString(attribute?.key).trim(),
              value: asString(attribute?.value).trim(),
            }))
            .filter((attribute) => attribute.key && attribute.value)
        : [];

      const price = asNonNegativeNumber(entry.price, NaN);
      if (!Number.isFinite(price)) return null;

      const salePrice = asNullableNonNegativeNumber(entry.salePrice);
      const stock = asNonNegativeInteger(entry.stock, 0);

      return {
        _id:
          entry._id && /^[0-9a-fA-F]{24}$/.test(String(entry._id))
            ? entry._id
            : undefined,
        label,
        sku: asString(entry.sku).trim(),
        price,
        salePrice:
          salePrice !== null && salePrice <= price ? salePrice : salePrice !== null ? price : null,
        stock,
        isActive: asBoolean(entry.isActive, true),
        attributes,
      };
    })
    .filter(Boolean);
};

const normalizeVariantDefinitions = (value) => {
  const parsed = parseJsonMaybe(value, value);

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry) => {
      if (!entry) return null;

      const rawPreset = String(entry.preset || entry.type || "custom")
        .trim()
        .toLowerCase();
      const preset = ["size", "color", "custom"].includes(rawPreset)
        ? rawPreset
        : "custom";
      const resolvedName =
        asString(entry.name || entry.label || entry.typeName).trim() ||
        (preset === "size" ? "Size" : preset === "color" ? "Color" : "");

      const optionsSource = Array.isArray(entry.options)
        ? entry.options
        : Array.isArray(entry.values)
          ? entry.values
          : [];

      const options = optionsSource
        .map((option) => {
          if (!option) return null;

          if (typeof option === "string") {
            const next = option.trim();
            if (!next) return null;
          return {
            label: next,
            value: next,
            colorHex:
              preset === "color" && /^#[0-9a-fA-F]{6}$/.test(next) ? next : "",
            priceMode: "default",
            price: null,
            comparePrice: null,
          };
        }

        const label = asString(option.label || option.name || option.value).trim();
        const valueText = asString(option.value || option.label || option.name).trim();
          const colorHex = asString(
            option.colorHex || option.hex || option.color || option.value,
          ).trim();

          if (!label && !valueText && !colorHex) return null;

          const price = normalizeVariantPrice(option.price);
          const comparePrice = normalizeVariantPrice(option.comparePrice);
          const priceMode = normalizeVariantPriceMode(option.priceMode, {
            price,
            comparePrice,
          });

          return {
            label: label || valueText || colorHex,
            value: valueText || label || colorHex,
            colorHex:
              preset === "color" && /^#[0-9a-fA-F]{6}$/.test(colorHex) ? colorHex : "",
            priceMode,
            price: priceMode === "default" ? null : price,
            comparePrice: priceMode === "compare" ? comparePrice : null,
          };
        })
        .filter(Boolean);

      if (!resolvedName || options.length === 0) return null;

      return {
        preset,
        name: resolvedName,
        options,
      };
    })
    .filter(Boolean);
};

const deriveProductColors = (fallbackColors = [], variantDefinitions = []) => {
  const variantColors = variantDefinitions
    .filter(
      (variant) =>
        String(variant?.preset || "").trim().toLowerCase() === "color" ||
        String(variant?.name || "").trim().toLowerCase() === "color",
    )
    .flatMap((variant) => variant.options || [])
    .map((option) => String(option?.colorHex || option?.value || "").trim().toLowerCase())
    .filter((value) => /^#[0-9a-f]{6}$/.test(value));

  if (variantColors.length > 0) {
    return [...new Set(variantColors)];
  }

  return normalizeStringArray(fallbackColors);
};

const normalizeGroupedProducts = (value, productIdToExclude = null) => {
  const parsed = parseJsonMaybe(value, value);
  const values = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "string"
      ? parsed
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [];
  if (!values.length) return [];

  const seen = new Set();
  const excludedId = productIdToExclude ? String(productIdToExclude) : null;

  return values
    .map((entry) =>
      typeof entry === "object" && entry !== null
        ? entry._id || entry.id || entry.product || entry.productId
        : entry,
    )
    .map((entry) => String(entry || "").trim())
    .filter((entry) => /^[0-9a-fA-F]{24}$/.test(entry))
    .filter((entry) => !excludedId || entry !== excludedId)
    .filter((entry) => {
      if (seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
};

const buildMarketplacePayload = ({
  body = {},
  existing = null,
  productIdForGrouping = null,
}) => {
  const readValue = (key, fallback) =>
    body[key] !== undefined ? body[key] : fallback;

  const marketplaceType = normalizeMarketplaceType(
    readValue("marketplaceType", existing?.marketplaceType || "simple"),
    existing?.marketplaceType || "simple",
  );

  const parsedPrice = asNonNegativeNumber(readValue("price", existing?.price), NaN);
  const parsedSalePrice = asNullableNonNegativeNumber(
    readValue("salePrice", existing?.salePrice),
  );
  const parsedStock = asNonNegativeInteger(readValue("stock", existing?.stock), 0);
  const parsedLowStockThreshold = asNonNegativeInteger(
    readValue("lowStockThreshold", existing?.lowStockThreshold),
    5,
  );
  const priceType = normalizePriceType(
    readValue("priceType", existing?.priceType || "single"),
    existing?.priceType || "single",
  );
  const commissionType = normalizeCommissionType(
    readValue("commissionType", existing?.commissionType || "inherit"),
    existing?.commissionType || "inherit",
  );
  const commissionValue = asNonNegativeNumber(
    readValue("commissionValue", existing?.commissionValue),
    0,
  );
  const commissionFixed = asNonNegativeNumber(
    readValue("commissionFixed", existing?.commissionFixed),
    0,
  );
  const isRecurring = asBoolean(
    readValue("isRecurring", existing?.isRecurring),
    Boolean(existing?.isRecurring),
  );
  const recurringInterval = normalizeRecurringInterval(
    readValue("recurringInterval", existing?.recurringInterval || "monthly"),
    existing?.recurringInterval || "monthly",
  );
  const recurringIntervalCount = Math.min(
    24,
    Math.max(
      1,
      asNonNegativeInteger(
        readValue("recurringIntervalCount", existing?.recurringIntervalCount),
        1,
      ),
    ),
  );
  const recurringTotalCycles = asNonNegativeInteger(
    readValue("recurringTotalCycles", existing?.recurringTotalCycles),
    0,
  );
  const recurringTrialDays = asNonNegativeInteger(
    readValue("recurringTrialDays", existing?.recurringTrialDays),
    0,
  );

  const payload = {
    marketplaceType,
    priceType,
    commissionType,
    commissionValue,
    commissionFixed,
    isRecurring,
    recurringInterval,
    recurringIntervalCount,
    recurringTotalCycles,
    recurringTrialDays,
    sku: asString(readValue("sku", existing?.sku)).trim(),
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    salePrice:
      parsedSalePrice !== null && parsedSalePrice <= (Number.isFinite(parsedPrice) ? parsedPrice : Infinity)
        ? parsedSalePrice
        : null,
    stock: parsedStock,
    lowStockThreshold: parsedLowStockThreshold,
    allowBackorder: asBoolean(
      readValue("allowBackorder", existing?.allowBackorder),
      false,
    ),
    showStockToPublic: asBoolean(
      readValue("showStockToPublic", existing?.showStockToPublic),
      false,
    ),
    deliveryMinDays: asNonNegativeInteger(
      readValue("deliveryMinDays", existing?.deliveryMinDays),
      2,
    ),
    deliveryMaxDays: asNonNegativeInteger(
      readValue("deliveryMaxDays", existing?.deliveryMaxDays),
      5,
    ),
    downloadUrl: asString(readValue("downloadUrl", existing?.downloadUrl)).trim(),
    serviceDurationDays: asNonNegativeInteger(
      readValue("serviceDurationDays", existing?.serviceDurationDays),
      0,
    ),
    variations: normalizeVariations(readValue("variations", existing?.variations || [])),
    groupedProducts: normalizeGroupedProducts(
      readValue("groupedProducts", existing?.groupedProducts || []),
      productIdForGrouping,
    ),
  };

  if (payload.deliveryMaxDays < payload.deliveryMinDays) {
    payload.deliveryMaxDays = payload.deliveryMinDays;
  }

  if (payload.commissionType === "inherit") {
    payload.commissionValue = 0;
    payload.commissionFixed = 0;
  } else if (payload.commissionType === "percentage") {
    payload.commissionFixed = 0;
  } else if (payload.commissionType === "fixed") {
    payload.commissionFixed =
      payload.commissionFixed > 0 ? payload.commissionFixed : payload.commissionValue;
    payload.commissionValue = 0;
  }

  if (!payload.isRecurring) {
    payload.recurringInterval = "monthly";
    payload.recurringIntervalCount = 1;
    payload.recurringTotalCycles = 0;
    payload.recurringTrialDays = 0;
  }

  const errors = [];

  if (
    !Number.isFinite(parsedPrice) &&
    marketplaceType !== "grouped" &&
    marketplaceType !== "variable" &&
    priceType !== "tba"
  ) {
    errors.push("Valid price is required");
  }

  if (marketplaceType !== "variable" && marketplaceType !== "grouped") {
    if (priceType === "single") {
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        errors.push("Single price requires a valid price");
      }
      payload.salePrice = null;
    }

    if (priceType === "best") {
      const regular = Number(payload.price);
      const discounted = Number(payload.salePrice);
      if (!Number.isFinite(regular) || regular <= 0) {
        errors.push("Best price requires a valid previous price");
      }
      if (!Number.isFinite(discounted) || discounted <= 0) {
        errors.push("Best price requires a valid new price");
      } else if (discounted >= regular) {
        errors.push("Best price new price must be lower than previous price");
      }
    }

    if (priceType === "tba") {
      payload.price = 0;
      payload.salePrice = null;
      payload.stock = 0;
      payload.allowBackorder = false;
    }
  } else {
    payload.priceType = "single";
  }

  if (marketplaceType === "variable") {
    if (!payload.variations.length) {
      errors.push("At least one variation is required for variable products");
    } else {
      const activeVariationPrices = payload.variations
        .filter((variation) => variation.isActive !== false)
        .map((variation) =>
          variation.salePrice !== null ? variation.salePrice : variation.price,
        );

      if (activeVariationPrices.length) {
        payload.price = Math.min(...activeVariationPrices);
      } else {
        payload.price = payload.variations[0].price;
      }

      payload.stock = payload.variations.reduce(
        (sum, variation) => sum + asNonNegativeInteger(variation.stock, 0),
        0,
      );
    }

    payload.salePrice = null;
  }

  if (marketplaceType === "grouped") {
    if (!payload.groupedProducts.length) {
      errors.push("At least one grouped product is required for grouped product type");
    }
    payload.stock = 0;
    payload.salePrice = null;
  }

  if (marketplaceType === "digital" && !payload.downloadUrl) {
    errors.push("Download URL is required for digital products");
  }

  if (payload.isRecurring) {
    if (payload.priceType === "tba") {
      errors.push("Recurring products cannot use TBA price type");
    }

    if (!["simple", "digital", "service"].includes(payload.marketplaceType)) {
      errors.push(
        "Recurring products are allowed only for simple, digital, or service types",
      );
    }
  }

  return { payload, errors };
};

// Search products
exports.searchProducts = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const products = await Product.find({
      $or: [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { brand: { $regex: query, $options: "i" } },
        { productType: { $regex: query, $options: "i" } },
        { marketplaceType: { $regex: query, $options: "i" } },
      ],
      isActive: true,
      publicationStatus: "published",
      approvalStatus: { $in: ["approved", null] },
    })
      .populate("category", "name")
      .populate("vendor", PUBLIC_VENDOR_POPULATE_FIELDS)
      .limit(20)
      .sort({ createdAt: -1 })
      .lean();

    await attachImageDataToProducts(products);
    const visibleProducts = filterPublicProductsByVendor(products);

    res.json({
      success: true,
      count: visibleProducts.length,
      products: visibleProducts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.createProduct = async (req, res) => {
  let uploadedImagePublicIds = [];
  let uploadedVideoPublicIds = [];
  let createdImageIds = [];
  try {
    const title = asString(req.body.title).trim();
    const description = asString(req.body.description).trim();
    const category = req.body.category;
    let productType = asString(req.body.productType || "General").trim() || "General";
    const brand = asString(req.body.brand).trim();
    const youtubeVideoUrls = normalizeYouTubeVideoUrls(
      req.body.youtubeVideoUrls !== undefined
        ? req.body.youtubeVideoUrls
        : req.body.youtubeVideoUrl,
    );
    const weight = asNonNegativeNumber(req.body.weight, 0);
    const dimensions = asString(req.body.dimensions).trim();
    const publicationStatus = normalizePublicationStatus(req.body.publicationStatus, "draft");
    const parsedVariantDefinitions = normalizeVariantDefinitions(req.body.variantDefinitions);
    const parsedColors = deriveProductColors(req.body.colors, parsedVariantDefinitions);
    const parsedFeatures = normalizeStringArray(req.body.features);
    const parsedSpecs = normalizeSpecifications(req.body.specifications);
    const { payload: marketplacePayload, errors: marketplaceErrors } =
      buildMarketplacePayload({ body: req.body });
    const isDraft = publicationStatus === "draft";

    if (!isDraft && (!title || !description || !category)) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and category are required",
      });
    }

    if (!isDraft && marketplaceErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: marketplaceErrors.join(", "),
      });
    }

    const categoryExists = category ? await Category.findById(category) : null;
    if (category && !categoryExists) {
      return res.status(400).json({
        success: false,
        message: "Category not found",
      });
    }

    if (categoryExists?.type) {
      productType = asString(categoryExists.type).trim() || productType;
    }

    const requesterIsAdmin = isAdmin(req.user);
    const requesterIsVendor = isVendorUser(req.user);

    let vendorId = null;
    let approvalStatus = "approved";
    let vendorUploadLimitContext = null;

    if (!requesterIsAdmin && !requesterIsVendor) {
      return res.status(403).json({
        success: false,
        message: "Only admin can create products",
      });
    }

    if (requesterIsVendor && !requesterIsAdmin) {
      const vendor = await getApprovedVendorForUser(req.user.id || req.user._id);

      if (!vendor) {
        return res.status(403).json({
          success: false,
          message:
            "Vendor profile is not approved yet. Contact admin to activate vendor store.",
        });
      }

      vendorId = vendor._id;
      approvalStatus = "pending";

      vendorUploadLimitContext = await assertVendorCanUploadProducts(vendor._id, 1);
      if (!vendorUploadLimitContext.allowed) {
        return res.status(vendorUploadLimitContext.status || 400).json({
          success: false,
          message: vendorUploadLimitContext.message,
          limits: vendorUploadLimitContext.limits || null,
        });
      }
    }

    const imageFiles = getUploadedImageFiles(req.files);
    const videoFiles = getUploadedVideoFiles(req.files);

    if (videoFiles.length > 3) {
      return res.status(400).json({
        success: false,
        message: "You can upload up to 3 product videos",
      });
    }

    for (const videoFile of videoFiles) {
      if (videoFile?.size > MAX_PRODUCT_VIDEO_SIZE_BYTES) {
        return res.status(400).json({
          success: false,
          message: "Each product video must be 9 MB or smaller",
        });
      }
    }

    // Create proper image URLs
    const images = [];
    if (imageFiles.length > 0) {
      for (const file of imageFiles) {
        const uploaded = await uploadProductImage(file);
        if (!uploaded?.secure_url) continue;
        uploadedImagePublicIds.push(uploaded.public_id);
        const imageDoc = await ProductImage.create({
          data: uploaded.secure_url,
          publicId: uploaded.public_id,
          mimeType: file.mimetype,
          size: uploaded.bytes || file.size || 0,
          format: uploaded.format || "",
          width: uploaded.width || 0,
          height: uploaded.height || 0,
          resourceType: uploaded.resource_type || "image",
        });
        images.push(imageDoc._id);
        createdImageIds.push(imageDoc._id);
      }
    }

    const uploadedVideos = [];
    for (const videoFile of videoFiles) {
      const uploadedVideo = await uploadProductVideo(videoFile);
      if (!uploadedVideo?.secure_url) continue;
      if (uploadedVideo?.public_id) {
        uploadedVideoPublicIds.push(uploadedVideo.public_id);
      }
      uploadedVideos.push({
        url: uploadedVideo.secure_url,
        publicId: uploadedVideo.public_id || "",
        mimeType: uploadedVideo?.format
          ? `video/${uploadedVideo.format}`
          : videoFile?.mimetype || "",
      });
    }

    const productPayload = syncLegacyVideoFields(
      {
      approvalStatus,
      rejectionReason: "",
      publicationStatus,
      title,
      description,
      price: marketplacePayload.price,
      salePrice: marketplacePayload.salePrice,
      priceType: marketplacePayload.priceType,
      commissionType: "inherit",
      commissionValue: 0,
      commissionFixed: 0,
      isRecurring: marketplacePayload.isRecurring,
      recurringInterval: marketplacePayload.recurringInterval,
      recurringIntervalCount: marketplacePayload.recurringIntervalCount,
      recurringTotalCycles: marketplacePayload.recurringTotalCycles,
      recurringTrialDays: marketplacePayload.recurringTrialDays,
      sku: marketplacePayload.sku,
      stock: marketplacePayload.stock,
      lowStockThreshold: marketplacePayload.lowStockThreshold,
      allowBackorder: marketplacePayload.allowBackorder,
      showStockToPublic: marketplacePayload.showStockToPublic,
      category,
      productType,
      marketplaceType: marketplacePayload.marketplaceType,
      brand,
      weight,
      dimensions,
      colors: parsedColors,
      features: parsedFeatures,
      specifications: parsedSpecs,
      variantDefinitions: parsedVariantDefinitions,
      variations: marketplacePayload.variations,
      groupedProducts: marketplacePayload.groupedProducts,
      downloadUrl: marketplacePayload.downloadUrl,
      serviceDurationDays: marketplacePayload.serviceDurationDays,
      deliveryMinDays: marketplacePayload.deliveryMinDays,
      deliveryMaxDays: marketplacePayload.deliveryMaxDays,
      images,
      isActive: asBoolean(req.body.isActive, true),
      },
      uploadedVideos,
      youtubeVideoUrls,
    );

    const product = await Product.create(productPayload);

    await product.populate("category", "name");

    if (vendorUploadLimitContext?.limits?.subscription) {
      await incrementVendorUploadCount(vendorUploadLimitContext.limits.subscription, 1);
    }
    invalidatePublicProductCache();

    res.status(201).json({
      success: true,
      message:
        publicationStatus === "draft"
          ? "Product saved as draft"
          : product.approvalStatus === "pending"
          ? "Product submitted and waiting for admin approval"
          : "Product created successfully",
      product,
    });
  } catch (error) {
    if (uploadedImagePublicIds.length > 0) {
      await Promise.all(uploadedImagePublicIds.map((id) => deleteImage(id)));
    }
    if (uploadedVideoPublicIds.length > 0) {
      await Promise.all(
        uploadedVideoPublicIds.map((id) => deleteImage(id, { resource_type: "video" })),
      );
    }
    if (createdImageIds.length > 0) {
      await ProductImage.deleteMany({ _id: { $in: createdImageIds } });
    }
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product with this title already exists",
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const requesterIsAdmin = isAdmin(req.user);
    const requesterIsVendor = isVendorUser(req.user);

    let query = {};

    if (requesterIsVendor && !requesterIsAdmin) {
      const vendor = await Vendor.findOne({ user: req.user.id || req.user._id })
        .select("_id")
        .lean();

      if (!vendor) {
        return res.status(403).json({
          success: false,
          message: "Vendor profile not found",
        });
      }

      query = { vendor: vendor._id };
    } else if (!requesterIsAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only admin or vendor can access products management",
      });
    }

    const products = await Product.find(query)
      .populate("category", "name")
      .populate("vendor", "storeName slug logo status")
      .sort({ createdAt: -1 })
      .lean();

    await attachImageDataToProducts(products);

    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getActiveProducts = async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      publicationStatus: "published",
      approvalStatus: { $in: ["approved", null] },
    })
      .populate("category", "name")
      .populate("vendor", PUBLIC_VENDOR_POPULATE_FIELDS)
      .select(
        "title price salePrice priceType showStockToPublic images videos video youtubeVideoUrls youtubeVideoUrl category brand description colors dimensions vendor productType marketplaceType stock allowBackorder variations variantDefinitions deliveryMinDays deliveryMaxDays ratingAverage ratingCount",
      )
      .sort({ createdAt: -1 })
      .lean();

    await attachImageDataToProducts(products);
    const visibleProducts = filterPublicProductsByVendor(products);

    res.json({
      success: true,
      count: visibleProducts.length,
      products: visibleProducts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// Add this method to productController.js after getActiveProducts method
exports.getProductsByType = async (req, res) => {
  try {
    const requestedType = String(req.params?.productType || "").trim();

    if (!requestedType) {
      return res.status(400).json({
        success: false,
        message: "Product type is required",
      });
    }

    const escapeRegex = (value) =>
      String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const typeRegex = new RegExp(`^\\s*${escapeRegex(requestedType)}\\s*$`, "i");
    const isGeneralRequest = /^general$/i.test(requestedType);

    const categoryQuery = isGeneralRequest
      ? {
          isActive: true,
          $or: [
            { type: typeRegex },
            { type: { $exists: false } },
            { type: null },
            { type: "" },
          ],
        }
      : { isActive: true, type: typeRegex };

    const categoryRows = await Category.find(categoryQuery).select("_id").lean();
    const categoryIds = categoryRows.map((row) => row._id).filter(Boolean);

    if (!categoryIds.length) {
      return res.json({
        success: true,
        count: 0,
        products: [],
      });
    }

    const products = await Product.find({
      isActive: true,
      publicationStatus: "published",
      approvalStatus: { $in: ["approved", null] },
      category: { $in: categoryIds },
    })
      .populate("category", "name type")
      .populate("vendor", PUBLIC_VENDOR_POPULATE_FIELDS)
      .select(
        "title price salePrice priceType showStockToPublic images videos video youtubeVideoUrls youtubeVideoUrl category brand description colors features dimensions vendor productType marketplaceType stock allowBackorder variations variantDefinitions deliveryMinDays deliveryMaxDays ratingAverage ratingCount",
      )
      .sort({ createdAt: -1 })
      .lean();

    await attachImageDataToProducts(products);
    const visibleProducts = filterPublicProductsByVendor(products);

    res.json({
      success: true,
      count: visibleProducts.length,
      products: visibleProducts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getHomeCatalog = async (_req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      publicationStatus: "published",
      approvalStatus: { $in: ["approved", null] },
      productType: { $in: HOME_CATALOG_TYPES },
    })
      .populate("category", "name type")
      .populate("vendor", PUBLIC_VENDOR_POPULATE_FIELDS)
      .select(HOME_CATALOG_PRODUCT_SELECT)
      .sort({ createdAt: -1 })
      .lean();

    await attachImageDataToProducts(products);

    const visibleProducts = filterPublicProductsByVendor(products);
    const [sections, brands] = await Promise.all([
      Promise.resolve(buildHomeCatalogSections(visibleProducts)),
      buildHomeCatalogBrands(visibleProducts),
    ]);

    res.json({
      success: true,
      sections,
      brands,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getProduct = async (req, res) => {
  try {
    // Check if the ID looks like a MongoDB ObjectId
    const { id } = req.params;

    // If the ID is a route keyword, return 404
    const routeKeywords = ["suggestions", "search", "public"];
    if (routeKeywords.includes(id)) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if it's a valid MongoDB ObjectId
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(id)
      .populate("category", "name")
      .populate("vendor", PUBLIC_VENDOR_POPULATE_FIELDS)
      .populate({
        path: "groupedProducts",
        select:
          "title price salePrice priceType showStockToPublic images videos video youtubeVideoUrls youtubeVideoUrl category brand marketplaceType stock isActive publicationStatus approvalStatus vendor variantDefinitions",
        populate: [
          { path: "category", select: "name" },
          { path: "vendor", select: PUBLIC_VENDOR_POPULATE_FIELDS },
        ],
      })
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (
      req.baseUrl.includes("public") &&
      (!product.isActive ||
        String(product.publicationStatus || "published") !== "published" ||
        !["approved", undefined, null].includes(product.approvalStatus) ||
        !isPublicVendorVisible(product.vendor))
    ) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const productObj = product;
    await attachImageDataToProducts(productObj);

    if (Array.isArray(productObj.groupedProducts) && productObj.groupedProducts.length > 0) {
      await attachImageDataToProducts(productObj.groupedProducts);

      if (req.baseUrl.includes("public")) {
        productObj.groupedProducts = productObj.groupedProducts.filter((groupedProduct) => {
          if (!groupedProduct?.isActive) return false;
          if (String(groupedProduct?.publicationStatus || "published") !== "published") {
            return false;
          }
          if (!["approved", undefined, null].includes(groupedProduct?.approvalStatus)) {
            return false;
          }
          return isPublicVendorVisible(groupedProduct?.vendor);
        });
      }
    }

    res.json({
      success: true,
      product: productObj,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.updateProduct = async (req, res) => {
  let uploadedImagePublicIds = [];
  let uploadedVideoPublicIds = [];
  let createdImageIds = [];
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const requesterIsAdmin = isAdmin(req.user);
    const requesterIsVendor = isVendorUser(req.user);

    if (!requesterIsAdmin && !requesterIsVendor) {
      return res.status(403).json({
        success: false,
        message: "Only admin can update products",
      });
    }

    if (requesterIsVendor && !requesterIsAdmin) {
      const vendor = await getApprovedVendorForUser(req.user.id || req.user._id);
      if (!vendor) {
        return res.status(403).json({
          success: false,
          message:
            "Vendor profile is not approved yet. Contact admin to activate vendor store.",
        });
      }

      if (String(product.vendor || "") !== String(vendor._id)) {
        return res.status(403).json({
          success: false,
          message: "You can update only your own products",
        });
      }

      req.body.vendor = vendor._id;
      req.body.approvalStatus = "pending";
      req.body.rejectionReason = "";
    }

    let requestedCategoryDoc = null;
    if (req.body.category) {
      requestedCategoryDoc = await Category.findById(req.body.category).select("type").lean();
      if (!requestedCategoryDoc) {
        return res.status(400).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    const nextCategoryId = req.body.category || product.category || null;
    const nextCategoryDoc =
      requestedCategoryDoc ||
      (nextCategoryId
        ? await Category.findById(nextCategoryId).select("type").lean()
        : null);

    const { payload: marketplacePayload, errors: marketplaceErrors } =
      buildMarketplacePayload({
        body: req.body,
        existing: product.toObject(),
        productIdForGrouping: req.params.id,
      });
    const publicationStatus = normalizePublicationStatus(
      req.body.publicationStatus,
      product.publicationStatus || "draft",
    );
    const shouldRemoveVideo = asBoolean(req.body.removeCurrentVideo, false);
    const isDraft = publicationStatus === "draft";

    if (!isDraft && marketplaceErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: marketplaceErrors.join(", "),
      });
    }

    const parsedVariantDefinitions =
      req.body.variantDefinitions !== undefined
        ? normalizeVariantDefinitions(req.body.variantDefinitions)
        : product.variantDefinitions || [];

    const updatePayload = {
      title:
        req.body.title !== undefined
          ? asString(req.body.title).trim()
          : product.title,
      description:
        req.body.description !== undefined
          ? asString(req.body.description).trim()
          : product.description,
      category: req.body.category || product.category,
      productType: nextCategoryDoc?.type
        ? asString(nextCategoryDoc.type).trim() || "General"
        : req.body.productType !== undefined
          ? asString(req.body.productType).trim() || "General"
          : product.productType || "General",
      brand:
        req.body.brand !== undefined
          ? asString(req.body.brand).trim()
          : product.brand,
      weight:
        req.body.weight !== undefined
          ? asNonNegativeNumber(req.body.weight, product.weight || 0)
          : product.weight,
      dimensions:
        req.body.dimensions !== undefined
          ? asString(req.body.dimensions).trim()
          : product.dimensions,
      colors:
        req.body.colors !== undefined
          ? deriveProductColors(req.body.colors, parsedVariantDefinitions)
          : deriveProductColors(product.colors || [], parsedVariantDefinitions),
      features:
        req.body.features !== undefined
          ? normalizeStringArray(req.body.features)
          : product.features || [],
      specifications:
        req.body.specifications !== undefined
          ? normalizeSpecifications(req.body.specifications)
          : product.specifications || [],
      price: marketplacePayload.price,
      salePrice: marketplacePayload.salePrice,
      priceType: marketplacePayload.priceType,
      commissionType: "inherit",
      commissionValue: 0,
      commissionFixed: 0,
      isRecurring: marketplacePayload.isRecurring,
      recurringInterval: marketplacePayload.recurringInterval,
      recurringIntervalCount: marketplacePayload.recurringIntervalCount,
      recurringTotalCycles: marketplacePayload.recurringTotalCycles,
      recurringTrialDays: marketplacePayload.recurringTrialDays,
      sku: marketplacePayload.sku,
      stock: marketplacePayload.stock,
      lowStockThreshold: marketplacePayload.lowStockThreshold,
      allowBackorder: marketplacePayload.allowBackorder,
      showStockToPublic: marketplacePayload.showStockToPublic,
      marketplaceType: marketplacePayload.marketplaceType,
      variantDefinitions: parsedVariantDefinitions,
      variations: marketplacePayload.variations,
      groupedProducts: marketplacePayload.groupedProducts,
      downloadUrl: marketplacePayload.downloadUrl,
      serviceDurationDays: marketplacePayload.serviceDurationDays,
      deliveryMinDays: marketplacePayload.deliveryMinDays,
      deliveryMaxDays: marketplacePayload.deliveryMaxDays,
      isActive:
        req.body.isActive !== undefined
          ? asBoolean(req.body.isActive, product.isActive)
          : product.isActive,
      publicationStatus,
      approvalStatus: req.body.approvalStatus || product.approvalStatus,
      rejectionReason:
        req.body.rejectionReason !== undefined
          ? asString(req.body.rejectionReason).trim()
          : product.rejectionReason || "",
    };

    const mainImageFirst =
      String(req.body.mainImageFirst || "").toLowerCase() === "true";
    if (req.body.mainImageFirst !== undefined) {
      delete req.body.mainImageFirst;
    }
    if (req.body.removeCurrentVideo !== undefined) {
      delete req.body.removeCurrentVideo;
    }

    let existingImages = null;
    if (req.body.existingImages) {
      try {
        existingImages = JSON.parse(req.body.existingImages);
      } catch (e) {
        existingImages = null;
      }
    }

    if (existingImages) {
      updatePayload.images = existingImages;
    }

    const imageFiles = getUploadedImageFiles(req.files);
    const videoFiles = getUploadedVideoFiles(req.files);
    const currentVideos = getExistingProductVideos(product);
    const youtubeVideoUrls = normalizeYouTubeVideoUrls(
      req.body.youtubeVideoUrls !== undefined
        ? req.body.youtubeVideoUrls
        : req.body.youtubeVideoUrl !== undefined
          ? req.body.youtubeVideoUrl
          : product.youtubeVideoUrls?.length
            ? product.youtubeVideoUrls
            : product.youtubeVideoUrl || "",
    );

    let existingVideos = currentVideos;
    if (req.body.existingVideos !== undefined) {
      existingVideos = normalizeProductVideoEntries(req.body.existingVideos, []);
    } else if (shouldRemoveVideo) {
      existingVideos = [];
    }

    if (videoFiles.length + existingVideos.length > 3) {
      return res.status(400).json({
        success: false,
        message: "You can keep up to 3 product videos",
      });
    }

    for (const videoFile of videoFiles) {
      if (videoFile?.size > MAX_PRODUCT_VIDEO_SIZE_BYTES) {
        return res.status(400).json({
          success: false,
          message: "Each product video must be 9 MB or smaller",
        });
      }
    }

    if (imageFiles.length > 0) {
      const newImageIds = [];
      for (const file of imageFiles) {
        const uploaded = await uploadProductImage(file);
        if (!uploaded?.secure_url) continue;
        uploadedImagePublicIds.push(uploaded.public_id);
        const imageDoc = await ProductImage.create({
          data: uploaded.secure_url,
          publicId: uploaded.public_id,
          mimeType: file.mimetype,
          size: uploaded.bytes || file.size || 0,
          format: uploaded.format || "",
          width: uploaded.width || 0,
          height: uploaded.height || 0,
          resourceType: uploaded.resource_type || "image",
        });
        newImageIds.push(imageDoc._id);
        createdImageIds.push(imageDoc._id);
      }
      const baseImages = updatePayload.images || product.images || [];
      if (mainImageFirst && newImageIds.length > 0) {
        updatePayload.images = [
          newImageIds[0],
          ...baseImages,
          ...newImageIds.slice(1),
        ].slice(0, 10);
      } else {
        updatePayload.images = [...baseImages, ...newImageIds].slice(0, 10);
      }
    }

    const nextVideos = [...existingVideos];

    for (const videoFile of videoFiles) {
      const uploadedVideo = await uploadProductVideo(videoFile);
      if (!uploadedVideo?.secure_url) continue;
      if (uploadedVideo?.public_id) {
        uploadedVideoPublicIds.push(uploadedVideo.public_id);
      }
      nextVideos.push({
        url: uploadedVideo.secure_url,
        publicId: uploadedVideo.public_id || "",
        mimeType: uploadedVideo?.format
          ? `video/${uploadedVideo.format}`
          : videoFile.mimetype || "",
      });
    }

    const removedVideos = currentVideos.filter(
      (currentVideo) =>
        currentVideo.publicId &&
        !nextVideos.some((nextVideo) => nextVideo.publicId === currentVideo.publicId),
    );

    if (removedVideos.length > 0) {
      await Promise.all(
        removedVideos.map((videoEntry) =>
          deleteImage(videoEntry.publicId, { resource_type: "video" }),
        ),
      );
    }

    Object.assign(updatePayload, syncLegacyVideoFields({}, nextVideos, youtubeVideoUrls));

    // Remove deleted images from ProductImage collection
    if (updatePayload.images) {
      const previousIds = (product.images || [])
        .filter((img) => isObjectIdLike(img))
        .map(String);
      const nextIds = (updatePayload.images || [])
        .filter((img) => isObjectIdLike(img))
        .map(String);
      const removedIds = previousIds.filter((id) => !nextIds.includes(id));
      if (removedIds.length > 0) {
        const removedDocs = await ProductImage.find({
          _id: { $in: removedIds },
        })
          .select("publicId")
          .lean();
        await Promise.all(
          removedDocs.map((doc) => deleteImage(doc.publicId)),
        );
        await ProductImage.deleteMany({ _id: { $in: removedIds } });
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true },
    )
      .populate("category", "name")
      .populate("vendor", "storeName slug logo status");

    // Ensure image URLs are properly formatted
    const productObj = updatedProduct.toObject();
    if (productObj.images && productObj.images.length > 0) {
      await attachImageDataToProducts(productObj);
    }
    invalidatePublicProductCache();

    res.json({
      success: true,
      message:
        publicationStatus === "draft"
          ? "Product draft updated successfully"
          : "Product updated successfully",
      product: productObj,
    });
  } catch (error) {
    if (uploadedImagePublicIds.length > 0) {
      await Promise.all(uploadedImagePublicIds.map((id) => deleteImage(id)));
    }
    if (uploadedVideoPublicIds.length > 0) {
      await Promise.all(
        uploadedVideoPublicIds.map((id) => deleteImage(id, { resource_type: "video" })),
      );
    }
    if (createdImageIds.length > 0) {
      await ProductImage.deleteMany({ _id: { $in: createdImageIds } });
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const requesterIsAdmin = isAdmin(req.user);
    const requesterIsVendor = isVendorUser(req.user);

    if (!requesterIsAdmin && !requesterIsVendor) {
      return res.status(403).json({
        success: false,
        message: "Only admin or vendor can delete products",
      });
    }

    if (requesterIsVendor && !requesterIsAdmin) {
      const vendor = await Vendor.findOne({ user: req.user.id || req.user._id })
        .select("_id")
        .lean();

      if (!vendor || String(product.vendor || "") !== String(vendor._id)) {
        return res.status(403).json({
          success: false,
          message: "You can delete only your own products",
        });
      }
    }

    const imageIds = (product.images || [])
      .filter((img) => isObjectIdLike(img))
      .map(String);

    await product.deleteOne();

    if (imageIds.length > 0) {
      const imageDocs = await ProductImage.find({ _id: { $in: imageIds } })
        .select("publicId")
        .lean();
      await Promise.all(imageDocs.map((doc) => deleteImage(doc.publicId)));
      await ProductImage.deleteMany({ _id: { $in: imageIds } });
    }
    if (product.videoPublicId) {
      await deleteImage(product.videoPublicId, { resource_type: "video" });
    }
    invalidatePublicProductCache();

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.toggleProductActive = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const requesterIsAdmin = isAdmin(req.user);
    const requesterIsVendor = isVendorUser(req.user);

    if (!requesterIsAdmin && !requesterIsVendor) {
      return res.status(403).json({
        success: false,
        message: "Only admin or vendor can update product status",
      });
    }

    if (requesterIsVendor && !requesterIsAdmin) {
      const vendor = await Vendor.findOne({ user: req.user.id || req.user._id })
        .select("_id")
        .lean();

      if (!vendor || String(product.vendor || "") !== String(vendor._id)) {
        return res.status(403).json({
          success: false,
          message: "You can update only your own products",
        });
      }
    }

    product.isActive = !product.isActive;
    product.updatedAt = Date.now();
    await product.save();

    // Ensure image URLs are properly formatted
    const productObj = product.toObject();
    if (productObj.images && productObj.images.length > 0) {
      await attachImageDataToProducts(productObj);
    }
    invalidatePublicProductCache();

    res.json({
      success: true,
      message: `Product ${
        product.isActive ? "activated" : "deactivated"
      } successfully`,
      product: productObj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.duplicateProduct = async (req, res) => {
  try {
    const sourceProduct = await Product.findById(req.params.id);

    if (!sourceProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const requesterIsAdmin = isAdmin(req.user);
    const requesterIsVendor = isVendorUser(req.user);

    if (!requesterIsAdmin && !requesterIsVendor) {
      return res.status(403).json({
        success: false,
        message: "Only admin or vendor can duplicate products",
      });
    }

    let approvalStatus = sourceProduct.approvalStatus || "approved";
    let vendorUploadLimitContext = null;

    if (requesterIsVendor && !requesterIsAdmin) {
      const vendor = await getApprovedVendorForUser(req.user.id || req.user._id);
      if (!vendor) {
        return res.status(403).json({
          success: false,
          message:
            "Vendor profile is not approved yet. Contact admin to activate vendor store.",
        });
      }

      if (String(sourceProduct.vendor || "") !== String(vendor._id)) {
        return res.status(403).json({
          success: false,
          message: "You can duplicate only your own products",
        });
      }

      approvalStatus = "pending";

      vendorUploadLimitContext = await assertVendorCanUploadProducts(vendor._id, 1);
      if (!vendorUploadLimitContext.allowed) {
        return res.status(vendorUploadLimitContext.status || 400).json({
          success: false,
          message: vendorUploadLimitContext.message,
          limits: vendorUploadLimitContext.limits || null,
        });
      }
    }

    const sourceObj = sourceProduct.toObject();
    const copiedTitleBase = String(sourceObj.title || "Product").trim();
    const copiedTitle = `${copiedTitleBase} (Copy)`.slice(0, 200);

    const duplicated = await Product.create({
      approvalStatus,
      rejectionReason: "",
      title: copiedTitle,
      description: sourceObj.description || "",
      price: sourceObj.price || 0,
      salePrice: sourceObj.salePrice ?? null,
      priceType: sourceObj.priceType || "single",
      commissionType: sourceObj.commissionType || "inherit",
      commissionValue: 0,
      commissionFixed: 0,
      isRecurring: sourceObj.isRecurring === true,
      recurringInterval: sourceObj.recurringInterval || "monthly",
      recurringIntervalCount: sourceObj.recurringIntervalCount || 1,
      recurringTotalCycles: sourceObj.recurringTotalCycles || 0,
      recurringTrialDays: sourceObj.recurringTrialDays || 0,
      sku: sourceObj.sku || "",
      stock: sourceObj.stock || 0,
      lowStockThreshold: sourceObj.lowStockThreshold || 0,
      allowBackorder: sourceObj.allowBackorder === true,
      showStockToPublic: sourceObj.showStockToPublic === true,
      category: sourceObj.category,
      productType: sourceObj.productType || "General",
      marketplaceType: sourceObj.marketplaceType || "simple",
      brand: sourceObj.brand || "",
      weight: sourceObj.weight || 0,
      dimensions: sourceObj.dimensions || "",
      colors: sourceObj.colors || [],
      features: sourceObj.features || [],
      specifications: sourceObj.specifications || [],
      variantDefinitions: sourceObj.variantDefinitions || [],
      variations: sourceObj.variations || [],
      groupedProducts: sourceObj.groupedProducts || [],
      downloadUrl: sourceObj.downloadUrl || "",
      serviceDurationDays: sourceObj.serviceDurationDays || 0,
      deliveryMinDays: sourceObj.deliveryMinDays || 2,
      deliveryMaxDays: sourceObj.deliveryMaxDays || 5,
      images: sourceObj.images || [],
      isActive: sourceObj.isActive !== false,
      publicationStatus: sourceObj.publicationStatus || "draft",
      ...syncLegacyVideoFields(
        {},
        getExistingProductVideos(sourceObj),
        sourceObj.youtubeVideoUrls?.length
          ? sourceObj.youtubeVideoUrls
          : sourceObj.youtubeVideoUrl || "",
      ),
    });

    await duplicated.populate("category", "name");

    const duplicatedObj = duplicated.toObject();
    await attachImageDataToProducts(duplicatedObj);

    if (vendorUploadLimitContext?.limits?.subscription) {
      await incrementVendorUploadCount(vendorUploadLimitContext.limits.subscription, 1);
    }
    invalidatePublicProductCache();

    res.status(201).json({
      success: true,
      message:
        duplicated.approvalStatus === "pending"
          ? "Product duplicated and sent for approval"
          : "Product duplicated successfully",
      product: duplicatedObj,
    });
  } catch (error) {
    console.error("Duplicate product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while duplicating product",
      error: error.message,
    });
  }
};

exports.updateProductApprovalStatus = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { status, rejectionReason = "" } = req.body || {};
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval status",
      });
    }

    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .populate("vendor", "storeName slug status");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    product.approvalStatus = status;
    product.rejectionReason =
      status === "rejected" ? String(rejectionReason || "").trim() : "";

    await product.save();

    const productObj = product.toObject();
    await attachImageDataToProducts(productObj);
    invalidatePublicProductCache();

    res.json({
      success: true,
      message: `Product ${status} successfully`,
      product: productObj,
    });
  } catch (error) {
    console.error("Update product approval status error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating product approval status",
      error: error.message,
    });
  }
};

// Get search suggestions
exports.getSearchSuggestions = async (req, res) => {
  try {
    const { query, limit = 8 } = req.query;

    // Only reject if completely undefined
    if (query === undefined) {
      return res.status(400).json({
        success: false,
        message: "Search query parameter is required",
      });
    }

    // Handle all other cases
    let searchQuery = "";
    if (query !== null && query !== undefined) {
      searchQuery = String(query).trim();
    }

    // If query is empty string, return empty results
    if (searchQuery.length === 0) {
      return res.json({
        success: true,
        suggestions: {
          products: [],
          categories: [],
        },
      });
    }

    // Search products
    let products = [];
    let categories = [];

    try {
      // Search products
        products = await Product.find({
          $or: [
            { title: { $regex: searchQuery, $options: "i" } },
            { description: { $regex: searchQuery, $options: "i" } },
            { brand: { $regex: searchQuery, $options: "i" } },
            { productType: { $regex: searchQuery, $options: "i" } },
            { marketplaceType: { $regex: searchQuery, $options: "i" } },
          ],
          isActive: true,
          publicationStatus: "published",
          approvalStatus: { $in: ["approved", null] },
        })
          .populate("category", "name")
          .populate("vendor", PUBLIC_VENDOR_POPULATE_FIELDS)
          .limit(parseInt(limit))
          .select(
            "title images videos video youtubeVideoUrls youtubeVideoUrl price salePrice priceType showStockToPublic category brand productType marketplaceType vendor _id",
          )
          .sort({ createdAt: -1 })
          .lean();

      await attachImageDataToProducts(products);

      // Search categories
      categories = await Category.find({
        name: { $regex: searchQuery, $options: "i" },
        isActive: true,
      })
        .limit(3)
        .select("name _id")
        .lean();
    } catch (dbError) {
      // Don't crash, just return empty results
    }

    // Format products with proper image URLs
    const formattedProducts = products.map((product) => {
      let imageUrl = null;
      if (product.images && product.images.length > 0) {
        const firstImage = product.images[0];
        if (typeof firstImage === "object" && firstImage.data) {
          imageUrl = firstImage.data;
        } else if (typeof firstImage === "string") {
          imageUrl = normalizeImageString(firstImage);
        } else {
          imageUrl = null;
        }
      }

      return {
        _id: product._id,
        title: product.title || "",
        price:
          String(product.priceType || "single") === "tba"
            ? null
            : product.salePrice !== null && product.salePrice !== undefined
              ? product.salePrice
              : product.price || 0,
        priceType: String(product.priceType || "single"),
        image: imageUrl,
        category: product.category?.name || "Uncategorized",
        brand: product.brand || "",
        productType: product.productType || "General",
        marketplaceType: product.marketplaceType || "simple",
        vendor: product.vendor || null,
        type: "product",
      };
    }).filter((product) => isPublicVendorVisible(product.vendor));

    const formattedCategories = categories.map((cat) => ({
      _id: cat._id,
      name: cat.name || "",
      type: "category",
    }));

    res.json({
      success: true,
      suggestions: {
        products: formattedProducts,
        categories: formattedCategories,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
