const mongoose = require("mongoose");
const { AccountEntry, ACCOUNT_ENTRY_TYPES } = require("../models/AccountEntry");
const Purchase = require("../models/Purchase");
const Order = require("../models/Order");
const {
  isAdmin,
  getVendorForUser,
  getUserId,
} = require("../utils/marketplaceAccess");

const parsePositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed < 0 ? 0 : parsed;
};

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

const resolveAccountScope = async (req, res, { allowAdmin = true } = {}) => {
  if (allowAdmin && isAdmin(req.user)) {
    const requestedVendorId = String(req.query?.vendorId || req.body?.vendorId || "").trim();
    const vendorFilter = mongoose.Types.ObjectId.isValid(requestedVendorId)
      ? requestedVendorId
      : null;

    return {
      admin: true,
      vendorId: vendorFilter,
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

const applyScopeToQuery = (query, scope) => {
  if (scope?.vendorId) {
    query.vendor = scope.vendorId;
  } else if (!scope?.admin) {
    query.vendor = null;
  }

  return query;
};

const getSummaryFromEntries = (entries = []) => {
  const incomeTypes = new Set(["income", "adjustment"]);
  const expenseTypes = new Set(["expense", "salary", "bill", "payout", "fund_transfer"]);

  return entries.reduce(
    (acc, entry) => {
      const amount = parsePositiveNumber(entry.amount, 0);
      if (incomeTypes.has(entry.type)) {
        acc.income += amount;
      }
      if (expenseTypes.has(entry.type)) {
        acc.expense += amount;
      }
      return acc;
    },
    { income: 0, expense: 0 },
  );
};

const getTypeBreakdown = (entries = []) =>
  entries.reduce((acc, entry) => {
    const type = String(entry?.type || "").trim().toLowerCase();
    if (!ACCOUNT_ENTRY_TYPES.includes(type)) return acc;
    acc[type] = parsePositiveNumber(acc[type], 0) + parsePositiveNumber(entry?.amount, 0);
    return acc;
  }, ACCOUNT_ENTRY_TYPES.reduce((seed, type) => ({ ...seed, [type]: 0 }), {}));

exports.getAccountEntries = async (req, res) => {
  try {
    const scope = await resolveAccountScope(req, res);
    if (!scope) return;

    const page = Math.max(1, Number.parseInt(req.query?.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query?.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    applyScopeToQuery(query, scope);

    const type = String(req.query?.type || "").trim().toLowerCase();
    if (type && ACCOUNT_ENTRY_TYPES.includes(type)) {
      query.type = type;
    }

    const search = String(req.query?.search || "").trim();
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
        { note: { $regex: search, $options: "i" } },
      ];
    }

    const dateRange = buildDateRange(req.query?.from, req.query?.to);
    if (dateRange) {
      query.entryDate = dateRange;
    }

    const [entries, total] = await Promise.all([
      AccountEntry.find(query)
        .populate("vendor", "storeName slug")
        .populate("createdBy", "name email")
        .sort({ entryDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      AccountEntry.countDocuments(query),
    ]);

    res.json({
      success: true,
      entries,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Get account entries error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching account entries",
    });
  }
};

exports.createAccountEntry = async (req, res) => {
  try {
    const scope = await resolveAccountScope(req, res);
    if (!scope) return;

    const type = String(req.body?.type || "").trim().toLowerCase();
    const title = String(req.body?.title || "").trim();
    const amount = parsePositiveNumber(req.body?.amount, NaN);

    if (!ACCOUNT_ENTRY_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Valid account entry type is required",
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    const entry = await AccountEntry.create({
      vendor: scope.vendorId || null,
      type,
      title,
      category: String(req.body?.category || "").trim(),
      amount,
      note: String(req.body?.note || "").trim(),
      entryDate: parseDate(req.body?.entryDate, new Date()),
      createdBy: getUserId(req.user),
    });

    const populated = await AccountEntry.findById(entry._id)
      .populate("vendor", "storeName slug")
      .populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Account entry created",
      entry: populated,
    });
  } catch (error) {
    console.error("Create account entry error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating account entry",
    });
  }
};

exports.updateAccountEntry = async (req, res) => {
  try {
    const scope = await resolveAccountScope(req, res);
    if (!scope) return;

    const query = { _id: req.params.id };
    applyScopeToQuery(query, scope);

    const entry = await AccountEntry.findOne(query);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Account entry not found",
      });
    }

    const updates = ["title", "category", "note"];
    updates.forEach((field) => {
      if (req.body?.[field] !== undefined) {
        entry[field] = String(req.body[field] || "").trim();
      }
    });

    if (req.body?.type !== undefined) {
      const nextType = String(req.body.type || "").trim().toLowerCase();
      if (!ACCOUNT_ENTRY_TYPES.includes(nextType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid account entry type",
        });
      }
      entry.type = nextType;
    }

    if (req.body?.amount !== undefined) {
      const amount = parsePositiveNumber(req.body.amount, NaN);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be greater than 0",
        });
      }
      entry.amount = amount;
    }

    if (req.body?.entryDate !== undefined) {
      entry.entryDate = parseDate(req.body.entryDate, entry.entryDate);
    }

    if (scope.admin && req.body?.vendorId !== undefined) {
      const vendorId = String(req.body.vendorId || "").trim();
      entry.vendor = mongoose.Types.ObjectId.isValid(vendorId) ? vendorId : null;
    }

    await entry.save();
    await entry.populate("vendor", "storeName slug");
    await entry.populate("createdBy", "name email");

    res.json({
      success: true,
      message: "Account entry updated",
      entry,
    });
  } catch (error) {
    console.error("Update account entry error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating account entry",
    });
  }
};

