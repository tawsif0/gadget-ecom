import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import SearchableSelect from "../components/SearchableSelect";
import { useAuth } from "../hooks/useAuth";

const baseUrl = import.meta.env.VITE_API_URL;

const REPORT_TYPES = [
  { value: "profit", label: "Profit / Loss" },
  { value: "sales", label: "Sales / Orders" },
  { value: "stock", label: "Stock" },
  { value: "abandoned", label: "Abandoned Orders" },
  { value: "risk", label: "Risk Customers" },
];

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const toTitleCase = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

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

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const downloadExcelFile = (fileName, header = [], bodyRows = []) => {
  const headerHtml = `<tr>${header
    .map((column) => `<th>${escapeHtml(column)}</th>`)
    .join("")}</tr>`;
  const rowsHtml = bodyRows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
    th { background: #111827; color: #ffffff; font-weight: 600; }
  </style>
</head>
<body>
  <table>
    <thead>${headerHtml}</thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([`\ufeff${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const formatCell = (value, type = "") => {
  if (value === null || value === undefined) return "";

  if (type === "date") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString();
  }

  if (type === "currency") {
    return `${Number(value || 0).toFixed(2)} Tk`;
  }

  if (type === "boolean") {
    return value ? "Yes" : "No";
  }

  if (type === "number") {
    return Number(value || 0);
  }

  return String(value);
};

const getSummaryCards = (summary = {}) => {
  const entries = Object.entries(summary || {});
  if (!entries.length) return [];

  return entries.slice(0, 6).map(([key, value]) => ({
    label: toTitleCase(key),
    value:
      typeof value === "number"
        ? Number.isInteger(value)
          ? value
          : value.toFixed(2)
        : String(value),
  }));
};

const ModuleBusinessReports = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [reportType, setReportType] = useState("sales");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [summaryByModule, setSummaryByModule] = useState({});
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [moduleSummary, setModuleSummary] = useState({});
  const [isApplying, setIsApplying] = useState(false);

  const canAccess = useMemo(
    () => String(user?.userType || "").toLowerCase() === "admin",
    [user?.userType],
  );

  const loadSummary = useCallback(async (filters = {}) => {
    if (!canAccess) return;

    const selectedFromDate =
      filters.fromDate !== undefined ? filters.fromDate : fromDate;
    const selectedToDate = filters.toDate !== undefined ? filters.toDate : toDate;

    try {
      setSummaryLoading(true);
      const response = await axios.get(`${baseUrl}/reports/summary`, {
        headers: getAuthHeaders(),
        params: {
          from: selectedFromDate || undefined,
          to: selectedToDate || undefined,
        },
      });

      setSummaryByModule(response.data?.summary || {});
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load report summary");
      setSummaryByModule({});
    } finally {
      setSummaryLoading(false);
    }
  }, [canAccess, fromDate, toDate]);

  const loadModuleReport = useCallback(async (filters = {}) => {
    if (!canAccess) return;

    const selectedType = filters.type || reportType;
    const selectedFromDate =
      filters.fromDate !== undefined ? filters.fromDate : fromDate;
    const selectedToDate = filters.toDate !== undefined ? filters.toDate : toDate;

    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/reports/module`, {
        headers: getAuthHeaders(),
        params: {
          type: selectedType,
          from: selectedFromDate || undefined,
          to: selectedToDate || undefined,
        },
      });

      setColumns(response.data?.columns || []);
      setRows(response.data?.rows || []);
      setModuleSummary(response.data?.summary || {});
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load report data");
      setColumns([]);
      setRows([]);
      setModuleSummary({});
    } finally {
      setLoading(false);
    }
  }, [canAccess, reportType, fromDate, toDate]);

  useEffect(() => {
    loadSummary();
    loadModuleReport();
  }, [loadSummary, loadModuleReport]);

  const applyFilters = async () => {
    try {
      setIsApplying(true);
      await Promise.all([loadSummary(), loadModuleReport()]);
    } finally {
      setIsApplying(false);
    }
  };

  const clearFilters = async () => {
    setFromDate("");
    setToDate("");

    try {
      setIsApplying(true);
      await Promise.all([
        loadSummary({ fromDate: "", toDate: "" }),
        loadModuleReport({ fromDate: "", toDate: "" }),
      ]);
    } finally {
      setIsApplying(false);
    }
  };

  const changeReportType = async (nextType) => {
    setReportType(nextType);
    await loadModuleReport({ type: nextType });
  };

  const downloadCsv = () => {
    if (!columns.length || !rows.length) {
      toast.error("No rows to download");
      return;
    }

    const header = columns.map((column) => column.label || toTitleCase(column.key));
    const bodyRows = rows.map((row) =>
      columns.map((column) => formatCell(row[column.key], column.type)),
    );

    const fileName = `report-${reportType}-${fromDate || "start"}-${toDate || "today"}.csv`;
    downloadCsvFile(fileName, [header, ...bodyRows]);
    toast.success("CSV downloaded");
  };

  const downloadExcel = () => {
    if (!columns.length || !rows.length) {
      toast.error("No rows to download");
      return;
    }

    const header = columns.map((column) => column.label || toTitleCase(column.key));
    const bodyRows = rows.map((row) =>
      columns.map((column) => formatCell(row[column.key], column.type)),
    );

    const fileName = `report-${reportType}-${fromDate || "start"}-${toDate || "today"}.xls`;
    downloadExcelFile(fileName, header, bodyRows);
    toast.success("Excel downloaded");
  };

  const downloadPdf = () => {
    if (!columns.length || !rows.length) {
      toast.error("No rows to download");
      return;
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4",
    });

    const title = `${toTitleCase(reportType)} Report`;
    doc.setFontSize(18);
    doc.text(title, 40, 40);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 58);
    doc.text(`Range: ${fromDate || "N/A"} to ${toDate || "N/A"}`, 40, 72);

    const summaryRows = Object.entries(moduleSummary || {}).map(([key, value]) => [
      toTitleCase(key),
      typeof value === "number" ? value.toFixed(2) : String(value),
    ]);

    if (summaryRows.length) {
      autoTable(doc, {
        startY: 86,
        head: [["Metric", "Value"]],
        body: summaryRows,
        theme: "grid",
        styles: { fontSize: 9 },
        headStyles: { fillColor: [17, 24, 39] },
        margin: { left: 40, right: 40 },
        tableWidth: 320,
      });
    }

    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY || 86) + 18,
      head: [columns.map((column) => column.label || toTitleCase(column.key))],
      body: rows.map((row) =>
        columns.map((column) => formatCell(row[column.key], column.type)),
      ),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [17, 24, 39] },
      margin: { left: 40, right: 40 },
    });

    doc.save(`report-${reportType}-${fromDate || "start"}-${toDate || "today"}.pdf`);
    toast.success("PDF downloaded");
  };

  const topSummaryCards = [
    {
      label: "Net Profit",
      value: `${Number(summaryByModule?.profit?.netProfit || 0).toFixed(2)} Tk`,
    },
    {
      label: "Sales Revenue",
      value: `${Number(summaryByModule?.sales?.revenue || 0).toFixed(2)} Tk`,
    },
    {
      label: "Low Stock Products",
      value: Number(summaryByModule?.stock?.lowStockCount || 0),
    },
    {
      label: "Abandoned Value",
      value: `${Number(summaryByModule?.abandoned?.potentialValue || 0).toFixed(2)} Tk`,
    },
    {
      label: "Risk Profiles",
      value: Number(summaryByModule?.risk?.count || 0),
    },
  ];

  if (!canAccess) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <h2 className="text-xl font-semibold text-black mb-2">Access Required</h2>
        <p className="text-gray-600">Only admin can access business reports.</p>
      </div>
    );
  }

  const moduleSummaryCards = getSummaryCards(moduleSummary);

  return (
    <div className="space-y-6">
      <div className="bg-linear-to-r from-zinc-900 to-black rounded-xl p-6 md:p-8 text-white">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-4">
          <FiBarChart2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">Business Reports</h1>
        <p className="text-zinc-200 mt-2">
          Profit/loss, sales, stock, abandoned, and risk analysis.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {topSummaryCards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[11px] text-gray-500">{card.label}</p>
            <p className="text-lg font-bold text-black mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
            <FiFilter className="w-4 h-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-black">Report Filters</p>
            <p className="text-xs text-gray-500">Select report type and date range.</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-linear-to-br from-white to-gray-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full lg:max-w-3xl">
              <label className="block">
                <span className="text-xs font-medium text-gray-600 mb-1 block">Report Type</span>
                <SearchableSelect
                  value={reportType}
                  onChange={changeReportType}
                  options={REPORT_TYPES}
                  placeholder="Report type"
                  searchable={false}
                  className="min-w-0"
                  buttonClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white"
                  menuClassName="rounded-xl"
                />
              </label>

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
                onClick={applyFilters}
                disabled={isApplying || summaryLoading}
                className="inline-flex h-10 items-center justify-center gap-2 px-4 bg-black text-white rounded-lg font-medium whitespace-nowrap disabled:opacity-60"
              >
                <FiRefreshCw className={`w-4 h-4 ${isApplying ? "animate-spin" : ""}`} />
                Apply
              </button>
              <button
                onClick={clearFilters}
                disabled={isApplying || summaryLoading}
                className="inline-flex h-10 items-center justify-center gap-2 px-4 border border-gray-300 rounded-lg font-medium whitespace-nowrap hover:bg-gray-100 disabled:opacity-60"
              >
                <FiXCircle className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {moduleSummaryCards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-[11px] text-gray-500">{card.label}</p>
            <p className="text-lg font-bold text-black mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">
            {toTitleCase(reportType)} Rows ({rows.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadExcel}
              disabled={loading || rows.length === 0}
              className="inline-flex h-10 items-center gap-2 px-4 text-sm border border-gray-300 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-60"
            >
              <FiDownload className="w-4 h-4" />
              Download Excel
            </button>
            <button
              onClick={downloadCsv}
              disabled={loading || rows.length === 0}
              className="inline-flex h-10 items-center gap-2 px-4 text-sm border border-gray-300 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-60"
            >
              <FiDownload className="w-4 h-4" />
              Download CSV
            </button>
            <button
              onClick={downloadPdf}
              disabled={loading || rows.length === 0}
              className="inline-flex h-10 items-center gap-2 px-4 text-sm border border-gray-300 rounded-lg font-medium hover:bg-gray-100 disabled:opacity-60"
            >
              <FiDownload className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading report rows...</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-600">No data found for this report.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-600 border-b border-gray-200">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className="py-2 pr-3">
                      {column.label || toTitleCase(column.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`row-${index}`} className="border-b border-gray-100">
                    {columns.map((column) => (
                      <td key={`${index}-${column.key}`} className="py-2 pr-3 text-gray-800">
                        {formatCell(row[column.key], column.type)}
                      </td>
                    ))}
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

export default ModuleBusinessReports;
