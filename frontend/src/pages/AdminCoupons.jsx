import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import {
  FiEdit,
  FiRefreshCw,
  FiSearch,
  FiTag,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import ConfirmModal from "../components/ConfirmModal";
import SearchableSelect from "../components/SearchableSelect";
import { useAuth } from "../hooks/useAuth";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const initialFormState = {
  code: "",
  offerType: "discount",
  discountType: "percentage",
  discountValue: "",
  applicabilityMode: "global",
  targetCategoryTypes: [],
  targetCategories: [],
  targetProducts: [],
  minPurchase: "",
  maxDiscount: "",
  validUntil: "",
  usageLimit: "",
  isActive: true,
  requiredProducts: [],
};

const sectionClassName =
  "rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(8,23,68,0.03)]";
const fieldClassName =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition focus:border-slate-900 focus:bg-white focus:outline-none";
const labelClassName =
  "mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500";
const neutralInlineToggleClass = (active = false) =>
  `inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${
    active
      ? "border-slate-950 bg-slate-950 text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
      : "border-slate-300 bg-white text-slate-700 hover:border-slate-950 hover:text-slate-950"
  }`;

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const formatMoney = (value) => `${Number(value || 0).toFixed(2)} Tk`;

const resolveImageValue = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) return resolveImageValue(value[0]);
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value.url || value.path || value.secure_url || value.src || "";
  }
  return "";
};

const toImageUrl = (value) => {
  const resolved = resolveImageValue(value);
  if (!resolved) return "";
  if (/^(https?:|data:|blob:)/i.test(resolved)) return resolved;
  const baseRoot = String(baseUrl || "").replace(/\/api\/?$/, "");
  return resolved.startsWith("/")
    ? `${baseRoot}${resolved}`
    : `${baseRoot}/${resolved}`;
};

const resolveProductCategoryId = (product) => {
  const categoryValue = product?.category;
  if (Array.isArray(categoryValue)) {
    const first = categoryValue[0];
    return String(first?._id || first || "");
  }
  return String(categoryValue?._id || categoryValue || "");
};