exports.deleteAccountEntry = async (req, res) => {
  try {
    const scope = await resolveAccountScope(req, res);
    if (!scope) return;

    const query = { _id: req.params.id };
    applyScopeToQuery(query, scope);

    const deleted = await AccountEntry.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Account entry not found",
      });
    }

    res.json({
      success: true,
      message: "Account entry deleted",
    });
  } catch (error) {
    console.error("Delete account entry error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting account entry",
    });
  }
};

exports.getAccountsSummary = async (req, res) => {
  try {
    const scope = await resolveAccountScope(req, res);
    if (!scope) return;

    const dateRange = buildDateRange(req.query?.from, req.query?.to);

    const entryQuery = {};
    applyScopeToQuery(entryQuery, scope);
    if (dateRange) entryQuery.entryDate = dateRange;

    const purchaseQuery = {};
    if (scope.vendorId) {
      purchaseQuery.vendor = scope.vendorId;
    }

    if (dateRange) {
      purchaseQuery.purchaseDate = dateRange;
    }

    const [entries, purchaseAggregate, revenueData] = await Promise.all([
      AccountEntry.find(entryQuery).select("type amount").lean(),
      Purchase.aggregate([
        { $match: purchaseQuery },
        {
          $group: {
            _id: null,
            totalPurchases: { $sum: "$totalAmount" },
            totalPaid: { $sum: "$paidAmount" },
            totalDue: { $sum: "$dueAmount" },
          },
        },
      ]),
      scope.vendorId
        ? Order.aggregate([
            {
              $match: {
                orderStatus: "delivered",
                ...(dateRange ? { createdAt: dateRange } : {}),
              },
            },
            { $unwind: "$items" },
            { $match: { "items.vendor": new mongoose.Types.ObjectId(scope.vendorId) } },
            {
              $group: {
                _id: null,
                revenue: {
                  $sum: {
                    $cond: [
                      { $gt: ["$items.vendorNetAmount", 0] },
                      "$items.vendorNetAmount",
                      { $multiply: ["$items.price", "$items.quantity"] },
                    ],
                  },
                },
              },
            },
          ])
        : Order.aggregate([
            {
              $match: {
                orderStatus: "delivered",
                ...(dateRange ? { createdAt: dateRange } : {}),
              },
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: "$total" },
              },
            },
          ]),
    ]);

    const entrySummary = getSummaryFromEntries(entries);
    const breakdownByType = getTypeBreakdown(entries);
    const purchaseSummary = purchaseAggregate[0] || {
      totalPurchases: 0,
      totalPaid: 0,
      totalDue: 0,
    };
    const orderRevenue = Number(revenueData?.[0]?.revenue || 0);

    const totalIncome = Number(entrySummary.income || 0) + orderRevenue;
    const totalExpense = Number(entrySummary.expense || 0);
    const netProfit = totalIncome - totalExpense;
    const manualBalance = Number(entrySummary.income || 0) - Number(entrySummary.expense || 0);

    res.json({
      success: true,
      summary: {
        orderRevenue,
        manualIncome: Number(entrySummary.income || 0),
        totalIncome,
        totalExpense,
        netProfit,
        manualBalance,
        currentBalance: netProfit,
        breakdownByType,
        purchases: {
          total: Number(purchaseSummary.totalPurchases || 0),
          paid: Number(purchaseSummary.totalPaid || 0),
          due: Number(purchaseSummary.totalDue || 0),
        },
      },
    });
  } catch (error) {
    console.error("Get accounts summary error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching accounts summary",
    });
  }
};
