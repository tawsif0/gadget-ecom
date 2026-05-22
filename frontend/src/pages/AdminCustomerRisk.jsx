import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { FiEye, FiRefreshCw, FiSave, FiSearch, FiShield, FiUserX } from "react-icons/fi";
import SearchableSelect from "../components/SearchableSelect";
import { useThemeColors } from "../hooks/useThemeColors";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const riskBadgeClass = (riskLevel = "") => {
  const risk = String(riskLevel || "").toLowerCase();
  if (risk === "trusted") return "bg-green-100 text-green-700";
  if (risk === "medium") return "bg-yellow-100 text-yellow-700";
  if (risk === "high") return "bg-orange-100 text-orange-700";
  if (risk === "blacklisted") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-700";
};

const AdminCustomerRisk = () => {
  const { themeColor } = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    totalProfiles: 0,
    blacklisted: 0,
    trusted: 0,
    highRisk: 0,
  });
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("");
  const [blacklistedOnly, setBlacklistedOnly] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [profileNotes, setProfileNotes] = useState("");
  const [profileReason, setProfileReason] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const filteredRows = useMemo(() => rows, [rows]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/auth/admin/customer-risk`, {
        headers: getAuthHeaders(),
        params: {
          search: search || undefined,
          risk: risk || undefined,
          blacklisted: blacklistedOnly ? "true" : undefined,
        },
      });
      setRows(Array.isArray(response.data?.profiles) ? response.data.profiles : []);
      setSummary(response.data?.summary || {});
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load customer risk data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [blacklistedOnly, risk, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const applyFilters = async () => {
    await loadData();
  };

  const clearFilters = async () => {
    setSearch("");
    setRisk("");
    setBlacklistedOnly(false);
    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/auth/admin/customer-risk`, {
        headers: getAuthHeaders(),
      });
      setRows(Array.isArray(response.data?.profiles) ? response.data.profiles : []);
      setSummary(response.data?.summary || {});
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load customer risk data");
    } finally {
      setLoading(false);
    }
  };

  const toggleBlacklist = async (row) => {
    if (!row?.customerId) {
      toast.error("Guest customer cannot be directly blacklisted from this panel");
      return;
    }

    const shouldBlacklist = !row.isBlacklisted;
    const reason = shouldBlacklist
      ? window.prompt(
          "Blacklist reason (required):",
          row.blacklistReason || "Low delivery success rate",
        )
      : "";

    if (shouldBlacklist && !String(reason || "").trim()) {
      toast.error("Blacklist reason is required");
      return;
    }

    try {
      setUpdatingId(String(row.customerId));
      await axios.patch(
        `${baseUrl}/auth/admin/customer-risk/${row.customerId}/blacklist`,
        {
          isBlacklisted: shouldBlacklist,
          blacklistReason: shouldBlacklist ? String(reason || "").trim() : "",
          adminNotes: row.adminNotes || "",
        },
        { headers: getAuthHeaders() },
      );
      toast.success(shouldBlacklist ? "Customer blacklisted" : "Removed from blacklist");
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update blacklist");
    } finally {
      setUpdatingId("");
    }
  };

  const openProfile = async (row) => {
    if (!row?.customerId) {
      toast.error("Profile details are available for registered users only");
      return;
    }

    try {
      setProfileOpen(true);
      setProfileLoading(true);
      const response = await axios.get(
        `${baseUrl}/auth/admin/customers/${row.customerId}/profile`,
        { headers: getAuthHeaders() },
      );

      const payload = response.data || {};
      setProfileData(payload);
      setProfileNotes(String(payload?.profile?.adminNotes || ""));
      setProfileReason(String(payload?.profile?.blacklistReason || ""));
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load customer profile");
      setProfileOpen(false);
      setProfileData(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfileMeta = async () => {
    const profile = profileData?.profile;
    if (!profile?.customerId) return;

    try {
      setSavingProfile(true);
      await axios.patch(
        `${baseUrl}/auth/admin/customer-risk/${profile.customerId}/blacklist`,
        {
          isBlacklisted: !!profile.isBlacklisted,
          blacklistReason: profile.isBlacklisted
            ? String(profileReason || "").trim()
            : "",
          adminNotes: String(profileNotes || "").trim(),
        },
        { headers: getAuthHeaders() },
      );

      toast.success("Customer notes updated");
      setProfileData((prev) =>
        prev
          ? {
              ...prev,
              profile: {
              ...prev.profile,
              adminNotes: String(profileNotes || "").trim(),
              blacklistReason: prev.profile?.isBlacklisted
                ? String(profileReason || "").trim()
                : "",
            },
            }
          : prev,
      );
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to update customer notes");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-linear-to-r from-zinc-900 to-black rounded-xl p-6 md:p-8 text-white">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-4">
          <FiShield className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold">Customer Risk Analysis</h1>
        <p className="text-zinc-200 mt-1">
          Track delivery success rate and control high-risk/blacklisted customers.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Profiles</p>
          <p className="text-2xl font-bold text-black">{summary.totalProfiles || 0}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Trusted</p>
          <p className="text-2xl font-bold text-green-700">{summary.trusted || 0}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">High Risk</p>
          <p className="text-2xl font-bold text-orange-700">{summary.highRisk || 0}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Blacklisted</p>
          <p className="text-2xl font-bold text-red-700">{summary.blacklisted || 0}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">Filters</h2>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="relative md:col-span-2">
            <FiSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone, email"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm"
            />
          </label>
          <SearchableSelect
            value={risk}
            onChange={setRisk}
            options={[
              { value: "", label: "All risk levels" },
              { value: "trusted", label: "Trusted" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "blacklisted", label: "Blacklisted" },
              { value: "new", label: "New" },
            ]}
            placeholder="All risk levels"
            searchable={false}
            className="min-w-0"
            buttonClassName="px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
            menuClassName="rounded-xl"
          />
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 px-2">
            <input
              type="checkbox"
              checked={blacklistedOnly}
              onChange={(event) => setBlacklistedOnly(event.target.checked)}
              style={{ accentColor: themeColor }}
            />
            Blacklisted only
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
        <h2 className="text-lg font-semibold text-black mb-4">
          Customer Profiles ({filteredRows.length})
        </h2>
        {loading ? (
          <p className="text-sm text-gray-600">Loading profiles...</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-sm text-gray-600">No customer profile found.</p>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((row) => (
              <div
                key={row.key}
                className="border border-gray-200 rounded-lg p-4 grid grid-cols-1 xl:grid-cols-12 gap-3"
              >
                <div className="xl:col-span-3">
                  <p className="font-semibold text-black">{row.customerName || "Customer"}</p>
                  <p className="text-xs text-gray-500 mt-1">{row.phone || "No phone"}</p>
                  <p className="text-xs text-gray-500">{row.email || "No email"}</p>
                  <p className="text-xs text-gray-500 mt-1 capitalize">
                    Type: {row.userType || "guest"}
                  </p>
                </div>

                <div className="xl:col-span-5 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="rounded border border-gray-200 p-2">
                    <p className="text-gray-500">Orders</p>
                    <p className="font-semibold text-black">{row.totalOrders || 0}</p>
                  </div>
                  <div className="rounded border border-gray-200 p-2">
                    <p className="text-gray-500">Delivered</p>
                    <p className="font-semibold text-green-700">{row.deliveredOrders || 0}</p>
                  </div>
                  <div className="rounded border border-gray-200 p-2">
                    <p className="text-gray-500">Cancelled</p>
                    <p className="font-semibold text-red-700">{row.cancelledOrders || 0}</p>
                  </div>
                  <div className="rounded border border-gray-200 p-2">
                    <p className="text-gray-500">Revenue</p>
                    <p className="font-semibold text-black">{Number(row.totalRevenue || 0).toFixed(2)} Tk</p>
                  </div>
                </div>

                <div className="xl:col-span-2">
                  <p className="text-xs text-gray-500">Success Rate</p>
                  <p className="text-xl font-bold text-black">{Number(row.successRate || 0).toFixed(1)}%</p>
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold mt-2 ${riskBadgeClass(
                      row.riskLevel,
                    )}`}
                  >
                    {String(row.riskLevel || "new").toUpperCase()}
                  </span>
                </div>

                <div className="xl:col-span-2 space-y-2">
                  <button
                    type="button"
                    disabled={!row.customerId}
                    onClick={() => openProfile(row)}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 disabled:opacity-60"
                  >
                    <FiEye className="w-4 h-4" />
                    View Profile
                  </button>
                  <button
                    type="button"
                    disabled={!row.customerId || updatingId === String(row.customerId)}
                    onClick={() => toggleBlacklist(row)}
                    className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                      row.isBlacklisted
                        ? "border border-green-300 text-green-700"
                        : "border border-red-300 text-red-700"
                    } disabled:opacity-60`}
                  >
                    <FiUserX className="w-4 h-4" />
                    {updatingId === String(row.customerId)
                      ? "Updating..."
                      : row.isBlacklisted
                        ? "Remove Blacklist"
                        : "Blacklist Customer"}
                  </button>
                  {row.blacklistReason ? (
                    <p className="text-[11px] text-red-600">{row.blacklistReason}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {profileOpen && (
        <div className="fixed inset-0 app-layer-modal bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl rounded-xl border border-gray-200 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h3 className="text-lg font-semibold text-black">Customer Profile</h3>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  setProfileData(null);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              >
                Close
              </button>
            </div>

            {profileLoading ? (
              <div className="p-6">
                <p className="text-sm text-gray-600">Loading profile...</p>
              </div>
            ) : !profileData?.profile ? (
              <div className="p-6">
                <p className="text-sm text-gray-600">Profile data not found.</p>
              </div>
            ) : (
              <div className="p-5 space-y-4 overflow-auto max-h-[calc(90vh-65px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Customer</p>
                    <p className="font-semibold text-black">{profileData.profile.name || "-"}</p>
                    <p className="text-xs text-gray-500 mt-1">{profileData.profile.email || "-"}</p>
                    <p className="text-xs text-gray-500">{profileData.profile.phone || "-"}</p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Orders</p>
                    <p className="text-xl font-bold text-black">{profileData.metrics?.totalOrders || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Delivered: {profileData.metrics?.deliveredOrders || 0}
                    </p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Success Rate</p>
                    <p className="text-xl font-bold text-black">
                      {Number(profileData.metrics?.successRate || 0).toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1 capitalize">
                      Risk: {profileData.metrics?.riskLevel || "new"}
                    </p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Total Revenue</p>
                    <p className="text-xl font-bold text-black">
                      {Number(profileData.metrics?.totalRevenue || 0).toFixed(2)} Tk
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Value: {Number(profileData.metrics?.totalOrderValue || 0).toFixed(2)} Tk
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-semibold text-black">Internal Notes</p>
                    <textarea
                      value={profileNotes}
                      onChange={(event) => setProfileNotes(event.target.value)}
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                      placeholder="Admin internal notes"
                    />

                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={Boolean(profileData.profile?.isBlacklisted)}
                        onChange={(event) =>
                          setProfileData((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  profile: {
                                    ...prev.profile,
                                    isBlacklisted: event.target.checked,
                                  },
                                }
                              : prev,
                          )
                        }
                        style={{ accentColor: themeColor }}
                      />
                      Blacklisted
                    </label>
                    <input
                      value={profileReason}
                      onChange={(event) => setProfileReason(event.target.value)}
                      disabled={!profileData.profile?.isBlacklisted}
                      placeholder="Blacklist reason"
                      className="w-full h-9 border border-gray-300 rounded-lg px-2 text-sm disabled:bg-gray-100"
                    />
                    <button
                      type="button"
                      onClick={saveProfileMeta}
                      disabled={savingProfile}
                      className="inline-flex items-center gap-2 px-4 h-10 bg-black text-white rounded-lg text-sm font-medium disabled:opacity-60"
                    >
                      <FiSave className="w-4 h-4" />
                      {savingProfile ? "Saving..." : "Save Notes"}
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-black mb-2">
                      Recent Order History ({Array.isArray(profileData.orderHistory) ? profileData.orderHistory.length : 0})
                    </p>
                    {Array.isArray(profileData.orderHistory) && profileData.orderHistory.length > 0 ? (
                      <div className="max-h-72 overflow-auto space-y-2">
                        {profileData.orderHistory.slice(0, 30).map((order) => (
                          <div key={order.orderNumber} className="border border-gray-200 rounded-md p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-black">{order.orderNumber}</p>
                              <p className="text-gray-500 capitalize">{order.orderStatus}</p>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <p className="text-gray-500">
                                {order.createdAt ? new Date(order.createdAt).toLocaleString() : "N/A"}
                              </p>
                              <p className="font-semibold text-black">
                                {Number(order.total || 0).toFixed(2)} Tk
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">No order history found.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCustomerRisk;
