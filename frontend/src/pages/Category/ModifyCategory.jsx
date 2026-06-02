/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import ConfirmModal from "../../components/ConfirmModal";
import SearchableSelect from "../../components/SearchableSelect";
import CategoryTypeSelect from "../../components/CategoryTypeSelect";
import { useThemeColors } from "../../hooks/useThemeColors";
import {
  dashboardFieldClass,
  dashboardFormSurfaceClass,
  dashboardPrimaryButtonClass,
  dashboardSecondaryButtonClass,
} from "../../utils/dashboardFormStyles";
import {
  loadAdminSettings,
  saveAdminSettings,
  selectAdminSettingsDraft,
  selectPublicSettingsState,
} from "../../store/publicSettingsSlice";

const baseUrl = import.meta.env.VITE_API_URL;

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
      style={{
        backgroundColor: checked ? themeColor : "rgba(226, 232, 240, 1)",
        borderColor: checked ? themeColor : "rgba(203, 213, 225, 1)",
      }}
    >
      <span
        className="app-toggle-switch__knob"
        style={{
          backgroundColor: checked ? buttonTextColor : "#ffffff",
        }}
      />
    </button>
    <span className="app-toggle-switch__label">
      {checked ? activeText : inactiveText}
    </span>
  </div>
);

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

