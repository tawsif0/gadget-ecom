const mongoose = require("mongoose");
const Order = require("../models/Order");
const Purchase = require("../models/Purchase");
const Product = require("../models/Product");
const AbandonedOrder = require("../models/AbandonedOrder");
const User = require("../models/User");
const { AccountEntry } = require("../models/AccountEntry");
const { isAdmin, getVendorForUser } = require("../utils/marketplaceAccess");

const roundMoney = (value) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const ACCOUNT_INCOME_TYPES = new Set(["income", "adjustment"]);
const ACCOUNT_EXPENSE_TYPES = new Set([
  "expense",
  "salary",
  "bill",
  "payout",
  "fund_transfer",
]);

const parseDate = (value, fallback = null) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
};

const buildDateRange = (from, to) => {
  const fromDate = parseDate(from, null);
  const toDate = parseDate(to, null);

  if (!fromDate && !toDate) return null;

  const range = {};
  if (fromDate) range.$gte = fromDate;
  if (toDate) {
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }

  return range;
};

const resolveScope = async (req, res) => {
  if (isAdmin(req.user)) {
    const requestedVendorId = String(req.query?.vendorId || "").trim();
    return {
      admin: true,
      vendorId: mongoose.Types.ObjectId.isValid(requestedVendorId)
        ? requestedVendorId
        : null,
    };
  }

  const access = await getVendorForUser(req.user, {
    approvedOnly: false,
    allowStaff: true,
  });

  if (!access?.vendor) {
    res.status(403).json({
      success: false,
      message: "Vendor or admin access required",
    });
    return null;
  }

  return {
    admin: false,
    vendorId: String(access.vendor._id),
    access,
  };
};

const getVendorSalesRows = async (vendorId, dateRange = null) => {
  const pipeline = [];

  const orderMatch = {};
  if (dateRange) {
    orderMatch.createdAt = dateRange;
  }
  if (Object.keys(orderMatch).length) {
    pipeline.push({ $match: orderMatch });
  }

  pipeline.push({ $unwind: "$items" });
  pipeline.push({
    $match: {
      "items.vendor": new mongoose.Types.ObjectId(vendorId),
    },
  });

  pipeline.push({
    $group: {
      _id: "$_id",
      orderNumber: { $first: "$orderNumber" },
      createdAt: { $first: "$createdAt" },
      orderStatus: { $first: "$orderStatus" },
      customerFirstName: { $first: "$shippingAddress.firstName" },
      customerLastName: { $first: "$shippingAddress.lastName" },
      customerPhone: { $first: "$shippingAddress.phone" },
      amount: {
        $sum: {
          $cond: [
            { $gt: ["$items.vendorNetAmount", 0] },
            "$items.vendorNetAmount",
            { $multiply: ["$items.price", "$items.quantity"] },
          ],
        },
      },
      itemCount: {
        $sum: "$items.quantity",
      },
    },
  });

  pipeline.push({ $sort: { createdAt: -1 } });

  const rows = await Order.aggregate(pipeline);

  return rows.map((row) => ({
    orderId: row._id,
    orderNumber: row.orderNumber,
    createdAt: row.createdAt,
    orderStatus: String(row.orderStatus || "").toLowerCase(),
    customerName: `${String(row.customerFirstName || "").trim()} ${String(
      row.customerLastName || "",
    ).trim()}`.trim(),
    customerPhone: String(row.customerPhone || "").trim(),
    amount: roundMoney(row.amount),
    itemCount: Number(row.itemCount || 0),
  }));
};

