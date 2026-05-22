import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import {
  FiActivity,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiSettings,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import {
  broadcastPublicSettingsUpdated,
  fetchPublicSettings,
  invalidatePublicSettingsCache,
} from "../utils/publicSettings";
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

const ModuleSuperAdminControl = ({ onMarketplaceModeChange }) => {
  const dispatch = useDispatch();
  const adminDraft = useSelector(selectAdminSettingsDraft);
  const { adminStatus } = useSelector(selectPublicSettingsState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [overview, setOverview] = useState(DEFAULT_OVERVIEW);
  const [form, setForm] = useState(DEFAULT_OVERVIEW.control);
  const [adminForm, setAdminForm] = useState(DEFAULT_ADMIN_FORM);
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
      setForm(nextOverview.control);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to load marketplace control",
      );
      setOverview(DEFAULT_OVERVIEW);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (adminStatus !== "loading") {
      dispatch(loadAdminSettings()).catch(() => undefined);
    }
  }, [adminStatus, dispatch]);

  const hasChanges = useMemo(() => false, [form, overview.control]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await axios.put(
        `${baseUrl}/auth/admin/marketplace-control`,
        {
          marketplaceMode: "single",
        },
        { headers: getAuthHeaders() },
      );

      const control = {
        ...DEFAULT_OVERVIEW.control,
        ...(response.data?.control || {}),
        marketplaceMode: "single",
      };

      setForm(control);
      setOverview((prev) => ({
        ...prev,
        control,
      }));

      invalidatePublicSettingsCache();
      await fetchPublicSettings({ force: true });
      broadcastPublicSettingsUpdated();
      if (typeof onMarketplaceModeChange === "function") {
        onMarketplaceModeChange(control.marketplaceMode);
      }

      toast.success("Marketplace control updated");
      await loadOverview();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update marketplace control",
      );
    } finally {
      setSaving(false);
    }
  };

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

  const control = overview.control || DEFAULT_OVERVIEW.control;
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
            disabled={loading || saving}
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
    </div>
  );
};

export default ModuleSuperAdminControl;
