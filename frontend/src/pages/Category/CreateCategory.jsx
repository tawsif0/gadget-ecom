import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import ConfirmModal from "../../components/ConfirmModal";
import CategoryTypeSelect from "../../components/CategoryTypeSelect";
import {
  createCategoryType,
  deleteCategoryType,
  fetchCategoryTypes,
  updateCategoryType,
} from "../../store/categoryTypeSlice";
import { useThemeColors } from "../../hooks/useThemeColors";
import {
  dashboardFieldClass,
  dashboardFormSurfaceClass,
  dashboardLabelClass,
  dashboardPrimaryButtonClass,
  dashboardSecondaryButtonClass,
} from "../../utils/dashboardFormStyles";

const baseUrl = import.meta.env.VITE_API_URL;

const normalizeName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

function CreateCategory({ mode = "all" }) {
  const dispatch = useDispatch();
  const { themeColor, buttonTextColor } = useThemeColors();
  const { list: categoryTypes } = useSelector((state) => state.categoryTypes);

  const [categoryTypeDraft, setCategoryTypeDraft] = useState("");
  const [editingTypeId, setEditingTypeId] = useState("");
  const [editingTypeDraft, setEditingTypeDraft] = useState("");
  const [categoryTypeError, setCategoryTypeError] = useState("");
  const [categoryTypeSaving, setCategoryTypeSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [subcategoryName, setSubcategoryName] = useState("");
  const [subcategoryParent, setSubcategoryParent] = useState("Latest");
  const [subcategoryImageFile, setSubcategoryImageFile] = useState(null);
  const [subcategoryImagePreview, setSubcategoryImagePreview] = useState("");
  const [subcategoryError, setSubcategoryError] = useState("");
  const [subcategoryParentError, setSubcategoryParentError] = useState("");
  const [subcategorySaving, setSubcategorySaving] = useState(false);

  const sortedCategoryTypes = useMemo(() => {
    const rows = (Array.isArray(categoryTypes) ? categoryTypes : [])
      .slice()
      .filter((entry) => String(entry?.name || "").trim())
      .sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || "")),
      );

    if (
      !rows.some(
        (entry) =>
          String(entry?.name || "").trim().toLowerCase() === "latest",
      )
    ) {
      rows.unshift({ _id: "latest", name: "Latest" });
    }

    return rows;
  }, [categoryTypes]);

  useEffect(() => {
    dispatch(fetchCategoryTypes()).catch(() => undefined);
  }, [dispatch]);

  const resetCategoryTypeDraft = () => {
    setCategoryTypeDraft("");
    setEditingTypeId("");
    setEditingTypeDraft("");
    setCategoryTypeError("");
  };

  const saveCategoryType = async (event) => {
    event.preventDefault();
    const name = normalizeName(categoryTypeDraft);

    if (!name) {
      setCategoryTypeError("Category name is required");
      return;
    }

    setCategoryTypeSaving(true);
    try {
      await dispatch(createCategoryType({ name })).unwrap();
      toast.success("Category name created");

      resetCategoryTypeDraft();
    } catch (error) {
      toast.error(String(error || "Failed to save category name"));
    } finally {
      setCategoryTypeSaving(false);
    }
  };

  const beginEditCategoryType = (entry) => {
    const id = String(entry?._id || entry?.id || "").trim();
    const name = String(entry?.name || "").trim();
    if (!id || name.toLowerCase() === "latest") return;
    setEditingTypeId(id);
    setEditingTypeDraft(name);
    setCategoryTypeError("");
  };

  const cancelEditCategoryType = () => {
    setEditingTypeId("");
    setEditingTypeDraft("");
    setCategoryTypeError("");
  };

  const saveEditedCategoryType = async () => {
    const id = String(editingTypeId || "").trim();
    const name = normalizeName(editingTypeDraft);
    if (!id) return;
    if (!name) {
      setCategoryTypeError("Category name is required");
      return;
    }

    setCategoryTypeSaving(true);
    try {
      await dispatch(updateCategoryType({ id, changes: { name } })).unwrap();
      toast.success("Category name updated");
      cancelEditCategoryType();
    } catch (error) {
      toast.error(String(error || "Failed to update category name"));
    } finally {
      setCategoryTypeSaving(false);
    }
  };

  const askDeleteCategoryType = (entry) => {
    const id = String(entry?._id || entry?.id || "").trim();
    const name = String(entry?.name || "").trim();
    if (!id || name.toLowerCase() === "latest") return;
    setDeleteTarget({ id, name });
  };

  const confirmDeleteCategoryType = async () => {
    const id = String(deleteTarget?.id || "").trim();
    if (!id) return;

    setDeleteSaving(true);
    try {
      await dispatch(deleteCategoryType(id)).unwrap();
      toast.success("Category name deleted");
      if (editingTypeId === id) {
        cancelEditCategoryType();
      }
      setDeleteTarget(null);
    } catch (error) {
      toast.error(String(error || "Failed to delete category name"));
    } finally {
      setDeleteSaving(false);
    }
  };

  const handleSubcategoryImageChange = (event) => {
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

    setSubcategoryImageFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setSubcategoryImagePreview(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  };

  const removeSubcategoryImage = () => {
    setSubcategoryImageFile(null);
    setSubcategoryImagePreview("");
  };

  const saveSubcategory = async (event) => {
    event.preventDefault();
    setSubcategoryError("");
    setSubcategoryParentError("");

    const resolvedName = normalizeName(subcategoryName);
    const resolvedParent = normalizeName(subcategoryParent) || "Latest";

    let hasError = false;
    if (!resolvedParent) {
      setSubcategoryParentError("Select a category name");
      hasError = true;
    }
    if (!resolvedName) {
      setSubcategoryError("Sub category is required");
      hasError = true;
    }
    if (hasError) return;

    setSubcategorySaving(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required. Please login again.");
        return;
      }

      const formData = new FormData();
      formData.append("name", resolvedName);
      formData.append("type", resolvedParent);
      formData.append("isActive", "true");

      if (subcategoryImageFile) {
        formData.append("image", subcategoryImageFile);
      }

      const response = await axios.post(`${baseUrl}/categories`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        setSubcategoryName("");
        setSubcategoryParent("Latest");
        setSubcategoryImageFile(null);
        setSubcategoryImagePreview("");
        toast.success("Sub category created successfully!");
        window.dispatchEvent(
          new CustomEvent("categoryCreated", {
            detail: response.data.category,
          }),
        );
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create sub category");
    } finally {
      setSubcategorySaving(false);
    }
  };

  const showCategoryManager = mode !== "subcategory";
  const showSubcategoryForm = mode !== "category";

  const isSinglePage = mode !== "all";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="w-full"
    >
      <div
        className={`grid gap-6 ${
          isSinglePage ? "" : "lg:grid-cols-[1fr_1.2fr]"
        }`}
      >
        {showCategoryManager ? (
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={`${dashboardFormSurfaceClass} p-5 md:p-6`}
          >
            <div className="mb-5 flex flex-col gap-2">
              <div className="inline-flex w-fit rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-600">
                Category Name Page
              </div>
              <h2 className="text-xl font-semibold text-black">
                Add and organize category names
              </h2>
              <p className="text-sm text-gray-600">
                Latest is always available. You can add, rename, or delete
                custom category names here.
              </p>
            </div>

            <form onSubmit={saveCategoryType} className="space-y-4">
              <div>
                <label className={dashboardLabelClass}>Category Name *</label>
                <input
                  type="text"
                  value={categoryTypeDraft}
                  onChange={(event) => {
                    setCategoryTypeDraft(event.target.value);
                    if (categoryTypeError) setCategoryTypeError("");
                  }}
                  className={`${dashboardFieldClass} text-base ${
                    categoryTypeError
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : ""
                  }`}
                  placeholder={
                    editingTypeId ? "Rename category name" : "Enter category name"
                  }
                  autoComplete="off"
                />
                {categoryTypeError ? (
                  <p className="mt-1 text-sm font-medium text-red-600">
                    {categoryTypeError}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={categoryTypeSaving}
                  className={`${dashboardPrimaryButtonClass} px-5 py-3 disabled:cursor-not-allowed disabled:opacity-60`}
                  style={{
                    backgroundColor: themeColor,
                    backgroundImage: "none",
                    color: buttonTextColor,
                  }}
                >
                  {categoryTypeSaving ? "Saving..." : "Add Category Name"}
                </button>
                {editingTypeId ? (
                  <button
                    type="button"
                    onClick={resetCategoryTypeDraft}
                    className={`${dashboardSecondaryButtonClass} px-5 py-3`}
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </form>

            <div className="mt-6 rounded-3xl border border-gray-200 bg-gray-50 p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Category Name List
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Latest is locked. Other names can be edited or removed.
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm">
                  {sortedCategoryTypes.length} total
                </span>
              </div>

              <div className="space-y-3">
                {sortedCategoryTypes.map((entry) => {
                  const id = String(entry?._id || entry?.id || "").trim();
                  const name = String(entry?.name || "").trim();
                  const locked = name.toLowerCase() === "latest";
                  const isEditing = editingTypeId === id;

                  return (
                    <div
                      key={id || name}
                      className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editingTypeDraft}
                              onChange={(event) => {
                                setEditingTypeDraft(event.target.value);
                                if (categoryTypeError) setCategoryTypeError("");
                              }}
                              className={`${dashboardFieldClass} text-base ${
                                categoryTypeError
                                  ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                                  : ""
                              }`}
                              placeholder="Rename category name"
                              autoFocus
                            />
                            {categoryTypeError ? (
                              <p className="text-sm font-medium text-red-600">
                                {categoryTypeError}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <>
                            <p className="truncate text-base font-semibold text-black">
                              {name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {locked
                                ? "Default category name"
                                : "Custom category name"}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {locked ? (
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                            Locked
                          </span>
                        ) : (
                          isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={saveEditedCategoryType}
                                disabled={categoryTypeSaving}
                                className={`${dashboardPrimaryButtonClass} px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60`}
                                style={{
                                  backgroundColor: themeColor,
                                  backgroundImage: "none",
                                  color: buttonTextColor,
                                }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditCategoryType}
                                className={`${dashboardSecondaryButtonClass} px-4 py-2 text-sm`}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => beginEditCategoryType(entry)}
                              className={`${dashboardPrimaryButtonClass} px-4 py-2 text-sm`}
                              style={{
                                backgroundColor: themeColor,
                                backgroundImage: "none",
                                color: buttonTextColor,
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => askDeleteCategoryType(entry)}
                              className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.section>
        ) : null}

        {showSubcategoryForm ? (
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
            className={`${dashboardFormSurfaceClass} p-5 md:p-6`}
          >
            <div className="mb-5 flex flex-col gap-2">
              <div className="inline-flex w-fit rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-600">
                Sub Category Page
              </div>
              <h2 className="text-xl font-semibold text-black">
                Create a sub category under a category name
              </h2>
              <p className="text-sm text-gray-600">
                Choose a parent category name, add the sub category, and upload
                an image if needed.
              </p>
            </div>

            <form onSubmit={saveSubcategory} noValidate className="space-y-4">
              <div>
                <label className={dashboardLabelClass}>Category Name *</label>
                <CategoryTypeSelect
                  value={subcategoryParent}
                  onChange={(value) => {
                    setSubcategoryParent(value);
                    if (subcategoryParentError) setSubcategoryParentError("");
                  }}
                  placeholder="Select a category name"
                  buttonClassName={`${dashboardFieldClass} text-base ${
                    subcategoryParentError
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : ""
                  }`}
                  showManageButton={false}
                  includeAllOption={false}
                />
                {subcategoryParentError ? (
                  <p className="mt-1 text-sm font-medium text-red-600">
                    {subcategoryParentError}
                  </p>
                ) : null}
              </div>

              <div>
                <label className={dashboardLabelClass}>Sub Category *</label>
                <input
                  type="text"
                  value={subcategoryName}
                  onChange={(event) => {
                    setSubcategoryName(event.target.value);
                    if (subcategoryError) setSubcategoryError("");
                  }}
                  className={`${dashboardFieldClass} text-base ${
                    subcategoryError
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : ""
                  }`}
                  placeholder="Enter sub category"
                  autoComplete="off"
                />
                {subcategoryError ? (
                  <p className="mt-1 text-sm font-medium text-red-600">
                    {subcategoryError}
                  </p>
                ) : null}
              </div>

              <div>
                <label className={dashboardLabelClass}>Sub Category Image</label>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-100">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleSubcategoryImageChange}
                  />
                  <span>Upload image</span>
                  <span className="mt-1 text-xs text-gray-500">
                    Optional but recommended for storefront cards.
                  </span>
                </label>

                {subcategoryImagePreview ? (
                  <div className="mt-3 flex items-start gap-3">
                    <div className="h-24 w-24 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                      <img
                        src={subcategoryImagePreview}
                        alt="Sub category preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={removeSubcategoryImage}
                      className={dashboardSecondaryButtonClass}
                    >
                      Remove image
                    </button>
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={subcategorySaving}
                className="inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-base font-bold shadow-lg shadow-slate-900/15 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor: themeColor,
                  color: buttonTextColor,
                }}
              >
                {subcategorySaving ? "Creating..." : "Create Sub Category"}
              </button>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                The same sub category name can exist under different category
                names, but it must stay unique within the same parent.
              </div>
            </form>
          </motion.section>
        ) : null}
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete category name?"
        message={
          deleteTarget?.name
            ? `Delete "${deleteTarget.name}"? It will be reassigned to Latest.`
            : "Delete this category name?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDanger
        isLoading={deleteSaving}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteCategoryType}
      />
    </motion.div>
  );
}

export default CreateCategory;