const getAdminSalesRows = async (dateRange = null) => {
  const query = {};
  if (dateRange) query.createdAt = dateRange;

  const rows = await Order.find(query)
    .select("orderNumber createdAt orderStatus total shippingAddress items")
    .sort({ createdAt: -1 })
    .lean();

  return rows.map((row) => ({
    orderId: row._id,
    orderNumber: row.orderNumber,
    createdAt: row.createdAt,
    orderStatus: String(row.orderStatus || "").toLowerCase(),
    customerName: `${String(row?.shippingAddress?.firstName || "").trim()} ${String(
      row?.shippingAddress?.lastName || "",
    ).trim()}`.trim(),
    customerPhone: String(row?.shippingAddress?.phone || "").trim(),
    amount: roundMoney(row.total),
    itemCount: Array.isArray(row.items) ? row.items.length : 0,
  }));
};

const buildSalesSummary = (rows = []) => {
  const summary = {
    totalOrders: rows.length,
    deliveredOrders: 0,
    cancelledOrders: 0,
    returnedOrders: 0,
    pendingOrders: 0,
    revenue: 0,
    gross: 0,
  };

  rows.forEach((row) => {
    const status = String(row.orderStatus || "").toLowerCase();
    const amount = roundMoney(row.amount);

    summary.gross += amount;

    if (status === "delivered") {
      summary.deliveredOrders += 1;
      summary.revenue += amount;
    } else if (status === "cancelled") {
      summary.cancelledOrders += 1;
    } else if (status === "returned") {
      summary.returnedOrders += 1;
    } else if (["pending", "confirmed", "processing", "shipped"].includes(status)) {
      summary.pendingOrders += 1;
    }
  });

  summary.gross = roundMoney(summary.gross);
  summary.revenue = roundMoney(summary.revenue);
  summary.averageOrderValue =
    summary.totalOrders > 0 ? roundMoney(summary.gross / summary.totalOrders) : 0;

  return summary;
};

const getPurchaseRows = async (scope, dateRange = null) => {
  const query = {};
  if (scope.vendorId) {
    query.vendor = scope.vendorId;
  }
  if (dateRange) {
    query.purchaseDate = dateRange;
  }

  const rows = await Purchase.find(query)
    .sort({ purchaseDate: -1, createdAt: -1 })
    .lean();

  return rows.map((row) => ({
    purchaseId: row._id,
    invoiceNumber: row.invoiceNumber,
    purchaseDate: row.purchaseDate,
    totalAmount: roundMoney(row.totalAmount),
    paidAmount: roundMoney(row.paidAmount),
    dueAmount: roundMoney(row.dueAmount),
    paymentStatus: String(row.paymentStatus || "").toLowerCase(),
  }));
};

const buildPurchaseSummary = (rows = []) => {
  const summary = {
    count: rows.length,
    totalAmount: 0,
    paidAmount: 0,
    dueAmount: 0,
  };

  rows.forEach((row) => {
    summary.totalAmount += roundMoney(row.totalAmount);
    summary.paidAmount += roundMoney(row.paidAmount);
    summary.dueAmount += roundMoney(row.dueAmount);
  });

  summary.totalAmount = roundMoney(summary.totalAmount);
  summary.paidAmount = roundMoney(summary.paidAmount);
  summary.dueAmount = roundMoney(summary.dueAmount);

  return summary;
};