const SelectionPanel = ({
  title,
  description,
  items,
  selectedValues,
  onToggle,
  onClear,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  emptyText,
  getKey,
  renderContent,
  columnsClassName = "sm:grid-cols-2",
  selectedLabel = "selected",
}) => (
  <div className="rounded-[26px] border border-slate-200 bg-slate-50/90 px-4 pb-4 pt-3.5 shadow-[0_16px_36px_rgba(8,23,68,0.03)] sm:px-5 sm:pb-5 sm:pt-4">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-black">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description} {selectedValues.length} {selectedLabel}
        </p>
      </div>
      {selectedValues.length > 0 ? (
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-900 hover:text-black"
        >
          Clear
        </button>
      ) : null}
    </div>

    <label className="relative mb-3 block">
      <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 focus:border-black focus:outline-none"
      />
    </label>

    <div
      className={`grid max-h-[360px] gap-3 overflow-y-auto pr-1 ${columnsClassName}`}
    >
      {items.length === 0 ? (
        <p className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          {emptyText}
        </p>
      ) : (
        items.map((item) => {
          const itemKey = getKey(item);
          const checked = selectedValues.includes(itemKey);

          return (
            <label
              key={itemKey}
              className={`flex min-h-[92px] cursor-pointer items-center rounded-[22px] border px-4 py-4 text-sm transition ${
                checked
                  ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_32px_rgba(8,23,68,0.08)]"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:shadow-[0_12px_24px_rgba(8,23,68,0.05)]"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(itemKey)}
                className="sr-only"
              />
              <div className="min-w-0 w-full">{renderContent(item, checked)}</div>
            </label>
          );
        })
      )}
    </div>
  </div>
);

const CATEGORY_TYPE_OPTIONS = [
  "General",
  "Popular",
  "Hot deals",
  "Best Selling",
  "Latest",
];

const AdminCoupons = () => {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(initialFormState);
  const [categoryTypeSearch, setCategoryTypeSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [comboProductSearch, setComboProductSearch] = useState("");
  const [categoryNamesEnabled, setCategoryNamesEnabled] = useState(false);
  const [productsEnabled, setProductsEnabled] = useState(false);

  const isAdmin = user?.userType === "admin";

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/coupons`, {
        headers: getAuthHeaders(),
      });
      setCoupons(response.data?.coupons || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await axios.get(`${baseUrl}/products`, {
        headers: getAuthHeaders(),
      });
      setProducts(response.data?.products || []);
    } catch {
      setProducts([]);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axios.get(`${baseUrl}/categories`, {
        headers: getAuthHeaders(),
      });
      setCategories(response.data?.categories || []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchCoupons();
      fetchCategories();
      fetchProducts();
    }
  }, [isAdmin, fetchCoupons, fetchCategories, fetchProducts]);

  const resetForm = () => {
    setForm(initialFormState);
    setEditingId("");
    setCategoryTypeSearch("");
    setCategorySearch("");
    setProductSearch("");
    setComboProductSearch("");
    setCategoryNamesEnabled(false);
    setProductsEnabled(false);
  };

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const toggleSelection = (field, value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;

    setForm((prev) => {
      const currentValues = Array.isArray(prev[field]) ? prev[field] : [];
      const exists = currentValues.includes(normalized);

      return {
        ...prev,
        [field]: exists
          ? currentValues.filter((entry) => entry !== normalized)
          : [...currentValues, normalized],
      };
    });
  };

  const buildPayload = () => ({
    code: form.code.trim().toUpperCase(),
    offerType: form.offerType,
    discountType: form.discountType,
    applicabilityMode: form.applicabilityMode,
    targetCategoryTypes: form.targetCategoryTypes.filter(Boolean),
    targetCategories: form.targetCategories.filter(Boolean),
    targetProducts: form.targetProducts.filter(Boolean),
    discountValue:
      form.offerType === "free_shipping"
        ? Number(form.discountValue || 0)
        : Number(form.discountValue),
    minPurchase: form.minPurchase === "" ? 0 : Number(form.minPurchase),
    maxDiscount: form.maxDiscount === "" ? null : Number(form.maxDiscount),
    validUntil: form.validUntil,
    usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit),
    isActive: Boolean(form.isActive),
    requiredProducts:
      form.offerType === "combo" ? form.requiredProducts.filter(Boolean) : [],
  });

  const validateForm = () => {
    if (!form.code.trim()) {
      toast.error("Coupon code is required");
      return false;
    }

    if (
      form.offerType !== "free_shipping" &&
      (!form.discountValue || Number(form.discountValue) <= 0)
    ) {
      toast.error("Discount value must be greater than 0");
      return false;
    }

    if (form.offerType === "combo" && form.requiredProducts.length === 0) {
      toast.error("Please select combo products");
      return false;
    }

    if (
      form.applicabilityMode === "targeted" &&
      form.targetCategoryTypes.length === 0 &&
      form.targetCategories.length === 0 &&
      form.targetProducts.length === 0
    ) {
      toast.error("Select at least one category type, category, or product");
      return false;
    }

    if (!form.validUntil) {
      toast.error("Expiry date is required");
      return false;
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
        await axios.put(`${baseUrl}/coupons/${editingId}`, payload, {
          headers: getAuthHeaders(),
        });
        toast.success("Coupon updated");
      } else {
        await axios.post(`${baseUrl}/coupons`, payload, {
          headers: getAuthHeaders(),
        });
        toast.success("Coupon created");
      }

      resetForm();
      fetchCoupons();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save coupon");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (coupon) => {
    const nextTargetCategoryTypes = Array.isArray(coupon.targetCategoryTypes)
      ? coupon.targetCategoryTypes.filter(Boolean)
      : [];
    const nextTargetCategories = Array.isArray(coupon.targetCategories)
      ? coupon.targetCategories
          .map((entry) => entry?._id || entry)
          .filter(Boolean)
      : [];
    const nextTargetProducts = Array.isArray(coupon.targetProducts)
      ? coupon.targetProducts
          .map((entry) => entry?._id || entry)
          .filter(Boolean)
      : [];

    setEditingId(coupon._id);
    setForm({
      code: coupon.code || "",
      offerType: coupon.offerType || "discount",
      discountType: coupon.discountType || "percentage",
      discountValue: String(coupon.discountValue ?? ""),
      applicabilityMode: coupon.applicabilityMode || "global",
      targetCategoryTypes: nextTargetCategoryTypes,
      targetCategories: nextTargetCategories,
      targetProducts: nextTargetProducts,
      minPurchase: String(coupon.minPurchase ?? ""),
      maxDiscount:
        coupon.maxDiscount === null || coupon.maxDiscount === undefined
          ? ""
          : String(coupon.maxDiscount),
      validUntil: toDateInputValue(coupon.validUntil),
      usageLimit:
        coupon.usageLimit === null || coupon.usageLimit === undefined
          ? ""
          : String(coupon.usageLimit),
      isActive: Boolean(coupon.isActive),
      requiredProducts: Array.isArray(coupon.requiredProducts)
        ? coupon.requiredProducts
            .map((entry) => entry?._id || entry)
            .filter(Boolean)
        : [],
    });
    setCategoryNamesEnabled(
      nextTargetCategories.length > 0 || nextTargetProducts.length > 0,
    );
    setProductsEnabled(nextTargetProducts.length > 0);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id) return;

    try {
      setDeleting(true);
      await axios.delete(`${baseUrl}/coupons/${deleteTarget._id}`, {
        headers: getAuthHeaders(),
      });
      toast.success("Coupon deleted");
      setDeleteTarget(null);
      fetchCoupons();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete coupon");
    } finally {
      setDeleting(false);
    }
  };

  const getCouponTargetSummary = (coupon) => {
    if (
      String(coupon?.applicabilityMode || "global").toLowerCase() !== "targeted"
    ) {
      return "Applies to the full catalog";
    }

    const parts = [];
    if (
      Array.isArray(coupon?.targetCategoryTypes) &&
      coupon.targetCategoryTypes.length > 0
    ) {
      parts.push(`${coupon.targetCategoryTypes.length} category type(s)`);
    }
    if (
      Array.isArray(coupon?.targetCategories) &&
      coupon.targetCategories.length > 0
    ) {
      parts.push(`${coupon.targetCategories.length} category name(s)`);
    }
    if (
      Array.isArray(coupon?.targetProducts) &&
      coupon.targetProducts.length > 0
    ) {
      parts.push(`${coupon.targetProducts.length} product(s)`);
    }

    return parts.length > 0 ? parts.join(" | ") : "Targeted catalog selection";
  };

  const categoryTypeOptions = useMemo(() => {
    const dynamicTypes = categories
      .map((category) => String(category?.type || "General").trim())
      .filter(Boolean);
    return [...new Set([...CATEGORY_TYPE_OPTIONS, ...dynamicTypes])];
  }, [categories]);

  const filteredCategoryTypes = useMemo(() => {
    const needle = categoryTypeSearch.trim().toLowerCase();
    if (!needle) return categoryTypeOptions;
    return categoryTypeOptions.filter((option) =>
      option.toLowerCase().includes(needle),
    );
  }, [categoryTypeOptions, categoryTypeSearch]);

  const normalizedSelectedCategoryTypes = useMemo(
    () =>
      form.targetCategoryTypes.map((entry) =>
        String(entry || "")
          .trim()
          .toLowerCase(),
      ),
    [form.targetCategoryTypes],
  );

  const filteredCategories = useMemo(() => {
    const needle = categorySearch.trim().toLowerCase();
    return categories.filter((category) => {
      const categoryType = String(category?.type || "General")
        .trim()
        .toLowerCase();
      if (
        normalizedSelectedCategoryTypes.length > 0 &&
        !normalizedSelectedCategoryTypes.includes(categoryType)
      ) {
        return false;
      }
      const haystack =
        `${category?.name || ""} ${category?.type || ""}`.toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [categories, categorySearch, normalizedSelectedCategoryTypes]);

  const selectedCategoryIdSet = useMemo(
    () => new Set(form.targetCategories.map((entry) => String(entry || ""))),
    [form.targetCategories],
  );

  const filteredProducts = useMemo(() => {
    const needle = productSearch.trim().toLowerCase();
    if (form.targetCategories.length === 0) return [];

    return products.filter((product) => {
      const categoryId = resolveProductCategoryId(product);
      if (!selectedCategoryIdSet.has(categoryId)) {
        return false;
      }
      const haystack =
        `${product?.title || ""} ${product?.brand || ""} ${product?.category?.name || ""}`.toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [
    form.targetCategories.length,
    productSearch,
    products,
    selectedCategoryIdSet,
  ]);

  const filteredComboProducts = useMemo(() => {
    const needle = comboProductSearch.trim().toLowerCase();
    if (!needle) return products;

    return products.filter((product) => {
      const haystack =
        `${product?.title || ""} ${product?.brand || ""} ${product?.category?.name || ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [comboProductSearch, products]);

  const selectedCategories = useMemo(
    () =>
      form.targetCategories
        .map((id) =>
          categories.find(
            (category) => String(category?._id || "") === String(id),
          ),
        )
        .filter(Boolean),
    [categories, form.targetCategories],
  );

  const selectedProducts = useMemo(
    () =>
      form.targetProducts
        .map((id) =>
          products.find((product) => String(product?._id || "") === String(id)),
        )
        .filter(Boolean),
    [form.targetProducts, products],
  );

  const selectedComboProducts = useMemo(
    () =>
      form.requiredProducts
        .map((id) =>
          products.find((product) => String(product?._id || "") === String(id)),
        )
        .filter(Boolean),
    [form.requiredProducts, products],
  );

  useEffect(() => {
    if (form.applicabilityMode !== "targeted") {
      setCategoryNamesEnabled(false);
      setProductsEnabled(false);
      return;
    }

    if (form.targetCategoryTypes.length === 0) {
      setCategoryNamesEnabled(false);
      setProductsEnabled(false);
    }
  }, [form.applicabilityMode, form.targetCategoryTypes.length]);

  useEffect(() => {
    if (form.targetCategoryTypes.length === 0) {
      setForm((prev) => {
        if (
          prev.targetCategories.length === 0 &&
          prev.targetProducts.length === 0
        ) {
          return prev;
        }
        return {
          ...prev,
          targetCategories: [],
          targetProducts: [],
        };
      });
      return;
    }

    const allowedTypes = new Set(normalizedSelectedCategoryTypes);
    const allowedCategoryIds = new Set(
      categories
        .filter((category) =>
          allowedTypes.has(
            String(category?.type || "General")
              .trim()
              .toLowerCase(),
          ),
        )
        .map((category) => String(category?._id || "")),
    );

    setForm((prev) => {
      const nextCategories = prev.targetCategories.filter((entry) =>
        allowedCategoryIds.has(String(entry || "")),
      );
      const nextProducts = prev.targetProducts.filter((entry) => {
        const product = products.find(
          (productItem) =>
            String(productItem?._id || "") === String(entry || ""),
        );
        if (!product) return false;
        return allowedCategoryIds.has(resolveProductCategoryId(product));
      });

      if (
        nextCategories.length === prev.targetCategories.length &&
        nextProducts.length === prev.targetProducts.length
      ) {
        return prev;
      }

      return {
        ...prev,
        targetCategories: nextCategories,
        targetProducts: nextProducts,
      };
    });
  }, [
    categories,
    normalizedSelectedCategoryTypes,
    products,
    form.targetCategoryTypes.length,
  ]);

  useEffect(() => {
    if (form.targetCategories.length === 0) {
      setProductsEnabled(false);
      setForm((prev) => {
        if (prev.targetProducts.length === 0) return prev;
        return {
          ...prev,
          targetProducts: [],
        };
      });
      return;
    }

    const allowedCategoryIds = new Set(
      form.targetCategories.map((entry) => String(entry || "")),
    );
    setForm((prev) => {
      const nextProducts = prev.targetProducts.filter((entry) => {
        const product = products.find(
          (productItem) =>
            String(productItem?._id || "") === String(entry || ""),
        );
        if (!product) return false;
        return allowedCategoryIds.has(resolveProductCategoryId(product));
      });

      if (nextProducts.length === prev.targetProducts.length) {
        return prev;
      }

      return {
        ...prev,
        targetProducts: nextProducts,
      };
    });
  }, [form.targetCategories, products]);

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <h2 className="text-xl font-semibold text-black mb-2">
          Access Required
        </h2>
        <p className="text-gray-600">Only admin can manage coupons.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-8">
        <section className="space-y-6">
          <form onSubmit={handleSubmit} className={sectionClassName}>
            <div className="space-y-8">
              <section className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Coupon Setup
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Configure identity, discount behavior, and coverage mode.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={form.isActive}
                      onChange={handleInputChange}
                    />
                    Active
                  </label>
                </div>

                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  <label className="order-1">
                    <span className={labelClassName}>Code</span>
                    <input
                      name="code"
                      value={form.code}
                      onChange={handleInputChange}
                      placeholder="SUMMER24"
                      className={fieldClassName}
                    />
                  </label>

                  <label className="order-2">
                    <span className={labelClassName}>Offer Type</span>
                    <SearchableSelect
                      value={form.offerType}
                      onChange={(value) =>
                        handleInputChange({
                          target: { name: "offerType", value },
                        })
                      }
                      options={[
                        { value: "discount", label: "Discount Offer" },
                        {
                          value: "free_shipping",
                          label: "Free Delivery Offer",
                        },
                        { value: "combo", label: "Combo Offer" },
                      ]}
                      placeholder="Offer Type"
                      searchable={false}
                      portal
                      className="min-w-0"
                      buttonClassName={fieldClassName}
                      menuClassName="rounded-xl"
                    />
                  </label>

                  <label className="order-3 md:col-span-2 lg:col-span-3">
                    <span className={labelClassName}>Scope</span>
                    <SearchableSelect
                      value={form.applicabilityMode}
                      onChange={(value) =>
                        handleInputChange({
                          target: { name: "applicabilityMode", value },
                        })
                      }
                      options={[
                        { value: "global", label: "Global Coupon" },
                        { value: "targeted", label: "Targeted Coupon" },
                      ]}
                      placeholder="Scope"
                      searchable={false}
                      portal
                      className="min-w-0"
                      buttonClassName={fieldClassName}
                      menuClassName="rounded-xl"
                    />
                  </label>

                  <label className="order-5">
                    <span className={labelClassName}>Discount Type</span>
                    <SearchableSelect
                      value={form.discountType}
                      onChange={(value) =>
                        handleInputChange({
                          target: { name: "discountType", value },
                        })
                      }
                      options={[
                        { value: "percentage", label: "Percentage" },
                        { value: "fixed", label: "Fixed Value" },
                      ]}
                      placeholder="Discount Type"
                      searchable={false}
                      portal
                      className="min-w-0"
                      buttonClassName={fieldClassName}
                      menuClassName="rounded-xl"
                    />
                  </label>

                  <label className="order-6">
                    <span className={labelClassName}>Value</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="discountValue"
                      value={form.discountValue}
                      onChange={handleInputChange}
                      placeholder={
                        form.discountType === "percentage" ? "20" : "150"
                      }
                      className={fieldClassName}
                      disabled={form.offerType === "free_shipping"}
                    />
                  </label>

                  {form.applicabilityMode === "global" ? (
                    <div className="order-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2 lg:col-span-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Coupon Reach
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        Full catalog coverage
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        This coupon works across the complete storefront.
                      </p>
                    </div>
                  ) : null}

                  <label className="order-7">
                    <span className={labelClassName}>Minimum Purchase</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="minPurchase"
                      value={form.minPurchase}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className={fieldClassName}
                    />
                  </label>

                  <label className="order-8">
                    <span className={labelClassName}>Max Discount</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      name="maxDiscount"
                      value={form.maxDiscount}
                      onChange={handleInputChange}
                      placeholder="50.00"
                      className={fieldClassName}
                    />
                  </label>

                  <label className="order-9">
                    <span className={labelClassName}>Expiry Date</span>
                    <input
                      type="date"
                      name="validUntil"
                      value={form.validUntil}
                      onChange={handleInputChange}
                      className={fieldClassName}
                    />
                  </label>

                  <label className="order-10">
                    <span className={labelClassName}>Usage Limit</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      name="usageLimit"
                      value={form.usageLimit}
                      onChange={handleInputChange}
                      placeholder="500"
                      className={fieldClassName}
                    />
                  </label>

                  {form.applicabilityMode === "targeted" ? (
                    <div className="order-4 space-y-5 md:col-span-2 lg:col-span-3">
                      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-5 pb-5 pt-4 shadow-[0_18px_44px_rgba(8,23,68,0.04)] sm:px-6 sm:pb-6 sm:pt-5">
                        <div className="text-left">
                          <h2 className="text-lg font-semibold text-slate-950">
                            Target Catalog
                          </h2>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            Build the coupon chain step by step. Start from
                            category type, activate category names when needed,
                            then activate products under the chosen categories.
                          </p>
                        </div>
                        <div className="mt-4 space-y-4">
                          <SelectionPanel
                            title="Category Type"
                            description="Choose one or more catalog type groups."
                            items={filteredCategoryTypes}
                            selectedValues={form.targetCategoryTypes}
                            onToggle={(value) =>
                              toggleSelection("targetCategoryTypes", value)
                            }
                            onClear={() =>
                              setForm((prev) => ({
                                ...prev,
                                targetCategoryTypes: [],
                                targetCategories: [],
                                targetProducts: [],
                              }))
                            }
                            searchValue={categoryTypeSearch}
                            onSearchChange={setCategoryTypeSearch}
                            searchPlaceholder="Search category type"
                            emptyText="No category types found."
                            getKey={(item) => item}
                            renderContent={(item, checked) => (
                              <div className="min-w-0">
                                <p
                                  className={`truncate font-semibold ${
                                    checked ? "text-white" : "text-slate-950"
                                  }`}
                                >
                                  {item}
                                </p>
                                <p
                                  className={`mt-1 text-xs ${
                                    checked ? "text-slate-200" : "text-slate-500"
                                  }`}
                                >
                                  Catalog grouping
                                </p>
                              </div>
                            )}
                            selectedLabel="selected"
                            columnsClassName="grid-cols-1"
                          />

                          <div
                            className={`rounded-[22px] border bg-white p-4 transition ${
                              categoryNamesEnabled
                                ? "border-slate-950 shadow-[0_16px_36px_rgba(8,23,68,0.06)]"
                                : "border-slate-200"
                            }`}
                          >
                            <div className="flex flex-col items-start gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">
                                  Category Name Layer
                                </p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">
                                  After selecting category type, activate this
                                  layer to choose the matching category names
                                  only.
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={form.targetCategoryTypes.length === 0}
                                onClick={() => {
                                  setCategoryNamesEnabled((prev) => {
                                    const nextValue = !prev;
                                    if (!nextValue) {
                                      setProductsEnabled(false);
                                      setForm((current) => ({
                                        ...current,
                                        targetCategories: [],
                                        targetProducts: [],
                                      }));
                                    }
                                    return nextValue;
                                  });
                                }}
                                className={`${neutralInlineToggleClass(categoryNamesEnabled)} disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400`}
                              >
                                {categoryNamesEnabled
                                  ? "Category Names Active"
                                  : "Activate Category Names"}
                              </button>
                            </div>
                          </div>

                          {categoryNamesEnabled ? (
                            <SelectionPanel
                              title="Category Name"
                              description="Only names from the selected category type appear here."
                              items={filteredCategories}
                              selectedValues={form.targetCategories}
                              onToggle={(value) =>
                                toggleSelection("targetCategories", value)
                              }
                              onClear={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  targetCategories: [],
                                  targetProducts: [],
                                }))
                              }
                              searchValue={categorySearch}
                              onSearchChange={setCategorySearch}
                              searchPlaceholder="Search category name"
                              emptyText="Select a category type first to load category names."
                              getKey={(item) => String(item?._id || "")}
                              renderContent={(item, checked) => (
                                <div className="min-w-0">
                                  <p
                                    className={`truncate font-semibold ${
                                      checked ? "text-white" : "text-slate-950"
                                    }`}
                                  >
                                    {item?.name || "Unnamed category"}
                                  </p>
                                  <p
                                    className={`mt-1 text-xs ${
                                      checked ? "text-slate-200" : "text-slate-500"
                                    }`}
                                  >
                                    {item?.type || "General"}
                                  </p>
                                </div>
                              )}
                              selectedLabel="selected"
                              columnsClassName="grid-cols-1"
                            />
                          ) : null}

                          {categoryNamesEnabled ? (
                            <div
                              className={`rounded-[22px] border bg-white p-4 transition ${
                                productsEnabled
                                  ? "border-slate-950 shadow-[0_16px_36px_rgba(8,23,68,0.06)]"
                                  : "border-slate-200"
                              }`}
                            >
                              <div className="flex flex-col items-start gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">
                                    Product Layer
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                    Activate products when you want the coupon
                                    to focus on selected products from the
                                    chosen category names.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={form.targetCategories.length === 0}
                                  onClick={() => {
                                    setProductsEnabled((prev) => {
                                      const nextValue = !prev;
                                      if (!nextValue) {
                                        setForm((current) => ({
                                          ...current,
                                          targetProducts: [],
                                        }));
                                      }
                                      return nextValue;
                                    });
                                  }}
                                  className={`${neutralInlineToggleClass(productsEnabled)} disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400`}
                                >
                                  {productsEnabled
                                    ? "Products Active"
                                    : "Activate Products"}
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {productsEnabled ? (
                            <SelectionPanel
                              title="Products"
                              description="Only products from the selected category names appear here."
                              items={filteredProducts}
                              selectedValues={form.targetProducts}
                              onToggle={(value) =>
                                toggleSelection("targetProducts", value)
                              }
                              onClear={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  targetProducts: [],
                                }))
                              }
                              searchValue={productSearch}
                              onSearchChange={setProductSearch}
                              searchPlaceholder="Search products"
                              emptyText="Select category names first to load matching products."
                              getKey={(item) => String(item?._id || "")}
                              renderContent={(item, checked) => {
                                const imageUrl = toImageUrl(item?.images?.[0]);
                                return (
                                  <div className="flex min-w-0 items-start gap-3">
                                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                                      {imageUrl ? (
                                        <img
                                          src={imageUrl}
                                          alt={item?.title || "Product"}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                                          No Image
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p
                                        className={`truncate font-semibold ${
                                          checked ? "text-white" : "text-slate-950"
                                        }`}
                                      >
                                        {item?.title || "Untitled product"}
                                      </p>
                                      <p
                                        className={`mt-1 text-xs ${
                                          checked ? "text-slate-200" : "text-slate-500"
                                        }`}
                                      >
                                        {item?.brand ||
                                          item?.category?.name ||
                                          "Catalog product"}
                                      </p>
                                      <p
                                        className={`mt-2 text-sm font-semibold ${
                                          checked ? "text-white" : "text-slate-900"
                                        }`}
                                      >
                                        {formatMoney(item?.price)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              }}
                              selectedLabel="selected"
                              columnsClassName="grid-cols-1"
                            />
                          ) : null}

                          {(form.targetCategoryTypes.length > 0 ||
                            selectedCategories.length > 0 ||
                            selectedProducts.length > 0) && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="flex flex-wrap gap-2">
                                {form.targetCategoryTypes.map((entry) => (
                                  <button
                                    key={entry}
                                    type="button"
                                    onClick={() =>
                                      toggleSelection(
                                        "targetCategoryTypes",
                                        entry,
                                      )
                                    }
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-black"
                                  >
                                    <span>{entry}</span>
                                    <FiX className="h-3.5 w-3.5" />
                                  </button>
                                ))}
                                {selectedCategories.map((category) => (
                                  <button
                                    key={category._id}
                                    type="button"
                                    onClick={() =>
                                      toggleSelection(
                                        "targetCategories",
                                        String(category._id),
                                      )
                                    }
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-black"
                                  >
                                    <span>{category.name}</span>
                                    <FiX className="h-3.5 w-3.5" />
                                  </button>
                                ))}
                                {selectedProducts.map((product) => (
                                  <button
                                    key={product._id}
                                    type="button"
                                    onClick={() =>
                                      toggleSelection(
                                        "targetProducts",
                                        String(product._id),
                                      )
                                    }
                                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-black"
                                  >
                                    <span>{product.title}</span>
                                    <FiX className="h-3.5 w-3.5" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                {form.offerType === "combo" ? (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-950">
                        Combo Products
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Pick the products that must be present before the combo
                        coupon applies.
                      </p>
                    </div>

                    <SelectionPanel
                      title="Combo Product Selection"
                      description="Choose all required products."
                      items={filteredComboProducts}
                      selectedValues={form.requiredProducts}
                      onToggle={(value) =>
                        toggleSelection("requiredProducts", value)
                      }
                      onClear={() =>
                        setForm((prev) => ({ ...prev, requiredProducts: [] }))
                      }
                      searchValue={comboProductSearch}
                      onSearchChange={setComboProductSearch}
                      searchPlaceholder="Search combo products"
                      emptyText="No products found."
                      getKey={(item) => String(item?._id || "")}
                      renderContent={(item, checked) => {
                        const imageUrl = toImageUrl(item?.images?.[0]);
                        return (
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={item?.title || "Product"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                                  No Image
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p
                                className={`truncate font-semibold ${
                                  checked ? "text-white" : "text-slate-950"
                                }`}
                              >
                                {item?.title || "Untitled product"}
                              </p>
                              <p
                                className={`mt-1 text-xs ${
                                  checked ? "text-slate-200" : "text-slate-500"
                                }`}
                              >
                                {item?.brand ||
                                  item?.category?.name ||
                                  "Catalog product"}
                              </p>
                              <p
                                className={`mt-2 text-sm font-semibold ${
                                  checked ? "text-white" : "text-slate-900"
                                }`}
                              >
                                {formatMoney(item?.price)}
                              </p>
                            </div>
                          </div>
                        );
                      }}
                    />

                    {selectedComboProducts.length > 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap gap-2">
                          {selectedComboProducts.map((product) => (
                            <button
                              key={product._id}
                              type="button"
                              onClick={() =>
                                toggleSelection(
                                  "requiredProducts",
                                  String(product._id),
                                )
                              }
                              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-black"
                            >
                              <span>{product.title}</span>
                              <FiX className="h-3.5 w-3.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
                  <div className="flex flex-wrap items-center gap-3">
                    {editingId ? (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-black"
                      >
                        Cancel Edit
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-full bg-[var(--brand-theme-color)] px-6 py-3 text-sm font-bold text-[var(--brand-button-text-color)] shadow-[0_18px_32px_var(--brand-theme-shadow)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? "Saving..."
                        : editingId
                          ? "Update Coupon"
                          : "Create Coupon"}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Coupons ({coupons.length})
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review active coupon entries, targets, and lifecycle status.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchCoupons}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-black"
            >
              <FiRefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className={`${sectionClassName} text-sm text-slate-500`}>
              Loading coupons...
            </div>
          ) : coupons.length === 0 ? (
            <div className={sectionClassName}>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-10 text-center">
                <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-white text-slate-900 shadow-sm">
                  <FiTag className="h-10 w-10 opacity-25" />
                </div>
                <h3 className="text-2xl font-bold text-slate-950">
                  No Active Coupons
                </h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-500">
                  Create your first coupon above and bring targeted offers into
                  the storefront.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {coupons.map((coupon) => {
                const isActive = Boolean(coupon?.isActive);
                const isTargeted =
                  String(
                    coupon?.applicabilityMode || "global",
                  ).toLowerCase() === "targeted";

                return (
                  <div key={coupon._id} className={sectionClassName}>
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-white">
                              {coupon.code}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {isActive ? "Active" : "Inactive"}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {isTargeted ? "Targeted" : "Global"}
                            </span>
                          </div>

                          <p className="mt-3 text-sm text-slate-600">
                            {(coupon.offerType || "discount") ===
                            "free_shipping"
                              ? "Free delivery offer"
                              : coupon.discountType === "percentage"
                                ? `${coupon.discountValue}% discount`
                                : `${coupon.discountValue} Tk discount`}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(coupon)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-black"
                          >
                            <FiEdit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(coupon)}
                            className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300"
                          >
                            <FiTrash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Restrictions
                          </p>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            <div className="flex items-center justify-between gap-3">
                              <span>Minimum purchase</span>
                              <strong className="text-slate-950">
                                {formatMoney(coupon.minPurchase || 0)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Max discount</span>
                              <strong className="text-slate-950">
                                {coupon.maxDiscount === null ||
                                coupon.maxDiscount === undefined
                                  ? "No limit"
                                  : formatMoney(coupon.maxDiscount)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Usage</span>
                              <strong className="text-slate-950">
                                {coupon.usedCount || 0}
                                {coupon.usageLimit
                                  ? ` / ${coupon.usageLimit}`
                                  : ""}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                            Coverage
                          </p>
                          <div className="mt-3 space-y-2 text-sm text-slate-700">
                            <div className="flex items-center justify-between gap-3">
                              <span>Applies to</span>
                              <strong className="text-right text-slate-950">
                                {getCouponTargetSummary(coupon)}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Expires</span>
                              <strong className="text-slate-950">
                                {toDateInputValue(coupon.validUntil) || "N/A"}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span>Offer mode</span>
                              <strong className="text-slate-950">
                                {coupon.offerType === "combo"
                                  ? "Combo"
                                  : coupon.offerType === "free_shipping"
                                    ? "Free delivery"
                                    : "Discount"}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      {coupon.offerType === "combo" ? (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                          Combo products:{" "}
                          <span className="font-semibold text-slate-950">
                            {Array.isArray(coupon.requiredProducts)
                              ? coupon.requiredProducts.length
                              : 0}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete coupon"
        message={
          deleteTarget?.code
            ? `Delete coupon ${deleteTarget.code}?`
            : "Delete this coupon?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDanger
        isLoading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default AdminCoupons;