function ModifyCategory() {
  const dispatch = useDispatch();
  const { themeColor, buttonTextColor } = useThemeColors();
  const settings = useSelector(selectAdminSettingsDraft);
  const { adminStatus, saveStatus } = useSelector(selectPublicSettingsState);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("Latest");
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    dispatch(loadAdminSettings()).catch(() => undefined);
  }, [dispatch]);

  const showCategoryMarquee =
    settings?.storefront?.showCategoryMarquee !== false;
  const storefrontSaving = saveStatus === "loading";
  const primaryButtonStyle = {
    backgroundColor: themeColor,
    backgroundImage: "none",
    color: buttonTextColor,
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required. Please login again.");
        return;
      }

      const response = await axios.get(`${baseUrl}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setCategories(Array.isArray(response.data.categories) ? response.data.categories : []);
      }
    } catch (error) {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const handleCategoryCreated = () => {
      fetchCategories();
      toast.success("Category list refreshed");
    };

    window.addEventListener("categoryCreated", handleCategoryCreated);
    window.addEventListener("categoryUpdated", handleCategoryCreated);
    window.addEventListener("categoryDeleted", handleCategoryCreated);

    return () => {
      window.removeEventListener("categoryCreated", handleCategoryCreated);
      window.removeEventListener("categoryUpdated", handleCategoryCreated);
      window.removeEventListener("categoryDeleted", handleCategoryCreated);
    };
  }, []);

  const visibleCategories = useMemo(() => {
    const normalizedSearch = normalizeText(searchQuery).toLowerCase();
    const normalizedType = normalizeText(filterType).toLowerCase();

    return categories.filter((category) => {
      const name = String(category?.name || "").toLowerCase();
      const type = String(category?.type || "Latest").trim().toLowerCase();
      const matchesSearch =
        !normalizedSearch || `${name} ${type}`.includes(normalizedSearch);
      const matchesType = !normalizedType || type === normalizedType;
      return matchesSearch && matchesType;
    });
  }, [categories, searchQuery, filterType]);

  const categoryTypeOptions = useMemo(() => {
    const uniqueTypes = Array.from(
      new Set(
        categories
          .map((category) => String(category?.type || "Latest").trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return [
      { value: "", label: "All category names" },
      ...uniqueTypes.map((type) => ({ value: type, label: type })),
    ];
  }, [categories]);

  const activeCount = categories.filter((category) => category.isActive !== false).length;
  const parentCount = new Set(
    categories.map((category) => String(category?.type || "Latest").trim() || "Latest"),
  ).size;

  const handleToggleCategoryMarquee = async () => {
    try {
      const payload = {
        storefront: {
          ...(settings?.storefront || {}),
          showCategoryMarquee: !showCategoryMarquee,
        },
      };
      const result = await dispatch(saveAdminSettings(payload)).unwrap();
      toast.success(result?.message || "Category marquee visibility updated");
    } catch (error) {
      toast.error(error || "Failed to update category marquee visibility");
    }
  };

  const handleEditImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];

    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPG, PNG, WebP, GIF allowed.");
      event.target.value = "";
      return;
    }

    setEditImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditImagePreview(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  };

  const startEditing = (category) => {
    setEditingId(category._id);
    setEditName(category.name || "");
    setEditType(String(category.type || "Latest").trim() || "Latest");
    setEditImageFile(null);
    setEditImagePreview(category.image || "");
    setEditIsActive(category.isActive !== false);
    setEditError("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditType("Latest");
    setEditImageFile(null);
    setEditImagePreview("");
    setEditIsActive(true);
    setEditError("");
  };

  const handleUpdate = async () => {
    setEditError("");

    if (!normalizeText(editName)) {
      setEditError("Sub category cannot be empty");
      toast.error("Sub category cannot be empty");
      return;
    }

    if (!normalizeText(editType)) {
      setEditError("Category name is required");
      toast.error("Category name is required");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("name", normalizeText(editName));
      formData.append("type", normalizeText(editType) || "Latest");
      formData.append("isActive", String(editIsActive));
      if (editImageFile) {
        formData.append("image", editImageFile);
      }

      const response = await axios.put(
        `${baseUrl}/categories/${editingId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (response.data.success) {
        setCategories((prev) =>
          prev.map((category) =>
            category._id === editingId ? response.data.category : category,
          ),
        );
        toast.success("Category updated successfully!");
        cancelEditing();
        window.dispatchEvent(new CustomEvent("categoryUpdated"));
      }
    } catch (error) {
      const message = error.response?.data?.message || "Failed to update category";
      setEditError(message);
      toast.error(message);
    }
  };

  const handleToggleVisibility = async (category) => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Authentication required. Please login again.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", category?.name || "");
      formData.append("type", category?.type || "Latest");
      formData.append("isActive", String(!(category?.isActive !== false)));

      const response = await axios.put(
        `${baseUrl}/categories/${category._id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (response.data.success) {
        setCategories((prev) =>
          prev.map((row) =>
            row._id === category._id ? response.data.category : row,
          ),
        );
        toast.success("Category visibility updated");
        window.dispatchEvent(new CustomEvent("categoryUpdated"));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update category");
    }
  };

  const handleDelete = (category) => setDeleteConfirm(category);

  const confirmDeleteCategory = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(`${baseUrl}/categories/${deleteConfirm._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        setCategories((prev) =>
          prev.filter((category) => category._id !== deleteConfirm._id),
        );
        toast.success("Category deleted successfully!");
        window.dispatchEvent(new CustomEvent("categoryDeleted"));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete category");
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-black" />
          <p className="mt-4 text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  const visibleCount = visibleCategories.length;
  const totalCount = categories.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full space-y-6"
    >


      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">


          <div className={`${dashboardFormSurfaceClass} p-4 md:p-6`}>
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Category Library
                </p>
                <h2 className="mt-1 text-lg font-semibold text-black">
                  Browse and edit categories
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-800">
                  {visibleCount} / {totalCount} categories
                </span>
                <button
                  type="button"
                  onClick={fetchCategories}
                  className="inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                  style={primaryButtonStyle}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search categories"
                className="min-h-[46px] rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-black placeholder:text-gray-400 focus:border-black focus:outline-none"
              />
              <SearchableSelect
                value={filterType}
                onChange={setFilterType}
                options={categoryTypeOptions}
                placeholder="All category names"
                searchPlaceholder="Search category names"
                emptyLabel="No category name found"
                clearable
              />
            </div>

            {(searchQuery || filterType) ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterType("");
                  }}
                  className="inline-flex items-center rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:border-black hover:text-black"
                >
                  Clear filters
                </button>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleCategories.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
                  <p className="text-lg font-semibold text-gray-900">
                    No categories match your filters
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Try another search or category name.
                  </p>
                </div>
              ) : (
                visibleCategories.map((category) => {
                  const isEditing = editingId === category._id;

                  return (
                    <div
                      key={category._id}
                      className={`flex flex-col justify-between h-full rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                        isEditing ? "border-black ring-1 ring-black/10" : "border-gray-200"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          {category.image ? (
                            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shrink-0">
                              <img
                                src={category.image}
                                alt={category.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-base font-semibold text-gray-600 shrink-0">
                              {String(category.name || "C").charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-lg font-semibold text-black">
                              {category.name}
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-700">
                                {category.type || "Latest"}
                              </span>
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                  category.isActive !== false
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {category.isActive !== false ? "Public" : "Hidden"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(category)}
                          className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                          style={primaryButtonStyle}
                        >
                          {category.isActive !== false ? "Hide" : "Show"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditing(category)}
                          className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                          style={primaryButtonStyle}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(category)}
                          className="inline-flex items-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className={`${dashboardFormSurfaceClass} p-5 md:p-6`}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              Edit panel
            </p>
            <h2 className="mt-2 text-lg font-semibold text-black">
              {editingId ? "Editing selected category" : "Select a category to edit"}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              The right panel stays focused on one category at a time, so the form feels cleaner and easier to use.
            </p>
          </section>

          <section className={`${dashboardFormSurfaceClass} p-5 md:p-6`}>
            {editingId ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  {editImagePreview ? (
                    <div className="h-16 w-16 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                      <img
                        src={editImagePreview}
                        alt={`${editName || "Category"} preview`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-lg font-semibold text-gray-600">
                      {(editName || "C").charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Editing
                    </p>
                    <h3 className="mt-1 truncate text-lg font-semibold text-black">
                      {editName || "Category"}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-700">
                        {editType || "Latest"}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                          editIsActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {editIsActive ? "Public" : "Hidden"}
                      </span>
                    </div>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-100">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleEditImageChange}
                  />
                  Upload new image
                </label>

                <input
                  type="text"
                  value={editName}
                  onChange={(event) => {
                    setEditName(event.target.value);
                    if (editError) setEditError("");
                  }}
                  className={`${dashboardFieldClass} ${
                    editError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""
                  }`}
                  placeholder="Sub category name"
                />

                <CategoryTypeSelect
                  value={editType}
                  onChange={(value) => {
                    setEditType(value);
                    if (editError) setEditError("");
                  }}
                  placeholder="Category name"
                  buttonClassName={dashboardFieldClass}
                />

                <button
                  type="button"
                  onClick={() => setEditIsActive((prev) => !prev)}
                  className={`inline-flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    editIsActive
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-gray-200 bg-gray-50 text-gray-700"
                  }`}
                >
                  <span>Visibility</span>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] uppercase tracking-widest">
                    {editIsActive ? "Public" : "Hidden"}
                  </span>
                </button>

                {editError ? (
                  <p className="text-sm font-medium text-red-600">{editError}</p>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleUpdate}
                  className={`${dashboardPrimaryButtonClass} px-6 py-3`}
                  style={primaryButtonStyle}
                >
                  Save changes
                </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className={dashboardSecondaryButtonClass}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
                <p className="text-lg font-semibold text-gray-900">
                  No category selected
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Click Edit on any category card to open its editing form here.
                </p>
              </div>
            )}
          </section>


        </aside>
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteConfirm)}
        title="Delete category"
        message={
          deleteConfirm?.name
            ? `Delete "${deleteConfirm.name}" category?`
            : "Delete this category?"
        }
        confirmLabel="Delete"
        isDanger
        isLoading={isDeleting}
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={confirmDeleteCategory}
      />
    </motion.div>
  );
}

export default ModifyCategory;
