/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import {
  FiCheck,
  FiGlobe,
  FiSave,
  FiSettings,
  FiUpload,
  FiX,
} from "react-icons/fi";
import axios from "axios";
import SearchableSelect from "../components/SearchableSelect";
import { useAuth } from "../hooks/useAuth";
import { useThemeColors } from "../hooks/useThemeColors";
import {
  ABOUT_CARD_ICON_OPTIONS,
  DEFAULT_ABOUT_CARDS,
  DEFAULT_ABOUT_STORY_CONTENT,
  DEFAULT_ABOUT_STORY_TITLE,
  createEmptyAboutCard,
  getAboutCardIconComponent,
  normalizeAboutCards,
} from "../utils/aboutSection";
import {
  resolveWebsiteIconUrl,
  toPublicAssetUrl,
} from "../utils/publicSettings";
import RichTextEditor from "../components/RichTextEditor";
import {
  loadAdminSettings,
  loadPublicSettings,
  saveAdminSettings,
  selectAdminSettingsDraft,
  selectPublicSettingsState,
  updateAdminField,
  updateAdminNestedField,
  uploadAdminHeaderIcon,
  uploadAdminLogo,
} from "../store/publicSettingsSlice";

const baseUrl = import.meta.env.VITE_API_URL;

const sectionClass = "app-panel space-y-4 p-5 md:p-6";
const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-black outline-none transition focus:border-black";
const textareaClass = `${inputClass} min-h-[104px] resize-y`;
const swatchButtonBaseClass =
  "group relative flex items-center gap-3 rounded-2xl border bg-white px-3 py-3 text-left transition";

