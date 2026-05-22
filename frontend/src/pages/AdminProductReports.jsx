import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FiBarChart2,
  FiDownload,
  FiFilter,
  FiRefreshCw,
  FiXCircle,
} from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const escapeCsv = (value) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const downloadCsvFile = (fileName, rows) => {
  const csv = rows.map((row) => row.map((cell) => escapeCsv(cell)).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const AdminProductReports = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalQuantitySold: 0,
    totalRevenue: 0,
  });
  const [reports, setReports] = useState([]);
  const [isApplying, setIsApplying] = useState(false);

  const fetchReports = useCallback(async (filters = {}) => {
    const selectedFromDate =
      filters.fromDate !== undefined ? filters.fromDate : fromDate;
    const selectedToDate = filters.toDate !== undefined ? filters.toDate : toDate;

    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/orders/admin/product-reports`, {
        headers: getAuthHeaders(),
        params: {
          from: selectedFromDate || undefined,
          to: selectedToDate || undefined,
        },
      });
      setSummary(
        response.data?.summary || {
          totalProducts: 0,
          totalQuantitySold: 0,
          totalRevenue: 0,
        },
      );
      setReports(response.data?.reports || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load product reports");
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    if (user?.userType === "admin") {
      fetchReports();
    }
  }, [user, fetchReports]);

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
  };

  const handleApplyFilters = async () => {
    try {
      setIsApplying(true);
      await fetchReports();
    } finally {
      setIsApplying(false);
    }
  };

  const handleClearFilters = async () => {
    clearFilters();
    try {
      setIsApplying(true);
      await fetchReports({ fromDate: "", toDate: "" });
    } finally {
      setIsApplying(false);
    }
  };

  const handleDownloadReport = () => {
    if (!reports.length) {
      toast.error("No product rows to download");
      return;
    }

    const rangeLabel =
      fromDate || toDate
        ? `${fromDate || "start"}_to_${toDate || "today"}`
        : "all_time";

    const generatedAt = new Date().toLocaleString();
    const rows = [
      ["Product Sales Report"],
      ["Generated At", generatedAt],
      ["From", fromDate || "N/A"],
      ["To", toDate || "N/A"],
      [],
      ["Summary"],
      ["Reported Products", summary.totalProducts || 0],
      ["Quantity Sold", summary.totalQuantitySold || 0],
      ["Total Revenue (Tk)", Number(summary.totalRevenue || 0).toFixed(2)],
      [],
      ["Rows"],
      ["Product", "Qty Sold", "Orders", "Revenue (Tk)"],
      ...reports.map((row) => [
        row.title || "",
        Number(row.quantitySold || 0),
        Number(row.orderCount || 0),
        Number(row.grossRevenue || 0).toFixed(2),
      ]),
    ];

    downloadCsvFile(`product-reports-${rangeLabel}.csv`, rows);
    toast.success("Product report downloaded");
  };

  const handleDownloadPdf = () => {
    if (!reports.length) {
      toast.error("No product rows to download");
      return;
    }

    const rangeLabel =
      fromDate || toDate
        ? `${fromDate || "start"}_to_${toDate || "today"}`
        : "all_time";

    const generatedAt = new Date().toLocaleString();
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    doc.setFontSize(18);
    doc.text("Product Sales Report", 40, 40);
    doc.setFontSize(10);
    doc.text(`Generated: ${generatedAt}`, 40, 60);
    doc.text(`From: ${fromDate || "N/A"}  To: ${toDate || "N/A"}`, 40, 74);

    autoTable(doc, {
      startY: 90,
      head: [["Metric", "Value"]],
      body: [
        ["Reported Products", Number(summary.totalProducts || 0)],
        ["Quantity Sold", Number(summary.totalQuantitySold || 0)],
        ["Total Revenue (Tk)", Number(summary.totalRevenue || 0).toFixed(2)],
      ],
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [17, 24, 39] },
      margin: { left: 40, right: 40 },
      tableWidth: 300,
    });

    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY || 90) + 18,
      head: [["Product", "Qty Sold", "Orders", "Revenue (Tk)"]],
      body: reports.map((row) => [
        row.title || "",
        Number(row.quantitySold || 0),
        Number(row.orderCount || 0),
        Number(row.grossRevenue || 0).toFixed(2),
      ]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [17, 24, 39] },
      margin: { left: 40, right: 40 },
    });

    doc.save(`product-reports-${rangeLabel}.pdf`);
    toast.success("Product PDF downloaded");
  };

  if (user?.userType !== "admin") {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <h2 className="text-xl font-semibold text-black mb-2">Admin Access Required</h2>
        <p className="text-gray-600">Only admins can view product reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-linear-to-r from-zinc-900 to-black rounded-xl p-6 md:p-8 text-white">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-4">
          <FiBarChart2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">Product Reports</h1>
        <p className="text-zinc-200 mt-2">
          Product-level sales and revenue analytics from store orders.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
            <FiFilter className="w-4 h-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-black">Report Filters</p>
            <p className="text-xs text-gray-500">
              Filter product sales reports by date range.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-linear-to-br from-white to-gray-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full lg:max-w-2xl">
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-1 block">From Date</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-1 block">To Date</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={handleApplyFilters}
                disabled={isApplying}
                className="inline-flex h-10 items-center justify-center gap-2 px-4 bg-black text-white rounded-lg font-medium whitespace-nowrap disabled:opacity-60"
              >
                <FiRefreshCw className={`w-4 h-4 ${isApplying ? "animate-spin" : ""}`} />
                Apply Filters
              </button>
              <button
                onClick={handleClearFilters}
                disabled={isApplying}
                className="inline-flex h-10 items-center justify-center gap-2 px-4 border border-gray-300 rounded-lg font-medium whitespace-nowrap hover:bg-gray-100 disabled:opacity-60"
              >
                <FiXCircle className="w-4 h-4" />
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500">Reported Products</p>
          <p className="text-2xl font-bold text-black mt-1">{summary.totalProducts || 0}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500">Quantity Sold</p>
          <p className="text-2xl font-bold text-black mt-1">
            {summary.totalQuantitySold || 0}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-black mt-1">
            {Number(summary.totalRevenue || 0).toFixed(2)} Tk
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">
            Product Report Rows ({reports.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadReport}
              disabled={loading || reports.length === 0}
              className="inline-flex h-10 items-center gap-2 px-4 text-sm border border-gray-300 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-60"
            >
              <FiDownload className="w-4 h-4" />
              Download CSV
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={loading || reports.length === 0}
              className="inline-flex h-10 items-center gap-2 px-4 text-sm border border-gray-300 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-60"
            >
              <FiDownload className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={fetchReports}
              className="inline-flex h-10 items-center gap-2 px-4 text-sm border border-gray-200 rounded-lg"
            >
              <FiRefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading reports...</p>
        ) : reports.length === 0 ? (
          <p className="text-gray-600">No report data found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Qty Sold</th>
                  <th className="py-2 pr-3">Orders</th>
                  <th className="py-2 pr-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((row) => (
                  <tr key={String(row.productId)} className="border-b border-gray-100">
                    <td className="py-2 pr-3">{row.title}</td>
                    <td className="py-2 pr-3">{Number(row.quantitySold || 0)}</td>
                    <td className="py-2 pr-3">{Number(row.orderCount || 0)}</td>
                    <td className="py-2 pr-3">
                      {Number(row.grossRevenue || 0).toFixed(2)} Tk
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

export default AdminProductReports;
