/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useMemo, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import ConfirmModal from "../../components/ConfirmModal";
import RichTextEditor from "../../components/RichTextEditor";
import SearchableSelect from "../../components/SearchableSelect";
import { useThemeColors } from "../../hooks/useThemeColors";
import {
  isAllowedProductVideoType,
  MAX_PRODUCT_VIDEO_UPLOADS,
  MAX_PRODUCT_VIDEO_SIZE_BYTES,
  normalizeProductVideoEntries,
  normalizeProductYouTubeUrls,
} from "../../utils/productMedia";
import {
  getReadableVariantOptionLabel,
  normalizeProductVariantDefinitions,
  normalizeVariantPrice,
  normalizeVariantPricing,
} from "../../utils/productVariants";
import { stripHtml } from "../../utils/richText";
import {
  FiEdit2,
  FiTrash2,
  FiImage,
  FiRefreshCw,
  FiPlus,
  FiArrowLeft,
  FiType,
  FiFileText,
  FiTag,
  FiPackage,
  FiBox,
  FiLayers,
  FiX,
  FiUpload,
  FiCopy,
} from "react-icons/fi";

function ProductModify({ initialMode = "list" }) {
  const { themeColor } = useThemeColors();
  const baseUrl = import.meta.env.VITE_API_URL;
  const VARIANT_PRICE_MODE_OPTIONS = [
    { value: "default", label: "Use Product Price" },
    { value: "direct", label: "Direct Price" },
    { value: "compare", label: "Compare Price" },
  ];

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [mainImageFile, setMainImageFile] = useState(null);
  const [mainImagePreview, setMainImagePreview] = useState("");
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [galleryPreviews, setGalleryPreviews] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);
  const [videoPreviews, setVideoPreviews] = useState([]);
  const [currentVideos, setCurrentVideos] = useState([]);
  const [youtubeVideoUrls, setYoutubeVideoUrls] = useState([""]);
  const [currentMainImage, setCurrentMainImage] = useState("");
  const [currentMainImageId, setCurrentMainImageId] = useState(null);
  const [currentGalleryImages, setCurrentGalleryImages] = useState([]);
  const [currentGalleryImageIds, setCurrentGalleryImageIds] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    salePrice: "",
    priceType: "single",
    costing: "",
    publicationStatus: "draft",
    category: "",
    productType: "General",
    marketplaceType: "simple",
    sku: "",
    stock: "",
    lowStockThreshold: "5",
    allowBackorder: false,
    deliveryMinDays: "2",
    deliveryMaxDays: "5",
    downloadUrl: "",
    serviceDurationDays: "",
    variationsJson: "[]",
    groupedProductsCsv: "",
    isRecurring: false,
    recurringInterval: "monthly",
    recurringIntervalCount: "1",
    recurringTotalCycles: "0",
    recurringTrialDays: "0",
    brand: "",
    weight: "",
    dimensions: "",
  });

  const [errors, setErrors] = useState({});
  const [features, setFeatures] = useState([""]);
  const [specifications, setSpecifications] = useState([
    { key: "", value: "" },
  ]);
  const [customColorValue, setCustomColorValue] = useState("#2563eb");
  const [brandOptions, setBrandOptions] = useState([]);
  const [variantDefinitions, setVariantDefinitions] = useState([]);
  const [listSearch, setListSearch] = useState("");
  const [listCategoryType, setListCategoryType] = useState("");
  const [listCategory, setListCategory] = useState("");
  const [listBrand, setListBrand] = useState("");
  const [listPublicationStatus, setListPublicationStatus] = useState("");

  // Product type options
  const productTypes = [
    "General",
    "Popular",
    "Hot deals",
    "Best Selling",
    "Latest",
  ];
  const marketplaceTypes = [{ value: "simple", label: "Simple Product" }];
  const priceTypes = [
    { value: "single", label: "Single Price" },
    { value: "best", label: "Best Price" },
    { value: "tba", label: "TBA" },
  ];
  const allowedMarketplaceTypeValues = new Set(
    marketplaceTypes.map((entry) => entry.value),
  );

  const colorOptions = [
    { name: "Red", value: "#dc2626" },
    { name: "Blue", value: "#2563eb" },
    { name: "Green", value: "#16a34a" },
    { name: "Yellow", value: "#ca8a04" },
    { name: "Black", value: "#000000" },
    { name: "White", value: "#ffffff" },
    { name: "Purple", value: "#9333ea" },
    { name: "Pink", value: "#db2777" },
    { name: "Gray", value: "#6b7280" },
    { name: "Orange", value: "#ea580c" },
  ];

  const createVariantOption = (preset = "custom") =>
    preset === "color"
      ? {
          label: "Black",
          value: "#000000",
          colorHex: "#000000",
          priceMode: "default",
          price: "",
          comparePrice: "",
        }
      : {
          label: "",
          value: "",
          colorHex: "",
          priceMode: "default",
          price: "",
          comparePrice: "",
        };

  const createVariantDefinition = (preset = "custom") => ({
    preset,
    name: preset === "color" ? "Color" : "",
    options: [createVariantOption(preset)],
  });

  const getDefaultVariantTypeName = (preset = "custom") =>
    preset === "color" ? "Color" : "";

  const normalizeVariantDefinitionsForForm = (definitions = [], fallbackColors = []) => {
    if (Array.isArray(definitions) && definitions.length > 0) {
      return definitions.map((definition) => ({
        preset: (() => {
          const rawPreset = String(definition?.preset || "custom");
          if (rawPreset === "size") return "custom";
          return ["color", "custom"].includes(rawPreset) ? rawPreset : "custom";
        })(),
        name: String(definition?.name || "").trim(),
        options: Array.isArray(definition?.options) && definition.options.length > 0
          ? definition.options.map((option) => ({
              label: String(option?.label || option?.value || option?.colorHex || "").trim(),
              value: String(option?.value || option?.label || option?.colorHex || "").trim(),
              colorHex: String(option?.colorHex || "").trim(),
              priceMode: String(option?.priceMode || "default").trim() || "default",
              price:
                option?.price === null || option?.price === undefined ? "" : String(option.price),
              comparePrice:
                option?.comparePrice === null || option?.comparePrice === undefined
                  ? ""
                  : String(option.comparePrice),
            }))
          : [createVariantOption(String(definition?.preset || "custom"))],
      }));
    }

    if (Array.isArray(fallbackColors) && fallbackColors.length > 0) {
      return [
        {
          preset: "color",
          name: "Color",
          options: fallbackColors.map((color) => ({
            label: String(color || "").trim(),
            value: String(color || "").trim(),
            colorHex: String(color || "").trim(),
            priceMode: "default",
            price: "",
            comparePrice: "",
          })),
        },
      ];
    }

    return [];
  };

  const getNormalizedVariantDefinitions = () =>
    variantDefinitions
      .map((definition) => {
        const rawPreset = String(definition?.preset || "custom");
        const preset = rawPreset === "size" ? "custom" : ["color", "custom"].includes(rawPreset) ? rawPreset : "custom";
        const defaultName = getDefaultVariantTypeName(preset);
        const name = String(definition?.name || "").trim() || defaultName;
        const options = Array.isArray(definition?.options)
          ? definition.options
              .map((option) => {
                const label = String(option?.label || option?.value || "").trim();
                const value = String(option?.value || option?.label || "").trim();
                const colorHex = String(option?.colorHex || "").trim().toLowerCase();

                if (preset === "color") {
                  const resolvedHex =
                    /^#[0-9a-fA-F]{6}$/.test(colorHex)
                      ? colorHex
                      : /^#[0-9a-fA-F]{6}$/.test(value)
                        ? value.toLowerCase()
                        : /^#[0-9a-fA-F]{6}$/.test(label)
                          ? label.toLowerCase()
                          : "";
                  if (!resolvedHex) return null;
                  return {
                    label: label || resolvedHex,
                    value: value || resolvedHex,
                    colorHex: resolvedHex,
                    priceMode:
                      String(option?.priceMode || "default").trim() || "default",
                    price: normalizeVariantPrice(option?.price),
                    comparePrice: normalizeVariantPrice(option?.comparePrice),
                  };
                }

                if (!label && !value) return null;
                return {
                  label: label || value,
                  value: value || label,
                  colorHex: "",
                  priceMode:
                    String(option?.priceMode || "default").trim() || "default",
                  price: normalizeVariantPrice(option?.price),
                  comparePrice: normalizeVariantPrice(option?.comparePrice),
                };
              })
              .filter(Boolean)
          : [];

        if (!options.length) return null;
        if (preset === "custom" && !name) return null;

        return { preset, name, options };
      })
      .filter(Boolean);

  const brandSelectOptions = useMemo(
    () =>
      brandOptions.map((brand) => {
        return {
          value: String(brand?.name || "").trim(),
          label: String(brand?.name || "").trim(),
          description: "Catalog brand",
        };
      }),
    [brandOptions],
  );

  const categoryTypeOptions = useMemo(() => {
    const types = new Set();

    categories.forEach((category) => {
      const type = String(category?.type || "General").trim() || "General";
      types.add(type);
    });

    return [
      { value: "", label: "All category types" },
      ...Array.from(types)
        .sort((left, right) => left.localeCompare(right))
        .map((type) => ({
          value: type,
          label: type,
        })),
    ];
  }, [categories]);

  const categoryFilterOptions = useMemo(() => {
    const normalizedCategoryType = String(listCategoryType || "").trim();

    return categories
      .filter((category) => {
        const categoryType = String(category?.type || "General").trim() || "General";
        if (!normalizedCategoryType) return true;
        return categoryType === normalizedCategoryType;
      })
      .map((category) => ({
        value: String(category?._id || "").trim(),
        label: String(category?.name || "").trim(),
        description: String(category?.type || "General").trim() || "General",
      }))
      .filter((option) => option.value);
  }, [categories, listCategoryType]);

  const brandFilterOptions = useMemo(
    () => [
      { value: "", label: "All brands" },
      ...brandSelectOptions,
    ],
    [brandSelectOptions],
  );

  const publicationStatusOptions = useMemo(
    () => [
      { value: "", label: "All statuses" },
      { value: "published", label: "Published" },
      { value: "draft", label: "Draft" },
    ],
    [],
  );

  const visibleProducts = useMemo(() => {
    const normalizedSearch = String(listSearch || "").trim().toLowerCase();
    const normalizedCategory = String(listCategory || "").trim();
    const normalizedBrand = String(listBrand || "").trim();
    const normalizedPublicationStatus = String(listPublicationStatus || "").trim().toLowerCase();

    return products.filter((product) => {
      const title = String(product?.title || "").toLowerCase();
      const description = stripHtml(product?.description || "").toLowerCase();
      const sku = String(product?.sku || "").toLowerCase();
      const productType = String(product?.productType || "").toLowerCase();
      const categoryId = String(product?.category?._id || product?.category || "").trim();
      const categoryName = String(product?.category?.name || "").toLowerCase();
      const categoryType = String(product?.category?.type || "General").toLowerCase();
      const brandName = String(product?.brand?.name || product?.brand || "").toLowerCase();
      const publicationStatus = String(product?.publicationStatus || "draft").trim().toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        [title, description, sku, categoryName, brandName, productType, categoryType]
          .join(" ")
          .includes(normalizedSearch);
      const matchesCategory = !normalizedCategory || categoryId === normalizedCategory;
      const matchesBrand =
        !normalizedBrand || String(product?.brand?._id || product?.brand || "").trim() === normalizedBrand || brandName === normalizedBrand.toLowerCase();
      const matchesPublicationStatus =
        !normalizedPublicationStatus || publicationStatus === normalizedPublicationStatus;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesBrand &&
        matchesPublicationStatus
      );
    });
  }, [products, listSearch, listCategory, listBrand, listPublicationStatus]);

  const hasActiveListFilters = Boolean(
    String(listSearch || "").trim() ||
      String(listCategoryType || "").trim() ||
      String(listCategory || "").trim() ||
      String(listBrand || "").trim() ||
      String(listPublicationStatus || "").trim(),
  );

  const clearListFilters = () => {
    setListSearch("");
    setListCategoryType("");
    setListCategory("");
    setListBrand("");
    setListPublicationStatus("");
  };

  const getToken = () => {
    return localStorage.getItem("token");
  };

  const getAuthHeaders = () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const getEffectiveProductPrice = (product) => {
    const priceType = String(product?.priceType || "single");
    const hasSalePrice =
      priceType === "best" &&
      product?.salePrice !== null &&
      product?.salePrice !== undefined &&
      String(product.salePrice).trim() !== "";
    if (hasSalePrice) {
      const salePrice = Number(product.salePrice);
      if (Number.isFinite(salePrice) && salePrice >= 0) return salePrice;
    }
    const price = Number(product?.price);
    if (Number.isFinite(price) && price >= 0) return price;
    return 0;
  };

  const getProductPriceBadge = (product) => {
    const priceType = String(product?.priceType || "single");
    if (priceType === "tba") {
      return "TBA";
    }
    if (priceType === "best") {
      const previous = Number(product?.price || 0);
      const next = Number(product?.salePrice || 0);
      if (previous > 0 && next > 0) {
        return `${previous.toFixed(2)} -> ${next.toFixed(2)} Tk`;
      }
    }
    return `${getEffectiveProductPrice(product).toFixed(2)} Tk`;
  };

  const getBaseProductPricingSummary = (product) => {
    const priceType = String(product?.priceType || "single").trim().toLowerCase();
    if (priceType === "tba") {
      return {
        currentPrice: null,
        previousPrice: null,
        isTba: true,
      };
    }

    const currentPrice = getEffectiveProductPrice(product);
    const oldPrice = Number(product?.price);
    return {
      currentPrice,
      previousPrice:
        priceType === "best" && Number.isFinite(oldPrice) && oldPrice > currentPrice
          ? oldPrice
          : null,
      isTba: false,
    };
  };

  const renderBaseProductPriceBadge = (pricing) => {
    if (!pricing) return null;

    if (pricing.isTba) {
      return (
        <span className="inline-flex items-center rounded-full bg-black px-2.5 py-1 text-xs font-semibold text-white">
          TBA
        </span>
      );
    }

    if (pricing.previousPrice !== null && pricing.currentPrice !== null) {
      return (
        <span className="inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs">
          <span className="text-gray-400 line-through">
            {pricing.previousPrice.toFixed(2)} Tk
          </span>
          <span className="font-semibold text-emerald-800">
            {pricing.currentPrice.toFixed(2)} Tk
          </span>
        </span>
      );
    }

    if (pricing.currentPrice !== null) {
      return (
        <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
          {pricing.currentPrice.toFixed(2)} Tk
        </span>
      );
    }

    return null;
  };

  const getVariantPricingGroups = (product) =>
    normalizeProductVariantDefinitions(product)
      .map((definition) => {
        const basePricing = getBaseProductPricingSummary(product);
        const pricedOptions = (definition.options || [])
          .map((option) => {
            const pricing = normalizeVariantPricing(option);
            const usesProductPrice = pricing.price === null;
            const baseCurrentPrice =
              basePricing.currentPrice === null ? null : Number(basePricing.currentPrice);
            const basePreviousPrice =
              basePricing.previousPrice === null ? null : Number(basePricing.previousPrice);
            const currentPrice = usesProductPrice
              ? baseCurrentPrice
              : baseCurrentPrice === null
                ? null
                : baseCurrentPrice + Number(pricing.price || 0);
            const previousPrice = usesProductPrice
              ? basePreviousPrice
              : pricing.priceMode === "compare" &&
                  pricing.comparePrice !== null &&
                  pricing.comparePrice > pricing.price &&
                  baseCurrentPrice !== null
                ? Number(basePreviousPrice ?? baseCurrentPrice) +
                  Number(pricing.comparePrice || 0)
                : basePreviousPrice !== null && currentPrice !== null
                  ? basePreviousPrice + Number(pricing.price || 0)
                  : null;

            if (currentPrice === null && !basePricing.isTba) return null;

            return {
              label: getReadableVariantOptionLabel({
                ...option,
                preset: definition.preset,
              }),
              colorHex:
                definition.preset === "color"
                  ? String(option?.colorHex || option?.value || "").trim().toLowerCase()
                  : "",
              currentPrice,
              previousPrice,
              isTba: !usesProductPrice && currentPrice === null,
              usesProductPrice,
              showPrice: !usesProductPrice,
            };
          })
          .filter(Boolean);

        if (!pricedOptions.length) return null;

        return {
          name: definition.name,
          preset: definition.preset,
          options: pricedOptions,
        };
      })
      .filter(Boolean);

  const getFullImageUrl = (imagePath) => {
    if (!imagePath) return null;

    if (
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://") ||
      imagePath.startsWith("data:")
    ) {
      return imagePath;
    }

    if (imagePath.startsWith("/")) {
      return baseUrl ? `${baseUrl}${imagePath}` : imagePath;
    }

    if (imagePath && !imagePath.startsWith("/")) {
      return baseUrl
        ? `${baseUrl}/uploads/products/${imagePath}`
        : `/uploads/products/${imagePath}`;
    }

    return null;
  };

  const FallbackImage = ({ className, alt }) => (
    <div
      className={`${className} bg-gray-200 flex items-center justify-center rounded-lg`}
    >
      <FiImage className="text-gray-400 text-2xl" />
      <span className="sr-only">{alt || "No image available"}</span>
    </div>
  );

  const ProductImage = ({ src, alt, className, isCurrent = false }) => {
    const [imgSrc, setImgSrc] = useState(getFullImageUrl(src));
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
      setImgSrc(getFullImageUrl(src));
      setHasError(false);
    }, [src]);

    const handleError = () => {
      setHasError(true);
      if (src && src.startsWith("/uploads/products/")) {
        const altUrl = `${baseUrl}${src}`;
        if (altUrl !== imgSrc) {
          setImgSrc(altUrl);
          setHasError(false);
        }
      }
    };

    if (hasError || !imgSrc) {
      return <FallbackImage className={className} alt={alt} />;
    }

    return (
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        onError={handleError}
        crossOrigin={
          imgSrc?.startsWith("http://") || imgSrc?.startsWith("https://")
            ? "anonymous"
            : undefined
        }
      />
    );
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/products`, {
        headers: getAuthHeaders(),
      });

      let productsData = [];
      if (response.data.success) {
        productsData = response.data.products || [];
      } else if (Array.isArray(response.data)) {
        productsData = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        productsData = response.data.data;
      }

      setProducts(productsData);
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Failed to load products",
      );

      if (err.response?.status === 401) {
        toast.error("Please login again");
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${baseUrl}/categories`, {
        headers: getAuthHeaders(),
      });

      let categoriesData = [];
      if (response.data.success) {
        categoriesData = response.data.categories || [];
      } else if (Array.isArray(response.data)) {
        categoriesData = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        categoriesData = response.data.data;
      }

      setCategories(categoriesData);
      // Initial filtered categories for "General" type
      filterCategoriesByType("General", categoriesData);
    } catch (err) {
      toast.error("Failed to load category options");
    }
  };

  const filterCategoriesByType = (type, categoriesList = categories) => {
    if (!type) {
      setFilteredCategories(
        categoriesList.filter((cat) => !cat.type || cat.type === "General"),
      );
      return;
    }

    // Filter categories by type (match category.type with productType)
    const filtered = categoriesList.filter((cat) => {
      // If category has no type, show it for General products
      if (!cat.type && type === "General") return true;
      // Match category type with product type
      return cat.type === type;
    });

    setFilteredCategories(filtered);

    // If current category is not in filtered list, reset category selection
    if (form.category && !filtered.find((cat) => cat._id === form.category)) {
      setForm((prev) => ({ ...prev, category: "" }));
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      toast.error("Please login first");
      setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
      return;
    }

    fetchProducts();
    fetchCategories();
    fetchBrandOptions();

    if (initialMode === "create") {
      setShowForm(true);
      setEditingId(null);
    }

    const handleProductCreated = () => {
      fetchProducts();
    };

    window.addEventListener("productCreated", handleProductCreated);
    return () => {
      window.removeEventListener("productCreated", handleProductCreated);
    };
  }, [initialMode]);

  useEffect(
    () => () => {
      videoPreviews.forEach((preview) => {
        if (preview) URL.revokeObjectURL(preview);
      });
    },
    [videoPreviews],
  );

  const handleDelete = (product) => {
    setDeleteConfirm(product);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    const toastId = toast.loading("Deleting product...");
    try {
      await axios.delete(`${baseUrl}/products/${deleteConfirm._id}`, {
        headers: getAuthHeaders(),
      });
      toast.success("Product deleted successfully", { id: toastId });
      fetchProducts();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to delete product",
        { id: toastId },
      );
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleDuplicate = async (productId) => {
    const toastId = toast.loading("Duplicating product...");
    try {
      await axios.post(
        `${baseUrl}/products/${productId}/duplicate`,
        {},
        { headers: getAuthHeaders() },
      );
      toast.success("Product duplicated successfully", { id: toastId });
      fetchProducts();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to duplicate product",
        { id: toastId },
      );
    }
  };

  const fetchBrandOptions = async () => {
    try {
      const response = await axios.get(`${baseUrl}/brands/public`);
      const rows = Array.isArray(response.data?.brands)
        ? response.data.brands
        : [];
      setBrandOptions(rows);
    } catch (_error) {
      setBrandOptions([]);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchProducts();
    fetchCategories();
    fetchBrandOptions();
    toast.success("Products refreshed!");
  };

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      price: "",
      salePrice: "",
      priceType: "single",
      costing: "",
      publicationStatus: "draft",
      category: "",
      productType: "General",
      marketplaceType: "simple",
      sku: "",
      stock: "",
      lowStockThreshold: "5",
      allowBackorder: false,
      deliveryMinDays: "2",
      deliveryMaxDays: "5",
      downloadUrl: "",
      serviceDurationDays: "",
      variationsJson: "[]",
      groupedProductsCsv: "",
      isRecurring: false,
      recurringInterval: "monthly",
      recurringIntervalCount: "1",
      recurringTotalCycles: "0",
      recurringTrialDays: "0",
      brand: "",
      weight: "",
      dimensions: "",
    });
    setFeatures([""]);
    setSpecifications([{ key: "", value: "" }]);
    setMainImageFile(null);
    setMainImagePreview("");
    setGalleryFiles([]);
    setGalleryPreviews([]);
    videoPreviews.forEach((preview) => {
      if (preview) URL.revokeObjectURL(preview);
    });
    setVideoFiles([]);
    setVideoPreviews([]);
    setCurrentVideos([]);
    setYoutubeVideoUrls([""]);
    setCurrentMainImage("");
    setCurrentMainImageId(null);
    setCurrentGalleryImages([]);
    setCurrentGalleryImageIds([]);
    setErrors({});
    setCustomColorValue("#2563eb");
    setVariantDefinitions([]);
    setEditingId(null);
  };

  const startCreating = () => {
    resetForm();
    setShowForm(true);
  };

  const startEditing = async (id) => {
    setLoading(true);
    try {
      const response = await axios.get(`${baseUrl}/products/${id}`, {
        headers: getAuthHeaders(),
      });

      const productData =
        response.data.product || response.data.data || response.data;

      // Set form data
      setForm({
        title: productData.title || "",
        description: productData.description || "",
        price: productData.price || "",
        salePrice:
          productData.salePrice !== undefined && productData.salePrice !== null
            ? productData.salePrice
            : "",
        priceType: ["single", "best", "tba"].includes(
          String(productData.priceType || "single"),
        )
          ? String(productData.priceType || "single")
          : "single",
        costing:
          productData.costing !== undefined && productData.costing !== null
            ? String(productData.costing)
            : "",
        publicationStatus:
          String(productData.publicationStatus || "draft").trim().toLowerCase() ===
          "published"
            ? "published"
            : "draft",
        category: productData.category?._id || productData.category || "",
        productType: productData.productType || "General",
        marketplaceType: allowedMarketplaceTypeValues.has(
          String(productData.marketplaceType || "simple"),
        )
          ? String(productData.marketplaceType || "simple")
          : "simple",
        sku: productData.sku || "",
        stock:
          productData.stock !== undefined && productData.stock !== null
            ? String(productData.stock)
            : "",
        lowStockThreshold:
          productData.lowStockThreshold !== undefined &&
          productData.lowStockThreshold !== null
            ? String(productData.lowStockThreshold)
            : "5",
        allowBackorder: Boolean(productData.allowBackorder),
        deliveryMinDays:
          productData.deliveryMinDays !== undefined &&
          productData.deliveryMinDays !== null
            ? String(productData.deliveryMinDays)
            : "2",
        deliveryMaxDays:
          productData.deliveryMaxDays !== undefined &&
          productData.deliveryMaxDays !== null
            ? String(productData.deliveryMaxDays)
            : "5",
        downloadUrl: productData.downloadUrl || "",
        serviceDurationDays:
          productData.serviceDurationDays !== undefined &&
          productData.serviceDurationDays !== null
            ? String(productData.serviceDurationDays)
            : "",
        variationsJson: JSON.stringify(productData.variations || [], null, 2),
        groupedProductsCsv: (productData.groupedProducts || [])
          .map((entry) =>
            typeof entry === "object"
              ? String(entry._id || entry.id || "")
              : String(entry || ""),
          )
          .filter(Boolean)
          .join(","),
        isRecurring: Boolean(productData.isRecurring),
        recurringInterval: ["weekly", "monthly", "quarterly", "yearly"].includes(
          String(productData.recurringInterval || "monthly"),
        )
          ? String(productData.recurringInterval || "monthly")
          : "monthly",
        recurringIntervalCount:
          productData.recurringIntervalCount !== undefined &&
          productData.recurringIntervalCount !== null
            ? String(productData.recurringIntervalCount)
            : "1",
        recurringTotalCycles:
          productData.recurringTotalCycles !== undefined &&
          productData.recurringTotalCycles !== null
            ? String(productData.recurringTotalCycles)
            : "0",
        recurringTrialDays:
          productData.recurringTrialDays !== undefined &&
          productData.recurringTrialDays !== null
            ? String(productData.recurringTrialDays)
            : "0",
        brand: productData.brand || "",
        weight: productData.weight || "",
        dimensions: productData.dimensions || "",
      });
      setVariantDefinitions(
        normalizeVariantDefinitionsForForm(
          productData.variantDefinitions || [],
          productData.colors || [],
        ),
      );
      setCustomColorValue("#2563eb");

      setFeatures(
        productData.features?.length > 0 ? productData.features : [""],
      );
      setSpecifications(
        productData.specifications?.length > 0
          ? productData.specifications
          : [{ key: "", value: "" }],
      );

      if (productData.images && productData.images.length > 0) {
        const imagesWithUrls = productData.images.map(
          (img) => getFullImageUrl(img) || img,
        );
        const imageIds = productData.imageIds || [];

        setCurrentMainImage(imagesWithUrls[0] || "");
        setCurrentMainImageId(imageIds[0] || null);
        setCurrentGalleryImages(imagesWithUrls.slice(1, 5));
        setCurrentGalleryImageIds(imageIds.slice(1, 5));
      } else {
        setCurrentMainImage("");
        setCurrentMainImageId(null);
        setCurrentGalleryImages([]);
        setCurrentGalleryImageIds([]);
      }
      setMainImageFile(null);
      setMainImagePreview("");
      setGalleryFiles([]);
      setGalleryPreviews([]);
      videoPreviews.forEach((preview) => {
        if (preview) URL.revokeObjectURL(preview);
      });
      setVideoFiles([]);
      setVideoPreviews([]);
      setCurrentVideos(normalizeProductVideoEntries(productData));
      setYoutubeVideoUrls(
        (() => {
          const nextUrls = normalizeProductYouTubeUrls(productData);
          return nextUrls.length > 0 ? nextUrls : [""];
        })(),
      );

      setEditingId(id);
      setShowForm(true);

      // Filter categories based on product type
      filterCategoriesByType(productData.productType || "General");
    } catch (err) {
      toast.error("Failed to load product data");
    } finally {
      setLoading(false);
    }
  };

  const cancelForm = () => {
    resetForm();
    setShowForm(false);
  };

  const handleMainImageChange = (e) => {
    const file = e.target.files[0];
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
      return;
    }

    setMainImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setMainImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleGalleryChange = (e) => {
    const filesArray = Array.from(e.target.files);

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];

    const validFiles = filesArray.filter((file) => {
      if (!validTypes.includes(file.type)) {
        toast.error(
          `Invalid file type: ${file.name}. Only JPG, PNG, WebP, GIF allowed.`,
        );
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      const maxGallery = Math.max(0, 4 - currentGalleryImages.length);
      const newFiles = [...galleryFiles, ...validFiles].slice(0, maxGallery);
      setGalleryFiles(newFiles);

      const newPreviews = [...galleryPreviews];
      validFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result);
          if (newPreviews.length === newFiles.length) {
            setGalleryPreviews(newPreviews.slice(0, maxGallery));
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeMainImage = () => {
    if (mainImagePreview) {
      setMainImageFile(null);
      setMainImagePreview("");
    } else {
      setCurrentMainImage("");
      setCurrentMainImageId(null);
    }
  };

  const removeGalleryImage = (index, isCurrent = false) => {
    if (isCurrent) {
      const newImages = currentGalleryImages.filter((_, i) => i !== index);
      const newIds = currentGalleryImageIds.filter((_, i) => i !== index);
      setCurrentGalleryImages(newImages);
      setCurrentGalleryImageIds(newIds);
    } else {
      const newFiles = galleryFiles.filter((_, i) => i !== index);
      const newPreviews = galleryPreviews.filter((_, i) => i !== index);
      setGalleryFiles(newFiles);
      setGalleryPreviews(newPreviews);
    }
  };

  const handleVideoChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    const remainingSlots = Math.max(
      0,
      MAX_PRODUCT_VIDEO_UPLOADS - currentVideos.length - videoFiles.length,
    );
    if (remainingSlots <= 0) {
      toast.error(`You can keep up to ${MAX_PRODUCT_VIDEO_UPLOADS} videos.`);
      e.target.value = "";
      return;
    }

    const nextFiles = [];
    const nextPreviews = [];

    selectedFiles.slice(0, remainingSlots).forEach((file) => {
      if (!isAllowedProductVideoType(file)) {
        toast.error("Only MP4, WebM, OGG, or MOV videos are allowed.");
        return;
      }

      if (file.size > MAX_PRODUCT_VIDEO_SIZE_BYTES) {
        toast.error("Each product video must be 9 MB or smaller.");
        return;
      }

      nextFiles.push(file);
      nextPreviews.push(URL.createObjectURL(file));
    });

    if (nextFiles.length > 0) {
      setVideoFiles((prev) => [...prev, ...nextFiles].slice(0, MAX_PRODUCT_VIDEO_UPLOADS));
      setVideoPreviews((prev) => [
        ...prev,
        ...nextPreviews,
      ].slice(0, MAX_PRODUCT_VIDEO_UPLOADS));
    }

    e.target.value = "";
  };

  const removeVideo = (index, isCurrent = false) => {
    if (isCurrent) {
      setCurrentVideos((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
      return;
    }

    if (videoPreviews[index]) {
      URL.revokeObjectURL(videoPreviews[index]);
    }

    setVideoFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setVideoPreviews((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleYoutubeUrlChange = (index, value) => {
    setYoutubeVideoUrls((prev) =>
      prev.map((entry, currentIndex) => (currentIndex === index ? value : entry)),
    );
  };

  const addYoutubeField = () => {
    setYoutubeVideoUrls((prev) => [...prev, ""]);
  };

  const removeYoutubeField = (index) => {
    setYoutubeVideoUrls((prev) => {
      if (prev.length === 1) return [""];
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const validateField = (name, value) => {
    let error = "";
    const normalizedValue = String(value || "");
    const plainValue = stripHtml(normalizedValue);
    switch (name) {
      case "title":
        if (!normalizedValue.trim()) error = "Product title is required";
        else if (normalizedValue.trim().length < 3)
          error = "Title must be at least 3 characters";
        break;
      case "description":
        if (!plainValue) error = "Description is required";
        else if (plainValue.length < 10)
          error = "Description must be at least 10 characters";
        break;
      case "price":
        if (!value || isNaN(value) || parseFloat(value) <= 0)
          error = "Valid price is required";
        break;
      case "salePrice":
        if (!value || isNaN(value) || parseFloat(value) <= 0) {
          error = "Valid new price is required";
        }
        break;
      case "category":
        if (!value) error = "Category selection is required";
        break;
      default:
        break;
    }
    setErrors((prev) => ({ ...prev, [name]: error }));
    return !error;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;

    if (name === "productType") {
      setForm((prev) => ({ ...prev, [name]: nextValue, category: "" }));
      filterCategoriesByType(nextValue);
    } else if (name === "marketplaceType") {
      setForm((prev) => {
        const updated = { ...prev, [name]: nextValue };
        if (nextValue !== "digital") {
          updated.downloadUrl = "";
          updated.isRecurring = false;
          updated.recurringInterval = "monthly";
          updated.recurringIntervalCount = "1";
          updated.recurringTotalCycles = "0";
          updated.recurringTrialDays = "0";
        }
        return updated;
      });
      if (errors[name]) validateField(name, nextValue);
    } else if (name === "priceType") {
      setForm((prev) => {
        const updated = { ...prev, [name]: nextValue };
        if (nextValue === "single") {
          updated.salePrice = "";
        }
        if (nextValue === "tba") {
          updated.price = "";
          updated.salePrice = "";
          updated.stock = "0";
          updated.allowBackorder = false;
          updated.isRecurring = false;
          updated.recurringInterval = "monthly";
          updated.recurringIntervalCount = "1";
          updated.recurringTotalCycles = "0";
          updated.recurringTrialDays = "0";
        }
        return updated;
      });
      setErrors((prev) => ({ ...prev, price: "", salePrice: "" }));
    } else if (name === "isRecurring") {
      setForm((prev) => {
        const enabled = Boolean(nextValue);
        const base = {
          ...prev,
          isRecurring: enabled,
        };

        if (!enabled) {
          return {
            ...base,
            recurringInterval: "monthly",
            recurringIntervalCount: "1",
            recurringTotalCycles: "0",
            recurringTrialDays: "0",
          };
        }

        if (prev.priceType === "tba" || prev.marketplaceType !== "digital") {
          return {
            ...base,
            isRecurring: false,
            recurringInterval: "monthly",
            recurringIntervalCount: "1",
            recurringTotalCycles: "0",
            recurringTrialDays: "0",
          };
        }

        return base;
      });
    } else {
      setForm((prev) => ({ ...prev, [name]: nextValue }));
      if (errors[name]) validateField(name, nextValue);
    }
  };

  const handleColorAdd = (colorValue) => {
    const normalizedColor = String(colorValue || "").trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(normalizedColor)) {
      return;
    }

    if (!form.colors.includes(normalizedColor)) {
      setForm((prev) => ({
        ...prev,
        colors: [...prev.colors, normalizedColor],
      }));
    }
  };

  const normalizeHexColor = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const withHash = raw.startsWith("#") ? raw : `#${raw}`;
    if (!/^#[0-9a-fA-F]{6}$/.test(withHash)) return "";
    return withHash.toLowerCase();
  };

  const handleCustomColorAdd = () => {
    const normalized = normalizeHexColor(customColorValue);
    if (!normalized) {
      toast.error("Enter a valid hex color like #2563eb");
      return;
    }
    handleColorAdd(normalized);
    setCustomColorValue(normalized);
  };

  const handleColorRemove = (colorToRemove) => {
    setForm((prev) => ({
      ...prev,
      colors: prev.colors.filter((color) => color !== colorToRemove),
    }));
  };

  const handleFeatureAdd = () => {
    setFeatures([...features, ""]);
  };

  const handleFeatureChange = (index, value) => {
    const newFeatures = [...features];
    newFeatures[index] = value;
    setFeatures(newFeatures);
  };

  const handleFeatureRemove = (index) => {
    if (features.length > 1) {
      const newFeatures = features.filter((_, i) => i !== index);
      setFeatures(newFeatures);
    }
  };

  const handleSpecificationAdd = () => {
    setSpecifications([...specifications, { key: "", value: "" }]);
  };

  const handleSpecificationChange = (index, field, value) => {
    const newSpecs = [...specifications];
    newSpecs[index][field] = value;
    setSpecifications(newSpecs);
  };

  const handleSpecificationRemove = (index) => {
    if (specifications.length > 1) {
      const newSpecs = specifications.filter((_, i) => i !== index);
      setSpecifications(newSpecs);
    }
  };

  const handleTogglePublication = async (product) => {
    const productId = String(product?._id || "").trim();
    if (!productId) return;

    const currentStatus =
      String(product?.publicationStatus || "draft").trim().toLowerCase() ===
      "published"
        ? "published"
        : "draft";
    const nextStatus = currentStatus === "published" ? "draft" : "published";
    const toastId = toast.loading(
      nextStatus === "published"
        ? "Publishing product..."
        : "Moving product back to draft...",
    );

    try {
      setPublishingId(productId);
      const payload = new FormData();
      payload.append("publicationStatus", nextStatus);

      const response = await axios.put(`${baseUrl}/products/${productId}`, payload, {
        headers: getAuthHeaders(),
      });
      const updatedProduct = response?.data?.product || response?.data?.data || {};

      toast.success(
        nextStatus === "published"
          ? "Product published successfully"
          : "Product moved to draft successfully",
        { id: toastId },
      );
      setProducts((prev) =>
        prev.map((entry) =>
          String(entry?._id || "") === productId
            ? {
                ...entry,
                ...updatedProduct,
                publicationStatus: updatedProduct.publicationStatus || nextStatus,
              }
            : entry,
        ),
      );
      if (String(editingId || "") === productId) {
        setForm((prev) => ({
          ...prev,
          publicationStatus:
            String(updatedProduct.publicationStatus || nextStatus).trim().toLowerCase() ===
            "published"
              ? "published"
              : "draft",
        }));
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          `Failed to ${nextStatus === "published" ? "publish" : "save draft"}`,
        { id: toastId },
      );
    } finally {
      setPublishingId(null);
    }
  };

  const handleVariantDefinitionAdd = (preset = "custom") => {
    setVariantDefinitions((prev) => [...prev, createVariantDefinition(preset)]);
  };

  const handleVariantDefinitionRemove = (index) => {
    setVariantDefinitions((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleVariantDefinitionChange = (index, field, value) => {
    setVariantDefinitions((prev) =>
      prev.map((definition, currentIndex) => {
        if (currentIndex !== index) return definition;

        if (field === "preset") {
          const previousPreset = String(definition?.preset || "custom");
          const nextRawPreset = String(value || "custom");
          const preset =
            nextRawPreset === "size"
              ? "custom"
              : ["color", "custom"].includes(nextRawPreset)
                ? nextRawPreset
                : "custom";
          const previousDefaultName = getDefaultVariantTypeName(previousPreset);
          const nextDefaultName = getDefaultVariantTypeName(preset);
          const currentName = String(definition?.name || "").trim();
          return {
            preset,
            name:
              !currentName || currentName === previousDefaultName
                ? nextDefaultName
                : currentName,
            options:
              Array.isArray(definition.options) && definition.options.length > 0
                ? definition.options.map((option) =>
                    preset === "color"
                      ? {
                          label: option?.label || option?.value || "Black",
                          value:
                            option?.value && /^#[0-9a-fA-F]{6}$/.test(String(option.value))
                              ? String(option.value).toLowerCase()
                              : "#000000",
                          colorHex:
                            option?.colorHex &&
                            /^#[0-9a-fA-F]{6}$/.test(String(option.colorHex))
                              ? String(option.colorHex).toLowerCase()
                              : "#000000",
                          priceMode: String(option?.priceMode || "default").trim() || "default",
                          price:
                            option?.price === null || option?.price === undefined
                              ? ""
                              : String(option.price),
                          comparePrice:
                            option?.comparePrice === null || option?.comparePrice === undefined
                              ? ""
                              : String(option.comparePrice),
                        }
                      : {
                          label: option?.label || option?.value || "",
                          value: option?.value || option?.label || "",
                          colorHex: "",
                          priceMode: String(option?.priceMode || "default").trim() || "default",
                          price:
                            option?.price === null || option?.price === undefined
                              ? ""
                              : String(option.price),
                          comparePrice:
                            option?.comparePrice === null || option?.comparePrice === undefined
                              ? ""
                              : String(option.comparePrice),
                        },
                  )
                : [createVariantOption(preset)],
          };
        }

        return {
          ...definition,
          [field]: value,
        };
      }),
    );
  };

  const handleVariantOptionAdd = (definitionIndex) => {
    setVariantDefinitions((prev) =>
      prev.map((definition, index) =>
        index === definitionIndex
          ? {
              ...definition,
              options: [...(definition.options || []), createVariantOption(definition.preset)],
            }
          : definition,
      ),
    );
  };

  const handleVariantOptionChange = (definitionIndex, optionIndex, field, value) => {
    setVariantDefinitions((prev) =>
      prev.map((definition, index) => {
        if (index !== definitionIndex) return definition;

        const nextOptions = (definition.options || []).map((option, currentOptionIndex) => {
          if (currentOptionIndex !== optionIndex) return option;

          if (definition.preset === "color" && field === "colorHex") {
            const normalizedColor = normalizeHexColor(value);
            return {
              ...option,
              colorHex: normalizedColor,
              value: normalizedColor,
              label: normalizedColor,
            };
          }

          if (field === "priceMode") {
            return {
              ...option,
              priceMode: value,
              price: value === "default" ? "" : option?.price ?? "",
              comparePrice:
                value === "compare"
                  ? option?.comparePrice ?? ""
                  : "",
            };
          }

          if (field === "price" || field === "comparePrice") {
            return {
              ...option,
              [field]: value,
            };
          }

          if (definition.preset === "color" && field === "label") {
            const normalizedColor = normalizeHexColor(value);
            return {
              ...option,
              label: value,
              value: normalizedColor || option?.value || "",
              colorHex: normalizedColor || option?.colorHex || "",
            };
          }

          if (field === "label" && definition.preset !== "color") {
            return {
              ...option,
              label: value,
              value,
            };
          }

          return {
            ...option,
            [field]: value,
          };
        });

        return {
          ...definition,
          options: nextOptions,
        };
      }),
    );
  };

  const handleVariantOptionRemove = (definitionIndex, optionIndex) => {
    setVariantDefinitions((prev) =>
      prev.map((definition, index) => {
        if (index !== definitionIndex) return definition;
        const remainingOptions = (definition.options || []).filter(
          (_, currentOptionIndex) => currentOptionIndex !== optionIndex,
        );
        return {
          ...definition,
          options: remainingOptions.length > 0
            ? remainingOptions
            : [createVariantOption(definition.preset)],
        };
      }),
    );
  };

  const validateForm = (desiredStatus = "published") => {
    if (String(desiredStatus || "published").trim().toLowerCase() === "draft") {
      setErrors({});
      return true;
    }

    let isValid = true;

    isValid = validateField("title", form.title) && isValid;
    isValid = validateField("description", form.description) && isValid;
    const needsDirectPrice = !["variable", "grouped"].includes(form.marketplaceType);
    if (needsDirectPrice) {
      if (form.priceType === "single") {
        isValid = validateField("price", form.price) && isValid;
      } else if (form.priceType === "best") {
        isValid = validateField("price", form.price) && isValid;
        isValid = validateField("salePrice", form.salePrice) && isValid;
        if (
          !isNaN(parseFloat(form.price)) &&
          !isNaN(parseFloat(form.salePrice)) &&
          parseFloat(form.salePrice) >= parseFloat(form.price)
        ) {
          setErrors((prev) => ({
            ...prev,
            salePrice: "New price must be lower than previous price",
          }));
          isValid = false;
        }
      }
    }
    isValid = validateField("category", form.category) && isValid;

    if (form.isRecurring) {
      if (form.priceType === "tba") {
        toast.error("Recurring product cannot use TBA price type");
        isValid = false;
      }

      if (form.marketplaceType !== "digital") {
        toast.error(
          "Recurring products are allowed only for digital products",
        );
        isValid = false;
      }

      if (!(Number(form.recurringIntervalCount || 0) >= 1)) {
        toast.error("Recurring interval count must be at least 1");
        isValid = false;
      }
    }

    const hasMainImage = Boolean(currentMainImage || mainImagePreview);
    if (!hasMainImage) {
      toast.error("Main product image is required");
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e, desiredStatus = "published") => {
    if (e?.preventDefault) {
      e.preventDefault();
    }

    if (!validateForm(desiredStatus)) {
      toast.error("Please fix all errors before submitting");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(
      editingId ? "Updating product..." : "Creating product...",
    );

    try {
      const token = getToken();
      if (!token) {
        toast.error("Authentication required. Please login again.", {
          id: toastId,
        });
        setIsSubmitting(false);
        return;
      }

      const formData = new FormData();
      const normalizedPublicationStatus =
        String(desiredStatus || "published").trim().toLowerCase() === "published"
          ? "published"
          : "draft";
      const needsDirectPrice = !["variable", "grouped"].includes(form.marketplaceType);
      const normalizedPriceType = needsDirectPrice ? form.priceType : "single";
      const normalizedPrice =
        normalizedPriceType === "tba" ? "0" : form.price || "0";
      const normalizedSalePrice =
        normalizedPriceType === "best" ? form.salePrice || "" : "";
      const normalizedStock =
        normalizedPriceType === "tba" ? "0" : form.stock || "0";

      formData.append("title", form.title.trim());
      formData.append("description", form.description.trim());
      formData.append("publicationStatus", normalizedPublicationStatus);
      formData.append("priceType", normalizedPriceType);
      formData.append("price", normalizedPrice);
      formData.append("salePrice", normalizedSalePrice);
      formData.append("costing", form.costing || "0");
      formData.append("category", form.category);
      formData.append("productType", form.productType);
      formData.append("marketplaceType", form.marketplaceType);
      formData.append("sku", form.sku.trim());
      formData.append("stock", normalizedStock);
      formData.append("lowStockThreshold", form.lowStockThreshold || "5");
      formData.append(
        "allowBackorder",
        String(
          normalizedPriceType === "tba" ? false : Boolean(form.allowBackorder),
        ),
      );
      formData.append("deliveryMinDays", form.deliveryMinDays || "2");
      formData.append("deliveryMaxDays", form.deliveryMaxDays || "5");
      formData.append("downloadUrl", form.downloadUrl.trim());
      formData.append("serviceDurationDays", form.serviceDurationDays || "0");
      formData.append("isRecurring", String(Boolean(form.isRecurring)));
      formData.append("recurringInterval", form.recurringInterval || "monthly");
      formData.append(
        "recurringIntervalCount",
        String(Math.max(1, Number(form.recurringIntervalCount || 1))),
      );
      formData.append(
        "recurringTotalCycles",
        String(Math.max(0, Number(form.recurringTotalCycles || 0))),
      );
      formData.append(
        "recurringTrialDays",
        String(Math.max(0, Number(form.recurringTrialDays || 0))),
      );
      formData.append("brand", form.brand.trim());
      formData.append("weight", form.weight || "0");
      formData.append("dimensions", form.dimensions.trim());
      formData.append(
        "youtubeVideoUrls",
        JSON.stringify(youtubeVideoUrls.map((value) => value.trim()).filter(Boolean)),
      );
      formData.append(
        "variantDefinitions",
        JSON.stringify(getNormalizedVariantDefinitions()),
      );
      formData.append(
        "features",
        JSON.stringify(features.filter((f) => f.trim())),
      );
      formData.append(
        "specifications",
        JSON.stringify(
          specifications.filter((s) => s.key.trim() && s.value.trim()),
        ),
      );

      if (form.marketplaceType === "variable") {
        formData.append("variations", form.variationsJson || "[]");
      } else {
        formData.append("variations", "[]");
      }

      if (form.marketplaceType === "grouped") {
        const groupedProductIds = (form.groupedProductsCsv || "")
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
        formData.append("groupedProducts", JSON.stringify(groupedProductIds));
      } else {
        formData.append("groupedProducts", "[]");
      }

      const existingImages = [];
      if (!mainImagePreview && currentMainImage) {
        existingImages.push(currentMainImageId || currentMainImage);
      }
      currentGalleryImages.forEach((img, idx) => {
        existingImages.push(currentGalleryImageIds[idx] || img);
      });
      formData.append("existingImages", JSON.stringify(existingImages));
      formData.append("existingVideos", JSON.stringify(currentVideos));

      if (mainImageFile) {
        formData.append("images", mainImageFile);
        formData.append("mainImageFirst", "true");
      }
      galleryFiles.forEach((image) => {
        formData.append("images", image);
      });
      videoFiles.forEach((video) => {
        formData.append("videos", video);
      });

      if (editingId) {
        await axios.put(`${baseUrl}/products/${editingId}`, formData, {
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "multipart/form-data",
          },
        });

        toast.success("Product updated successfully!", { id: toastId });
      } else {
        await axios.post(`${baseUrl}/products`, formData, {
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "multipart/form-data",
          },
        });

        toast.success("Product created successfully!", { id: toastId });
      }

      cancelForm();
      fetchProducts();
      fetchCategories();
      fetchBrandOptions();

      window.dispatchEvent(new CustomEvent("productCreated"));
    } catch (err) {
      let errorMessage = editingId
        ? "Failed to update product"
        : "Failed to create product";

      if (err.response?.status === 401) {
        errorMessage = "Authentication failed. Please login again.";
      } else if (err.response?.status === 413) {
        errorMessage = "Image upload failed (file too large)";
      } else if (err.response?.status === 415) {
        errorMessage = "Unsupported file type";
      } else if (err.response?.data?.message) {
        errorMessage = Array.isArray(err.response.data.message)
          ? err.response.data.message.join(", ")
          : err.response.data.message;
      }

      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !showForm) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] w-full">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-2 border-gray-200 border-t-2 border-t-black rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full"
      >
        <div className="w-full">
          {editingId ? (
            <div className="mb-4">
              <button
                onClick={cancelForm}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <FiArrowLeft className="h-4 w-4" />
                Back to products
              </button>
            </div>
          ) : null}

          <form onSubmit={(event) => handleSubmit(event, "published")}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
              {/* Left Column - Main Info */}
              <div className="lg:col-span-2">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="dashboard-form-surface bg-white p-4 md:p-6 border border-gray-200"
                >
                  <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-4 md:mb-6 flex items-center">
                    <FiPackage className="mr-2" /> Product Information
                  </h2>

                  {/* Basic Info */}
                  <div className="space-y-4 md:space-y-6">
                    {/* Title */}
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <FiType className="mr-2" /> Product Title *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        onBlur={() => validateField("title", form.title)}
                        placeholder="Enter product title"
                        className={`w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border ${
                          errors.title ? "border-red-500" : "border-gray-300"
                        } focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base`}
                      />
                      {errors.title && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-red-500 mt-1"
                        >
                          {errors.title}
                        </motion.p>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <FiFileText className="mr-2" /> Description *
                      </label>
                      <RichTextEditor
                        value={form.description}
                        onChange={(value) => {
                          setForm((prev) => ({ ...prev, description: value }));
                          if (errors.description) validateField("description", value);
                        }}
                        placeholder="Enter product description"
                        minHeight={220}
                      />
                      {errors.description && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-red-500 mt-1"
                        >
                          {errors.description}
                        </motion.p>
                      )}
                    </div>

                    {/* Price */}
                    <div className="grid grid-cols-1 gap-3 md:gap-4">
                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          Price Type *
                        </label>
                        <SearchableSelect
                          value={form.priceType}
                          onChange={(value) =>
                            handleChange({ target: { name: "priceType", value } })
                          }
                          options={priceTypes}
                          placeholder="Price Type"
                          searchable={false}
                          className="min-w-0"
                          buttonClassName="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                          menuClassName="rounded-xl"
                        />
                      </div>

                      {form.priceType === "single" && (
                          <div>
                            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                              Price (Tk) *
                            </label>
                            <input
                              type="number"
                              name="price"
                              value={form.price}
                              onChange={handleChange}
                              onBlur={() => validateField("price", form.price)}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              className={`w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border ${
                                errors.price ? "border-red-500" : "border-gray-300"
                              } focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base`}
                            />
                            {errors.price && (
                              <p className="text-sm text-red-500 mt-1">{errors.price}</p>
                            )}
                          </div>
                        )}

                      {form.priceType === "best" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <div>
                              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                                Previous Price (Tk) *
                              </label>
                              <input
                                type="number"
                                name="price"
                                value={form.price}
                                onChange={handleChange}
                                onBlur={() => validateField("price", form.price)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                className={`w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border ${
                                  errors.price ? "border-red-500" : "border-gray-300"
                                } focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base`}
                              />
                              {errors.price && (
                                <p className="text-sm text-red-500 mt-1">{errors.price}</p>
                              )}
                            </div>
                            <div>
                              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                                New Price (Tk) *
                              </label>
                              <input
                                type="number"
                                name="salePrice"
                                value={form.salePrice}
                                onChange={handleChange}
                                onBlur={() => validateField("salePrice", form.salePrice)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                className={`w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border ${
                                  errors.salePrice ? "border-red-500" : "border-gray-300"
                                } focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base`}
                              />
                              {errors.salePrice && (
                                <p className="text-sm text-red-500 mt-1">{errors.salePrice}</p>
                              )}
                            </div>
                          </div>
                        )}

                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          Product Costing (Tk)
                        </label>
                        <input
                          type="number"
                          name="costing"
                          value={form.costing}
                          onChange={handleChange}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Used for estimated profit and revenue analytics.
                        </p>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 md:px-4 py-3 text-sm text-gray-700">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">Estimated Profit (per unit)</span>
                          <span className="font-semibold text-black">
                            {(() => {
                              const sellPrice =
                                form.priceType === "tba"
                                  ? 0
                                  : Number(
                                      form.priceType === "best"
                                        ? form.salePrice || form.price || 0
                                        : form.price || 0,
                                    );
                              const cost = Number(form.costing || 0);
                              return `${(sellPrice - cost).toFixed(2)} Tk`;
                            })()}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                          <span>Gross Margin</span>
                          <span>
                            {(() => {
                              const sellPrice =
                                form.priceType === "tba"
                                  ? 0
                                  : Number(
                                      form.priceType === "best"
                                        ? form.salePrice || form.price || 0
                                        : form.price || 0,
                                    );
                              if (sellPrice <= 0) return "0.0%";
                              const cost = Number(form.costing || 0);
                              return `${(((sellPrice - cost) / sellPrice) * 100).toFixed(1)}%`;
                            })()}
                          </span>
                        </div>
                      </div>

                      {form.priceType === "tba" && (
                          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
                            This product will show <span className="font-semibold">TBA</span>{" "}
                            instead of price and cannot be purchased until price type changes.
                          </div>
                        )}
                    </div>

                    {/* Product Type */}
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        Product Type *
                      </label>
                      <SearchableSelect
                        value={form.productType}
                        onChange={(value) =>
                          handleChange({ target: { name: "productType", value } })
                        }
                        options={productTypes.map((type) => ({
                          value: type,
                          label: type,
                        }))}
                        placeholder="Product Type"
                        searchable={false}
                        className="min-w-0"
                        buttonClassName="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                        menuClassName="rounded-xl"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Type of product for grouping
                      </p>
                    </div>

                    {/* Category */}
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <FiTag className="mr-2" /> Category *
                      </label>
                      <SearchableSelect
                        value={form.category}
                        onChange={(value) =>
                          handleChange({ target: { name: "category", value } })
                        }
                        options={[
                          {
                            value: "",
                            label:
                              filteredCategories.length === 0
                                ? `No categories available for ${form.productType} type`
                                : "Select a category",
                          },
                          ...filteredCategories.map((cat) => ({
                            value: cat._id,
                            label: `${cat.name} (${cat.type || "General"})`,
                          })),
                        ]}
                        placeholder="Select a category"
                        searchable={false}
                        className="min-w-0"
                        buttonClassName={`w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border ${
                          errors.category ? "border-red-500" : "border-gray-300"
                        } focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base`}
                        menuClassName="rounded-xl"
                      />
                      {filteredCategories.length === 0 && (
                        <p className="text-sm text-yellow-600 mt-1">
                          No categories found for {form.productType} type.
                          Please create a category first.
                        </p>
                      )}
                      {errors.category && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-red-500 mt-1"
                        >
                          {errors.category}
                        </motion.p>
                      )}
                    </div>

                    {/* Brand */}
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <FiPackage className="mr-2" /> Brand
                      </label>
                      <SearchableSelect
                        value={form.brand}
                        onChange={(value) => setForm((prev) => ({ ...prev, brand: value }))}
                        options={brandSelectOptions}
                        placeholder="Select a brand"
                        searchPlaceholder="Search brands"
                        emptyLabel="No matching brands found"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          Marketplace Type *
                        </label>
                        <SearchableSelect
                          value={form.marketplaceType}
                          onChange={(value) =>
                            handleChange({ target: { name: "marketplaceType", value } })
                          }
                          options={marketplaceTypes}
                          placeholder="Marketplace Type"
                          searchable={false}
                          className="min-w-0"
                          buttonClassName="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                          menuClassName="rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          SKU
                        </label>
                        <input
                          type="text"
                          name="sku"
                          value={form.sku}
                          onChange={handleChange}
                          placeholder="Stock keeping unit"
                          className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          Stock Qty
                        </label>
                        <input
                          type="number"
                          name="stock"
                          value={form.stock}
                          onChange={handleChange}
                          placeholder="0"
                          min="0"
                          disabled={form.priceType === "tba"}
                          className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                        />
                      </div>
                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          Low Stock Alert
                        </label>
                        <input
                          type="number"
                          name="lowStockThreshold"
                          value={form.lowStockThreshold}
                          onChange={handleChange}
                          placeholder="5"
                          min="0"
                          className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            name="allowBackorder"
                            checked={form.allowBackorder}
                            onChange={handleChange}
                            disabled={form.priceType === "tba"}
                            style={{ accentColor: themeColor }}
                          />
                          Allow Backorder
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          Delivery Min Days
                        </label>
                        <input
                          type="number"
                          name="deliveryMinDays"
                          value={form.deliveryMinDays}
                          onChange={handleChange}
                          placeholder="2"
                          min="0"
                          className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                        />
                      </div>
                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          Delivery Max Days
                        </label>
                        <input
                          type="number"
                          name="deliveryMaxDays"
                          value={form.deliveryMaxDays}
                          onChange={handleChange}
                          placeholder="5"
                          min="0"
                          className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                        />
                      </div>
                    </div>

                    {form.marketplaceType === "digital" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Download URL
                        </label>
                        <input
                          type="url"
                          name="downloadUrl"
                          value={form.downloadUrl}
                          onChange={handleChange}
                          placeholder="https://example.com/download/file.zip"
                          className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                        />
                      </div>
                    )}

                    {form.marketplaceType === "digital" ? (
                    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          name="isRecurring"
                          checked={Boolean(form.isRecurring)}
                          onChange={handleChange}
                          disabled={form.priceType === "tba"}
                          style={{ accentColor: themeColor }}
                        />
                        Enable recurring subscription billing
                      </label>
                      <p className="text-xs text-gray-500">
                        Recurring billing is available only for digital products.
                      </p>

                      {Boolean(form.isRecurring) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Billing Interval
                            </label>
                            <SearchableSelect
                              value={form.recurringInterval}
                              onChange={(value) =>
                                handleChange({ target: { name: "recurringInterval", value } })
                              }
                              options={[
                                { value: "weekly", label: "Weekly" },
                                { value: "monthly", label: "Monthly" },
                                { value: "quarterly", label: "Quarterly" },
                                { value: "yearly", label: "Yearly" },
                              ]}
                              placeholder="Billing Interval"
                              searchable={false}
                              className="min-w-0"
                              buttonClassName="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 text-sm"
                              menuClassName="rounded-xl"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Interval Count
                            </label>
                            <input
                              type="number"
                              name="recurringIntervalCount"
                              value={form.recurringIntervalCount}
                              onChange={handleChange}
                              min="1"
                              max="24"
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Renewal Cycles
                            </label>
                            <input
                              type="number"
                              name="recurringTotalCycles"
                              value={form.recurringTotalCycles}
                              onChange={handleChange}
                              min="0"
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 text-sm"
                            />
                            <p className="text-[11px] text-gray-500 mt-1">0 = Unlimited</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Trial Days
                            </label>
                            <input
                              type="number"
                              name="recurringTrialDays"
                              value={form.recurringTrialDays}
                              onChange={handleChange}
                              min="0"
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    ) : null}

                    {/* Physical Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          <FiBox className="mr-2" /> Weight (kg)
                        </label>
                        <input
                          type="number"
                          name="weight"
                          value={form.weight}
                          onChange={handleChange}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                        />
                      </div>
                      <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                          <FiLayers className="mr-2" /> Dimensions
                        </label>
                        <input
                          type="text"
                          name="dimensions"
                          value={form.dimensions}
                          onChange={handleChange}
                          placeholder="e.g., 10×5×2 cm"
                          className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                        />
                      </div>
                    </div>

                    {/* Features */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Key Features
                      </label>
                      {features.map((feature, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={feature}
                            onChange={(e) =>
                              handleFeatureChange(index, e.target.value)
                            }
                            className="flex-1 px-3 md:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:border-gray-500 text-sm md:text-base"
                            placeholder="Enter a feature"
                          />
                          {features.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleFeatureRemove(index)}
                              className="px-3 py-2 text-red-600 hover:text-red-800"
                            >
                              <FiX />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleFeatureAdd}
                        className="mt-2 flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm"
                      >
                        <FiPlus /> Add Feature
                      </button>
                    </div>

                    {/* Specifications */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Specifications
                      </label>
                      {specifications.map((spec, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2"
                        >
                          <input
                            type="text"
                            value={spec.key}
                            onChange={(e) =>
                              handleSpecificationChange(
                                index,
                                "key",
                                e.target.value,
                              )
                            }
                            className="px-3 md:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:border-gray-500 text-sm md:text-base"
                            placeholder="Key"
                          />
                          <input
                            type="text"
                            value={spec.value}
                            onChange={(e) =>
                              handleSpecificationChange(
                                index,
                                "value",
                                e.target.value,
                              )
                            }
                            className="px-3 md:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:border-gray-500 text-sm md:text-base"
                            placeholder="Value"
                          />
                          {specifications.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleSpecificationRemove(index)}
                              className="px-3 py-2 text-red-600 hover:text-red-800 flex items-center justify-center"
                            >
                              <FiTrash2 />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleSpecificationAdd}
                        className="mt-2 flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm"
                      >
                        <FiPlus /> Add Specification
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Right Column - Images & Colors */}
              <div className="space-y-4 md:space-y-6 lg:space-y-8">
                {/* Images Upload */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="dashboard-form-surface bg-white p-4 md:p-6 border border-gray-200"
                >
                  <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-4 flex items-center">
                    <FiImage className="mr-2" /> Product Images *
                  </h2>

                  {/* Main Image Upload */}
                  <div className="mb-4 md:mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Main Product Image *
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 md:p-6 text-center hover:border-gray-500 transition-colors">
                      {mainImagePreview ? (
                        <div className="relative">
                          <img
                            src={mainImagePreview}
                            alt="Main product preview"
                            className="w-full h-40 md:h-48 object-contain rounded-lg mx-auto"
                          />
                          <button
                            type="button"
                            onClick={removeMainImage}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                          >
                            <FiX size={14} />
                          </button>
                          <div className="text-xs text-gray-500 mt-2 text-center">
                            New Main Image
                          </div>
                        </div>
                      ) : currentMainImage ? (
                        <div className="relative">
                          <ProductImage
                            src={currentMainImage}
                            alt="Current main product"
                            className="w-full h-40 md:h-48 object-contain rounded-lg mx-auto"
                            isCurrent={true}
                          />
                          <button
                            type="button"
                            onClick={removeMainImage}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                          >
                            <FiX size={14} />
                          </button>
                          <div className="text-xs text-gray-500 mt-2 text-center">
                            Current Main Image
                          </div>
                        </div>
                      ) : (
                        <>
                          <FiImage className="mx-auto text-gray-400 text-2xl md:text-3xl mb-2" />
                          <p className="text-gray-600 mb-2 text-sm md:text-base">
                            Click to upload main product image
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleMainImageChange}
                            className="hidden"
                            id="main-image-upload"
                          />
                          <label
                            htmlFor="main-image-upload"
                            className="inline-flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-900 text-white rounded-lg cursor-pointer hover:bg-gray-800 transition-colors text-sm md:text-base"
                          >
                            <FiUpload /> Upload Main Image
                          </label>
                      <p className="text-xs text-gray-500 mt-2">
                        JPG, PNG, WebP, GIF (auto-optimized on upload)
                      </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Gallery Images Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gallery Images ({currentGalleryImages.length + galleryPreviews.length}/4)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 md:p-4 text-center hover:border-gray-500 transition-colors">
                      <p className="text-gray-600 mb-2 text-sm md:text-base">
                        Add up to 4 images for product gallery
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleGalleryChange}
                        className="hidden"
                        id="gallery-upload"
                        disabled={currentGalleryImages.length + galleryPreviews.length >= 4}
                      />
                      <label
                        htmlFor="gallery-upload"
                        className={`inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg cursor-pointer text-sm md:text-base ${
                          currentGalleryImages.length + galleryPreviews.length >= 4
                            ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                            : "bg-gray-900 text-white hover:bg-gray-800"
                        }`}
                      >
                        <FiUpload /> Add Gallery Images
                      </label>
                      <p className="text-xs text-gray-500 mt-2">
                        JPG, PNG, WebP, GIF (auto-optimized on upload)
                      </p>
                    </div>

                    {/* Current Gallery Images */}
                    {currentGalleryImages.length > 0 && (
                      <div className="mt-3 md:mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Current Gallery
                        </label>
                        <div className="grid grid-cols-2 gap-2 md:gap-3">
                          {currentGalleryImages.map((image, index) => (
                            <div
                              key={`current-gallery-${index}`}
                              className="relative group"
                            >
                              <ProductImage
                                src={image}
                                alt={`Current gallery ${index + 1}`}
                                className="w-full h-28 md:h-32 object-cover rounded-lg"
                                isCurrent={true}
                              />
                              <button
                                type="button"
                                onClick={() => removeGalleryImage(index, true)}
                                className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <FiX size={12} />
                              </button>
                              <div className="text-xs text-gray-500 mt-1 text-center">
                                Gallery {index + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New Gallery Previews */}
                    {galleryPreviews.length > 0 && (
                      <div className="mt-3 md:mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          New Gallery Preview
                        </label>
                        <div className="grid grid-cols-2 gap-2 md:gap-3">
                          {galleryPreviews.map((preview, index) => (
                            <div key={`new-gallery-${index}`} className="relative group">
                              <img
                                src={preview}
                                alt={`New gallery ${index + 1}`}
                                className="w-full h-28 md:h-32 object-cover rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => removeGalleryImage(index, false)}
                                className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <FiX size={12} />
                              </button>
                              <div className="text-xs text-gray-500 mt-1 text-center">
                                New Gallery {index + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 md:mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Video (Optional)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 md:p-4 text-center hover:border-gray-500 transition-colors">
                      {currentVideos.length > 0 ? (
                        <div className="grid gap-3 md:grid-cols-3">
                          {currentVideos.map((video, index) => (
                            <div key={`current-video-${index}`} className="relative">
                              <video
                                src={video.url}
                                className="h-40 w-full rounded-lg bg-black object-contain"
                                preload="metadata"
                                controls
                                controlsList="nodownload"
                              />
                              <button
                                type="button"
                                onClick={() => removeVideo(index, true)}
                                className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                              >
                                <FiX size={14} />
                              </button>
                              <div className="text-xs text-gray-500 mt-2 text-center">
                                Current video {index + 1}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {videoPreviews.length > 0 ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          {videoPreviews.map((preview, index) => (
                            <div key={`new-video-${index}`} className="relative">
                              <video
                                src={preview}
                                className="h-40 w-full rounded-lg bg-black object-contain"
                                preload="metadata"
                                controls
                                controlsList="nodownload"
                              />
                              <button
                                type="button"
                                onClick={() => removeVideo(index, false)}
                                className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                              >
                                <FiX size={14} />
                              </button>
                              <div className="text-xs text-gray-500 mt-2 text-center">
                                {videoFiles[index]?.name || `New video ${index + 1}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {currentVideos.length + videoFiles.length < MAX_PRODUCT_VIDEO_UPLOADS ? (
                        <>
                          <FiUpload className="mx-auto text-gray-400 text-2xl md:text-3xl mb-2 mt-2" />
                          <p className="text-gray-600 mb-2 text-sm md:text-base">
                            Upload up to {MAX_PRODUCT_VIDEO_UPLOADS} product videos, 9 MB each
                          </p>
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/ogg,video/quicktime"
                            onChange={handleVideoChange}
                            className="hidden"
                            id="product-video-upload"
                            multiple
                          />
                          <label
                            htmlFor="product-video-upload"
                            className="inline-flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-900 text-white rounded-lg cursor-pointer hover:bg-gray-800 transition-colors text-sm md:text-base"
                          >
                            <FiUpload /> Upload Video
                          </label>
                          <p className="text-xs text-gray-500 mt-2">
                            MP4, WebM, OGG, MOV. Keep each file at 9 MB or less.
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      YouTube Video Links (Optional)
                    </label>
                    <div className="space-y-3">
                      {youtubeVideoUrls.map((value, index) => (
                        <div key={`youtube-link-${index}`} className="flex gap-2">
                          <input
                            type="url"
                            value={value}
                            onChange={(event) =>
                              handleYoutubeUrlChange(index, event.target.value)
                            }
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                          />
                          <button
                            type="button"
                            onClick={() => removeYoutubeField(index)}
                            className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 text-red-600 transition hover:bg-red-50"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addYoutubeField}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:text-black"
                      >
                        <FiPlus /> Add YouTube Link
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      These links will appear in the product gallery beside the images and uploaded videos.
                    </p>
                  </div>
                </motion.div>

                {/* Variants */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="dashboard-form-surface bg-white p-4 md:p-6 border border-gray-200"
                >
                  <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-4">
                    Product Variants
                  </h2>

                  <div className="space-y-3 md:space-y-4">
                    <p className="text-sm text-gray-500">
                      Variants are optional. Use preset types like{" "}
                      <span className="font-semibold">Color</span>, or switch to{" "}
                      <span className="font-semibold">Custom</span> to name your own variant group.
                    </p>

                    {variantDefinitions.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-500">
                        No variants added yet.
                      </div>
                    ) : null}

                    {variantDefinitions.map((definition, definitionIndex) => (
                      <div
                        key={`variant-${definitionIndex}`}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                          <SearchableSelect
                            value={definition.preset}
                            onChange={(value) =>
                              handleVariantDefinitionChange(
                                definitionIndex,
                                "preset",
                                value,
                              )
                            }
                            options={[
                              { value: "color", label: "Color" },
                              { value: "custom", label: "Custom" },
                            ]}
                            placeholder="Preset"
                            searchable={false}
                            className="min-w-0"
                            buttonClassName="w-full md:w-40 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
                            menuClassName="rounded-xl"
                          />

                          <input
                            type="text"
                            value={definition.name}
                            onChange={(event) =>
                              handleVariantDefinitionChange(
                                definitionIndex,
                                "name",
                                event.target.value,
                              )
                            }
                            placeholder={
                              definition.preset === "color"
                                ? "Variant type name, e.g. Color"
                                : "Custom variant type name"
                            }
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm"
                          />

                          <button
                            type="button"
                            onClick={() => handleVariantDefinitionRemove(definitionIndex)}
                            className="inline-flex h-10 items-center justify-center rounded-lg border border-red-200 px-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Remove Type
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(definition.options || []).map((option, optionIndex) => (
                            <div
                              key={`variant-${definitionIndex}-option-${optionIndex}`}
                              className="rounded-xl border border-gray-200 bg-white p-3"
                            >
                              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                {definition.preset === "color" ? (
                                  <>
                                    <input
                                      type="color"
                                      value={option.colorHex || "#000000"}
                                      onChange={(event) =>
                                        handleVariantOptionChange(
                                          definitionIndex,
                                          optionIndex,
                                          "colorHex",
                                          event.target.value,
                                        )
                                      }
                                      className="h-10 w-full rounded-lg border border-gray-300 bg-white p-1 md:w-16"
                                    />
                                    <input
                                      type="text"
                                      value={option.label}
                                      onChange={(event) =>
                                        handleVariantOptionChange(
                                          definitionIndex,
                                          optionIndex,
                                          "label",
                                          event.target.value,
                                        )
                                      }
                                      placeholder="Color label"
                                      className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                                    />
                                  </>
                                ) : (
                                  <input
                                    type="text"
                                    value={option.label}
                                    onChange={(event) =>
                                      handleVariantOptionChange(
                                        definitionIndex,
                                        optionIndex,
                                        "label",
                                        event.target.value,
                                      )
                                    }
                                    placeholder={
                                      "Add custom option"
                                    }
                                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleVariantOptionRemove(definitionIndex, optionIndex)
                                  }
                                  className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 transition hover:border-red-300 hover:text-red-600"
                                >
                                  <FiX className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="space-y-2">
                                <SearchableSelect
                                  value={option.priceMode || "default"}
                                  onChange={(value) =>
                                    handleVariantOptionChange(
                                      definitionIndex,
                                      optionIndex,
                                      "priceMode",
                                      value,
                                    )
                                  }
                                  options={VARIANT_PRICE_MODE_OPTIONS}
                                  placeholder="Price Mode"
                                  searchable={false}
                                  className="min-w-0"
                                  buttonClassName="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                                  menuClassName="rounded-xl"
                                />

                                {String(option.priceMode || "default") === "direct" ? (
                                  <div className="space-y-1">
                                    <label className="block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                                      Direct Price
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={option.price ?? ""}
                                      onChange={(event) =>
                                        handleVariantOptionChange(
                                          definitionIndex,
                                          optionIndex,
                                          "price",
                                          event.target.value,
                                        )
                                      }
                                      placeholder="Direct price"
                                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                                    />
                                  </div>
                                ) : null}

                                {String(option.priceMode || "default") === "compare" ? (
                                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                    <div className="space-y-1">
                                      <label className="block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                                        Old Price
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={option.comparePrice ?? ""}
                                        onChange={(event) =>
                                          handleVariantOptionChange(
                                            definitionIndex,
                                            optionIndex,
                                            "comparePrice",
                                            event.target.value,
                                          )
                                        }
                                        placeholder="Old price"
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="block text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                                        New Price
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={option.price ?? ""}
                                        onChange={(event) =>
                                          handleVariantOptionChange(
                                            definitionIndex,
                                            optionIndex,
                                            "price",
                                            event.target.value,
                                          )
                                        }
                                        placeholder="New price"
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                                      />
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleVariantOptionAdd(definitionIndex)}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-black hover:text-black"
                        >
                          <FiPlus className="w-4 h-4" />
                          Add Option
                        </button>
                      </div>
                    ))}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleVariantDefinitionAdd("color")}
                        className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-900"
                      >
                        <FiPlus className="w-4 h-4" />
                        Add Color
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVariantDefinitionAdd("custom")}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-black"
                      >
                        <FiPlus className="w-4 h-4" />
                        Add Custom Variant
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Submit & Cancel Buttons */}
                <div className="space-y-2 md:space-y-3">
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="w-full py-2 md:py-3 px-3 md:px-4 rounded-lg font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all shadow-sm md:shadow-md text-sm md:text-base"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={(event) => handleSubmit(event, "draft")}
                    disabled={isSubmitting}
                    className="w-full py-2 md:py-3 px-3 md:px-4 rounded-lg font-medium text-gray-900 bg-amber-100 border border-amber-200 hover:bg-amber-200 transition-all shadow-sm md:shadow-md flex items-center justify-center text-sm md:text-base disabled:opacity-60"
                  >
                    {isSubmitting ? "Saving draft..." : editingId ? "Save Draft" : "Create Draft"}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-2 md:py-3 px-3 md:px-4 rounded-lg font-medium text-white ${
                      isSubmitting
                        ? "bg-gray-600 cursor-not-allowed"
                        : "bg-gray-900 hover:bg-gray-800"
                    } transition-all shadow-sm md:shadow-md flex items-center justify-center text-sm md:text-base`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Publishing...
                      </>
                    ) : editingId ? (
                      "Publish Product"
                    ) : (
                      "Create & Publish"
                    )}
                  </motion.button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <div className="w-full">
        {/* Products List */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="dashboard-form-surface bg-white p-4 md:p-6 border border-gray-200"
        >
          <div className="py-1 border-b border-gray-100 mb-4 md:mb-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  Product Library
                </p>
                <h2 className="mt-1 text-lg font-semibold text-black">
                  Manage products
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Search and narrow the catalog by category, brand, and publication state.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {visibleProducts.length} / {products.length} products
                </span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Refresh"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  <span className="hidden md:inline">Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={startCreating}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                  <span className="hidden md:inline">Add Product</span>
                  <span className="md:hidden">Add</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
              <input
                value={listSearch}
                onChange={(event) => setListSearch(event.target.value)}
                placeholder="Search products"
                className="min-h-[46px] rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-black placeholder:text-gray-400 focus:border-black focus:outline-none"
              />
              <SearchableSelect
                value={listCategoryType}
                onChange={setListCategoryType}
                options={categoryTypeOptions}
                placeholder="All category types"
                searchPlaceholder="Search category types"
                emptyLabel="No category type found"
                clearable
              />
              <SearchableSelect
                value={listCategory}
                onChange={setListCategory}
                options={[{ value: "", label: "All categories" }, ...categoryFilterOptions]}
                placeholder="All categories"
                searchPlaceholder="Search categories"
                emptyLabel="No matching categories found"
                clearable
              />
              <SearchableSelect
                value={listBrand}
                onChange={setListBrand}
                options={brandFilterOptions}
                placeholder="All brands"
                searchPlaceholder="Search brands"
                emptyLabel="No matching brands found"
                clearable
              />
              <SearchableSelect
                value={listPublicationStatus}
                onChange={setListPublicationStatus}
                options={publicationStatusOptions}
                placeholder="All statuses"
                searchable={false}
                clearable
              />
            </div>

            {hasActiveListFilters ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={clearListFilters}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-black hover:text-black"
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>

          {products.length === 0 ? (
            <div className="py-8 md:py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">
                No products found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new product.
              </p>
              <div className="mt-4 md:mt-6">
                <button
                  onClick={startCreating}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                  Create Your First Product
                </button>
              </div>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="py-8 md:py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M10 6h10M10 12h10M10 18h10M4 6h.01M4 12h.01M4 18h.01"
                />
              </svg>
              <h3 className="mt-2 text-lg font-medium text-gray-900">
                No products match your filters
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Try clearing the search or dropdown filters to see more products.
              </p>
              <div className="mt-4 md:mt-6">
                <button
                  type="button"
                  onClick={clearListFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:gap-6">
              {visibleProducts.map((product) => (
                <motion.div
                  key={product._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                      {/* Product Image */}
                      <div className="shrink-0 self-center">
                        <div className="relative w-full h-full md:w-40 md:h-40 rounded-lg overflow-hidden">
                          <ProductImage
                            src={product.images && product.images[0]}
                            alt={product.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      {/* Product Details */}
                      <div className="flex-1">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2">
                          <div className="flex-1">
                            {(() => {
                          const variantPricingGroups = getVariantPricingGroups(product);
                          const basePricing = getBaseProductPricingSummary(product);
                          const hasColorVariantGroup = variantPricingGroups.some(
                            (group) => String(group?.preset || "").trim().toLowerCase() === "color",
                          );
                          return (
                            <>
                            <div className="flex items-center gap-2 mb-2">
                              <h2 className="text-lg md:text-xl font-semibold text-gray-900 line-clamp-1">
                                {product.title}
                              </h2>
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.16em] ${
                                  String(product.publicationStatus || "draft").toLowerCase() ===
                                  "published"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {String(product.publicationStatus || "draft")}
                              </span>
                            </div>
                            <p className="text-gray-600 text-xs md:text-sm mb-3 line-clamp-2">
                              {stripHtml(product.description)}
                            </p>

                            <div className="flex flex-wrap gap-1 md:gap-2 mb-3">
                              <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                                {product.category?.name || "Uncategorized"}
                              </span>
                              <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded">
                                {product.productType || "General"}
                              </span>
                              <span className="bg-gray-900 text-white text-xs px-2 py-1 rounded capitalize">
                                {product.marketplaceType || "simple"}
                              </span>
                            </div>

                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                                Product Price
                              </span>
                              {renderBaseProductPriceBadge(basePricing)}
                            </div>

                            {variantPricingGroups.length ? (
                              <div className="mb-3 space-y-2">
                                {variantPricingGroups.map((group) => (
                                  <div key={group.name} className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-semibold uppercase tracking-[0.18em] text-gray-500">
                                      {group.name}
                                    </span>
                                    {group.options.map((option) => (
                                      <span
                                        key={`${group.name}-${option.label}-${option.colorHex || option.currentPrice}`}
                                        className="inline-flex flex-wrap items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1"
                                      >
                                        {String(group?.preset || "").trim().toLowerCase() === "color" &&
                                        option.colorHex ? (
                                          <span
                                            className="h-3.5 w-3.5 rounded-full border border-black/10"
                                            style={{ backgroundColor: option.colorHex }}
                                            title={option.label}
                                          />
                                        ) : (
                                          <span className="font-medium text-gray-700">
                                            {option.label}
                                          </span>
                                        )}
                                        {option.isTba ? (
                                          <span className="font-semibold text-gray-900">TBA</span>
                                        ) : option.showPrice && option.previousPrice !== null ? (
                                          <>
                                            <span className="text-gray-400 line-through">
                                              {option.previousPrice.toFixed(2)} Tk
                                            </span>
                                            <span className="font-semibold text-gray-900">
                                              {option.currentPrice.toFixed(2)} Tk
                                            </span>
                                          </>
                                        ) : option.showPrice ? (
                                          <span className="font-semibold text-gray-900">
                                            {option.currentPrice.toFixed(2)} Tk
                                          </span>
                                        ) : option.usesProductPrice ? (
                                          <span className="text-[11px] font-medium text-gray-500">
                                            No extra charge needed
                                          </span>
                                        ) : null}
                                      </span>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            {/* Colors Preview */}
                            {!hasColorVariantGroup && product.colors && product.colors.length > 0 && (
                              <div className="mb-2 flex items-center gap-1">
                                <div className="flex gap-1">
                                  {product.colors
                                    .slice(0, 3)
                                    .map((color, idx) => (
                                      <div
                                        key={idx}
                                        className="w-3 h-3 md:w-4 md:h-4 rounded-full border border-gray-300"
                                        style={{ backgroundColor: color }}
                                        title={color}
                                      />
                                    ))}
                                  {product.colors.length > 3 && (
                                    <span className="text-xs text-gray-500">
                                      +{product.colors.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                                </>
                              );
                            })()}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 self-end md:self-start">
                            <button
                              onClick={() => handleDuplicate(product._id)}
                              className="text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50 transition-colors"
                              title="Duplicate"
                            >
                              <FiCopy className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleTogglePublication(product)}
                              disabled={publishingId === product._id}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 ${
                                String(product.publicationStatus || "draft")
                                  .trim()
                                  .toLowerCase() === "published"
                                  ? "text-amber-700 bg-amber-50 hover:bg-amber-100"
                                  : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                              }`}
                              title={
                                String(product.publicationStatus || "draft")
                                  .trim()
                                  .toLowerCase() === "published"
                                  ? "Move to draft"
                                  : "Publish"
                              }
                            >
                              <FiUpload className="w-5 h-5" />
                              <span>
                                {publishingId === product._id
                                  ? "Saving..."
                                  : String(product.publicationStatus || "draft")
                                        .trim()
                                        .toLowerCase() === "published"
                                    ? "Draft"
                                    : "Publish"}
                              </span>
                            </button>
                            <button
                              onClick={() => startEditing(product._id)}
                              className="text-gray-600 hover:text-gray-800 p-2 rounded-full hover:bg-gray-50 transition-colors"
                              title="Edit"
                            >
                              <FiEdit2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(product)}
                              className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <FiTrash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {/* Product Meta */}
                        <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                          <div className="text-xs md:text-sm text-gray-500">
                            Created:{" "}
                            {product.createdAt
                              ? new Date(product.createdAt).toLocaleDateString()
                              : "N/A"}
                          </div>
                          {product.brand && (
                            <div className="text-xs md:text-sm text-gray-600">
                              Brand: {product.brand}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          <ConfirmModal
            isOpen={Boolean(deleteConfirm)}
            title="Delete product"
            message={
              deleteConfirm?.title
                ? `Delete "${deleteConfirm.title}" product?`
                : "Delete this product?"
            }
            confirmLabel="Delete"
            isDanger
            isLoading={isDeleting}
            onCancel={() => setDeleteConfirm(null)}
            onConfirm={confirmDeleteProduct}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

export default ProductModify;

