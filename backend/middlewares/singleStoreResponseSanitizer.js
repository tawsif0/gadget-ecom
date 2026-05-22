const BLOCKED_KEY_PARTS = [
  "vendor",
  "supplier",
  "commission",
  "payout",
];

const shouldRemoveKey = (key) => {
  const normalized = String(key || "").toLowerCase();
  return BLOCKED_KEY_PARTS.some((part) => normalized.includes(part));
};

const isObjectIdLike = (value) =>
  Boolean(value) &&
  typeof value === "object" &&
  (value?._bsontype === "ObjectId" || value?.constructor?.name === "ObjectId") &&
  typeof value.toString === "function" &&
  /^[0-9a-fA-F]{24}$/.test(String(value));

const sanitizeSingleStorePayload = (value, seen = new WeakMap()) => {
  if (!value || typeof value !== "object") return value;

  if (value instanceof Date) return value;
  if (isObjectIdLike(value)) return String(value);

  if (Array.isArray(value)) {
    if (seen.has(value)) return seen.get(value);
    const sanitizedArray = [];
    seen.set(value, sanitizedArray);
    value.forEach((entry) => {
      sanitizedArray.push(sanitizeSingleStorePayload(entry, seen));
    });
    return sanitizedArray;
  }

  const source =
    typeof value.toObject === "function"
      ? value.toObject({ virtuals: true })
      : value;

  if (seen.has(source)) return seen.get(source);

  const sanitizedObject = {};
  seen.set(source, sanitizedObject);

  return Object.entries(source).reduce((acc, [key, entry]) => {
    if (shouldRemoveKey(key)) return acc;
    acc[key] = sanitizeSingleStorePayload(entry, seen);
    return acc;
  }, sanitizedObject);
};

const singleStoreResponseSanitizer = (_req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload) => originalJson(sanitizeSingleStorePayload(payload));

  next();
};

module.exports = {
  sanitizeSingleStorePayload,
  singleStoreResponseSanitizer,
};
