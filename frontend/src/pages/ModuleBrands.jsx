import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { FiEdit2, FiPlus, FiRefreshCw, FiSave, FiTag, FiTrash2 } from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../hooks/useAuth";
import { useThemeColors } from "../hooks/useThemeColors";
import RichTextEditor from "../components/RichTextEditor";
import ConfirmModal from "../components/ConfirmModal";
import { stripHtml } from "../utils/richText";
import {
  loadAdminSettings,
  saveAdminSettings,
  selectAdminSettingsDraft,
  selectPublicSettingsState,
} from "../store/publicSettingsSlice";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const emptyForm = {
  name: "",
  description: "",
  logoUrl: "",
  isActive: true,
};

const ToggleSwitch = ({
  checked,
  onChange,
  disabled = false,
  label,
  activeText = "On",
  inactiveText = "Off",
  themeColor = "#000000",
  buttonTextColor = "#ffffff",
}) => (
  <div className="flex items-center gap-3">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`app-toggle-switch focus:outline-none ${checked ? "is-on" : ""}`}
      style={
        {
          backgroundColor: checked ? themeColor : "rgba(226, 232, 240, 1)",
          borderColor: checked ? themeColor : "rgba(203, 213, 225, 1)",
        }
      }
    >
      <span
        className="app-toggle-switch__knob"
        style={{
          backgroundColor: checked ? buttonTextColor : "#ffffff",
        }}
      />
    </button>
    <span className="app-toggle-switch__label">{checked ? activeText : inactiveText}</span>
  </div>
);