const THEME_COLOR_OPTIONS = [
  { label: "Midnight", value: "#111827" },
  { label: "Ocean", value: "#0f766e" },
  { label: "Royal", value: "#2563eb" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Emerald", value: "#059669" },
  { label: "Amber", value: "#d97706" },
  { label: "Rose", value: "#e11d48" },
  { label: "Charcoal", value: "#0f172a" },
];

const BUTTON_TEXT_COLOR_OPTIONS = [
  { label: "White", value: "#ffffff" },
  { label: "Soft White", value: "#f8fafc" },
  { label: "Cream", value: "#fef3c7" },
  { label: "Slate", value: "#e2e8f0" },
  { label: "Ink", value: "#111827" },
  { label: "Black", value: "#000000" },
];

const normalizeLogoMode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase() === "text"
    ? "text"
    : "image";

const parseIdList = (value) =>
  Array.isArray(value)
    ? value
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)
        .filter((entry, index, list) => list.indexOf(entry) === index)
    : [];

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const ColorPaletteField = ({
  label,
  helperText,
  options,
  selectedValue,
  onChange,
}) => (
  <div className="space-y-3">
    <div>
      <p className="text-sm font-semibold text-black">{label}</p>
      <p className="mt-1 text-xs text-gray-500">{helperText}</p>
    </div>

    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-600">
          Pick Color
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Choose any color using the picker or enter hex code
        </p>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={selectedValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-12 cursor-pointer rounded-lg border border-gray-200"
        />
        <div className="flex-1">
          <input
            type="text"
            value={selectedValue}
            onChange={(e) => {
              const val = e.target.value.trim();
              if (/^#[0-9a-f]{6}$/i.test(val)) {
                onChange(val);
              }
            }}
            placeholder="#000000"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-500">Hex format: #000000</p>
        </div>
      </div>
    </div>
  </div>
);

const ModuleWebsiteSetup = () => {
  const { themeColor } = useThemeColors();
  const { user } = useAuth();
  const dispatch = useDispatch();
  const settings = useSelector(selectAdminSettingsDraft);
  const { adminStatus, saveStatus, logoUploadStatus } = useSelector(
    selectPublicSettingsState,
  );
  const loading = adminStatus === "idle" || adminStatus === "loading";
  const saving = saveStatus === "loading";
  const logoUploading = logoUploadStatus === "loading";
  const logoInputRef = useRef(null);
  const headerIconInputRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [iconUploading, setIconUploading] = useState(false);
  const logoMode = normalizeLogoMode(settings?.website?.logoMode);
  const logoPreviewUrl = useMemo(
    () => toPublicAssetUrl(settings?.website?.logoUrl || ""),
    [settings?.website?.logoUrl],
  );
  const headerIconPreviewUrl = useMemo(
    () => resolveWebsiteIconUrl(settings?.website || {}),
    [settings?.website],
  );
  const publicStockCategoryIds = useMemo(
    () =>
      parseIdList(
        settings?.publicStockCategoryIds ||
          settings?.marketplace?.publicStockCategoryIds,
      ),
    [
      settings?.marketplace?.publicStockCategoryIds,
      settings?.publicStockCategoryIds,
    ],
  );
  const publicStockSummaryEnabled = Boolean(
    settings?.publicStockSummaryEnabled ??
    settings?.marketplace?.publicStockSummaryEnabled,
  );
  const selectedThemeColor =
    String(settings?.website?.themeColor || "").trim() ||
    THEME_COLOR_OPTIONS[0].value;
  const selectedButtonTextColor =
    String(settings?.website?.buttonTextColor || "").trim() ||
    BUTTON_TEXT_COLOR_OPTIONS[0].value;
  const useLogoAsHeaderIcon = Boolean(settings?.website?.useLogoAsHeaderIcon);
  const isAdmin = useMemo(
    () => String(user?.userType || "").toLowerCase() === "admin",
    [user?.userType],
  );

  useEffect(() => {
    if (!isAdmin) return;

    dispatch(loadAdminSettings())
      .unwrap()
      .catch((message) => {
        toast.error(message || "Failed to load website settings");
      });
  }, [dispatch, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const loadCategories = async () => {
      try {
        setCategoriesLoading(true);
        const response = await axios.get(`${baseUrl}/categories`, {
          headers: getAuthHeaders(),
        });

        const nextCategories = response.data?.success
          ? response.data.categories || []
          : Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data)
              ? response.data
              : [];

        setCategories(nextCategories);
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to load categories",
        );
      } finally {
        setCategoriesLoading(false);
      }
    };

    loadCategories();
  }, [isAdmin]);

  const updateNested = (section, key, value) => {
    dispatch(updateAdminNestedField({ section, key, value }));
  };

  const updateRoot = (key, value) => {
    dispatch(updateAdminField({ key, value }));
  };

  const aboutCards = useMemo(
    () => normalizeAboutCards(settings?.about?.cards || DEFAULT_ABOUT_CARDS),
    [settings?.about?.cards],
  );

  const updateAboutCards = (nextCards) => {
    updateNested("about", "cards", normalizeAboutCards(nextCards));
  };

  const addAboutCard = () => {
    if (aboutCards.length >= 4) return;
    updateAboutCards([...aboutCards, createEmptyAboutCard()]);
  };

  const updateAboutCard = (index, updates) => {
    updateAboutCards(
      aboutCards.map((card, currentIndex) =>
        currentIndex === index ? { ...card, ...updates } : card,
      ),
    );
  };

  const removeAboutCard = (index) => {
    updateAboutCards(
      aboutCards.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await dispatch(uploadAdminLogo(file)).unwrap();
      toast.success(result?.message || "Logo uploaded");
    } catch (error) {
      toast.error(error || "Failed to upload logo");
    } finally {
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  };

  const handleHeaderIconUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIconUploading(true);
      const result = await dispatch(uploadAdminHeaderIcon(file)).unwrap();
      toast.success(result?.message || "Header icon uploaded");
    } catch (error) {
      toast.error(error || "Failed to upload header icon");
    } finally {
      setIconUploading(false);
      if (headerIconInputRef.current) {
        headerIconInputRef.current.value = "";
      }
    }
  };

  const togglePublicStockCategory = (categoryId) => {
    const normalizedId = String(categoryId || "").trim();
    if (!normalizedId) return;

    updateRoot(
      "publicStockCategoryIds",
      publicStockCategoryIds.includes(normalizedId)
        ? publicStockCategoryIds.filter((id) => id !== normalizedId)
        : [...publicStockCategoryIds, normalizedId],
    );
  };

  const saveSettings = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        website: { ...(settings.website || {}) },
        contact: { ...(settings.contact || {}) },
        social: { ...(settings.social || {}) },
        policies: { ...(settings.policies || {}) },
        storefront: {
          ...(settings.storefront || {}),
          footerCaption: String(
            settings?.storefront?.footerCaption || "",
          ).trim(),
        },
        about: {
          ...(settings.about || {}),
          storyTitle:
            String(settings?.about?.storyTitle || "").trim() ||
            DEFAULT_ABOUT_STORY_TITLE,
          storySubtitle: String(settings?.about?.storySubtitle || "").trim(),
          storyContent:
            String(settings?.about?.storyContent || "").trim() ||
            DEFAULT_ABOUT_STORY_CONTENT,
          cards: aboutCards,
        },
        marketplace: {
          ...(settings?.marketplace || {}),
          publicStockSummaryEnabled,
          publicStockCategoryIds,
        },
        publicStockSummaryEnabled,
        publicStockCategoryIds,
      };

      const result = await dispatch(saveAdminSettings(payload)).unwrap();
      toast.success(result?.message || "Settings saved");

      // Reload public settings to reflect changes immediately
      dispatch(loadPublicSettings({ force: true }));
    } catch (error) {
      toast.error(error || "Failed to save settings");
    }
  };

  if (!isAdmin) {
    return (
      <div className="app-panel p-8 text-center">
        <h2 className="mb-2 text-xl font-semibold text-black">
          Admin Access Required
        </h2>
        <p className="text-gray-600">Only admin can manage website settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="app-hero p-6 md:p-8">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
          <FiSettings className="h-6 w-6" />
        </div>
        <p className="app-kicker text-white/65!">Website setup</p>
        <h1 className="mt-3 text-2xl font-black md:text-3xl">Website Setup</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-200 md:text-base">
          Keep only the public-site settings this project actually uses:
          branding, SEO, analytics, category-based public stock visibility,
          policies, and footer copy.
        </p>
      </div>

      {loading ? (
        <div className="app-panel-soft p-6">
          <p className="text-gray-600">Loading settings...</p>
        </div>
      ) : (
        <form onSubmit={saveSettings} className="space-y-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className={sectionClass}>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-black">
                <FiGlobe className="h-5 w-5" /> Brand Identity
              </h2>
              <p className="text-sm text-gray-600">
                Manage the store name, tagline, and navbar logo from one compact
                section.
              </p>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={settings.website.storeName}
                  onChange={(event) =>
                    updateNested("website", "storeName", event.target.value)
                  }
                  placeholder="Store name"
                  className={inputClass}
                />
                <input
                  value={settings.website.tagline}
                  onChange={(event) =>
                    updateNested("website", "tagline", event.target.value)
                  }
                  placeholder="Store tagline"
                  className={inputClass}
                />
              </div>

              <div className="app-panel-muted space-y-4 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-black">
                      Navbar Logo
                    </p>
                    <p className="text-xs text-gray-500">
                      Use a text logo or upload an image for the public
                      storefront.
                    </p>
                  </div>
                  <SearchableSelect
                    value={logoMode}
                    onChange={(value) =>
                      updateNested(
                        "website",
                        "logoMode",
                        normalizeLogoMode(value),
                      )
                    }
                    options={[
                      { value: "image", label: "Image Logo" },
                      { value: "text", label: "Text Logo" },
                    ]}
                    placeholder="Logo mode"
                    searchable={false}
                    className="min-w-0"
                    buttonClassName="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 md:w-44"
                    menuClassName="rounded-xl"
                  />
                </div>

                {logoMode === "text" ? (
                  <input
                    value={settings.website.logoText || ""}
                    onChange={(event) =>
                      updateNested("website", "logoText", event.target.value)
                    }
                    placeholder="Text logo for navbar"
                    className={inputClass}
                  />
                ) : (
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      className="app-btn-secondary h-11 gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
                    >
                      <FiUpload className="h-4 w-4" />
                      {logoUploading ? "Uploading..." : "Upload Logo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateNested("website", "logoUrl", "")}
                      className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:border-black"
                    >
                      Remove Logo
                    </button>
                    <p className="text-xs text-gray-500">
                      PNG, JPG, WEBP, or GIF.
                    </p>
                  </div>
                )}

                <div className="rounded-3xl border border-dashed border-black/12 bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Logo Preview
                  </p>
                  <div className="mt-3 flex min-h-24 items-center justify-center rounded-[18px] border border-black/8 bg-white px-4 py-3">
                    {logoMode === "text" ? (
                      <div
                        className="inline-flex min-h-11 items-center rounded-xl border px-4 text-base font-black tracking-[0.08em]"
                        style={{
                          borderColor: `${selectedThemeColor}22`,
                          backgroundColor: selectedThemeColor,
                          color: selectedButtonTextColor,
                        }}
                      >
                        {String(
                          settings?.website?.logoText ||
                            settings?.website?.storeName ||
                            "LOGO",
                        ).trim() || "LOGO"}
                      </div>
                    ) : logoPreviewUrl ? (
                      <img
                        src={logoPreviewUrl}
                        alt={String(settings?.website?.storeName || "Logo")}
                        className="h-14 w-auto max-w-full object-contain"
                      />
                    ) : (
                      <p className="text-sm text-gray-500">
                        No logo uploaded yet.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <h2 className="text-lg font-semibold text-black">
                Appearance & Icon
              </h2>
              <p className="text-sm text-gray-600">
                Customize button colors and control when the logo should power
                the browser icon.
              </p>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-black">Live Preview</p>
                <p className="mt-1 text-xs text-gray-500">
                  Primary buttons and navbar accents follow the selected brand
                  color after you save.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold shadow-sm"
                    style={{
                      backgroundColor: selectedThemeColor,
                      color: selectedButtonTextColor,
                    }}
                  >
                    Primary Button
                  </button>
                </div>
              </div>

              <ColorPaletteField
                label="Primary Button Color"
                helperText="Changes the main storefront action color and branded accents."
                options={THEME_COLOR_OPTIONS}
                selectedValue={selectedThemeColor}
                onChange={(value) =>
                  updateNested("website", "themeColor", value)
                }
              />

              <ColorPaletteField
                label="Button Text Color"
                helperText="Applies to the text inside the primary buttons across the project."
                options={BUTTON_TEXT_COLOR_OPTIONS}
                selectedValue={selectedButtonTextColor}
                onChange={(value) =>
                  updateNested("website", "buttonTextColor", value)
                }
              />

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_160px]">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-black">
                        Browser Icon
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Turn on the toggle only when you want the website logo
                        to be used as the browser tab icon. When it stays off,
                        logo uploads will not replace the icon.
                      </p>
                    </div>

                    <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={useLogoAsHeaderIcon}
                        onChange={(event) =>
                          updateNested(
                            "website",
                            "useLogoAsHeaderIcon",
                            event.target.checked,
                          )
                        }
                      />
                      Use the navbar logo as the browser icon
                    </label>

                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <input
                        ref={headerIconInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                        onChange={handleHeaderIconUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => headerIconInputRef.current?.click()}
                        disabled={iconUploading}
                        className="app-btn-secondary h-11 gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
                      >
                        <FiUpload className="h-4 w-4" />
                        {iconUploading ? "Uploading..." : "Upload Icon"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateNested("website", "headerIconUrl", "")
                        }
                        className="h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 transition hover:border-black"
                      >
                        Remove Uploaded Icon
                      </button>
                    </div>

                    <p className="text-xs text-gray-500">
                      {useLogoAsHeaderIcon
                        ? "The current logo will be used as the icon after save."
                        : "The uploaded icon will be used only when the toggle stays off."}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Icon Preview
                    </p>
                    <div className="mt-3 flex h-32 items-center justify-center rounded-[18px] border border-black/8 bg-white p-4">
                      {headerIconPreviewUrl ? (
                        <img
                          src={headerIconPreviewUrl}
                          alt={`${String(settings?.website?.storeName || "Website").trim() || "Website"} icon`}
                          className="h-16 w-16 rounded-2xl object-contain"
                        />
                      ) : (
                        <p className="text-center text-sm text-gray-500">
                          No browser icon selected yet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-black">
                      Public Stock Categories
                    </p>
                    <p className="text-xs text-gray-500">
                      Choose which categories appear in the public stock
                      summary.
                    </p>
                  </div>
                  <p className="text-xs font-medium text-gray-500">
                    {categoriesLoading
                      ? "Loading categories..."
                      : `${publicStockCategoryIds.length} selected`}
                  </p>
                </div>

                {categoriesLoading ? (
                  <p className="mt-4 text-sm text-gray-500">
                    Loading categories...
                  </p>
                ) : categories.length ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {categories.map((category) => {
                      const categoryId = String(category._id || "").trim();
                      if (!categoryId) return null;

                      const checked =
                        publicStockCategoryIds.includes(categoryId);

                      return (
                        <button
                          key={categoryId}
                          type="button"
                          onClick={() => togglePublicStockCategory(categoryId)}
                          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                            checked
                              ? "shadow-[0_14px_24px_rgba(15,23,42,0.08)]"
                              : "border-slate-200 bg-white text-slate-900 hover:border-black"
                          }`}
                          style={
                            checked
                              ? {
                                  borderColor: selectedThemeColor,
                                  backgroundColor: selectedThemeColor,
                                  color: selectedButtonTextColor,
                                }
                              : undefined
                          }
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              checked
                                ? "border-white bg-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor: checked
                                  ? selectedThemeColor
                                  : "#cbd5e1",
                              }}
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">
                              {category.name || "Category"}
                            </span>
                            <span
                              className={`mt-1 block text-xs ${
                                checked ? "opacity-80" : "text-slate-500"
                              }`}
                            >
                              {category.type || "General"}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-500">
                    No categories available yet.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {publicStockCategoryIds.map((categoryId) => {
                    const category = categories.find(
                      (entry) => String(entry._id || "") === categoryId,
                    );
                    if (!category) return null;

                    return (
                      <button
                        key={categoryId}
                        type="button"
                        onClick={() => togglePublicStockCategory(categoryId)}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-black"
                      >
                        <span>{category.name}</span>
                        <FiX className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className={sectionClass}>
              <h2 className="text-lg font-semibold text-black">
                Contact Details
              </h2>
              <p className="text-sm text-gray-600">
                Keep the store contact details compact and easy to maintain.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={settings.contact.address}
                  onChange={(event) =>
                    updateNested("contact", "address", event.target.value)
                  }
                  placeholder="Store address"
                  className={inputClass}
                />
                <input
                  value={settings.contact.addressLink}
                  onChange={(event) =>
                    updateNested("contact", "addressLink", event.target.value)
                  }
                  placeholder="Google Maps link"
                  className={inputClass}
                />
                <input
                  value={settings.contact.phone1}
                  onChange={(event) =>
                    updateNested("contact", "phone1", event.target.value)
                  }
                  placeholder="Primary phone"
                  className={inputClass}
                />
                <input
                  value={settings.contact.phone2}
                  onChange={(event) =>
                    updateNested("contact", "phone2", event.target.value)
                  }
                  placeholder="Secondary phone"
                  className={inputClass}
                />
                <input
                  value={settings.contact.email}
                  onChange={(event) =>
                    updateNested("contact", "email", event.target.value)
                  }
                  placeholder="Support email"
                  className={`${inputClass} md:col-span-2`}
                />
              </div>
            </section>

            <section className={sectionClass}>
              <h2 className="text-lg font-semibold text-black">Social Links</h2>
              <p className="text-sm text-gray-600">
                Update the public social links without stretching the page
                layout.
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  value={settings.social.facebook}
                  onChange={(event) =>
                    updateNested("social", "facebook", event.target.value)
                  }
                  placeholder="Facebook URL"
                  className={inputClass}
                />
                <input
                  value={settings.social.whatsapp}
                  onChange={(event) =>
                    updateNested("social", "whatsapp", event.target.value)
                  }
                  placeholder="WhatsApp URL"
                  className={inputClass}
                />
                <input
                  value={settings.social.instagram}
                  onChange={(event) =>
                    updateNested("social", "instagram", event.target.value)
                  }
                  placeholder="Instagram URL"
                  className={inputClass}
                />
                <input
                  value={settings.social.youtube}
                  onChange={(event) =>
                    updateNested("social", "youtube", event.target.value)
                  }
                  placeholder="YouTube URL"
                  className={inputClass}
                />
              </div>
            </section>
          </div>

          <section className={sectionClass}>
            <h2 className="text-lg font-semibold text-black">About Page</h2>
            <p className="text-sm text-gray-600">
              Control the story copy and feature cards shown on the public About
              page.
            </p>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                Our Story
              </p>
              <div className="grid gap-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Story Title
                  </label>
                  <input
                    value={settings?.about?.storyTitle || ""}
                    onChange={(event) =>
                      updateNested("about", "storyTitle", event.target.value)
                    }
                    placeholder="Our Story"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Story Subtitle
                  </label>
                  <input
                    value={settings?.about?.storySubtitle || ""}
                    onChange={(event) =>
                      updateNested("about", "storySubtitle", event.target.value)
                    }
                    placeholder="Optional"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Story Content
                  </label>
                  <RichTextEditor
                    value={settings?.about?.storyContent || ""}
                    onChange={(value) =>
                      updateNested("about", "storyContent", value)
                    }
                    placeholder="Write the About page story content..."
                    minHeight={220}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                Trust Badges / Stats
              </p>
              <div className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Stat 1 Value
                    </label>
                    <input
                      value={settings?.about?.stat1Value || ""}
                      onChange={(event) =>
                        updateNested("about", "stat1Value", event.target.value)
                      }
                      placeholder="99.9%"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Stat 1 Label
                    </label>
                    <input
                      value={settings?.about?.stat1Label || ""}
                      onChange={(event) =>
                        updateNested("about", "stat1Label", event.target.value)
                      }
                      placeholder="Uptime Guarantee"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Stat 2 Value
                    </label>
                    <input
                      value={settings?.about?.stat2Value || ""}
                      onChange={(event) =>
                        updateNested("about", "stat2Value", event.target.value)
                      }
                      placeholder="50K+"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Stat 2 Label
                    </label>
                    <input
                      value={settings?.about?.stat2Label || ""}
                      onChange={(event) =>
                        updateNested("about", "stat2Label", event.target.value)
                      }
                      placeholder="Active Merchants"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Stat 3 Value
                    </label>
                    <input
                      value={settings?.about?.stat3Value || ""}
                      onChange={(event) =>
                        updateNested("about", "stat3Value", event.target.value)
                      }
                      placeholder="24/7"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Stat 3 Label
                    </label>
                    <input
                      value={settings?.about?.stat3Label || ""}
                      onChange={(event) =>
                        updateNested("about", "stat3Label", event.target.value)
                      }
                      placeholder="Premium Support"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                    About Cards
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-black">
                    Up to four feature cards
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Choose the icon, colors, title, and description shown on the
                    public About page.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addAboutCard}
                  disabled={aboutCards.length >= 4}
                  className="app-btn-primary rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-50 transition-shadow"
                >
                  Add Card
                </button>
              </div>

              {aboutCards.length ? (
                <div className="mt-4 space-y-4">
                  {aboutCards.map((card, index) => {
                    const IconPreview = getAboutCardIconComponent(card.icon);

                    return (
                      <div
                        key={`about-card-${index}`}
                        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex items-start gap-3">
                            <div
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                              style={{
                                backgroundColor:
                                  card.backgroundColor || "#111827",
                              }}
                            >
                              <IconPreview
                                className="h-5 w-5"
                                style={{ color: card.iconColor || "#ffffff" }}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                                Card {index + 1}
                              </p>
                              <p className="text-sm text-gray-500">
                                Configure the icon, colors, title, and
                                description.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeAboutCard(index)}
                            className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 lg:w-auto"
                          >
                            Remove Card
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,220px)_120px_120px]">
                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                              Icon
                            </label>
                            <SearchableSelect
                              value={card.icon || "package"}
                              onChange={(value) =>
                                updateAboutCard(index, {
                                  icon: value,
                                })
                              }
                              options={ABOUT_CARD_ICON_OPTIONS}
                              placeholder="Icon"
                              searchable={false}
                              className="min-w-0"
                              buttonClassName={inputClass}
                              menuClassName="rounded-xl"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                              Icon Color
                            </label>
                            <input
                              type="color"
                              value={card.iconColor || "#ffffff"}
                              onChange={(event) =>
                                updateAboutCard(index, {
                                  iconColor: event.target.value,
                                })
                              }
                              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-2 py-2"
                            />
                          </div>

                          <div className="sm:col-span-2 xl:col-span-1">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                              Background
                            </label>
                            <input
                              type="color"
                              value={card.backgroundColor || "#111827"}
                              onChange={(event) =>
                                updateAboutCard(index, {
                                  backgroundColor: event.target.value,
                                })
                              }
                              className="h-12 w-full rounded-xl border border-gray-200 bg-white px-2 py-2"
                            />
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4">
                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                              Card Title
                            </label>
                            <input
                              value={card.title || ""}
                              onChange={(event) =>
                                updateAboutCard(index, {
                                  title: event.target.value,
                                })
                              }
                              placeholder="Fast Shipping"
                              className={inputClass}
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                              Card Description
                            </label>
                            <RichTextEditor
                              value={card.description || ""}
                              onChange={(value) =>
                                updateAboutCard(index, { description: value })
                              }
                              placeholder="Write the card description..."
                              minHeight={160}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                  No cards added yet. Add up to four cards for the About page.
                </div>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className={sectionClass}>
              <h2 className="text-lg font-semibold text-black">
                Order Cancellation
              </h2>
              <p className="text-sm text-gray-600">
                Control how long customers can cancel an order from the
                storefront. Once the time limit expires, or once the order moves
                out of pending, the cancel button turns off automatically.
              </p>

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-black">
                      Cancellation Time Limit
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={settings?.policies?.cancellationWindowDays ?? 1}
                      onChange={(event) =>
                        updateNested(
                          "policies",
                          "cancellationWindowDays",
                          event.target.value,
                        )
                      }
                      placeholder="Days"
                      className={inputClass}
                    />
                    <p className="text-xs text-gray-500">
                      Use days. Set `0` to disable customer cancellation
                      completely.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-black">
                      Cancellation Policy
                    </label>
                    <RichTextEditor
                      value={settings?.policies?.cancellationPolicy || ""}
                      onChange={(value) =>
                        updateNested("policies", "cancellationPolicy", value)
                      }
                      placeholder="Explain the cancellation rules customers should see"
                      minHeight={180}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionClass}>
              <h2 className="text-lg font-semibold text-black">
                Policies & Footer
              </h2>
              <RichTextEditor
                value={settings.policies.shipmentPolicy}
                onChange={(value) =>
                  updateNested("policies", "shipmentPolicy", value)
                }
                placeholder="Shipping policy"
                minHeight={160}
              />
              <RichTextEditor
                value={settings.policies.deliveryPolicy}
                onChange={(value) =>
                  updateNested("policies", "deliveryPolicy", value)
                }
                placeholder="Delivery policy"
                minHeight={160}
              />
              <RichTextEditor
                value={settings.policies.termsConditions}
                onChange={(value) =>
                  updateNested("policies", "termsConditions", value)
                }
                placeholder="Terms and conditions"
                minHeight={160}
              />
              <RichTextEditor
                value={settings.policies.returnPolicy}
                onChange={(value) =>
                  updateNested("policies", "returnPolicy", value)
                }
                placeholder="Return policy"
                minHeight={160}
              />
              <RichTextEditor
                value={settings.policies.privacyPolicy}
                onChange={(value) =>
                  updateNested("policies", "privacyPolicy", value)
                }
                placeholder="Privacy policy"
                minHeight={160}
              />
              <input
                value={settings?.storefront?.footerCaption || ""}
                onChange={(event) =>
                  updateNested(
                    "storefront",
                    "footerCaption",
                    event.target.value,
                  )
                }
                placeholder="Footer caption"
                className={inputClass}
              />
            </section>
          </div>

          <div className="sticky bottom-3 z-50">
            <div className="rounded-2xl border border-black/10 bg-white/90 p-3 shadow-[0_18px_40px_rgba(15,23,42,0.10)] backdrop-blur supports-[backdrop-filter]:bg-white/70">
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  title="Save settings"
                  aria-label="Save settings"
                  className="app-btn-primary inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-md transition-shadow hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 md:px-5"
                >
                  <FiSave className="h-4 w-4" />
                  <span>{saving ? "Saving..." : "Save Settings"}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

export default ModuleWebsiteSetup;
