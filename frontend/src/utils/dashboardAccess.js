const ADMIN_PERMISSION_KEYS = [
  "manageOrders",
  "manageProducts",
  "manageUsers",
  "manageReports",
  "manageWebsite",
];

export const normalizeMarketplaceMode = () => "single";

export const resolveUserRole = (user) => {
  const role = String(user?.userType || "user")
    .trim()
    .toLowerCase();
  return role === "admin" ? "admin" : "user";
};

const hasAnyAdminPermissionConfigured = (permissions) =>
  ADMIN_PERMISSION_KEYS.some((key) =>
    Object.prototype.hasOwnProperty.call(permissions || {}, key),
  );

export const isSuperAdminUser = (user) => {
  const role = resolveUserRole(user);
  if (role !== "admin") return false;
  return user?.adminSettings?.isSuperAdmin === true;
};

export const hasAdminPermission = (user, key) => {
  if (resolveUserRole(user) !== "admin") return false;
  if (!key) return true;

  const permissions =
    user?.adminSettings?.permissions &&
    typeof user.adminSettings.permissions === "object"
      ? user.adminSettings.permissions
      : {};

  if (!hasAnyAdminPermissionConfigured(permissions)) {
    return true;
  }

  return Boolean(permissions[key]);
};

const ADMIN_ALLOWED_TABS = new Set([
  "dashboard",
  "settings",
  "home",
  "notifications",
  "add-order",
  "order-list",
  "shipping-zones",
  "payment-methods",
  "courier-settings",
  "coupons",
  "customers",
  "product-reviews",
  "create-category",
  "modify-category",
  "create-product",
  "modify-product",
  "create-banner",
  "modify-banner",
  "module-brands",
  "module-inventory",
  "module-accounts",
  "product-reports",
  "module-business-reports",
  "customer-risk",
  "contacted-list",
  "module-website-setup",
  "module-seo-analytics",
  "module-admin-users",
  "module-super-admin",
  "module-abandoned",
]);

const USER_ALLOWED_TABS = new Set([
  "dashboard",
  "settings",
  "home",
  "notifications",
  "my-orders",
  "my-order-tracking",
  "my-addresses",
  "wishlist",
]);

const ADMIN_TAB_PERMISSION_MAP = {
  "add-order": "manageOrders",
  "order-list": "manageOrders",
  "shipping-zones": "manageOrders",
  "payment-methods": "manageOrders",
  "courier-settings": "manageOrders",
  "create-product": "manageProducts",
  "modify-product": "manageProducts",
  "create-category": "manageProducts",
  "modify-category": "manageProducts",
  "module-brands": "manageProducts",
  "module-inventory": "manageProducts",
  customers: "manageUsers",
  "product-reviews": "manageProducts",
  "module-admin-users": "manageUsers",
  "product-reports": "manageReports",
  "module-business-reports": "manageReports",
  "customer-risk": "manageReports",
  "create-banner": "manageWebsite",
  "modify-banner": "manageWebsite",
  "module-website-setup": "manageWebsite",
  "module-seo-analytics": "manageWebsite",
  "contacted-list": "manageWebsite",
};

export const canAccessDashboardTab = ({ user, tab }) => {
  const role = resolveUserRole(user);
  const normalizedTab = String(tab || "").trim();

  if (!normalizedTab) return false;

  if (role === "admin") {
    if (!ADMIN_ALLOWED_TABS.has(normalizedTab)) return false;

    if (
      normalizedTab === "module-super-admin"
    ) {
      return isSuperAdminUser(user);
    }

    const requiredPermission = ADMIN_TAB_PERMISSION_MAP[normalizedTab];
    if (!requiredPermission) return true;

    return hasAdminPermission(user, requiredPermission);
  }

  return USER_ALLOWED_TABS.has(normalizedTab);
};
