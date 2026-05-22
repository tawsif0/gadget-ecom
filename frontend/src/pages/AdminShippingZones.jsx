import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { FiEdit, FiRefreshCw, FiTrash2, FiTruck } from "react-icons/fi";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../hooks/useAuth";
import { useThemeColors } from "../hooks/useThemeColors";
import {
  BANGLADESH_DISTRICT_OPTIONS,
  DHAKA_DISTRICT_OPTION,
  OUTSIDE_DHAKA_COVERAGE_KEY,
  OUTSIDE_DHAKA_SHIPPING_OPTION,
  getDistrictCoverageKeys,
  getDistrictKey,
  isDhakaDistrict,
  isOutsideDhakaShippingOption,
  normalizeDistrictOption,
} from "../utils/bangladeshLocations";

const baseUrl = import.meta.env.VITE_API_URL;

const emptyRule = {
  districts: [],
  shippingFee: "0",
  isActive: true,
};

const emptyForm = {
  name: "",
  isActive: true,
  rules: [{ ...emptyRule }],
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fieldLabelClassName = "mb-1.5 block text-sm font-medium text-gray-700";
const inputClassName = "w-full px-3 py-2.5 border border-gray-200 rounded-lg";

const getRuleDistricts = (rule = {}) =>
  (Array.isArray(rule.districts)
    ? rule.districts
    : rule.district
      ? [rule.district]
      : []
  )
    .map(normalizeDistrictOption)
    .filter(Boolean);

const getZoneDistricts = (zone = {}) =>
  (Array.isArray(zone.rules) ? zone.rules : []).flatMap(getRuleDistricts);

const formatDistrictSummary = (districts = []) => {
  const normalizedDistricts = districts
    .map(normalizeDistrictOption)
    .filter(Boolean);
  if (normalizedDistricts.some(isOutsideDhakaShippingOption)) {
    return "Outside Dhaka (all 63 districts)";
  }
  return normalizedDistricts.length > 0
    ? normalizedDistricts.join(", ")
    : "No districts";
};

const normalizeZoneForUi = (zone = {}) => ({
  ...zone,
  _id: String(zone?._id || ""),
  createdBy: zone?.createdBy ? String(zone.createdBy) : "",
  updatedBy: zone?.updatedBy ? String(zone.updatedBy) : "",
  rules: Array.isArray(zone?.rules)
    ? zone.rules.map((rule) => ({
        ...rule,
        _id: String(rule?._id || ""),
        districts: getRuleDistricts(rule),
      }))
    : [],
});

const AdminShippingZones = () => {
  const { themeColor } = useThemeColors();
  const { user } = useAuth();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);

  const hasDhakaZone = useMemo(
    () =>
      zones.some(
        (zone) =>
          zone?.isActive !== false &&
          getZoneDistricts(zone).some(isDhakaDistrict),
      ),
    [zones],
  );

  const usedCoverageKeysByOtherZones = useMemo(() => {
    const keys = new Set();

    zones.forEach((zone) => {
      if (editingId && String(zone?._id || "") === String(editingId)) return;
      if (zone?.isActive === false) return;
      getDistrictCoverageKeys(getZoneDistricts(zone)).forEach((key) =>
        keys.add(key),
      );
    });

    return keys;
  }, [editingId, zones]);

  const isFirstDhakaZoneRequired = !editingId && !hasDhakaZone;

  const fetchZones = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/shipping/admin/zones`, {
        headers: getAuthHeaders(),
      });
      setZones(
        (Array.isArray(response.data?.zones) ? response.data.zones : [])
          .map(normalizeZoneForUi)
          .filter((zone) => zone._id),
      );
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to load shipping zones",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.userType === "admin") {
      fetchZones();
    }
  }, [user]);

  useEffect(() => {
    if (!isFirstDhakaZoneRequired) return;

    setForm((prev) => ({
      ...prev,
      rules: prev.rules.map((rule) => ({
        ...rule,
        districts: getRuleDistricts(rule).filter(isDhakaDistrict),
      })),
    }));
  }, [isFirstDhakaZoneRequired]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
    setIsNameManuallyEdited(false);
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (name === "name") {
      setIsNameManuallyEdited(value.trim().length > 0);
    }
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleRuleChange = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      rules: prev.rules.map((rule, i) =>
        i === index ? { ...rule, [field]: value } : rule,
      ),
    }));
  };

  const toggleRuleDistrict = (index, district) => {
    const normalizedDistrict = normalizeDistrictOption(district);
    if (!normalizedDistrict) return;

    setForm((prev) => {
      const updatedRules = prev.rules.map((rule, i) => {
        if (i !== index) return rule;

        const currentDistricts = Array.isArray(rule.districts)
          ? rule.districts.map(normalizeDistrictOption).filter(Boolean)
          : [];
        const hasDistrict = currentDistricts.includes(normalizedDistrict);

        if (isOutsideDhakaShippingOption(normalizedDistrict)) {
          return {
            ...rule,
            districts: hasDistrict ? [] : [OUTSIDE_DHAKA_SHIPPING_OPTION],
          };
        }

        return {
          ...rule,
          districts: hasDistrict
            ? currentDistricts.filter((entry) => entry !== normalizedDistrict)
            : [
                ...currentDistricts.filter(
                  (entry) => !isOutsideDhakaShippingOption(entry),
                ),
                normalizedDistrict,
              ],
        };
      });

      // Auto-populate zone name only if NOT manually edited
      const selectedDistricts = updatedRules[0]?.districts || [];
      const autoName =
        !isNameManuallyEdited && selectedDistricts.length > 0
          ? formatDistrictSummary(selectedDistricts)
          : prev.name;

      return {
        ...prev,
        name: autoName,
        rules: updatedRules,
      };
    });
  };

  const getAvailableDistrictOptions = (ruleIndex) => {
    const rule = form.rules[ruleIndex] || {};
    const currentDistricts = getRuleDistricts(rule);
    const currentCoverageKeys = new Set(
      getDistrictCoverageKeys(currentDistricts),
    );
    const blockedKeys = new Set([...usedCoverageKeysByOtherZones]);

    if (isFirstDhakaZoneRequired) {
      return [DHAKA_DISTRICT_OPTION];
    }

    const districtOptions = BANGLADESH_DISTRICT_OPTIONS.filter((district) => {
      const key = getDistrictKey(district);
      return currentCoverageKeys.has(key) || !blockedKeys.has(key);
    });

    const currentHasOutsideDhaka = currentDistricts.some(
      isOutsideDhakaShippingOption,
    );
    if (currentHasOutsideDhaka) {
      return [OUTSIDE_DHAKA_SHIPPING_OPTION];
    }

    const currentHasIndividualNonDhaka = currentDistricts.some(
      (district) =>
        !isDhakaDistrict(district) && !isOutsideDhakaShippingOption(district),
    );
    const outsideDhakaBlocked = blockedKeys.has(OUTSIDE_DHAKA_COVERAGE_KEY);

    if (!currentHasIndividualNonDhaka && !outsideDhakaBlocked) {
      return [...districtOptions, OUTSIDE_DHAKA_SHIPPING_OPTION];
    }

    return districtOptions;
  };

  const buildPayload = () => {
    const selectedDistricts =
      (form.rules[0]?.districts || []).length > 0
        ? formatDistrictSummary(form.rules[0].districts)
        : "Unnamed Zone";
    const finalName = form.name.trim() || selectedDistricts;

    return {
      name: finalName,
      isActive: Boolean(form.isActive),
      rules: form.rules.map((rule) => ({
        districts: Array.isArray(rule.districts)
          ? rule.districts.map(normalizeDistrictOption).filter(Boolean)
          : [],
        shippingFee: Number(rule.shippingFee || 0),
        estimatedMinDays: Number(rule.estimatedMinDays || 0),
        estimatedMaxDays: Number(rule.estimatedMaxDays || 0),
        isActive: Boolean(rule.isActive),
      })),
    };
  };

  const validateForm = () => {
    const selectedDistricts = form.rules[0]?.districts || [];
    if (selectedDistricts.length === 0) {
      toast.error("Please select at least one district");
      return false;
    }

    const invalidRule = form.rules.find(
      (rule) =>
        Number(rule.shippingFee) < 0 ||
        !Array.isArray(rule.districts) ||
        rule.districts.length === 0,
    );

    if (invalidRule) {
      toast.error(
        "Shipping rule must include at least one district and a valid fee",
      );
      return false;
    }

    if (isFirstDhakaZoneRequired) {
      const selectedKeys = new Set(
        getDistrictCoverageKeys(form.rules.flatMap(getRuleDistricts)),
      );
      if (selectedKeys.size !== 1 || !selectedKeys.has("dhaka")) {
        toast.error("Create the Dhaka shipping zone first");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload = buildPayload();

      if (editingId) {
        await axios.put(
          `${baseUrl}/shipping/admin/zones/${editingId}`,
          payload,
          {
            headers: getAuthHeaders(),
          },
        );
        toast.success("Shipping zone updated");
      } else {
        await axios.post(`${baseUrl}/shipping/admin/zones`, payload, {
          headers: getAuthHeaders(),
        });
        toast.success("Shipping zone created");
      }

      resetForm();
      fetchZones();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to save shipping zone",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (zone) => {
    setEditingId(String(zone?._id || ""));
    setIsNameManuallyEdited(Boolean(zone.name));
    setForm({
      name: zone.name || "",
      isActive: Boolean(zone.isActive),
      rules:
        zone.rules?.length > 0
          ? zone.rules.map((rule) => ({
              districts: Array.isArray(rule.districts)
                ? rule.districts.map(normalizeDistrictOption).filter(Boolean)
                : rule.district
                  ? [normalizeDistrictOption(rule.district)]
                  : [],
              shippingFee: String(rule.shippingFee ?? 0),
              estimatedMinDays: String(rule.estimatedMinDays ?? 0),
              estimatedMaxDays: String(rule.estimatedMaxDays ?? 0),
              isActive: Boolean(rule.isActive),
            }))
          : [{ ...emptyRule }],
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id) return;
    try {
      setIsDeleting(true);
      await axios.delete(
        `${baseUrl}/shipping/admin/zones/${String(deleteTarget._id || "")}`,
        {
          headers: getAuthHeaders(),
        },
      );
      toast.success("Shipping zone deleted");
      setDeleteTarget(null);
      fetchZones();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to delete shipping zone",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (user?.userType !== "admin") {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <h2 className="text-xl font-semibold text-black mb-2">
          Admin Access Required
        </h2>
        <p className="text-gray-600">
          Only admins can manage global shipping zones.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-linear-to-r from-slate-900 to-black rounded-xl p-6 md:p-8 text-white">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-4">
          <FiTruck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold">Global Shipping Zones</h1>
        <p className="text-slate-200 mt-1">
          Configure delivery fees by district. Create Dhaka first, then assign
          the remaining 63 districts. You can set one Outside Dhaka default fee,
          then add separate zones for district-specific overrides (e.g. Chandpur).
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 p-5 md:p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black">
            {editingId ? "Edit Zone" : "Create Zone"}
          </h2>
          <button
            type="button"
            onClick={resetForm}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg"
          >
            Reset
          </button>
        </div>

        <div className="space-y-6">
          {form.rules.map((rule, index) => (
            <div key={`rule-${index}`} className="space-y-4">
              {/* Step 1: Select Districts */}
              <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    Step 1: Select District(s)
                  </p>
                  <p className="text-xs text-gray-600">
                    {isFirstDhakaZoneRequired
                      ? "Start with Dhaka. Other districts unlock after this zone is saved."
                      : "Select the district(s) this zone will cover. Use individual zones to override an existing Outside Dhaka default fee."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {getAvailableDistrictOptions(index).map((district) => {
                    const selected =
                      Array.isArray(rule.districts) &&
                      rule.districts
                        .map(normalizeDistrictOption)
                        .includes(normalizeDistrictOption(district));
                    const isOutsideDhaka =
                      isOutsideDhakaShippingOption(district);

                    return (
                      <button
                        key={`${index}-${district}`}
                        type="button"
                        onClick={() => toggleRuleDistrict(index, district)}
                        className={`rounded-lg border px-3 py-2 text-left transition ${
                          selected
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span className="block text-sm font-medium">
                          {isOutsideDhaka ? "Outside Dhaka" : district}
                        </span>
                        <span className="block text-xs text-current/70">
                          {selected
                            ? "Selected"
                            : isOutsideDhaka
                              ? "All 63 districts"
                              : "Click to add"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto-Generated Zone Name Display */}
              {Array.isArray(rule.districts) && rule.districts.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1">
                    Zone Name (Auto-Generated)
                  </p>
                  <p className="text-sm text-blue-700 font-medium">
                    {formatDistrictSummary(rule.districts)}
                  </p>
                </div>
              )}

              {/* Step 2: Shipping Settings */}
              {Array.isArray(rule.districts) && rule.districts.length > 0 && (
                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-900">
                    Step 2: Shipping Settings
                  </p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label>
                      <span className={fieldLabelClassName}>
                        Shipping Fee (Tk)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rule.shippingFee}
                        onChange={(e) =>
                          handleRuleChange(index, "shippingFee", e.target.value)
                        }
                        placeholder="Enter shipping fee"
                        className={inputClassName}
                      />
                    </label>
                    <label>
                      <span className={fieldLabelClassName}>
                        Min. Delivery Days
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={rule.estimatedMinDays}
                        onChange={(e) =>
                          handleRuleChange(
                            index,
                            "estimatedMinDays",
                            e.target.value,
                          )
                        }
                        placeholder="Min days"
                        className={inputClassName}
                      />
                    </label>
                    <label>
                      <span className={fieldLabelClassName}>
                        Max. Delivery Days
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={rule.estimatedMaxDays}
                        onChange={(e) =>
                          handleRuleChange(
                            index,
                            "estimatedMaxDays",
                            e.target.value,
                          )
                        }
                        placeholder="Max days"
                        className={inputClassName}
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={Boolean(rule.isActive)}
                      onChange={(e) =>
                        handleRuleChange(index, "isActive", e.target.checked)
                      }
                      style={{ accentColor: themeColor }}
                    />
                    <span>Shipping Rule Active</span>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Step 3: Zone Settings */}
        <div className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
          <p className="text-sm font-semibold text-gray-900">
            Step 3: Zone Settings
          </p>
          <div className="space-y-3">
            <label>
              <span className={fieldLabelClassName}>
                Zone Name (Optional Custom Name)
              </span>
              <input
                name="name"
                value={form.name}
                onChange={handleInputChange}
                placeholder="Leave empty to auto-generate from districts"
                className={inputClassName}
              />
              <p className="text-xs text-gray-500 mt-1 mb-2">
                {isNameManuallyEdited
                  ? "You can still reset by clearing this field to use auto-generated name"
                  : "Auto-generated from selected districts. Type here to customize."}
              </p>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handleInputChange}
                style={{ accentColor: themeColor }}
              />
              <span>Zone Active</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-black text-white rounded-lg font-medium disabled:opacity-60"
        >
          {saving ? "Saving..." : editingId ? "Update Zone" : "Create Zone"}
        </button>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-black">
            Zones ({zones.length})
          </h2>
          <button
            onClick={fetchZones}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            <FiRefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading shipping zones...</p>
        ) : zones.length === 0 ? (
          <p className="text-gray-600">No shipping zones found.</p>
        ) : (
          <div className="space-y-3">
            {zones.map((zone) => (
              <div
                key={zone._id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-black">{zone.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Status: {zone.isActive ? "Active" : "Inactive"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                      {(zone.rules || []).map((rule, index) => {
                        const districts = Array.isArray(rule.districts)
                          ? rule.districts
                              .map(normalizeDistrictOption)
                              .filter(Boolean)
                          : rule.district
                            ? [normalizeDistrictOption(rule.district)]
                            : [];

                        return (
                          <span
                            key={`${zone._id}-rule-${index}`}
                            className="rounded-full bg-gray-100 px-3 py-1"
                          >
                            {formatDistrictSummary(districts)} | Tk{" "}
                            {Number(rule.shippingFee || 0).toFixed(2)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(zone)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                    >
                      <FiEdit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(zone)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg"
                    >
                      <FiTrash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete shipping zone"
        message={
          deleteTarget?.name
            ? `Delete shipping zone "${deleteTarget.name}"?`
            : "Delete this shipping zone?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDanger
        isLoading={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default AdminShippingZones;
