/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
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
import usePublicSettings from "../hooks/usePublicSettings";
import {
  canAccessDashboardTab,
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

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

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
                    label: "Add Order",
                    tab: "add-order",
                    icon: ShoppingBagIcon,
                  },
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
                    label: "Customer Risk",
                    tab: "customer-risk",
                    icon: ShieldCheckIcon,
                  },
                  {
                    label: "Abandoned Orders",
                    tab: "module-abandoned",
                    icon: TicketIcon,
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
                    label: "Super Admin",
                    tab: "module-super-admin",
                    icon: ShieldCheckIcon,
                  },
                  {
                    label: "Brands",
                    tab: "module-brands",
                    icon: ArrowRightIcon,
                  },
                  {
                    label: "Accounts",
                    tab: "module-accounts",
                    icon: CurrencyDollarIcon,
                  },
                  {
                    label: "Admin Users",
                    tab: "module-admin-users",
                    icon: ShieldCheckIcon,
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