const getProfitRows = async (scope, dateRange = null) => {
  const salesRows = scope.vendorId
    ? await getVendorSalesRows(scope.vendorId, dateRange)
    : await getAdminSalesRows(dateRange);
  const purchaseRows = await getPurchaseRows(scope, dateRange);

  const accountEntryQuery = {};
  if (scope.vendorId) {
    accountEntryQuery.vendor = scope.vendorId;
  }
  if (dateRange) {
    accountEntryQuery.entryDate = dateRange;
  }

  const accountEntries = await AccountEntry.find(accountEntryQuery)
    .select("type amount title category entryDate")
    .sort({ entryDate: -1, createdAt: -1 })
    .lean();

  let deliveredRevenue = 0;
  let pipelineRevenue = 0;
  let returnedOrCancelledAmount = 0;

  salesRows.forEach((row) => {
    const status = String(row.orderStatus || "").toLowerCase();
    const amount = roundMoney(row.amount);

    if (status === "delivered") {
      deliveredRevenue += amount;
      return;
    }

    if (["pending", "confirmed", "processing", "shipped"].includes(status)) {
      pipelineRevenue += amount;
      return;
    }

    if (["cancelled", "returned"].includes(status)) {
      returnedOrCancelledAmount += amount;
    }
  });

  const purchaseExpense = purchaseRows.reduce(
    (sum, row) => sum + roundMoney(row.totalAmount),
    0,
  );

  let accountIncome = 0;
  let accountExpense = 0;

  accountEntries.forEach((entry) => {
    const type = String(entry.type || "").toLowerCase();
    const amount = roundMoney(entry.amount);

    if (ACCOUNT_INCOME_TYPES.has(type)) {
      accountIncome += amount;
    }

    if (ACCOUNT_EXPENSE_TYPES.has(type)) {
      accountExpense += amount;
    }
  });

  const grossProfit = deliveredRevenue - purchaseExpense;
  const netProfit =
    deliveredRevenue + accountIncome - purchaseExpense - accountExpense;

  return [
    {
      metric: "Delivered Revenue",
      type: "income",
      amount: roundMoney(deliveredRevenue),
      note: "Revenue from delivered orders",
    },
    {
      metric: "Pipeline Revenue",
      type: "informational",
      amount: roundMoney(pipelineRevenue),
      note: "Pending/confirmed/processing/shipped orders",
    },
    {
      metric: "Returned/Cancelled Amount",
      type: "expense",
      amount: roundMoney(returnedOrCancelledAmount),
      note: "Orders not counted as realized revenue",
    },
    {
      metric: "Purchase Expense",
      type: "expense",
      amount: roundMoney(purchaseExpense),
      note: "Total purchases in selected range",
    },
    {
      metric: "Other Income",
      type: "income",
      amount: roundMoney(accountIncome),
      note: "Income/adjustment entries",
    },
    {
      metric: "Other Expense",
      type: "expense",
      amount: roundMoney(accountExpense),
      note: "Expense/salary/bill/payout/fund transfer entries",
    },
    {
      metric: "Gross Profit",
      type: "result",
      amount: roundMoney(grossProfit),
      note: "Delivered revenue - purchase expense",
    },
    {
      metric: "Net Profit",
      type: "result",
      amount: roundMoney(netProfit),
      note: "Delivered revenue + other income - purchase expense - other expense",
    },
  ];
};

const buildProfitSummary = (rows = []) => {
  const byMetric = new Map(rows.map((row) => [String(row.metric || ""), roundMoney(row.amount)]));

  const deliveredRevenue = roundMoney(byMetric.get("Delivered Revenue") || 0);
  const pipelineRevenue = roundMoney(byMetric.get("Pipeline Revenue") || 0);
  const returnedOrCancelledAmount = roundMoney(
    byMetric.get("Returned/Cancelled Amount") || 0,
  );
  const purchaseExpense = roundMoney(byMetric.get("Purchase Expense") || 0);
  const otherIncome = roundMoney(byMetric.get("Other Income") || 0);
  const otherExpense = roundMoney(byMetric.get("Other Expense") || 0);
  const grossProfit = roundMoney(byMetric.get("Gross Profit") || 0);
  const netProfit = roundMoney(byMetric.get("Net Profit") || 0);

  return {
    deliveredRevenue,
    pipelineRevenue,
    returnedOrCancelledAmount,
    purchaseExpense,
    otherIncome,
    otherExpense,
    grossProfit,
    netProfit,
    isProfit: netProfit >= 0,
  };
};

