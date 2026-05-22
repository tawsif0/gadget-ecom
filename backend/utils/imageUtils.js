const mongoose = require("mongoose");
const ProductImage = require("../models/ProductImage");

const IMAGE_LOOKUP_CACHE_TTL_MS = Math.max(
  10000,
  Number(process.env.IMAGE_LOOKUP_CACHE_TTL_MS || 300000),
);
const IMAGE_LOOKUP_CACHE_MAX_ENTRIES = Math.max(
  100,
  Number(process.env.IMAGE_LOOKUP_CACHE_MAX_ENTRIES || 5000),
);
const imageLookupCache = new Map();

const getCachedImageData = (id) => {
  const cacheKey = String(id || "");
  if (!cacheKey) return undefined;

  const entry = imageLookupCache.get(cacheKey);
  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    imageLookupCache.delete(cacheKey);
    return undefined;
  }

  imageLookupCache.delete(cacheKey);
  imageLookupCache.set(cacheKey, entry);
  return entry.value;
};

const setCachedImageData = (id, value) => {
  const cacheKey = String(id || "");
  if (!cacheKey) return;

  imageLookupCache.set(cacheKey, {
    value: value || null,
    expiresAt: Date.now() + IMAGE_LOOKUP_CACHE_TTL_MS,
  });

  while (imageLookupCache.size > IMAGE_LOOKUP_CACHE_MAX_ENTRIES) {
    const oldestKey = imageLookupCache.keys().next().value;
    if (!oldestKey) break;
    imageLookupCache.delete(oldestKey);
  }
};

const isObjectIdLike = (value) => {
  if (!value) return false;
  if (value instanceof mongoose.Types.ObjectId) return true;
  if (typeof value === "string") {
    return /^[0-9a-fA-F]{24}$/.test(value);
  }
  return false;
};

const normalizeImageString = (value) => {
  if (!value || typeof value !== "string") return value;
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    return value;
  }
  return value.startsWith("/") ? value : `/${value}`;
};

const attachImageDataToProducts = async (products) => {
  const list = Array.isArray(products) ? products : [products];
  const imageIds = new Set();

  list.forEach((product) => {
    if (!product?.images) return;
    product.images.forEach((img) => {
      if (isObjectIdLike(img)) {
        imageIds.add(String(img));
      }
    });
  });

  let imageMap = new Map();
  if (imageIds.size > 0) {
    const missingIds = [];
    Array.from(imageIds).forEach((id) => {
      const cached = getCachedImageData(id);
      if (cached !== undefined) {
        imageMap.set(id, cached);
      } else {
        missingIds.push(id);
      }
    });

    if (missingIds.length > 0) {
      const imageDocs = await ProductImage.find({
        _id: { $in: missingIds },
      })
        .select("data")
        .lean();

      const foundIds = new Set();
      imageDocs.forEach((doc) => {
        const id = String(doc._id);
        const data = doc.data || null;
        foundIds.add(id);
        imageMap.set(id, data);
        setCachedImageData(id, data);
      });

      missingIds.forEach((id) => {
        if (!foundIds.has(id)) {
          imageMap.set(id, null);
          setCachedImageData(id, null);
        }
      });
    }
  }

  list.forEach((product) => {
    if (!product?.images) return;
    const mapped = product.images.map((img) => {
      if (!img) return { data: null, id: null };
      if (typeof img === "object" && img.data) {
        return { data: img.data, id: img.id || null };
      }
      if (isObjectIdLike(img)) {
        return { data: imageMap.get(String(img)) || null, id: String(img) };
      }
      if (typeof img === "string") {
        return { data: normalizeImageString(img), id: null };
      }
      return { data: null, id: null };
    });

    const filtered = mapped.filter((item) => Boolean(item.data));
    product.images = filtered.map((item) => item.data);
    product.imageIds = filtered.map((item) => item.id);
  });

  return products;
};

module.exports = {
  isObjectIdLike,
  normalizeImageString,
  attachImageDataToProducts,
};
