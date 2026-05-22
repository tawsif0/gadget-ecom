import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import {
  FiArchive,
  FiCheckCircle,
  FiFilter,
  FiRefreshCw,
  FiTrash2,
  FiPhoneCall,
} from "react-icons/fi";
import SearchableSelect from "../components/SearchableSelect";
import { useAuth } from "../hooks/useAuth";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const statusBadgeClass = (status = "") => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "new") return "bg-blue-100 text-blue-700";
  if (normalized === "follow_up") return "bg-yellow-100 text-yellow-700";
  if (normalized === "converted") return "bg-emerald-100 text-emerald-700";
  if (normalized === "discarded") return "bg-zinc-200 text-zinc-700";
  return "bg-gray-100 text-gray-700";
};

const ModuleAbandonedOrders = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const canAccess = useMemo(
    () => String(user?.userType || "").toLowerCase() === "admin",
    [user?.userType],
  );

  const fetchRows = useCallback(async (filters = {}) => {
    if (!canAccess) return;

    const nextSearch = filters.search !== undefined ? filters.search : search;
    const nextStatus = filters.status !== undefined ? filters.status : status;

    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/abandoned-orders`, {
        headers: getAuthHeaders(),
        params: {
          search: nextSearch || undefined,
          status: nextStatus || undefined,
          limit: 100,
        },
      });

      setRows(response.data?.abandonedOrders || []);
      setSummary(response.data?.summary || {});
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load abandoned orders");
      setRows([]);
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [canAccess, search, status]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const changeStatus = async (row, nextStatus) => {
    try {
      await axios.patch(
        `${baseUrl}/abandoned-orders/${row._id}`,
        { status: nextStatus },
        { headers: getAuthHeaders() },
      );
      setRows((prev) =>
        prev.map((entry) =>
          entry._id === row._id
            ? {
                ...entry,
                status: nextStatus,
              }
            : entry,
        ),
      );
      toast.success("Status updated");
      fetchRows();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  const convertToOrder = async (row) => {
    try {
      const response = await axios.post(
        `${baseUrl}/abandoned-orders/${row._id}/convert`,
        {},
        { headers: getAuthHeaders() },
      );
      const orderNumber = response.data?.order?.orderNumber || "";
      toast.success(orderNumber ? `Converted: ${orderNumber}` : "Converted to order");
      fetchRows();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to convert abandoned order");
    }
  };

  const deleteRow = async (row) => {
    const ok = window.confirm("Delete this abandoned order entry?");
    if (!ok) return;

    try {
      await axios.delete(`${baseUrl}/abandoned-orders/${row._id}`, {
        headers: getAuthHeaders(),
      });
      toast.success("Deleted");
      fetchRows();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete abandoned order");
    }
  };

  const applyFilters = async () => {
    try {
      setIsApplying(true);
      await fetchRows();
    } finally {
      setIsApplying(false);
    }
  };

  const clearFilters = async () => {
    setSearch("");
    setStatus("");
    try {
      setIsApplying(true);
      await fetchRows({ search: "", status: "" });
    } finally {
      setIsApplying(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <h2 className="text-xl font-semibold text-black mb-2">Access Required</h2>
        <p className="text-gray-600">Only admin can access abandoned orders.</p>
      </div>
    );
  }

  const summaryCards = [
    { label: "New", value: Number(summary?.new?.count || 0) },
    { label: "Follow-up", value: Number(summary?.follow_up?.count || 0) },
    { label: "Converted", value: Number(summary?.converted?.count || 0) },
    { label: "Discarded", value: Number(summary?.discarded?.count || 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-linear-to-r from-zinc-900 to-black rounded-xl p-6 md:p-8 text-white">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-4">
          <FiArchive className="w-6 h-6" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">Abandoned Orders</h1>
        <p className="text-zinc-200 mt-2">
          Recover high-intent checkout drop-offs and convert them into confirmed orders.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-black mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
            <FiFilter className="w-4 h-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-black">Filters</p>
            <p className="text-xs text-gray-500">Search customer details or filter by status.</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-linear-to-br from-white to-gray-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:max-w-2xl">
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-1 block">Search</span>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, phone, email"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-1 block">Status</span>
                <SearchableSelect
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: "", label: "All statuses" },
                    { value: "new", label: "New" },
                    { value: "follow_up", label: "Follow-up" },
                    { value: "converted", label: "Converted" },
                    { value: "discarded", label: "Discarded" },
                  ]}
                  placeholder="All statuses"
                  searchable={false}
                  className="min-w-0"
                  buttonClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white"
                  menuClassName="rounded-xl"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={applyFilters}
                disabled={isApplying}
                className="inline-flex h-10 items-center justify-center gap-2 px-4 bg-black text-white rounded-lg font-medium whitespace-nowrap disabled:opacity-60"
              >
                <FiRefreshCw className={`w-4 h-4 ${isApplying ? "animate-spin" : ""}`} />
                Apply Filters
              </button>
              <button
                onClick={clearFilters}
                disabled={isApplying}
                className="inline-flex h-10 items-center justify-center gap-2 px-4 border border-gray-300 rounded-lg font-medium whitespace-nowrap hover:bg-gray-100 disabled:opacity-60"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">Abandoned Rows ({rows.length})</h2>
          <button
            onClick={fetchRows}
            className="inline-flex h-10 items-center gap-2 px-4 text-sm border border-gray-200 rounded-lg"
          >
            <FiRefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading abandoned rows...</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-600">No abandoned orders found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Items</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Captured</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id} className="border-b border-gray-100 align-top">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-black">{row.customer?.name || "Guest"}</p>
                      <p className="text-xs text-gray-600">{row.customer?.phone || "-"}</p>
                      <p className="text-xs text-gray-500">{row.customer?.email || "-"}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <p className="text-gray-800">{Number(row.items?.length || 0)} item(s)</p>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {Array.isArray(row.items)
                          ? row.items.map((item) => item.title).filter(Boolean).join(", ")
                          : "-"}
                      </p>
                    </td>
                    <td className="py-3 pr-3 font-semibold text-black">
                      {Number(row.total || 0).toFixed(2)} Tk
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold ${statusBadgeClass(row.status)}`}
                      >
                        {String(row.status || "new").toUpperCase()}
                      </span>
                      <div className="mt-2">
                        <SearchableSelect
                          value={row.status || "new"}
                          onChange={(value) => changeStatus(row, value)}
                          options={[
                            { value: "new", label: "new" },
                            { value: "follow_up", label: "follow_up" },
                            { value: "converted", label: "converted" },
                            { value: "discarded", label: "discarded" },
                          ]}
                          placeholder="Status"
                          searchable={false}
                          className="min-w-0"
                          buttonClassName="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white"
                          menuClassName="rounded-xl"
                        />
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-gray-600">
                      {row.capturedAt ? new Date(row.capturedAt).toLocaleString() : "-"}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => convertToOrder(row)}
                          disabled={String(row.status) === "converted"}
                          className="inline-flex h-8 items-center gap-1 px-2.5 text-xs rounded-md bg-black text-white disabled:opacity-50"
                        >
                          <FiCheckCircle className="w-3.5 h-3.5" />
                          Convert
                        </button>
                        <button
                          onClick={() => changeStatus(row, "follow_up")}
                          className="inline-flex h-8 items-center gap-1 px-2.5 text-xs rounded-md border border-gray-300"
                        >
                          <FiPhoneCall className="w-3.5 h-3.5" />
                          Follow-up
                        </button>
                        <button
                          onClick={() => deleteRow(row)}
                          className="inline-flex h-8 items-center gap-1 px-2.5 text-xs rounded-md border border-red-300 text-red-600"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModuleAbandonedOrders;