const getStockRows = async (scope) => {
  const query = {};
  if (scope.vendorId) {
    query.vendor = scope.vendorId;
  }

  const rows = await Product.find(query)
    .populate("vendor", "storeName")
    .select("title sku stock lowStockThreshold price salePrice priceType vendor isActive")
    .sort({ updatedAt: -1 })
    .lean();

  return rows.map((row) => ({
    productId: row._id,
    title: row.title,
    sku: row.sku || "",
    vendorName: row?.vendor?.storeName || "Platform",
    stock: Number(row.stock || 0),
    lowStockThreshold: Number(row.lowStockThreshold || 0),
    priceType: String(row.priceType || "single").toLowerCase(),
    regularPrice: roundMoney(row.price),
    salePrice: row.salePrice === null || row.salePrice === undefined ? null : roundMoney(row.salePrice),
    isActive: Boolean(row.isActive),
  }));
};

const buildStockSummary = (rows = []) => {
  const summary = {
    count: rows.length,
    totalStock: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    inactiveCount: 0,
  };

  rows.forEach((row) => {
    const stock = Number(row.stock || 0);
    const threshold = Number(row.lowStockThreshold || 0);

    summary.totalStock += stock;
    if (stock <= 0) {
      summary.outOfStockCount += 1;
    } else if (stock <= threshold) {
      summary.lowStockCount += 1;
    }

    if (!row.isActive) {
      summary.inactiveCount += 1;
    }
  });

  return summary;
};

const getAbandonedRows = async (scope, dateRange = null) => {
  const query = {};
  if (scope.vendorId) {
    query.vendorIds = new mongoose.Types.ObjectId(scope.vendorId);
  }
  if (dateRange) {
    query.capturedAt = dateRange;
  }

  const rows = await AbandonedOrder.find(query)
    .sort({ capturedAt: -1 })
    .lean();

  return rows.map((row) => ({
    abandonedId: row._id,
    capturedAt: row.capturedAt,
    customerName: row?.customer?.name || "",
    customerPhone: row?.customer?.phone || "",
    customerEmail: row?.customer?.email || "",
    status: String(row.status || "").toLowerCase(),
    source: String(row.source || "").toLowerCase(),
    itemCount: Array.isArray(row.items) ? row.items.length : 0,
    total: roundMoney(row.total),
  }));
};

const buildAbandonedSummary = (rows = []) => {
  const summary = {
    count: rows.length,
    newCount: 0,
    followUpCount: 0,
    convertedCount: 0,
    discardedCount: 0,
    potentialValue: 0,
  };

  rows.forEach((row) => {
    summary.potentialValue += roundMoney(row.total);

    if (row.status === "new") summary.newCount += 1;
    if (row.status === "follow_up") summary.followUpCount += 1;
    if (row.status === "converted") summary.convertedCount += 1;
    if (row.status === "discarded") summary.discardedCount += 1;
  });

  summary.potentialValue = roundMoney(summary.potentialValue);

  return summary;
};

const classifyRiskLevel = (successRate, totalOrders, isBlacklisted = false) => {
  if (isBlacklisted) return "blacklisted";
  if (!Number.isFinite(totalOrders) || totalOrders <= 0) return "new";
  if (successRate >= 80) return "trusted";
  if (successRate >= 60) return "medium";
  if (successRate >= 40) return "high";
  return "blacklisted";
};

