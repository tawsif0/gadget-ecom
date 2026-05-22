import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import {
  FiBarChart2,
  FiDollarSign,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";
import SearchableSelect from "../components/SearchableSelect";
import { useAuth } from "../hooks/useAuth";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const ENTRY_TYPES = [
  "income",
  "expense",
  "fund_transfer",
  "salary",
  "bill",
  "payout",
  "adjustment",
];

const entryLabel = (type = "") =>
  String(type || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const ModuleAccounts = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState({
    orderRevenue: 0,
    manualIncome: 0,
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    manualBalance: 0,
    currentBalance: 0,
    breakdownByType: {
      income: 0,
      expense: 0,
      fund_transfer: 0,
      salary: 0,
      bill: 0,
      payout: 0,
      adjustment: 0,
    },
    purchases: {
      total: 0,
      paid: 0,
      due: 0,
    },
  });
  const [entries, setEntries] = useState([]);
  const [entryTypeFilter, setEntryTypeFilter] = useState("");
  const [form, setForm] = useState({
    type: "expense",
    title: "",
    category: "",
    amount: "",
    note: "",
    entryDate: new Date().toISOString().slice(0, 10),
  });

  const canAccess = useMemo(
    () => String(user?.userType || "").toLowerCase() === "admin",
    [user?.userType],
  );

  const fetchData = useCallback(async () => {
    if (!canAccess) return;

    try {
      setLoading(true);
      const [summaryResponse, entriesResponse] = await Promise.all([
        axios.get(`${baseUrl}/accounts/summary`, {
          headers: getAuthHeaders(),
        }),
        axios.get(`${baseUrl}/accounts/entries`, {
          headers: getAuthHeaders(),
          params: {
            limit: 100,
            type: entryTypeFilter || undefined,
          },
        }),
      ]);

      setSummary(
        summaryResponse.data?.summary || {
          orderRevenue: 0,
          manualIncome: 0,
          totalIncome: 0,
          totalExpense: 0,
          netProfit: 0,
          manualBalance: 0,
          currentBalance: 0,
          breakdownByType: {
            income: 0,
            expense: 0,
            fund_transfer: 0,
            salary: 0,
            bill: 0,
            payout: 0,
            adjustment: 0,
          },
          purchases: {
            total: 0,
            paid: 0,
            due: 0,
          },
        },
      );
      setEntries(entriesResponse.data?.entries || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load accounts data");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [canAccess, entryTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createEntry = async (event) => {
    event.preventDefault();

    if (!String(form.title || "").trim()) {
      toast.error("Title is required");
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${baseUrl}/accounts/entries`,
        {
          type: form.type,
          title: String(form.title || "").trim(),
          category: String(form.category || "").trim(),
          amount,
          note: String(form.note || "").trim(),
          entryDate: form.entryDate || undefined,
        },
        { headers: getAuthHeaders() },
      );

      toast.success("Account entry added");
      setForm({
        type: "expense",
        title: "",
        category: "",
        amount: "",
        note: "",
        entryDate: new Date().toISOString().slice(0, 10),
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add account entry");
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (entry) => {
    const ok = window.confirm("Delete this account entry?");
    if (!ok) return;

    try {
      await axios.delete(`${baseUrl}/accounts/entries/${entry._id}`, {
        headers: getAuthHeaders(),
      });
      toast.success("Deleted");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete entry");
    }
  };

  if (!canAccess) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <h2 className="text-xl font-semibold text-black mb-2">Access Required</h2>
        <p className="text-gray-600">Only admin can access accounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-linear-to-r from-zinc-900 to-black rounded-xl p-6 md:p-8 text-white">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-4">
          <FiBarChart2 className="w-6 h-6" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">Accounts & Profit/Loss</h1>
        <p className="text-zinc-200 mt-2">Track income, expenses, and net profit in one finance view.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500">Total Income</p>
          <p className="text-2xl font-bold text-black mt-1">{Number(summary.totalIncome || 0).toFixed(2)} Tk</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500">Total Expense</p>
          <p className="text-2xl font-bold text-black mt-1">{Number(summary.totalExpense || 0).toFixed(2)} Tk</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs text-gray-500">Net Profit</p>
          <p className={`text-2xl font-bold mt-1 ${Number(summary.netProfit || 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {Number(summary.netProfit || 0).toFixed(2)} Tk
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Fund Transfer</p>
          <p className="text-lg font-bold text-black mt-1">
            {Number(summary?.breakdownByType?.fund_transfer || 0).toFixed(2)} Tk
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Salary</p>
          <p className="text-lg font-bold text-black mt-1">
            {Number(summary?.breakdownByType?.salary || 0).toFixed(2)} Tk
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Bills</p>
          <p className="text-lg font-bold text-black mt-1">
            {Number(summary?.breakdownByType?.bill || 0).toFixed(2)} Tk
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Store Payout</p>
          <p className="text-lg font-bold text-black mt-1">
            {Number(summary?.breakdownByType?.payout || 0).toFixed(2)} Tk
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Manual Balance</p>
          <p className="text-lg font-bold text-black mt-1">
            {Number(summary?.manualBalance || 0).toFixed(2)} Tk
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Current Balance</p>
          <p
            className={`text-lg font-bold mt-1 ${
              Number(summary?.currentBalance || 0) >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {Number(summary?.currentBalance || 0).toFixed(2)} Tk
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <form onSubmit={createEntry} className="xl:col-span-1 bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-semibold text-black">Add Account Entry</h2>

          <SearchableSelect
            value={form.type}
            onChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
            options={ENTRY_TYPES.map((type) => ({
              value: type,
              label: entryLabel(type),
            }))}
            placeholder="Entry type"
            searchable={false}
            className="min-w-0"
            buttonClassName="w-full px-3 py-2.5 border border-gray-200 rounded-lg"
            menuClassName="rounded-xl"
          />

          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Title"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg"
          />

          <input
            value={form.category}
            onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            placeholder="Category"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg"
          />

          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
            placeholder="Amount"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg"
          />

          <input
            type="date"
            value={form.entryDate}
            onChange={(event) => setForm((prev) => ({ ...prev, entryDate: event.target.value }))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg"
          />

          <textarea
            value={form.note}
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="Note"
            rows={3}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg"
          />

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 px-4 bg-black text-white rounded-lg font-medium disabled:opacity-60"
          >
            <FiPlus className="w-4 h-4" />
            {saving ? "Saving..." : "Add Entry"}
          </button>
        </form>

        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-black">Ledger Entries ({entries.length})</h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <SearchableSelect
                value={entryTypeFilter}
                onChange={setEntryTypeFilter}
                options={[
                  { value: "", label: "All Types" },
                  ...ENTRY_TYPES.map((type) => ({
                    value: type,
                    label: entryLabel(type),
                  })),
                ]}
                placeholder="All Types"
                searchable={false}
                className="min-w-0 w-full sm:w-auto"
                buttonClassName="h-10 w-full px-3 border border-gray-300 rounded-lg text-sm bg-white sm:min-w-[140px]"
                menuClassName="rounded-xl"
              />
              <button
                onClick={fetchData}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 text-sm sm:w-auto"
              >
                <FiRefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-gray-600">Loading ledger entries...</p>
          ) : entries.length === 0 ? (
            <p className="text-gray-600">No entries found.</p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Title</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry._id} className="border-b border-gray-100">
                      <td className="py-3 pr-3">
                        {entry.entryDate ? new Date(entry.entryDate).toLocaleDateString() : "-"}
                      </td>
                      <td className="py-3 pr-3">
                        <span className="inline-flex px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                          {entryLabel(entry.type)}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-black">{entry.title}</p>
                        <p className="text-xs text-gray-500">{entry.category || "-"}</p>
                      </td>
                      <td className="py-3 pr-3 font-semibold text-black">
                        <span className="inline-flex items-center gap-1">
                          <FiDollarSign className="w-4 h-4" />
                          {Number(entry.amount || 0).toFixed(2)} Tk
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <button
                          onClick={() => deleteEntry(entry)}
                          className="inline-flex h-8 items-center gap-1 px-2.5 text-xs rounded-md border border-red-300 text-red-600"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModuleAccounts;
