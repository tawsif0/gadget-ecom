const safeString = (value) => String(value || "").trim();

const normalizeSeoKeywords = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => safeString(entry))
      .filter(Boolean)
      .join(", ");
  }

  return safeString(value);
};

const normalizeSeoSettings = (value = {}) => ({
  metaTitle: safeString(value?.metaTitle || value?.title || ""),
  metaDescription: safeString(
    value?.metaDescription || value?.description || "",
  ),
  metaKeywords: normalizeSeoKeywords(
    value?.metaKeywords || value?.keywords || "",
  ),
  openGraphImage: safeString(
    value?.openGraphImage || value?.ogImage || value?.image || "",
  ),
});

module.exports = {
  normalizeSeoSettings,
};