const getRiskRows = async (scope, dateRange = null) => {
  if (!scope.admin) {
    return null;
  }

  const userQuery = {
    userType: { $ne: "admin" },
  };

  const users = await User.find(userQuery)
    .select("_id name email phone originalPhone isBlacklisted blacklistReason adminNotes")
    .lean();

  if (!users.length) return [];

  const userIds = users.map((user) => user._id);
  const orderQuery = {
    user: { $in: userIds },
  };
  if (dateRange) {
    orderQuery.createdAt = dateRange;
  }

  const orders = await Order.find(orderQuery)
    .select("user orderStatus total createdAt")
    .lean();

  const statsMap = new Map();
  users.forEach((user) => {
    statsMap.set(String(user._id), {
      user,
      totalOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      returnedOrders: 0,
      totalRevenue: 0,
      lastOrderDate: null,
    });
  });

  orders.forEach((order) => {
    const key = String(order.user || "");
    const entry = statsMap.get(key);
    if (!entry) return;

    entry.totalOrders += 1;
    const status = String(order.orderStatus || "").toLowerCase();

    if (status === "delivered") {
      entry.deliveredOrders += 1;
      entry.totalRevenue += Number(order.total || 0);
    } else if (status === "cancelled") {
      entry.cancelledOrders += 1;
    } else if (status === "returned") {
      entry.returnedOrders += 1;
    }

    if (
      order.createdAt &&
      (!entry.lastOrderDate || new Date(order.createdAt) > new Date(entry.lastOrderDate))
    ) {
      entry.lastOrderDate = order.createdAt;
    }
  });

  const rows = Array.from(statsMap.values()).map((entry) => {
    const successRate =
      entry.totalOrders > 0 ? (entry.deliveredOrders / entry.totalOrders) * 100 : 0;
    const riskLevel = classifyRiskLevel(
      successRate,
      entry.totalOrders,
      Boolean(entry.user?.isBlacklisted),
    );

    return {
      customerId: entry.user._id,
      customerName: entry.user.name || "",
      phone: entry.user.originalPhone || entry.user.phone || "",
      email: entry.user.email || "",
      totalOrders: entry.totalOrders,
      deliveredOrders: entry.deliveredOrders,
      cancelledOrders: entry.cancelledOrders,
      returnedOrders: entry.returnedOrders,
      revenue: roundMoney(entry.totalRevenue),
      successRate: roundMoney(successRate),
      riskLevel,
      isBlacklisted: Boolean(entry.user?.isBlacklisted),
      blacklistReason: String(entry.user?.blacklistReason || ""),
      lastOrderDate: entry.lastOrderDate || null,
    };
  });

  rows.sort((a, b) => {
    if (a.isBlacklisted !== b.isBlacklisted) return a.isBlacklisted ? -1 : 1;
    return Number(b.totalOrders || 0) - Number(a.totalOrders || 0);
  });

  return rows;
};

const buildRiskSummary = (rows = []) => {
  const summary = {
    count: rows.length,
    trusted: 0,
    medium: 0,
    high: 0,
    blacklisted: 0,
  };

  rows.forEach((row) => {
    const risk = String(row.riskLevel || "").toLowerCase();
    if (risk === "trusted") summary.trusted += 1;
    if (risk === "medium") summary.medium += 1;
    if (risk === "high") summary.high += 1;
    if (risk === "blacklisted") summary.blacklisted += 1;
  });

  return summary;
};

const getColumnsForType = (type) => {
  const columnMap = {
    profit: [
      { key: "metric", label: "Metric" },
      { key: "type", label: "Type" },
      { key: "amount", label: "Amount (Tk)", type: "currency" },
      { key: "note", label: "Notes" },
    ],
    sales: [
      { key: "orderNumber", label: "Order" },
      { key: "createdAt", label: "Date", type: "date" },
      { key: "customerName", label: "Customer" },
      { key: "customerPhone", label: "Phone" },
      { key: "orderStatus", label: "Status" },
      { key: "amount", label: "Amount (Tk)", type: "currency" },
    ],
    purchases: [
      { key: "invoiceNumber", label: "Invoice" },
      { key: "purchaseDate", label: "Date", type: "date" },
      { key: "paymentStatus", label: "Payment Status" },
      { key: "totalAmount", label: "Total (Tk)", type: "currency" },
      { key: "paidAmount", label: "Paid (Tk)", type: "currency" },
      { key: "dueAmount", label: "Due (Tk)", type: "currency" },
    ],
    stock: [
      { key: "title", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "vendorName", label: "Vendor" },
      { key: "stock", label: "Stock", type: "number" },
      { key: "lowStockThreshold", label: "Low Stock Alert", type: "number" },
      { key: "priceType", label: "Price Type" },
      { key: "regularPrice", label: "Price (Tk)", type: "currency" },
    ],
    abandoned: [
      { key: "capturedAt", label: "Captured", type: "date" },
      { key: "customerName", label: "Customer" },
      { key: "customerPhone", label: "Phone" },
      { key: "status", label: "Status" },
      { key: "source", label: "Source" },
      { key: "itemCount", label: "Items", type: "number" },
      { key: "total", label: "Value (Tk)", type: "currency" },
    ],
    risk: [
      { key: "customerName", label: "Customer" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "totalOrders", label: "Orders", type: "number" },
      { key: "deliveredOrders", label: "Delivered", type: "number" },
      { key: "successRate", label: "Success %", type: "number" },
      { key: "riskLevel", label: "Risk" },
      { key: "isBlacklisted", label: "Blacklisted", type: "boolean" },
    ],
  };

  return columnMap[type] || [];
};

