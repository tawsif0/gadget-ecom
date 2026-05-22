import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import {
  FiAlertTriangle,
  FiBox,
  FiEdit3,
  FiPackage,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

const baseUrl = import.meta.env.VITE_API_URL;

const toImageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return baseUrl ? `${baseUrl}${raw}` : raw;
  }
  return baseUrl ? `${baseUrl}/uploads/products/${raw}` : `/uploads/products/${raw}`;
};

const getStockStatus = (product) => {
  const stock = Math.max(0, Number(product?.stock || 0));
  const threshold = Math.max(0, Number(product?.lowStockThreshold || 0));

  if (stock <= 0) {
    return {
      key: "out",
      label: "Out of stock",
      className: "bg-red-50 text-red-700 border-red-200",
    };
  }

  if (threshold > 0 && stock <= threshold) {
    return {
      key: "low",
      label: "Low stock",
      className: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  return {
    key: "healthy",
    label: "Healthy",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
};

const openDashboardTab = (tab) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("dashboardActiveTab", tab);
  window.dispatchEvent(new CustomEvent("dashboardTabChange", { detail: { tab } }));
};

const ModuleInventoryCenter = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const role = String(user?.userType || "").toLowerCase();
  const canManageInventory = role === "admin";

  const loadInventory = useCallback(async () => {
    if (!canManageInventory) return;

    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`${baseUrl}/products`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setProducts(Array.isArray(response.data?.products) ? response.data.products : []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [canManageInventory]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if (!canManageInventory) return undefined;

    const handleInventoryRefresh = () => {
      loadInventory();
    };

    window.addEventListener("productCreated", handleInventoryRefresh);
    return () => {
      window.removeEventListener("productCreated", handleInventoryRefresh);
    };
  }, [canManageInventory, loadInventory]);

  const summary = useMemo(() => {
    return products.reduce(
      (acc, product) => {
        const stock = Math.max(0, Number(product?.stock || 0));
        const status = getStockStatus(product);
        acc.totalProducts += 1;
        acc.totalStock += stock;
        if (status.key === "low") acc.lowStock += 1;
        if (status.key === "out") acc.outOfStock += 1;
        return acc;
      },
      {
        totalProducts: 0,
        totalStock: 0,
        lowStock: 0,
        outOfStock: 0,
      },
    );
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = String(search || "").trim().toLowerCase();
    return products
      .filter((product) => {
        const status = getStockStatus(product);
        if (filter === "low" && status.key !== "low") return false;
        if (filter === "out" && status.key !== "out") return false;
        if (!query) return true;

        const haystack = [
          product?.title,
          product?.sku,
          product?.brand,
          product?.category?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((left, right) => {
        const statusOrder = { out: 0, low: 1, healthy: 2 };
        const leftStatus = getStockStatus(left);
        const rightStatus = getStockStatus(right);
        return (
          statusOrder[leftStatus.key] - statusOrder[rightStatus.key] ||
          Number(left?.stock || 0) - Number(right?.stock || 0)
        );
      });
  }, [filter, products, search]);

  if (!canManageInventory) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <h2 className="text-xl font-semibold text-black mb-2">Inventory Access Required</h2>
        <p className="text-gray-600">Only admin can manage stock inventory.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => openDashboardTab("modify-product")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-bold text-white"
            >
              <FiEdit3 className="h-4 w-4" />
              Manage Products
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:w-[320px]">
            {[
              { label: "Products", value: summary.totalProducts, icon: FiBox },
              { label: "Stock Units", value: summary.totalStock, icon: FiPackage },
              { label: "Low Stock", value: summary.lowStock, icon: FiAlertTriangle },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="rounded-[22px] border border-gray-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      {item.label}
                    </p>
                    <Icon className="h-4 w-4 text-gray-500" />
                  </div>
                  <p className="mt-3 text-2xl font-black text-black">{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
          <label className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
              <FiSearch className="h-[18px] w-[18px] text-gray-400" />
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product, SKU, brand, or category"
              className="h-[52px] w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm focus:border-black focus:bg-white focus:outline-none"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {[
              ["all", "All Stock"],
              ["low", "Low Stock"],
              ["out", "Out of Stock"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filter === key
                    ? "bg-black text-white"
                    : "border border-gray-200 bg-white text-gray-700 hover:border-black"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadInventory}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 text-sm font-semibold text-black transition hover:border-black"
          >
            <FiRefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-[28px] border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-black">
            Inventory Rows ({filteredProducts.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading inventory...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No products match this stock filter.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredProducts.map((product) => {
              const status = getStockStatus(product);
              const imageUrl = toImageUrl(product?.images?.[0]);
              const stock = Math.max(0, Number(product?.stock || 0));
              const threshold = Math.max(0, Number(product?.lowStockThreshold || 0));

              return (
                <div
                  key={product._id}
                  className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1.3fr)_150px_180px_220px]"
                >
                  <div className="flex min-w-0 gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product?.title || "Product"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-black">
                        {product?.title || "Untitled product"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        SKU: {product?.sku || "Not set"} • {product?.brand || "No brand"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {product?.category?.name || product?.productType || "General"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Stock
                    </p>
                    <p className="mt-1 text-2xl font-black text-black">{stock}</p>
                    <p className="mt-1 text-xs text-gray-500">Alert at {threshold}</p>
                  </div>

                  <div className="space-y-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                    <div className="text-xs text-gray-500">
                      <p>Backorder: {product?.allowBackorder ? "Allowed" : "Off"}</p>
                      <p>Price type: {String(product?.priceType || "single")}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => openDashboardTab("modify-product")}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-black transition hover:border-black"
                    >
                      <FiEdit3 className="h-4 w-4" />
                      Modify Product
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleInventoryCenter;

