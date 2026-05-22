import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import {
  FiActivity,
  FiEye,
  FiEyeOff,
  FiBarChart2,
  FiRefreshCw,
  FiSettings,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  loadAdminSettings,
  selectAdminSettingsDraft,
  selectPublicSettingsState,
} from "../store/publicSettingsSlice";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const DEFAULT_OVERVIEW = {
  control: {
    marketplaceMode: "single",
  },
  activity: {
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    last30DaysOrders: 0,
    last30DaysRevenue: 0,
    recentOrders: [],
    recentUsers: [],
  },
};

const ADMIN_PERMISSION_OPTIONS = [
  { key: "manageOrders", label: "Orders" },
  { key: "manageProducts", label: "Products" },
  { key: "manageUsers", label: "Users" },
  { key: "manageReports", label: "Reports" },
  { key: "manageWebsite", label: "Website" },
];

const buildDefaultPermissionState = (enabled = true) =>
  ADMIN_PERMISSION_OPTIONS.reduce((acc, permission) => {
    acc[permission.key] = Boolean(enabled);
    return acc;
  }, {});

const DEFAULT_ADMIN_FORM = {
  name: "",
  email: "",
  phone: "",
  password: "",
  status: "active",
  adminPermissions: buildDefaultPermissionState(true),
};

const PermissionToggle = ({
  checked,
  onChange,
  label,
  themeColor,
  buttonTextColor,
}) => (
  <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`app-toggle-switch focus:outline-none ${checked ? "is-on" : ""}`}
      style={{
        backgroundColor: checked
          ? themeColor || "var(--brand-theme-color)"
          : "rgba(226, 232, 240, 1)",
        borderColor: checked
          ? themeColor || "var(--brand-theme-color)"
          : "rgba(203, 213, 225, 1)",
      }}
    >
      <span
        className="app-toggle-switch__knob"
        style={{
          backgroundColor: checked
            ? buttonTextColor || "var(--brand-button-text-color)"
            : "#ffffff",
        }}
      />
    </button>
    {label}
  </label>
);