const formatRowsByColumns = (rows = [], columns = []) =>
  rows.map((row) => {
    const formatted = {};
    columns.forEach((column) => {
      const rawValue = row?.[column.key];
      if (column.type === "date") {
        formatted[column.key] = rawValue ? new Date(rawValue).toISOString() : "";
      } else {
        formatted[column.key] = rawValue;
      }
    });
    return formatted;
  });

exports.getReportSummary = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const dateRange = buildDateRange(req.query?.from, req.query?.to);

    const salesRows = scope.vendorId
      ? await getVendorSalesRows(scope.vendorId, dateRange)
      : await getAdminSalesRows(dateRange);
    const purchaseRows = await getPurchaseRows(scope, dateRange);
    const stockRows = await getStockRows(scope);
    const abandonedRows = await getAbandonedRows(scope, dateRange);
    const riskRows = await getRiskRows(scope, dateRange);
    const profitRows = await getProfitRows(scope, dateRange);

    res.json({
      success: true,
      summary: {
        profit: buildProfitSummary(profitRows),
        sales: buildSalesSummary(salesRows),
        purchases: buildPurchaseSummary(purchaseRows),
        stock: buildStockSummary(stockRows),
        abandoned: buildAbandonedSummary(abandonedRows),
        risk: Array.isArray(riskRows) ? buildRiskSummary(riskRows) : null,
      },
    });
  } catch (error) {
    console.error("Get report summary error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching report summary",
    });
  }
};

exports.getModuleReport = async (req, res) => {
  try {
    const scope = await resolveScope(req, res);
    if (!scope) return;

    const type = String(req.query?.type || "sales").trim().toLowerCase();
    if (!["profit", "sales", "purchases", "stock", "abandoned", "risk"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report type",
      });
    }

    const dateRange = buildDateRange(req.query?.from, req.query?.to);

    let rows = [];
    let summary = {};

    if (type === "profit") {
      rows = await getProfitRows(scope, dateRange);
      summary = buildProfitSummary(rows);
    } else if (type === "sales") {
      rows = scope.vendorId
        ? await getVendorSalesRows(scope.vendorId, dateRange)
        : await getAdminSalesRows(dateRange);
      summary = buildSalesSummary(rows);
    } else if (type === "purchases") {
      rows = await getPurchaseRows(scope, dateRange);
      summary = buildPurchaseSummary(rows);
    } else if (type === "stock") {
      rows = await getStockRows(scope);
      summary = buildStockSummary(rows);
    } else if (type === "abandoned") {
      rows = await getAbandonedRows(scope, dateRange);
      summary = buildAbandonedSummary(rows);
    } else if (type === "risk") {
      const riskRows = await getRiskRows(scope, dateRange);
      if (riskRows === null) {
        return res.status(403).json({
          success: false,
          message: "Risk report is available for admin only",
        });
      }
      rows = riskRows;
      summary = buildRiskSummary(rows);
    }

    const columns = getColumnsForType(type);

    res.json({
      success: true,
      type,
      columns,
      rows: formatRowsByColumns(rows, columns),
      summary,
    });
  } catch (error) {
    console.error("Get module report error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching module report",
    });
  }
};
