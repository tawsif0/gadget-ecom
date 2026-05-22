/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import {
  CheckCircleIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ArrowRightIcon,
  ShoppingBagIcon,
  HeartIcon,
  MapPinIcon,
  TicketIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
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
import usePublicSettings from "../hooks/usePublicSettings";
import {
  canAccessDashboardTab,
  isSuperAdminUser,
  normalizeMarketplaceMode,
} from "../utils/dashboardAccess";

const baseUrl = import.meta.env.VITE_API_URL;

const DashboardHome = ({ user, onTabChange }) => {
  const [loading, setLoading] = useState(false);
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    totalRevenue: 0,
    sales: {
      today: 0,
      monthly: 0,
      total: 0,
    },
    orders: {
      total: 0,
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
    },
    financials: {
      revenue: 0,
      otherIncome: 0,
      expense: 0,
      netProfit: 0,
    },
    inventory: {
      totalProducts: 0,
      totalStock: 0,
      lowStockAlerts: 0,
      outOfStock: 0,
    },
    customerInsights: {
      abandonedOrders: 0,
      abandonedValue: 0,
      highRiskCustomers: 0,
      recentOrders: [],
    },
  });
  const { settings, loaded } = usePublicSettings();

  const isAdmin = user?.userType === "admin";
  const isSuperAdmin = isSuperAdminUser(user);
  const marketplaceMode = loaded
    ? normalizeMarketplaceMode(settings?.marketplaceMode)
    : "multi";
  const statCardClass = "app-stat-card";
  const panelClass = "app-panel p-5";
  const actionButtonClass =
    "app-btn-secondary h-11 w-full justify-between px-4 text-sm font-semibold";

  const quickActions = [
    { label: "My Orders", tab: "my-orders", icon: ShoppingBagIcon },
    { label: "Saved Addresses", tab: "my-addresses", icon: MapPinIcon },
    { label: "Wishlist", tab: "wishlist", icon: HeartIcon },
  ];

  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsOptionsLoading, setAnalyticsOptionsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
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

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

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
      setProducts([]);
      setCategories([]);
      setBrands([]);
    } finally {
      setAnalyticsOptionsLoading(false);
    }
  }, []);

  const loadRevenueAnalytics = useCallback(
    async (filters = analyticsFilters) => {
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
        setAnalyticsError(error.response?.data?.message || "Failed to load revenue analytics");
        setAnalyticsPayload({ summary: null, reports: [], trend: [] });
      } finally {
        setAnalyticsLoading(false);
      }
    },
    [analyticsFilters],
  );

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !isSuperAdmin) return;
    loadAnalyticsOptions();
    loadRevenueAnalytics();
  }, [isAdmin, isSuperAdmin, loadAnalyticsOptions, loadRevenueAnalytics]);

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
      brands
        .map((brand) => String(brand?.name || "").trim())
        .filter(Boolean)
        .map((name) => ({ value: name, label: name })),
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

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const statsResponse = await axios.get(
        `${baseUrl}/auth/admin/system-stats`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setSystemStats((prev) => ({
        ...prev,
        ...(statsResponse.data || {}),
      }));
    } catch (error) {
      console.error("Error fetching admin dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="app-hero p-6 md:p-8">
          <p className="app-kicker text-white/65!">Operations overview</p>
          <h2 className="mt-3 text-2xl font-black text-white md:text-3xl">
            Admin Dashboard
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/72 md:text-base">
            Track revenue, inventory health, orders, and customer signals from
            one organized workspace.
          </p>
        </div>

        {loading ? (
          <div className="app-panel-soft flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={statCardClass}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <CurrencyDollarIcon className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Today Sales</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Number(systemStats?.sales?.today || 0).toFixed(2)} Tk
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={statCardClass}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Monthly Sales</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Number(systemStats?.sales?.monthly || 0).toFixed(2)} Tk
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={statCardClass}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <ShoppingBagIcon className="h-6 w-6 text-slate-700" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Number(systemStats?.orders?.total || 0)}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={statCardClass}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <ClockIcon className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Pipeline Orders</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Number(systemStats?.orders?.pending || 0) +
                        Number(systemStats?.orders?.confirmed || 0) +
                        Number(systemStats?.orders?.processing || 0) +
                        Number(systemStats?.orders?.shipped || 0)}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className={statCardClass}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircleIcon className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Delivered</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Number(systemStats?.orders?.delivered || 0)}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className={statCardClass}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <ShieldCheckIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Cancelled/Returned</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {Number(systemStats?.orders?.cancelled || 0) +
                        Number(systemStats?.orders?.returned || 0)}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className={`${panelClass} space-y-4`}>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Commerce Control
                  </p>
                  <p className="text-xs text-gray-500">
                    Fast access to stock, order, and catalog operations.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Manage Products", tab: "modify-product" },
                  { label: "Inventory Center", tab: "module-inventory" },
                  { label: "Order List", tab: "order-list" },
                  { label: "Product Reports", tab: "product-reports" },
                ].map((action) => (
                  <button
                    key={action.tab}
                    type="button"
                    onClick={() => onTabChange?.(action.tab)}
                    className={actionButtonClass}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className={panelClass}>
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  Financials
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Revenue</span>
                    <span className="font-semibold text-black">
                      {Number(systemStats?.financials?.revenue || 0).toFixed(2)}{" "}
                      Tk
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Expense</span>
                    <span className="font-semibold text-black">
                      {Number(systemStats?.financials?.expense || 0).toFixed(2)}{" "}
                      Tk
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                    <span className="text-gray-700">Net Profit</span>
                    <span
                      className={`font-bold ${
                        Number(systemStats?.financials?.netProfit || 0) >= 0
                          ? "text-emerald-700"
                          : "text-red-700"
                      }`}
                    >
                      {Number(systemStats?.financials?.netProfit || 0).toFixed(
                        2,
                      )}{" "}
                      Tk
                    </span>
                  </div>
                </div>
              </div>

              <div className={panelClass}>
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  Inventory
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total Stock Units</span>
                    <span className="font-semibold text-black">
                      {Number(systemStats?.inventory?.totalStock || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Products</span>
                    <span className="font-semibold text-black">
                      {Number(systemStats?.inventory?.totalProducts || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Low Stock Alerts</span>
                    <span className="font-semibold text-black">
                      {Number(systemStats?.inventory?.lowStockAlerts || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Out of Stock</span>
                    <span className="font-semibold text-black">
                      {Number(systemStats?.inventory?.outOfStock || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className={panelClass}>
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  Customer Insights
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Abandoned Orders</span>
                    <span className="font-semibold text-black">
                      {Number(
                        systemStats?.customerInsights?.abandonedOrders || 0,
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Abandoned Value</span>
                    <span className="font-semibold text-black">
                      {Number(
                        systemStats?.customerInsights?.abandonedValue || 0,
                      ).toFixed(2)}{" "}
                      Tk
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">High-Risk Customers</span>
                    <span className="font-semibold text-black">
                      {Number(
                        systemStats?.customerInsights?.highRiskCustomers || 0,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {isSuperAdmin ? (
              <div className={`${panelClass} overflow-hidden`}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Revenue Analytics
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Product costing analytics with revenue, sold units, and profit.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadRevenueAnalytics()}
                    disabled={analyticsLoading}
                    className="app-btn-secondary h-10 px-4 text-sm font-semibold disabled:opacity-60"
                  >
                    Refresh
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 mb-1 block">
                        From
                      </span>
                      <input
                        type="date"
                        value={analyticsFilters.from}
                        onChange={(event) =>
                          setAnalyticsFilters((prev) => ({
                            ...prev,
                            from: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 mb-1 block">
                        To
                      </span>
                      <input
                        type="date"
                        value={analyticsFilters.to}
                        onChange={(event) =>
                          setAnalyticsFilters((prev) => ({
                            ...prev,
                            to: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600 mb-1 block">
                        Product
                      </span>
                      <select
                        value={analyticsFilters.productId}
                        onChange={(event) =>
                          setAnalyticsFilters((prev) => ({
                            ...prev,
                            productId: event.target.value,
                          }))
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
                      <span className="text-xs font-medium text-gray-600 mb-1 block">
                        Category
                      </span>
                      <select
                        value={analyticsFilters.categoryId}
                        onChange={(event) =>
                          setAnalyticsFilters((prev) => ({
                            ...prev,
                            categoryId: event.target.value,
                          }))
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
                      <span className="text-xs font-medium text-gray-600 mb-1 block">
                        Category Type
                      </span>
                      <select
                        value={analyticsFilters.categoryType}
                        onChange={(event) =>
                          setAnalyticsFilters((prev) => ({
                            ...prev,
                            categoryType: event.target.value,
                          }))
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
                      <span className="text-xs font-medium text-gray-600 mb-1 block">
                        Brand
                      </span>
                      <select
                        value={analyticsFilters.brand}
                        onChange={(event) =>
                          setAnalyticsFilters((prev) => ({
                            ...prev,
                            brand: event.target.value,
                          }))
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
                      <span className="text-xs font-medium text-gray-600">
                        Pie group
                      </span>
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
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-black px-4 text-sm font-semibold text-white disabled:opacity-60"
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
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 disabled:opacity-60"
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
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <p className="text-[11px] text-gray-500">Sold Units</p>
                        <p className="text-xl font-bold text-black mt-1">
                          {Number(analyticsPayload.summary?.totalQuantitySold || 0)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <p className="text-[11px] text-gray-500">Revenue</p>
                        <p className="text-xl font-bold text-black mt-1">
                          {Number(analyticsPayload.summary?.totalRevenue || 0).toFixed(2)} Tk
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <p className="text-[11px] text-gray-500">Cost</p>
                        <p className="text-xl font-bold text-black mt-1">
                          {Number(analyticsPayload.summary?.totalCost || 0).toFixed(2)} Tk
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <p className="text-[11px] text-gray-500">Profit</p>
                        <p className="text-xl font-bold text-black mt-1">
                          {Number(analyticsPayload.summary?.totalProfit || 0).toFixed(2)} Tk
                        </p>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <p className="text-[11px] text-gray-500">Reported Products</p>
                        <p className="text-xl font-bold text-black mt-1">
                          {Number(analyticsPayload.summary?.totalProducts || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-gray-200 bg-white p-4 min-w-0">
                        <p className="text-sm font-semibold text-black mb-2">
                          Revenue share (Pie)
                        </p>
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
                        <p className="text-sm font-semibold text-black mb-2">
                          Revenue & sold units trend
                        </p>
                        <div className="h-[280px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analyticsPayload.trend}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                              <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ fontSize: 11 }}
                              />
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
                  </>
                )}
              </div>
            ) : null}

            <div className={panelClass}>
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Recent Orders
              </p>
              {(systemStats?.customerInsights?.recentOrders || []).length ===
              0 ? (
                <p className="text-sm text-gray-500">No recent orders found.</p>
              ) : (
                <div className="space-y-2">
                  {(systemStats?.customerInsights?.recentOrders || []).map(
                    (order) => (
                      <div
                        key={order.orderNumber}
                        className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-black truncate">
                            {order.orderNumber}
                          </p>
                          <p className="text-gray-500 truncate">
                            {order.customerName || "Guest Customer"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-black">
                            {Number(order.total || 0).toFixed(2)} Tk
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            {order.status}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>

            <div className={panelClass}>
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Quick Access
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    label: "Order List",
                    tab: "order-list",
                    icon: ShoppingBagIcon,
                  },
                  {
                    label: "Inventory Center",
                    tab: "module-inventory",
                    icon: ArrowRightIcon,
                  },
                  {
                    label: "Business Reports",
                    tab: "module-business-reports",
                    icon: ArrowRightIcon,
                  },
                  {
                    label: "Website Setup",
                    tab: "module-website-setup",
                    icon: ArrowRightIcon,
                  },
                  {
                    label: "Brands",
                    tab: "module-brands",
                    icon: ArrowRightIcon,
                  },
                  {
                    label: "Geolocation",
                    tab: "module-geolocation",
                    icon: ArrowRightIcon,
                  },
                ]
                  .filter((action) =>
                    canAccessDashboardTab({
                      user,
                      tab: action.tab,
                      marketplaceMode,
                    }),
                  )
                  .map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.tab}
                        type="button"
                        onClick={() => onTabChange?.(action.tab)}
                        className={actionButtonClass}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {action.label}
                        </span>
                        <ArrowRightIcon className="w-4 h-4" />
                      </button>
                    );
                  })}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  const createdAt = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString()
    : "N/A";

  return (
    <div className="space-y-6">
      <div className="app-hero p-6 md:p-8">
        <p className="app-kicker text-white/65!">Account workspace</p>
        <h2 className="mt-3 text-2xl font-black text-white md:text-3xl">
          Welcome, {user?.name}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-white/72 md:text-base">
          Keep your orders, saved details, and account activity in one organized
          view.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={statCardClass}
        >
          <p className="text-sm text-gray-500">Email</p>
          <p className="text-lg font-bold text-gray-900 break-all">
            {user?.email || "-"}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={statCardClass}
        >
          <p className="text-sm text-gray-500">Account Status</p>
          <p className="text-2xl font-bold text-emerald-600">
            {user?.status || "active"}
          </p>
        </motion.div>
      </div>

      <div className={panelClass}>
        <p className="text-sm text-gray-500">Joined On</p>
        <p className="text-lg font-semibold text-gray-900 mt-1">{createdAt}</p>
      </div>

      <div className={panelClass}>
        <p className="text-sm font-semibold text-gray-900 mb-3">Quick Access</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions
            .filter((action) =>
              canAccessDashboardTab({
                user,
                tab: action.tab,
                marketplaceMode,
              }),
            )
            .map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.tab}
                  type="button"
                  onClick={() => onTabChange?.(action.tab)}
                  className={actionButtonClass}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {action.label}
                  </span>
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