const ModuleSuperAdminControl = () => {
  const dispatch = useDispatch();
  const adminDraft = useSelector(selectAdminSettingsDraft);
  const { adminStatus } = useSelector(selectPublicSettingsState);
  const [loading, setLoading] = useState(true);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [overview, setOverview] = useState(DEFAULT_OVERVIEW);
  const [adminForm, setAdminForm] = useState(DEFAULT_ADMIN_FORM);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsOptionsLoading, setAnalyticsOptionsLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [analyticsFilters, setAnalyticsFilters] = useState({
    from: "",
    to: "",
    productId: "",
    categoryId: "",
    categoryType: "",
    brand: "",
  });
  const [groupBy, setGroupBy] = useState("product");
  const [analyticsPayload, setAnalyticsPayload] = useState({
    summary: null,
    reports: [],
    trend: [],
  });
  const themeColor =
    String(adminDraft?.website?.themeColor || "").trim() ||
    "var(--brand-theme-color)";
  const buttonTextColor =
    String(adminDraft?.website?.buttonTextColor || "").trim() ||
    "var(--brand-button-text-color)";

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${baseUrl}/auth/admin/marketplace-control`,
        {
          headers: getAuthHeaders(),
        },
      );

      const payload = response.data || {};
      const nextOverview = {
        ...DEFAULT_OVERVIEW,
        ...payload,
        control: {
          ...DEFAULT_OVERVIEW.control,
          ...(payload.control || {}),
          marketplaceMode: "single",
        },
        activity: {
          ...DEFAULT_OVERVIEW.activity,
          ...(payload.activity || {}),
          recentOrders: Array.isArray(payload?.activity?.recentOrders)
            ? payload.activity.recentOrders
            : [],
          recentUsers: Array.isArray(payload?.activity?.recentUsers)
            ? payload.activity.recentUsers
            : [],
        },
      };

      setOverview(nextOverview);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to load marketplace control",
      );
      setOverview(DEFAULT_OVERVIEW);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalyticsOptions = useCallback(async () => {
    try {
      setAnalyticsOptionsLoading(true);
      const [productResponse, categoryResponse, brandResponse] = await Promise.all([
        axios.get(`${baseUrl}/products`, { headers: getAuthHeaders() }),
        axios.get(`${baseUrl}/categories`, { headers: getAuthHeaders() }),
        axios.get(`${baseUrl}/brands`, { headers: getAuthHeaders() }),
      ]);

      setProducts(Array.isArray(productResponse.data?.products) ? productResponse.data.products : []);
      setCategories(
        Array.isArray(categoryResponse.data?.categories) ? categoryResponse.data.categories : [],
      );
      setBrands(Array.isArray(brandResponse.data?.brands) ? brandResponse.data.brands : []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load analytics options");
      setProducts([]);
      setCategories([]);
      setBrands([]);
    } finally {
      setAnalyticsOptionsLoading(false);
    }
  }, []);

  const loadRevenueAnalytics = useCallback(async (filters = analyticsFilters) => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError("");
      const response = await axios.get(`${baseUrl}/orders/admin/product-reports`, {
        headers: getAuthHeaders(),
        params: {
          from: filters.from || undefined,
          to: filters.to || undefined,
          productId: filters.productId || undefined,
          categoryId: filters.categoryId || undefined,
          categoryType: filters.categoryType || undefined,
          brand: filters.brand || undefined,
        },
      });

      setAnalyticsPayload({
        summary: response.data?.summary || null,
        reports: Array.isArray(response.data?.reports) ? response.data.reports : [],
        trend: Array.isArray(response.data?.trend) ? response.data.trend : [],
      });
    } catch (error) {
      const message = error.response?.data?.message || "Failed to load revenue analytics";
      setAnalyticsError(message);
      setAnalyticsPayload({ summary: null, reports: [], trend: [] });
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsFilters]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadAnalyticsOptions();
    loadRevenueAnalytics();
  }, [loadAnalyticsOptions, loadRevenueAnalytics]);

  const categoryTypeOptions = useMemo(() => {
    const types = new Set();
    categories.forEach((cat) => {
      const type = String(cat?.type ?? cat?.categoryType ?? cat?.productType ?? "").trim();
      if (type) types.add(type);
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const productSelectOptions = useMemo(
    () =>
      products.map((product) => ({
        value: String(product?._id || ""),
        label: String(product?.title || "Untitled Product"),
      })),
    [products],
  );

  const categorySelectOptions = useMemo(
    () =>
      categories.map((cat) => ({
        value: String(cat?._id || ""),
        label: `${String(cat?.name || "Unnamed")} (${String(
          cat?.type ?? cat?.categoryType ?? cat?.productType ?? "General",
        )})`,
      })),
    [categories],
  );

  const brandSelectOptions = useMemo(
    () =>
      brands.map((brand) => ({
        value: String(brand?.name || "").trim(),
        label: String(brand?.name || "").trim(),
      })),
    [brands],
  );

  const pieData = useMemo(() => {
    const keyForRow = (row) => {
      if (groupBy === "category") return String(row?.categoryName || "Unassigned");
      if (groupBy === "brand") return String(row?.brand || "Unassigned");
      if (groupBy === "categoryType") return String(row?.categoryType || "Unassigned");
      return String(row?.title || "Product");
    };

    const buckets = new Map();
    analyticsPayload.reports.forEach((row) => {
      const key = keyForRow(row);
      const value = Number(row?.grossRevenue || 0);
      buckets.set(key, (buckets.get(key) || 0) + value);
    });

    const sorted = Array.from(buckets.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 8) return sorted;

    const top = sorted.slice(0, 8);
    const otherValue = sorted.slice(8).reduce((acc, entry) => acc + entry.value, 0);
    return [...top, { name: "Other", value: Number(otherValue.toFixed(2)) }];
  }, [analyticsPayload.reports, groupBy]);

  const chartColors = [
    "#111827",
    "#2563eb",
    "#16a34a",
    "#ca8a04",
    "#9333ea",
    "#ea580c",
    "#db2777",
    "#0ea5e9",
    "#64748b",
  ];

  useEffect(() => {
    if (adminStatus !== "loading") {
      dispatch(loadAdminSettings()).catch(() => undefined);
    }
  }, [adminStatus, dispatch]);

  const updateAdminField = (key, value) => {
    setAdminForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateAdminPermission = (key, value) => {
    setAdminForm((prev) => ({
      ...prev,
      adminPermissions: {
        ...(prev.adminPermissions || {}),
        [key]: Boolean(value),
      },
    }));
  };

  const handleCreateAdmin = async () => {
    const payload = {
      name: String(adminForm.name || "").trim(),
      email: String(adminForm.email || "").trim(),
      phone: String(adminForm.phone || "").trim(),
      password: String(adminForm.password || ""),
      status: String(adminForm.status || "active").toLowerCase(),
      adminPermissions:
        adminForm.adminPermissions || buildDefaultPermissionState(true),
    };

    if (
      !payload.name ||
      !payload.email ||
      !payload.phone ||
      !payload.password
    ) {
      toast.error("Name, email, phone and password are required");
      return;
    }

    try {
      setCreatingAdmin(true);
      await axios.post(`${baseUrl}/auth/admin/create-admin`, payload, {
        headers: getAuthHeaders(),
      });
      toast.success("Admin account created");
      setAdminForm(DEFAULT_ADMIN_FORM);
      await loadOverview();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create admin");
    } finally {
      setCreatingAdmin(false);
    }
  };

  const activity = overview.activity || DEFAULT_OVERVIEW.activity;

  return (
    <div className="space-y-6">
      <div className="bg-linear-to-r from-zinc-900 to-black rounded-xl p-6 md:p-8 text-white">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-4">
          <FiShield className="w-6 h-6" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">Super Admin Control</h1>
        <p className="text-zinc-200 mt-2">
          Manage admin access and monitor platform activity.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
          <h2 className="text-base font-semibold text-black">
            Super Admin Can
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            <li>Create admin accounts and set their permissions</li>
            <li>Access super admin control and full platform overview</li>
            <li>Manage admin users and global website controls</li>
          </ul>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
          <h2 className="text-base font-semibold text-black">Admin Can</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            <li>Run daily operations: orders, catalog, customers, reports</li>
            <li>
              Use modules assigned by permission set (users/reports/website)
            </li>
            <li>
              Manage storefront, products, campaigns, and customer service
            </li>
            <li>Cannot access super admin mode or create other admins</li>
          </ul>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
              <FiSettings className="w-4 h-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-black">Store Mode</p>
              <p className="text-xs text-gray-500">
                This store now runs in single-store mode.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadOverview}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <FiRefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-700">
            Current: Single Store
          </span>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-black">
              Create Admin Account
            </h2>
            <p className="text-xs text-gray-500">
              Super admin can create new admin users with role permissions.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
            Super Admin Only
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-medium text-gray-600 mb-1 block">
              Full Name
            </span>
            <input
              type="text"
              value={adminForm.name}
              onChange={(event) => updateAdminField("name", event.target.value)}
              placeholder="Enter admin name"
              className="w-full h-10 px-3 border border-gray-200 rounded-lg"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600 mb-1 block">
              Email
            </span>
            <input
              type="email"
              value={adminForm.email}
              onChange={(event) =>
                updateAdminField("email", event.target.value)
              }
              placeholder="Enter admin email"
              className="w-full h-10 px-3 border border-gray-200 rounded-lg"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600 mb-1 block">
              Phone
            </span>
            <input
              type="text"
              value={adminForm.phone}
              onChange={(event) =>
                updateAdminField("phone", event.target.value)
              }
              placeholder="01XXXXXXXXX"
              className="w-full h-10 px-3 border border-gray-200 rounded-lg"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600 mb-1 block">
              Password
            </span>
            <div className="relative">
              <input
                type={showAdminPassword ? "text" : "password"}
                value={adminForm.password}
                onChange={(event) =>
                  updateAdminField("password", event.target.value)
                }
                placeholder="Minimum 8 characters"
                className="w-full h-10 px-3 pr-10 border border-gray-200 rounded-lg"
              />
              <button
                type="button"
                onClick={() => setShowAdminPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-600 hover:bg-gray-100"
                aria-label={
                  showAdminPassword ? "Hide password" : "Show password"
                }
              >
                {showAdminPassword ? (
                  <FiEyeOff className="h-4 w-4" />
                ) : (
                  <FiEye className="h-4 w-4" />
                )}
              </button>
            </div>
          </label>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-gray-600 mb-2">
            Admin Permissions
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ADMIN_PERMISSION_OPTIONS.map((permission) => (
              <PermissionToggle
                key={permission.key}
                label={permission.label}
                checked={Boolean(adminForm.adminPermissions?.[permission.key])}
                onChange={(nextChecked) =>
                  updateAdminPermission(permission.key, nextChecked)
                }
                themeColor={themeColor}
                buttonTextColor={buttonTextColor}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreateAdmin}
          disabled={creatingAdmin}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-black px-5 font-medium text-white disabled:opacity-60"
        >
          <FiUsers
            className={`h-4 w-4 ${creatingAdmin ? "animate-pulse" : ""}`}
          />
          {creatingAdmin ? "Creating..." : "Create Admin"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500">Total Users</p>
          <p className="text-xl font-bold text-black mt-1">
            {Number(activity.totalUsers || 0)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500">Total Orders</p>
          <p className="text-xl font-bold text-black mt-1">
            {Number(activity.totalOrders || 0)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500">Delivered Revenue</p>
          <p className="text-xl font-bold text-black mt-1">
            {Number(activity.totalRevenue || 0).toFixed(2)} Tk
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500">Products (filtered)</p>
          <p className="text-xl font-bold text-black mt-1">
            {Number(analyticsPayload.summary?.totalProducts || 0)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500">Sold Units (filtered)</p>
          <p className="text-xl font-bold text-black mt-1">
            {Number(analyticsPayload.summary?.totalQuantitySold || 0)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500">Revenue (filtered)</p>
          <p className="text-xl font-bold text-black mt-1">
            {Number(analyticsPayload.summary?.totalRevenue || 0).toFixed(2)} Tk
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500">Cost (filtered)</p>
          <p className="text-xl font-bold text-black mt-1">
            {Number(analyticsPayload.summary?.totalCost || 0).toFixed(2)} Tk
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[11px] text-gray-500">Profit (filtered)</p>
          <p className="text-xl font-bold text-black mt-1">
            {Number(analyticsPayload.summary?.totalProfit || 0).toFixed(2)} Tk
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <FiActivity className="h-4 w-4 text-gray-600" />
            <h2 className="text-lg font-semibold text-black">
              Recent Orders (
              {Array.isArray(activity.recentOrders)
                ? activity.recentOrders.length
                : 0}
              )
            </h2>
          </div>
          {Array.isArray(activity.recentOrders) &&
          activity.recentOrders.length > 0 ? (
            <div className="space-y-2">
              {activity.recentOrders.map((order) => (
                <div
                  key={`${order.orderNumber}-${order.createdAt}`}
                  className="rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-black truncate">
                      {order.orderNumber || "N/A"}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {order.status || "-"}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {order.customerName || "Guest"} •{" "}
                    {Number(order.total || 0).toFixed(2)} Tk
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No order activity found.</p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <FiUsers className="h-4 w-4 text-gray-600" />
            <h2 className="text-lg font-semibold text-black">
              Recent Users (
              {Array.isArray(activity.recentUsers)
                ? activity.recentUsers.length
                : 0}
              )
            </h2>
          </div>
          {Array.isArray(activity.recentUsers) &&
          activity.recentUsers.length > 0 ? (
            <div className="space-y-2">
              {activity.recentUsers.map((account) => (
                <div
                  key={`${account.email}-${account.createdAt}`}
                  className="rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-black truncate">
                      {account.name || "-"}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {String(account.userType || "user")}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 truncate">
                    {account.email || account.phone || "-"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No user activity found.</p>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6 overflow-hidden">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <div className="flex items-center gap-2">
            <FiBarChart2 className="h-4 w-4 text-gray-600" />
            <div>
              <h2 className="text-lg font-semibold text-black">Revenue Analytics</h2>
              <p className="text-xs text-gray-500">
                Filter by product, category, category type, and brand.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadRevenueAnalytics()}
            disabled={analyticsLoading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium disabled:opacity-60"
          >
            <FiRefreshCw className={`h-4 w-4 ${analyticsLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-1 block">From</span>
              <input
                type="date"
                value={analyticsFilters.from}
                onChange={(event) =>
                  setAnalyticsFilters((prev) => ({ ...prev, from: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-1 block">To</span>
              <input
                type="date"
                value={analyticsFilters.to}
                onChange={(event) =>
                  setAnalyticsFilters((prev) => ({ ...prev, to: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-1 block">Product</span>
              <select
                value={analyticsFilters.productId}
                onChange={(event) =>
                  setAnalyticsFilters((prev) => ({ ...prev, productId: event.target.value }))
                }
                disabled={analyticsOptionsLoading}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">All products</option>
                {productSelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-1 block">Category</span>
              <select
                value={analyticsFilters.categoryId}
                onChange={(event) =>
                  setAnalyticsFilters((prev) => ({ ...prev, categoryId: event.target.value }))
                }
                disabled={analyticsOptionsLoading}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">All categories</option>
                {categorySelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-1 block">Category Type</span>
              <select
                value={analyticsFilters.categoryType}
                onChange={(event) =>
                  setAnalyticsFilters((prev) => ({ ...prev, categoryType: event.target.value }))
                }
                disabled={analyticsOptionsLoading}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">All types</option>
                {categoryTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-1 block">Brand</span>
              <select
                value={analyticsFilters.brand}
                onChange={(event) =>
                  setAnalyticsFilters((prev) => ({ ...prev, brand: event.target.value }))
                }
                disabled={analyticsOptionsLoading}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
              >
                <option value="">All brands</option>
                {brandSelectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <span className="text-xs font-medium text-gray-600">Pie group</span>
              <select
                value={groupBy}
                onChange={(event) => setGroupBy(event.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              >
                <option value="product">Product</option>
                <option value="category">Category</option>
                <option value="categoryType">Category Type</option>
                <option value="brand">Brand</option>
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => loadRevenueAnalytics()}
                disabled={analyticsLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-medium text-white disabled:opacity-60"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleared = {
                    from: "",
                    to: "",
                    productId: "",
                    categoryId: "",
                    categoryType: "",
                    brand: "",
                  };
                  setAnalyticsFilters(cleared);
                  loadRevenueAnalytics(cleared);
                }}
                disabled={analyticsLoading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-medium disabled:opacity-60"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {analyticsError ? (
          <p className="mt-4 text-sm text-red-600">{analyticsError}</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-[11px] text-gray-500">Profit (filtered)</p>
                <p className="text-xl font-bold text-black mt-1">
                  {Number(analyticsPayload.summary?.totalProfit || 0).toFixed(2)} Tk
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-[11px] text-gray-500">Revenue (filtered)</p>
                <p className="text-xl font-bold text-black mt-1">
                  {Number(analyticsPayload.summary?.totalRevenue || 0).toFixed(2)} Tk
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-[11px] text-gray-500">Cost (filtered)</p>
                <p className="text-xl font-bold text-black mt-1">
                  {Number(analyticsPayload.summary?.totalCost || 0).toFixed(2)} Tk
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 min-w-0">
                <p className="text-sm font-semibold text-black mb-2">Revenue share (Pie)</p>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={48} />
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        outerRadius={95}
                        innerRadius={45}
                        paddingAngle={2}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`${entry.name}-${index}`}
                            fill={chartColors[index % chartColors.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 min-w-0">
                <p className="text-sm font-semibold text-black mb-2">Revenue & profit trend</p>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsPayload.trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="revenue"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="profit"
                        stroke="#16a34a"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="quantitySold"
                        stroke="#111827"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm bg-white">
                <thead className="text-left text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-3">Product</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Brand</th>
                    <th className="py-2 px-3">Qty</th>
                    <th className="py-2 px-3">Revenue</th>
                    <th className="py-2 px-3">Cost</th>
                    <th className="py-2 px-3">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsLoading ? (
                    <tr>
                      <td colSpan={7} className="py-3 px-3 text-gray-600">
                        Loading analytics...
                      </td>
                    </tr>
                  ) : analyticsPayload.reports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-3 px-3 text-gray-600">
                        No data found for selected filters.
                      </td>
                    </tr>
                  ) : (
                    analyticsPayload.reports.slice(0, 25).map((row) => (
                      <tr key={String(row.productId)} className="border-b border-gray-100">
                        <td className="py-2 px-3 whitespace-nowrap">{row.title}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {row.categoryName || "-"} {row.categoryType ? `(${row.categoryType})` : ""}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">{row.brand || "-"}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {Number(row.quantitySold || 0)}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {Number(row.grossRevenue || 0).toFixed(2)} Tk
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {Number(row.grossCost || 0).toFixed(2)} Tk
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {Number(row.grossProfit || 0).toFixed(2)} Tk
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModuleSuperAdminControl;