const ModuleBrands = () => {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { themeColor, buttonTextColor } = useThemeColors();
  const settings = useSelector(selectAdminSettingsDraft);
  const { adminStatus, saveStatus } = useSelector(selectPublicSettingsState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [brands, setBrands] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [logoUploading, setLogoUploading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDeleteBrand, setPendingDeleteBrand] = useState(null);
  const logoInputRef = useRef(null);

  const role = String(user?.userType || "").toLowerCase();
  const canAccess = role === "admin";

  const fetchData = useCallback(async () => {
    if (!canAccess) return;

    try {
      setLoading(true);
      const params = {
        limit: 200,
        search: search || undefined,
      };

      const brandResponse = await axios.get(`${baseUrl}/brands`, {
        headers: getAuthHeaders(),
        params,
      });

      const responseData = brandResponse.data || {};
      const rows = Array.isArray(responseData.brands)
        ? responseData.brands
        : Array.isArray(responseData.data?.brands)
          ? responseData.data.brands
          : Array.isArray(responseData.data)
            ? responseData.data
            : [];

      setBrands(rows);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load brands");
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, [canAccess, search]);

  useEffect(() => {
    if (!canAccess) return;
    dispatch(loadAdminSettings()).catch(() => undefined);
  }, [canAccess, dispatch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setEditingId("");
    setForm(emptyForm);
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLogoUploading(true);
      const payload = new FormData();
      payload.append("logo", file);
      const response = await axios.post(`${baseUrl}/brands/logo-upload`, payload, {
        headers: getAuthHeaders(),
      });
      const nextLogoUrl = String(response?.data?.logoUrl || "").trim();
      setForm((prev) => ({ ...prev, logoUrl: nextLogoUrl }));
      toast.success(response?.data?.message || "Brand logo uploaded");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to upload brand logo");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!String(form.name || "").trim()) {
      toast.error("Brand name is required");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: String(form.name || "").trim(),
        description: String(form.description || "").trim(),
        logoUrl: String(form.logoUrl || "").trim(),
        isActive: Boolean(form.isActive),
      };

      if (editingId) {
        await axios.patch(`${baseUrl}/brands/${editingId}`, payload, {
          headers: getAuthHeaders(),
        });
        toast.success("Brand updated");
      } else {
        await axios.post(`${baseUrl}/brands`, payload, {
          headers: getAuthHeaders(),
        });
        toast.success("Brand created");
      }

      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save brand");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (brand) => {
    setEditingId(String(brand?._id || ""));
    setForm({
      name: String(brand?.name || ""),
      description: String(brand?.description || ""),
      logoUrl: String(brand?.logoUrl || ""),
      isActive: brand?.isActive !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (brand) => {
    setPendingDeleteBrand(brand || null);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteBrand?._id) return;

    try {
      setDeleting(true);
      await axios.delete(`${baseUrl}/brands/${pendingDeleteBrand._id}`, {
        headers: getAuthHeaders(),
      });
      toast.success("Brand deleted");
      if (editingId === String(pendingDeleteBrand._id)) {
        resetForm();
      }
      setDeleteModalOpen(false);
      setPendingDeleteBrand(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete brand");
    } finally {
      setDeleting(false);
    }
  };

  const brandCountLabel = useMemo(() => `${brands.length}`, [brands.length]);
  const showBrandMarquee = settings?.storefront?.showBrandMarquee !== false;
  const storefrontSaving = saveStatus === "loading";

  const handleToggleBrandMarquee = async () => {
    try {
      const payload = {
        storefront: {
          ...(settings?.storefront || {}),
          showBrandMarquee: !showBrandMarquee,
        },
      };
      const result = await dispatch(saveAdminSettings(payload)).unwrap();
      toast.success(result?.message || "Brand marquee visibility updated");
    } catch (error) {
      toast.error(error || "Failed to update brand marquee visibility");
    }
  };

  if (!canAccess) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <h2 className="text-xl font-semibold text-black mb-2">Access Required</h2>
        <p className="text-gray-600">Only admin can access brands.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete brand?"
        message={`Delete “${String(pendingDeleteBrand?.name || "").trim()}”? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDanger
        isLoading={deleting}
        onCancel={() => {
          if (deleting) return;
          setDeleteModalOpen(false);
          setPendingDeleteBrand(null);
        }}
        onConfirm={confirmDelete}
      />
      <div className="bg-linear-to-r from-zinc-900 to-black rounded-xl p-6 md:p-8 text-white">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-4">
          <FiTag className="w-6 h-6" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">Brand Management</h1>
        <p className="text-zinc-200 mt-2">Create and manage brand catalog for products.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Home Page Brands
            </p>
            <h2 className="mt-2 text-lg font-semibold text-black">
              Brand marquee visibility
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Control whether the brand sliding section appears on the public home page.
            </p>
          </div>

          <div className="flex flex-col items-start gap-2">
            <ToggleSwitch
              checked={showBrandMarquee}
              onChange={handleToggleBrandMarquee}
              disabled={adminStatus === "loading" || storefrontSaving}
              label="Toggle brand marquee visibility"
              activeText={storefrontSaving ? "Saving..." : "Public"}
              inactiveText={storefrontSaving ? "Saving..." : "Private"}
              themeColor={themeColor}
              buttonTextColor={buttonTextColor}
            />
            <p className="text-xs text-gray-500">
              Status: {showBrandMarquee ? "Visible on storefront" : "Hidden from storefront"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <form
          onSubmit={handleSubmit}
          className="xl:col-span-1 bg-white border border-gray-200 rounded-xl p-5 space-y-3"
        >
            <h2 className="text-lg font-semibold text-black">
            {editingId ? "Edit Brand" : "Create Brand"}
          </h2>

          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Brand name"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg"
          />

          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 disabled:opacity-60"
              >
                {logoUploading ? "Uploading..." : "Upload Logo"}
              </button>
              {form.logoUrl ? (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, logoUrl: "" }))}
                  className="inline-flex h-10 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700"
                >
                  Remove Logo
                </button>
              ) : null}
            </div>
            <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-4">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt={form.name || "Brand logo"} className="h-16 w-auto max-w-full object-contain" />
              ) : (
                <p className="text-sm text-gray-500">No brand logo uploaded yet.</p>
              )}
            </div>
          </div>

          <RichTextEditor
            value={form.description}
            onChange={(value) => setForm((prev) => ({ ...prev, description: value }))}
            placeholder="Description (optional)"
            minHeight={160}
          />

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-black">Brand Status</p>
                <p className="text-xs text-gray-500">
                  Control whether this brand can appear in brand listings.
                </p>
              </div>
              <ToggleSwitch
                checked={form.isActive}
                onChange={() =>
                  setForm((prev) => ({ ...prev, isActive: !prev.isActive }))
                }
                label="Toggle brand active status"
                activeText="Active"
                inactiveText="Inactive"
                themeColor={themeColor}
                buttonTextColor={buttonTextColor}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 px-4 bg-black text-white rounded-lg font-medium disabled:opacity-60"
            >
              {editingId ? <FiSave className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-10 items-center px-4 border border-gray-300 rounded-lg text-sm"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-black">Brands ({brandCountLabel})</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search brand"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <button
                type="button"
                onClick={fetchData}
                className="inline-flex h-10 items-center gap-2 px-3 border border-gray-300 rounded-lg text-sm"
              >
                <FiRefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-gray-600">Loading brands...</p>
          ) : brands.length === 0 ? (
            <p className="text-gray-600">No brands found.</p>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="py-2 pr-3">Brand</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.map((brand) => (
                    <tr key={brand._id} className="border-b border-gray-100">
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                            {brand.logoUrl ? (
                              <img
                                src={brand.logoUrl}
                                alt={brand.name || "Brand logo"}
                                className="h-full w-full object-contain p-1"
                              />
                            ) : (
                              <FiTag className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-black">{brand.name}</p>
                            <p className="text-xs text-gray-500">
                              {brand.description ? stripHtml(brand.description).slice(0, 80) : "-"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-[11px] font-semibold ${
                            brand.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {brand.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(brand)}
                            className="inline-flex h-8 items-center gap-1 px-2.5 text-xs rounded-md border border-gray-300"
                          >
                            <FiEdit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(brand)}
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
    </div>
  );
};

export default ModuleBrands;
