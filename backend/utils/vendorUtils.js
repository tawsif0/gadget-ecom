const normalizeSlug = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const buildUniqueStoreSlug = async (Vendor, baseName, excludeVendorId = null) => {
  const baseSlug = normalizeSlug(baseName) || `store-${Date.now()}`;
  let slug = baseSlug;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await Vendor.findOne({
      slug,
      ...(excludeVendorId ? { _id: { $ne: excludeVendorId } } : {}),
    })
      .select("_id")
      .lean();

    if (!existing) return slug;

    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
};

const isAdmin = (user) => {
  const type = String(user?.userType || user?.role || "").toLowerCase();
  return type === "admin";
};

module.exports = {
  normalizeSlug,
  buildUniqueStoreSlug,
  isAdmin,
};
