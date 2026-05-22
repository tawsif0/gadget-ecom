import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import {
  FiCheck,
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiGlobe,
  FiSave,
  FiSearch,
  FiSettings,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import axios from "axios";
import ConfirmModal from "../components/ConfirmModal";
import { useAuth } from "../hooks/useAuth";
import { useThemeColors } from "../hooks/useThemeColors";
import {
  loadAdminSettings,
  loadPublicSettings,
  saveAdminSettings,
  selectAdminSettingsDraft,
  selectPublicSettingsState,
} from "../store/publicSettingsSlice";
import {
  buildEntryTargets,
  createMarketingEntryId,
  formatEntryTargets,
  getFallbackRobotsUrl,
  getFallbackSitemapUrl,
  getPageTargetOptions,
  normalizeMarketingEntry,
} from "../utils/marketingProfiles";

const baseUrl = import.meta.env.VITE_API_URL;

const sectionClass = "app-panel space-y-4 p-5 md:p-6";
const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-black";
const textareaClass = `${inputClass} min-h-[104px] resize-y`;
const labelClass =
  "mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500";

const TYPE_TABS = [
  {
    id: "seo",
    label: "SEO",
    description: "Create metadata cards for global or selected pages.",
  },
  {
    id: "facebook",
    label: "Facebook Pixel",
    description: "Create one or many Meta Pixel cards with data layer support.",
  },
  {
    id: "analytics",
    label: "Google Analytics",
    description: "Create separate GA4, legacy GA, or GTM tracking cards.",
  },
  {
    id: "custom",
    label: "Custom",
    description:
      "Save custom header scripts as reusable cards for selected storefront targets.",
  },
];

const SCOPE_TABS = [
  {
    id: "global",
    label: "Global",
    description: "Applies across the storefront, including product pages.",
  },
  {
    id: "page",
    label: "Page Based",
    description: "Apply a card to selected pages, selected products, or both.",
  },
];

const SEO_ANALYTICS_STORAGE_KEY = "seoAnalyticsActivePanel";

const isValidTypeTab = (value) =>
  TYPE_TABS.some((tab) => String(tab.id) === String(value || ""));

const isValidScopeTab = (value) =>
  SCOPE_TABS.some((tab) => String(tab.id) === String(value || ""));

const getStoredSeoAnalyticsPanel = () => {
  if (typeof window === "undefined") {
    return {
      activeType: "seo",
      activeScope: "global",
    };
  }

  try {
    const stored = JSON.parse(
      window.localStorage.getItem(SEO_ANALYTICS_STORAGE_KEY) || "{}",
    );

    return {
      activeType: isValidTypeTab(stored?.activeType)
        ? stored.activeType
        : "seo",
      activeScope: isValidScopeTab(stored?.activeScope)
        ? stored.activeScope
        : "global",
    };
  } catch {
    return {
      activeType: "seo",
      activeScope: "global",
    };
  }
};

const createSeoForm = () => ({
  name: "",
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
  openGraphImage: "",
});

const createFacebookForm = () => ({
  name: "",
  facebookPixelId: "",
  enableDataLayer: true,
});

const createAnalyticsForm = () => ({
  name: "",
  ga4MeasurementId: "",
  googleAnalyticsId: "",
  gtmId: "",
});

const createCustomForm = () => ({
  name: "",
  customTrackingCode: "",
});

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const normalizeSiteUrl = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const getCurrentOrigin = () =>
  typeof window !== "undefined"
    ? String(window.location.origin || "")
        .trim()
        .replace(/\/+$/, "")
    : "";

const normalizeProductOption = (product = {}) => {
  const productId = String(product?._id || product?.productId || "").trim();
  const productName = String(
    product?.title || product?.name || product?.productName || "",
  ).trim();
  const categoryName = String(
    product?.category?.name || product?.categoryName || "",
  ).trim();
  const productType = String(product?.productType || "").trim();
  const vendorName = String(
    product?.vendor?.storeName || product?.vendorName || "",
  ).trim();

  return {
    productId,
    productName: productName || "Untitled Product",
    categoryName,
    productType,
    vendorName,
    searchValue: [productId, productName, categoryName, productType, vendorName]
      .join(" ")
      .toLowerCase(),
  };
};

const hasSeoValues = (entry = {}) =>
  Boolean(
    String(entry.metaTitle || "").trim() ||
    String(entry.metaDescription || "").trim() ||
    String(entry.metaKeywords || "").trim() ||
    String(entry.openGraphImage || "").trim(),
  );

const hasAnalyticsValues = (entry = {}) =>
  Boolean(
    String(entry.ga4MeasurementId || "").trim() ||
    String(entry.googleAnalyticsId || "").trim() ||
    String(entry.gtmId || "").trim(),
  );

const hasCustomValues = (entry = {}) =>
  Boolean(String(entry.customTrackingCode || "").trim());

const truncateText = (value, limit = 140) => {
  const normalized = String(value || "").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
};

const sortEntries = (entries = []) =>
  [...entries].sort((left, right) => {
    const rightDate = Date.parse(right.updatedAt || right.createdAt || 0) || 0;
    const leftDate = Date.parse(left.updatedAt || left.createdAt || 0) || 0;
    if (rightDate !== leftDate) return rightDate - leftDate;
    return String(left.name || "").localeCompare(String(right.name || ""));
  });

const ModuleSeoAnalytics = () => {
  const dispatch = useDispatch();
  const { themeColor } = useThemeColors();
  const { user } = useAuth();
  const settings = useSelector(selectAdminSettingsDraft);
  const { adminStatus, saveStatus } = useSelector(selectPublicSettingsState);
  const loading = adminStatus === "idle" || adminStatus === "loading";
  const saving = saveStatus === "loading";
  const isAdmin = useMemo(
    () => String(user?.userType || "").toLowerCase() === "admin",
    [user?.userType],
  );

  const [activeType, setActiveType] = useState(
    () => getStoredSeoAnalyticsPanel().activeType,
  );
  const [activeScope, setActiveScope] = useState(
    () => getStoredSeoAnalyticsPanel().activeScope,
  );
  const [editingEntryId, setEditingEntryId] = useState("");
  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [selectedPageKeys, setSelectedPageKeys] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [seoForm, setSeoForm] = useState(createSeoForm());
  const [facebookForm, setFacebookForm] = useState(createFacebookForm());
  const [analyticsForm, setAnalyticsForm] = useState(createAnalyticsForm());
  const [customForm, setCustomForm] = useState(createCustomForm());

  useEffect(() => {
    if (!isAdmin) return;

    dispatch(loadAdminSettings())
      .unwrap()
      .catch((message) => {
        toast.error(message || "Failed to load SEO settings");
      });
  }, [dispatch, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        const response = await axios.get(`${baseUrl}/products`, {
          headers: getAuthHeaders(),
        });
        setAllProducts(
          Array.isArray(response.data?.products) ? response.data.products : [],
        );
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to load products");
        setAllProducts([]);
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, [isAdmin]);

  useEffect(() => {
    const nextSiteUrl =
      normalizeSiteUrl(
        settings?.website?.siteUrl || settings?.website?.storeUrl || "",
      ) || getCurrentOrigin();

    setSiteUrlInput((current) => current || nextSiteUrl);
  }, [settings?.website?.siteUrl, settings?.website?.storeUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        SEO_ANALYTICS_STORAGE_KEY,
        JSON.stringify({
          activeType,
          activeScope,
        }),
      );
    } catch {
      // ignore storage errors
    }
  }, [activeScope, activeType]);

  const pageTargetOptions = useMemo(
    () => getPageTargetOptions({ includeHidden: true }),
    [],
  );

  const normalizedEntries = useMemo(
    () =>
      sortEntries(
        Array.isArray(settings?.seoAnalytics?.entries)
          ? settings.seoAnalytics.entries.map((entry, index) =>
              normalizeMarketingEntry(entry, index),
            )
          : [],
      ),
    [settings?.seoAnalytics?.entries],
  );

  const visibleEntries = useMemo(
    () => normalizedEntries.filter((entry) => entry.type === activeType),
    [activeType, normalizedEntries],
  );

  const productOptions = useMemo(
    () =>
      allProducts
        .map((product) => normalizeProductOption(product))
        .filter((product) => product.productId),
    [allProducts],
  );

  const productMap = useMemo(
    () =>
      new Map(productOptions.map((product) => [product.productId, product])),
    [productOptions],
  );

  const filteredProducts = useMemo(() => {
    const query = String(productSearchQuery || "")
      .trim()
      .toLowerCase();
    return productOptions
      .filter((product) => !query || product.searchValue.includes(query))
      .sort((left, right) =>
        String(left.productName || "").localeCompare(
          String(right.productName || ""),
        ),
      );
  }, [productOptions, productSearchQuery]);

  const selectedProductEntries = useMemo(
    () =>
      selectedProductIds
        .map((productId) => productMap.get(productId))
        .filter(Boolean),
    [productMap, selectedProductIds],
  );

  const resolvedSiteUrl = normalizeSiteUrl(siteUrlInput) || getCurrentOrigin();
  const sitemapUrl =
    settings?.seoAnalytics?.sitemap?.publicSitemapUrl ||
    getFallbackSitemapUrl();
  const robotsUrl =
    settings?.seoAnalytics?.sitemap?.publicRobotsUrl ||
    getFallbackRobotsUrl(
      resolvedSiteUrl ||
        settings?.website?.siteUrl ||
        settings?.website?.storeUrl ||
        getCurrentOrigin(),
    );

  const resetEditor = () => {
    setEditingEntryId("");
    setSelectedPageKeys([]);
    setSelectedProductIds([]);
    setProductSearchQuery("");
    setSeoForm(createSeoForm());
    setFacebookForm(createFacebookForm());
    setAnalyticsForm(createAnalyticsForm());
    setCustomForm(createCustomForm());
  };

  const togglePageKey = (pageKey) => {
    const normalizedKey = String(pageKey || "").trim();
    if (!normalizedKey) return;
    setSelectedPageKeys((current) =>
      current.includes(normalizedKey)
        ? current.filter((entry) => entry !== normalizedKey)
        : [...current, normalizedKey],
    );
  };

  const toggleProductId = (productId) => {
    const normalizedId = String(productId || "").trim();
    if (!normalizedId) return;
    setSelectedProductIds((current) =>
      current.includes(normalizedId)
        ? current.filter((entry) => entry !== normalizedId)
        : [...current, normalizedId],
    );
  };

  const startEditingEntry = (entry) => {
    const normalizedEntry = normalizeMarketingEntry(entry);
    setEditingEntryId(normalizedEntry.id);
    setActiveType(normalizedEntry.type);
    setActiveScope(normalizedEntry.scope);
    setSelectedPageKeys(
      (normalizedEntry.targets || [])
        .filter((target) => target.kind === "page")
        .map((target) => target.key),
    );
    setSelectedProductIds(
      (normalizedEntry.targets || [])
        .filter((target) => target.kind === "product")
        .map((target) => target.key),
    );
    setSeoForm({
      name: normalizedEntry.name || "",
      metaTitle: normalizedEntry.metaTitle || "",
      metaDescription: normalizedEntry.metaDescription || "",
      metaKeywords: normalizedEntry.metaKeywords || "",
      openGraphImage: normalizedEntry.openGraphImage || "",
    });
    setFacebookForm({
      name: normalizedEntry.name || "",
      facebookPixelId: normalizedEntry.facebookPixelId || "",
      enableDataLayer: normalizedEntry.enableDataLayer !== false,
    });
    setAnalyticsForm({
      name: normalizedEntry.name || "",
      ga4MeasurementId: normalizedEntry.ga4MeasurementId || "",
      googleAnalyticsId: normalizedEntry.googleAnalyticsId || "",
      gtmId: normalizedEntry.gtmId || "",
    });
    setCustomForm({
      name: normalizedEntry.name || "",
      customTrackingCode: normalizedEntry.customTrackingCode || "",
    });
  };

  const persistEntries = async (nextEntries, successMessage) => {
    const now = new Date().toISOString();
    const payload = {
      website: {
        ...(settings?.website || {}),
        siteUrl: resolvedSiteUrl,
        storeUrl: resolvedSiteUrl,
      },
      seoAnalytics: {
        ...(settings?.seoAnalytics || {}),
        entries: nextEntries.map((entry, index) =>
          normalizeMarketingEntry(entry, index),
        ),
        sitemap: {
          ...(settings?.seoAnalytics?.sitemap || {}),
          autoIntegrate: true,
          lastGeneratedAt: now,
        },
      },
    };

    const result = await dispatch(saveAdminSettings(payload)).unwrap();
    toast.success(result?.message || successMessage);
    dispatch(loadPublicSettings({ force: true }));
  };

  const handleSaveCurrentCard = async (event) => {
    event.preventDefault();

    const now = new Date().toISOString();
    const existingEntry = normalizedEntries.find(
      (entry) => entry.id === editingEntryId,
    );
    const targets =
      activeScope === "global"
        ? []
        : buildEntryTargets({
            pageKeys: selectedPageKeys,
            products: selectedProductEntries,
          });

    if (activeScope === "page" && targets.length === 0) {
      toast.error("Select at least one page or product first");
      return;
    }

    let nextEntry = {
      id: editingEntryId || createMarketingEntryId(activeType),
      type: activeType,
      scope: activeScope,
      targets,
      createdAt: existingEntry?.createdAt || now,
      updatedAt: now,
    };

    if (activeType === "seo") {
      if (!hasSeoValues(seoForm)) {
        toast.error("Add at least one SEO value before saving");
        return;
      }

      nextEntry = {
        ...nextEntry,
        name: String(seoForm.name || "").trim() || "SEO Card",
        metaTitle: String(seoForm.metaTitle || "").trim(),
        metaDescription: String(seoForm.metaDescription || "").trim(),
        metaKeywords: String(seoForm.metaKeywords || "").trim(),
        openGraphImage: String(seoForm.openGraphImage || "").trim(),
      };
    }

    if (activeType === "facebook") {
      if (!String(facebookForm.facebookPixelId || "").trim()) {
        toast.error("Facebook Pixel ID is required");
        return;
      }

      nextEntry = {
        ...nextEntry,
        name: String(facebookForm.name || "").trim() || "Facebook Pixel Card",
        facebookPixelId: String(facebookForm.facebookPixelId || "").trim(),
        enableDataLayer: Boolean(facebookForm.enableDataLayer),
      };
    }

    if (activeType === "analytics") {
      if (!hasAnalyticsValues(analyticsForm)) {
        toast.error("Add a GA4 ID, legacy GA ID, or GTM ID before saving");
        return;
      }

      nextEntry = {
        ...nextEntry,
        name:
          String(analyticsForm.name || "").trim() || "Google Analytics Card",
        ga4MeasurementId: String(analyticsForm.ga4MeasurementId || "").trim(),
        googleAnalyticsId: String(analyticsForm.googleAnalyticsId || "").trim(),
        gtmId: String(analyticsForm.gtmId || "").trim(),
      };
    }

    if (activeType === "custom") {
      if (!hasCustomValues(customForm)) {
        toast.error("Add a custom script before saving");
        return;
      }

      nextEntry = {
        ...nextEntry,
        name: String(customForm.name || "").trim() || "Custom Script Card",
        customTrackingCode: String(customForm.customTrackingCode || "").trim(),
      };
    }

    try {
      const nextEntries = sortEntries(
        [
          ...normalizedEntries.filter((entry) => entry.id !== nextEntry.id),
          nextEntry,
        ].map((entry, index) => normalizeMarketingEntry(entry, index)),
      );

      await persistEntries(
        nextEntries,
        editingEntryId
          ? "Card updated successfully"
          : "Card created successfully",
      );
      resetEditor();
    } catch (error) {
      toast.error(error || "Failed to save settings");
    }
  };

  const handleDeleteEntry = (entry) => {
    setDeleteTarget(normalizeMarketingEntry(entry));
  };

  const confirmDeleteEntry = async () => {
    if (!deleteTarget?.id) return;

    try {
      setDeleting(true);
      const nextEntries = normalizedEntries.filter(
        (entry) => entry.id !== deleteTarget.id,
      );
      await persistEntries(nextEntries, "Card deleted successfully");
      if (editingEntryId === deleteTarget.id) {
        resetEditor();
      }
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error || "Failed to delete card");
    } finally {
      setDeleting(false);
    }
  };

  const handleDownloadSitemap = async () => {
    try {
      const response = await axios.get(sitemapUrl, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/xml" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "sitemap.xml";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success("Sitemap downloaded");
    } catch (_error) {
      toast.error("Failed to download sitemap");
    }
  };

  const saveAutomationSettings = async () => {
    try {
      const payload = {
        website: {
          ...(settings?.website || {}),
          siteUrl: resolvedSiteUrl,
          storeUrl: resolvedSiteUrl,
        },
        seoAnalytics: {
          ...(settings?.seoAnalytics || {}),
          sitemap: {
            ...(settings?.seoAnalytics?.sitemap || {}),
            autoIntegrate: true,
            lastGeneratedAt: new Date().toISOString(),
          },
        },
      };
      const result = await dispatch(saveAdminSettings(payload)).unwrap();
      toast.success(result?.message || "Sitemap settings saved");
      dispatch(loadPublicSettings({ force: true }));
    } catch (error) {
      toast.error(error || "Failed to save sitemap settings");
    }
  };

  const currentTypeLabel =
    TYPE_TABS.find((tab) => tab.id === activeType)?.label || "Card";

  if (!isAdmin) {
    return (
      <div className="app-panel p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold text-black">
          Admin Access Required
        </h2>
        <p className="text-gray-600">
          Only admin users can manage SEO and analytics settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="app-hero p-6 md:p-8">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
          <FiGlobe className="h-6 w-6" />
        </div>
        <p className="app-kicker text-white/65!">Site configuration</p>
        <h1 className="mt-3 text-2xl font-black md:text-3xl">
          SEO and Tracking
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-200 md:text-base">
          Build separate global or page-based cards for SEO, Facebook Pixel, and
          Google Analytics. Page-based cards can target multiple pages, multiple
          products, or both in the same save.
        </p>
      </div>

      {loading ? (
        <div className="app-panel-soft p-6">
          <p className="text-gray-600">Loading SEO settings...</p>
        </div>
      ) : (
        <div className="app-container space-y-5">
          <section className={sectionClass}>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Sitemap Automation
                </p>
                <h2 className="mt-2 text-lg font-semibold text-black">
                  Sitemap is now auto-integrated
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Save your SEO card once, keep your website URL here, and the
                  project will expose a live sitemap plus a robots file so
                  search engines can discover it automatically.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    window.open(sitemapUrl, "_blank", "noopener,noreferrer")
                  }
                  className="app-btn-secondary inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold"
                >
                  <FiExternalLink className="h-4 w-4" />
                  Open Sitemap
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSitemap}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:border-black"
                >
                  <FiDownload className="h-4 w-4" />
                  Download Sitemap
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div>
                <label className={labelClass}>Website URL</label>
                <input
                  type="url"
                  value={siteUrlInput}
                  onChange={(event) => setSiteUrlInput(event.target.value)}
                  placeholder="https://your-store.com"
                  className={inputClass}
                />
                <p className="mt-2 text-xs text-gray-500">
                  This URL is used for canonical sitemap links and the public
                  `robots.txt` file.
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Public URLs
                  </p>
                  <p className="mt-2 text-sm font-semibold text-black">
                    Live sitemap and robots endpoints
                  </p>
                </div>
                <div className="space-y-2 text-xs text-gray-600">
                  <p className="break-all">
                    <span className="font-semibold text-black">Sitemap:</span>{" "}
                    {sitemapUrl || "Not available"}
                  </p>
                  <p className="break-all">
                    <span className="font-semibold text-black">Robots:</span>{" "}
                    {robotsUrl || "Not available"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={saveAutomationSettings}
                  disabled={saving}
                  className="app-btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
                >
                  <FiSave className="h-4 w-4" />
                  Save Sitemap Settings
                </button>
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Configuration Type
              </p>
              <h2 className="text-lg font-semibold text-black">
                Choose the card type you want to manage
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {TYPE_TABS.map((tab) => {
                const isActive = activeType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveType(tab.id);
                      setEditingEntryId("");
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? "border-black bg-white shadow-[0_18px_32px_rgba(15,23,42,0.08)]"
                        : "border-gray-200 bg-gray-50 hover:border-black/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-black">
                        {tab.label}
                      </p>
                      {isActive ? (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
                          <FiCheck className="h-4 w-4" />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      {tab.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 border-t border-gray-200 pt-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Scope
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Global cards cover the whole storefront, including cart and
                  checkout. Page-based cards let you target selected pages and
                  selected products together.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {SCOPE_TABS.map((tab) => {
                  const isActive = activeScope === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveScope(tab.id);
                        setEditingEntryId("");
                        if (tab.id === "global") {
                          setSelectedPageKeys([]);
                          setSelectedProductIds([]);
                        }
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        isActive
                          ? "border-black bg-white shadow-sm"
                          : "border-gray-200 bg-gray-50 hover:border-black/30"
                      }`}
                    >
                      <p className="text-sm font-semibold text-black">
                        {tab.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        {tab.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {activeScope === "page" ? (
            <section className={sectionClass}>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Page Based Targets
                </p>
                <h2 className="text-lg font-semibold text-black">
                  Select pages and products
                </h2>
                <p className="text-sm text-gray-600">
                  The next {currentTypeLabel.toLowerCase()} card will apply to
                  every page and product you choose below.
                </p>
              </div>

              <div className="space-y-3">
                <label className={labelClass}>Pages</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {pageTargetOptions.map((page) => {
                    const selected = selectedPageKeys.includes(page.key);
                    return (
                      <button
                        key={page.key}
                        type="button"
                        onClick={() => togglePageKey(page.key)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          selected
                            ? "border-black bg-black text-white"
                            : "border-gray-200 bg-white hover:border-black/40"
                        }`}
                      >
                        <p className="text-sm font-semibold">{page.label}</p>
                        <p
                          className={`mt-1 text-xs ${
                            selected ? "text-white/70" : "text-gray-500"
                          }`}
                        >
                          {page.key === "productDetails"
                            ? "Applies to every product detail page."
                            : `Target the ${page.label.toLowerCase()} page.`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <label className={labelClass}>Products</label>
                <div className="relative">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(event) =>
                      setProductSearchQuery(event.target.value)
                    }
                    placeholder="Search products by name, category, type, or ID"
                    className={`${inputClass} pl-10`}
                  />
                </div>

                <div className="max-h-72 overflow-y-auto rounded-2xl border border-gray-200 bg-white">
                  {productsLoading ? (
                    <div className="p-4 text-sm text-gray-500">
                      Loading products...
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">
                      No matching products found.
                    </div>
                  ) : (
                    filteredProducts.map((product) => {
                      const selected = selectedProductIds.includes(
                        product.productId,
                      );
                      const metaLine = [
                        product.categoryName,
                        product.productType,
                        product.vendorName,
                      ]
                        .filter(Boolean)
                        .join(" | ");

                      return (
                        <button
                          key={product.productId}
                          type="button"
                          onClick={() => toggleProductId(product.productId)}
                          className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 ${
                            selected ? "bg-black/[0.03]" : "hover:bg-gray-50"
                          }`}
                        >
                          <span
                            className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              selected
                                ? "border-black bg-black text-white"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {selected ? (
                              <FiCheck className="h-3.5 w-3.5" />
                            ) : null}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-black">
                              {product.productName}
                            </span>
                            <span className="mt-1 block truncate text-xs text-gray-500">
                              {metaLine || `ID: ${product.productId}`}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedPageKeys.length > 0 ||
              selectedProductEntries.length > 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-black">
                        Current Selection
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Your next card will be saved to every target shown here.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPageKeys([]);
                        setSelectedProductIds([]);
                      }}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-black"
                    >
                      Clear Targets
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedPageKeys.map((pageKey) => {
                      const page = pageTargetOptions.find(
                        (entry) => entry.key === pageKey,
                      );
                      return (
                        <button
                          key={pageKey}
                          type="button"
                          onClick={() => togglePageKey(pageKey)}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-black"
                        >
                          <span>{page?.label || pageKey}</span>
                          <FiX className="h-3.5 w-3.5" />
                        </button>
                      );
                    })}
                    {selectedProductEntries.map((product) => (
                      <button
                        key={product.productId}
                        type="button"
                        onClick={() => toggleProductId(product.productId)}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-black"
                      >
                        <span>{product.productName}</span>
                        <FiX className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <section className={sectionClass}>
              <p className="text-sm text-gray-600">
                Global cards automatically apply to Home, Shop, About, Contact,
                FAQ, Cart, Checkout, product pages, and the rest of the
                storefront.
              </p>
              <div className="flex flex-wrap gap-2">
                {pageTargetOptions.map((page) => (
                  <span
                    key={page.key}
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700"
                  >
                    {page.label}
                  </span>
                ))}
              </div>
            </section>
          )}

          <form onSubmit={handleSaveCurrentCard} className="space-y-5">
            {activeType === "seo" ? (
              <section className={sectionClass}>
                <div className="space-y-2 border-b border-gray-200 pb-4">
                  <h2 className="text-lg font-semibold text-black">SEO Card</h2>
                  <p className="text-sm text-gray-600">
                    Save a reusable SEO card for the selected scope. You can use
                    placeholders like `{"{storeName}"}`, `{"{pageName}"}`, and
                    on product pages also `{"{productName}"}` and `
                    {"{productCategory}"}`.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Card Name</label>
                    <input
                      type="text"
                      value={seoForm.name}
                      onChange={(event) =>
                        setSeoForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Homepage SEO"
                      className={inputClass}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelClass}>Meta Title</label>
                    <input
                      type="text"
                      value={seoForm.metaTitle}
                      onChange={(event) =>
                        setSeoForm((current) => ({
                          ...current,
                          metaTitle: event.target.value,
                        }))
                      }
                      placeholder="Buy from {storeName}"
                      className={inputClass}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className={labelClass}>Meta Description</label>
                    <textarea
                      value={seoForm.metaDescription}
                      onChange={(event) =>
                        setSeoForm((current) => ({
                          ...current,
                          metaDescription: event.target.value,
                        }))
                      }
                      placeholder="Write the search description for these targets."
                      className={textareaClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Meta Keywords</label>
                    <input
                      type="text"
                      value={seoForm.metaKeywords}
                      onChange={(event) =>
                        setSeoForm((current) => ({
                          ...current,
                          metaKeywords: event.target.value,
                        }))
                      }
                      placeholder="ecommerce, shop, products"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Open Graph Image URL</label>
                    <input
                      type="url"
                      value={seoForm.openGraphImage}
                      onChange={(event) =>
                        setSeoForm((current) => ({
                          ...current,
                          openGraphImage: event.target.value,
                        }))
                      }
                      placeholder="https://example.com/share-image.jpg"
                      className={inputClass}
                    />
                  </div>
                </div>
              </section>
            ) : null}

            {activeType === "facebook" ? (
              <section className={sectionClass}>
                <div className="space-y-2 border-b border-gray-200 pb-4">
                  <h2 className="text-lg font-semibold text-black">
                    Facebook Pixel Card
                  </h2>
                  <p className="text-sm text-gray-600">
                    Create multiple Meta Pixel cards and enable data layer
                    support per card so storefront events are easier to inspect.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Card Name</label>
                    <input
                      type="text"
                      value={facebookForm.name}
                      onChange={(event) =>
                        setFacebookForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Primary Meta Pixel"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Facebook Pixel ID</label>
                    <input
                      type="text"
                      value={facebookForm.facebookPixelId}
                      onChange={(event) =>
                        setFacebookForm((current) => ({
                          ...current,
                          facebookPixelId: event.target.value,
                        }))
                      }
                      placeholder="123456789012345"
                      className={inputClass}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={facebookForm.enableDataLayer}
                        onChange={(event) =>
                          setFacebookForm((current) => ({
                            ...current,
                            enableDataLayer: event.target.checked,
                          }))
                        }
                      />
                      Enable data layer for this pixel card
                    </label>
                  </div>
                </div>
              </section>
            ) : null}

            {activeType === "analytics" ? (
              <section className={sectionClass}>
                <div className="space-y-2 border-b border-gray-200 pb-4">
                  <h2 className="text-lg font-semibold text-black">
                    Google Analytics Card
                  </h2>
                  <p className="text-sm text-gray-600">
                    Keep Google Analytics separate from Facebook Pixel. You can
                    create multiple analytics cards with GA4, legacy UA, or GTM.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Card Name</label>
                    <input
                      type="text"
                      value={analyticsForm.name}
                      onChange={(event) =>
                        setAnalyticsForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="GA4 Main Property"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>GA4 Measurement ID</label>
                    <input
                      type="text"
                      value={analyticsForm.ga4MeasurementId}
                      onChange={(event) =>
                        setAnalyticsForm((current) => ({
                          ...current,
                          ga4MeasurementId: event.target.value,
                        }))
                      }
                      placeholder="G-XXXXXXXXXX"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>
                      Legacy Google Analytics ID
                    </label>
                    <input
                      type="text"
                      value={analyticsForm.googleAnalyticsId}
                      onChange={(event) =>
                        setAnalyticsForm((current) => ({
                          ...current,
                          googleAnalyticsId: event.target.value,
                        }))
                      }
                      placeholder="UA-XXXXXXXXX-X"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Google Tag Manager ID</label>
                    <input
                      type="text"
                      value={analyticsForm.gtmId}
                      onChange={(event) =>
                        setAnalyticsForm((current) => ({
                          ...current,
                          gtmId: event.target.value,
                        }))
                      }
                      placeholder="GTM-XXXXXXX"
                      className={inputClass}
                    />
                  </div>
                </div>
              </section>
            ) : null}

            {activeType === "custom" ? (
              <section className={sectionClass}>
                <div className="space-y-2 border-b border-gray-200 pb-4">
                  <h2 className="text-lg font-semibold text-black">
                    Custom Script Card
                  </h2>
                  <p className="text-sm text-gray-600">
                    Save reusable custom scripts that should be injected into
                    the document head for the selected storefront targets.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className={labelClass}>Card Name</label>
                    <input
                      type="text"
                      value={customForm.name}
                      onChange={(event) =>
                        setCustomForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Custom Header Script"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Custom Script</label>
                    <textarea
                      value={customForm.customTrackingCode}
                      onChange={(event) =>
                        setCustomForm((current) => ({
                          ...current,
                          customTrackingCode: event.target.value,
                        }))
                      }
                      placeholder="<script>console.log('custom script');</script>"
                      className={`${textareaClass} min-h-[220px] font-mono text-xs`}
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      The script is sanitized and injected into the page header
                      for matching routes.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            <div className="app-panel flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-end">
              <div className="flex flex-wrap gap-3">
                {(editingEntryId ||
                  selectedPageKeys.length > 0 ||
                  selectedProductIds.length > 0 ||
                  seoForm.name ||
                  facebookForm.name ||
                  analyticsForm.name ||
                  customForm.name ||
                  customForm.customTrackingCode) && (
                  <button
                    type="button"
                    onClick={resetEditor}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:border-black"
                  >
                    <FiX className="h-4 w-4" />
                    Reset
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="app-btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
                >
                  <FiSave className="h-4 w-4" />
                  {saving
                    ? "Saving..."
                    : editingEntryId
                      ? "Update Card"
                      : "Save Card"}
                </button>
              </div>
            </div>
          </form>

          <section className={sectionClass}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Saved Cards
                </p>
                <h2 className="mt-2 text-lg font-semibold text-black">
                  {currentTypeLabel} cards
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Edit, update, or delete any saved{" "}
                  {currentTypeLabel.toLowerCase()} card.
                </p>
              </div>
              <p className="text-xs font-medium text-gray-500">
                {visibleEntries.length} saved card(s)
              </p>
            </div>

            {visibleEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
                No {currentTypeLabel.toLowerCase()} cards have been saved yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {visibleEntries.map((entry) => {
                  const targetSummary = formatEntryTargets(entry);
                  return (
                    <article
                      key={entry.id}
                      className={`rounded-2xl border p-4 transition ${
                        editingEntryId === entry.id
                          ? "border-black bg-white shadow-[0_16px_30px_rgba(15,23,42,0.08)]"
                          : "border-gray-200 bg-white hover:border-black/30"
                      }`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-base font-semibold text-black">
                              {entry.name || "Untitled Card"}
                            </p>
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                              {entry.scope === "global"
                                ? "Global"
                                : "Page Based"}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {Array.isArray(targetSummary) ? (
                              targetSummary.map((target) => (
                                <span
                                  key={`${entry.id}-${target}`}
                                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700"
                                >
                                  {target}
                                </span>
                              ))
                            ) : (
                              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                                {targetSummary}
                              </span>
                            )}
                          </div>

                          {entry.type === "seo" ? (
                            <div className="mt-4 space-y-2 text-sm text-gray-600">
                              <p>
                                <span className="font-semibold text-black">
                                  Title:
                                </span>{" "}
                                {truncateText(
                                  entry.metaTitle || "Not set",
                                  120,
                                )}
                              </p>
                              <p>
                                <span className="font-semibold text-black">
                                  Description:
                                </span>{" "}
                                {truncateText(
                                  entry.metaDescription || "Not set",
                                  150,
                                )}
                              </p>
                              <p>
                                <span className="font-semibold text-black">
                                  Keywords:
                                </span>{" "}
                                {truncateText(
                                  entry.metaKeywords || "Not set",
                                  150,
                                )}
                              </p>
                            </div>
                          ) : null}

                          {entry.type === "facebook" ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                                Pixel: {entry.facebookPixelId || "Not set"}
                              </span>
                              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                                Data Layer:{" "}
                                {entry.enableDataLayer ? "On" : "Off"}
                              </span>
                            </div>
                          ) : null}

                          {entry.type === "analytics" ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {entry.ga4MeasurementId ? (
                                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                                  GA4: {entry.ga4MeasurementId}
                                </span>
                              ) : null}
                              {entry.googleAnalyticsId ? (
                                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                                  GA: {entry.googleAnalyticsId}
                                </span>
                              ) : null}
                              {entry.gtmId ? (
                                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                                  GTM: {entry.gtmId}
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          {entry.type === "custom" ? (
                            <div className="mt-4 space-y-2 text-sm text-gray-600">
                              <p>
                                <span className="font-semibold text-black">
                                  Script:
                                </span>{" "}
                                {truncateText(
                                  entry.customTrackingCode || "Not set",
                                  180,
                                )}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingEntry(entry)}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                          >
                            <FiEdit2 className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(entry)}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                          >
                            <FiTrash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete card"
        message={
          deleteTarget?.name
            ? `Delete ${deleteTarget.name}?`
            : "Delete this saved card?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDanger
        isLoading={deleting}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
        }}
        onConfirm={confirmDeleteEntry}
      />
    </div>
  );
};

export default ModuleSeoAnalytics;
