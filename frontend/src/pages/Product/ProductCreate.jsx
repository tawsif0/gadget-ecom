/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import axios from "axios";
import RichTextEditor from "../../components/RichTextEditor";
import SearchableSelect from "../../components/SearchableSelect";
import { useThemeColors } from "../../hooks/useThemeColors";
import { stripHtml } from "../../utils/richText";
import {
  isAllowedProductVideoType,
  MAX_PRODUCT_VIDEO_UPLOADS,
  MAX_PRODUCT_VIDEO_SIZE_BYTES,
} from "../../utils/productMedia";
import {
  FiImage,
  FiUpload,
  FiType,
  FiFileText,
  FiDollarSign,
  FiTag,
  FiPackage,
  FiBox,
  FiLayers,
  FiTruck,
  FiX,
  FiPlus,
  FiTrash2,
} from "react-icons/fi";

const ProductCreate = () => {
  const { themeColor } = useThemeColors();
  const baseUrl = import.meta.env.VITE_API_URL;

  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Separate state for main image and gallery images
  const [mainImageFile, setMainImageFile] = useState(null);
  const [mainImagePreview, setMainImagePreview] = useState("");
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [galleryPreviews, setGalleryPreviews] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);
  const [videoPreviews, setVideoPreviews] = useState([]);
  const [youtubeVideoUrls, setYoutubeVideoUrls] = useState([""]);

  // Form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    sku: "",
    stock: "0",
    lowStockThreshold: "5",
    allowBackorder: false,
    category: "",
    productType: "General",
    brand: "",
    weight: "",
    dimensions: "",
    deliveryMinDays: "2",
    deliveryMaxDays: "5",
    colors: [],
  });

  const [errors, setErrors] = useState({});
  const [customColorValue, setCustomColorValue] = useState("#2563eb");
  const [brandOptions, setBrandOptions] = useState([]);

  const [features, setFeatures] = useState([""]);
  const [specifications, setSpecifications] = useState([
    { key: "", value: "" },
  ]);

  // Product type options - same as category types
  const productTypes = [
    "General",
    "Popular",
    "Hot deals",
    "Best Selling",
    "Latest",
  ];

  const getToken = () => {
    return localStorage.getItem("token");
  };

  const getAuthHeaders = () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

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
    } catch (err) {
      toast.error("Failed to load category options");

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

  const normalizeTypeKey = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  const resolveCategoryTypeLabel = (value) => {
    const key = normalizeTypeKey(value);
    if (!key) return "General";

    const match = productTypes.find((label) => normalizeTypeKey(label) === key);
    return match || String(value || "").trim() || "General";
  };

  const resolveCategoryTypeKey = (category) => {
    const rawType = category?.type ?? category?.categoryType ?? category?.productType;
    const key = normalizeTypeKey(rawType);
    return key || "general";
  };

  const filterCategoriesByType = (type, categoriesList = categories) => {
    const selectedKey = normalizeTypeKey(type) || "general";

    const filtered = (Array.isArray(categoriesList) ? categoriesList : []).filter(
      (cat) => {
        const categoryKey = resolveCategoryTypeKey(cat);

        if (selectedKey === "general") {
          return categoryKey === "general";
        }

        return categoryKey === selectedKey;
      },
    );

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

    fetchCategories();
    fetchBrandOptions();
  }, []);

  useEffect(() => {
    if (!categories.length) {
      setFilteredCategories([]);
      return;
    }

    filterCategoriesByType(form.productType, categories);
  }, [categories, form.productType]);

  useEffect(
    () => () => {
      videoPreviews.forEach((preview) => {
        if (preview) URL.revokeObjectURL(preview);
      });
    },
    [videoPreviews],
  );

  // Handle product type change
  const handleProductTypeChange = (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, productType: value, category: "" }));
    filterCategoriesByType(value);
  };

  // Handle main image upload
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

  // Handle gallery images upload
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
          `Invalid file type: ${file.name}. Only JPG, PNG, WebP, GIF allowed.`
        );
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      const newFiles = [...galleryFiles, ...validFiles].slice(0, 4);
      setGalleryFiles(newFiles);

      const newPreviews = [...galleryPreviews];
      validFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result);
          if (newPreviews.length === newFiles.length) {
            setGalleryPreviews(newPreviews.slice(0, 4));
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeMainImage = () => {
    setMainImageFile(null);
    setMainImagePreview("");
  };

  const removeGalleryImage = (index) => {
    const newFiles = galleryFiles.filter((_, i) => i !== index);
    const newPreviews = galleryPreviews.filter((_, i) => i !== index);
    setGalleryFiles(newFiles);
    setGalleryPreviews(newPreviews);
  };

  const handleVideoChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    const availableSlots = Math.max(0, MAX_PRODUCT_VIDEO_UPLOADS - videoFiles.length);
    if (availableSlots <= 0) {
      toast.error(`You can upload up to ${MAX_PRODUCT_VIDEO_UPLOADS} videos.`);
      e.target.value = "";
      return;
    }

    const nextFiles = [];
    const nextPreviews = [];

    selectedFiles.slice(0, availableSlots).forEach((file) => {
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

  const removeVideo = (index) => {
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
    switch (name) {
      case "title":
        if (!value.trim()) error = "Product title is required";
        else if (value.trim().length < 3)
          error = "Title must be at least 3 characters";
        break;
      case "description":
        if (!stripHtml(value)) error = "Description is required";
        else if (stripHtml(value).length < 10)
          error = "Description must be at least 10 characters";
        break;
      case "price":
        if (!value || isNaN(value) || parseFloat(value) <= 0)
          error = "Valid price is required";
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
    const { name, value } = e.target;

    if (name === "productType") {
      handleProductTypeChange(e);
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: e.target.type === "checkbox" ? e.target.checked : value,
      }));
      if (errors[name]) validateField(name, value);
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

  const validateForm = () => {
    let isValid = true;

    isValid = validateField("title", form.title) && isValid;
    isValid = validateField("description", form.description) && isValid;
    isValid = validateField("price", form.price) && isValid;
    isValid = validateField("category", form.category) && isValid;

    if (!mainImagePreview) {
      toast.error("Main product image is required");
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix all errors before submitting");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Creating product...");

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

      // Append form data
      formData.append("title", form.title.trim());
      formData.append("description", form.description.trim());
      formData.append("price", form.price);
      formData.append("sku", form.sku.trim());
      formData.append("stock", form.stock || "0");
      formData.append("lowStockThreshold", form.lowStockThreshold || "5");
      formData.append("allowBackorder", String(Boolean(form.allowBackorder)));
      formData.append("category", form.category);
      formData.append("productType", form.productType);
      formData.append("brand", form.brand.trim());
      formData.append("weight", form.weight || "0");
      formData.append("dimensions", form.dimensions.trim());
      formData.append("deliveryMinDays", form.deliveryMinDays || "2");
      formData.append("deliveryMaxDays", form.deliveryMaxDays || "5");
      formData.append(
        "youtubeVideoUrls",
        JSON.stringify(youtubeVideoUrls.map((value) => value.trim()).filter(Boolean)),
      );
      formData.append("colors", JSON.stringify(form.colors));
      formData.append(
        "features",
        JSON.stringify(features.filter((f) => f.trim()))
      );
      formData.append(
        "specifications",
        JSON.stringify(
          specifications.filter((s) => s.key.trim() && s.value.trim())
        )
      );
      formData.append("isActive", "true");

      // Append main image first
      if (mainImageFile) {
        formData.append("images", mainImageFile);
      }

      // Append gallery images
      galleryFiles.forEach((image) => {
        formData.append("images", image);
      });

      videoFiles.forEach((video) => {
        formData.append("videos", video);
      });

      const response = await axios.post(`${baseUrl}/products`, formData, {
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        toast.success("Product created successfully!", { id: toastId });

        // Reset form
        setForm({
          title: "",
          description: "",
          price: "",
          sku: "",
          stock: "0",
          lowStockThreshold: "5",
          allowBackorder: false,
          category: "",
          productType: "General",
          brand: "",
          weight: "",
          dimensions: "",
          deliveryMinDays: "2",
          deliveryMaxDays: "5",
          colors: [],
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
        setYoutubeVideoUrls([""]);
        setErrors({});
        setCustomColorValue("#2563eb");

        // Reset filtered categories to default
        filterCategoriesByType("General");

        window.dispatchEvent(
          new CustomEvent("productCreated", {
            detail: response.data.product,
          })
        );
      }
    } catch (err) {
      let errorMessage = "Failed to create product";

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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] w-full">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-2 border-gray-200 border-t-2 border-t-black rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full"
    >
      <div className="w-full">
        <form onSubmit={handleSubmit}>
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
                        if (errors.description) {
                          validateField("description", value);
                        }
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
                        <span className="mr-2 font-semibold">Tk</span>
                        Price (Tk) *
                      </label>
                      <input
                        type="number"
                        name="price"
                        value={form.price}
                        onChange={handleChange}
                        onBlur={() => validateField("price", form.price)}
                        placeholder="Tk 0.00"
                        step="0.01"
                        min="0"
                        className={`w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border ${
                          errors.price ? "border-red-500" : "border-gray-300"
                        } focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base`}
                      />
                      {errors.price && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors.price}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <FiTag className="mr-2" /> SKU
                      </label>
                      <input
                        type="text"
                        name="sku"
                        value={form.sku}
                        onChange={handleChange}
                        placeholder="Enter SKU"
                        className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                      />
                    </div>
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <FiPackage className="mr-2" /> Stock Qty
                      </label>
                      <input
                        type="number"
                        name="stock"
                        value={form.stock}
                        onChange={handleChange}
                        placeholder="0"
                        min="0"
                        className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:border-gray-500 transition-all text-sm md:text-base"
                      />
                    </div>
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <FiBox className="mr-2" /> Low Stock Alert
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
                    <label className="flex items-center justify-between rounded-lg border border-gray-300 px-3 md:px-4 py-2 md:py-3 text-sm text-gray-700">
                      <span className="font-medium">Allow backorder</span>
                      <input
                        type="checkbox"
                        name="allowBackorder"
                        checked={Boolean(form.allowBackorder)}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-gray-300 accent-black"
                        style={{ accentColor: themeColor }}
                      />
                    </label>
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
                          label: `${cat.name} (${resolveCategoryTypeLabel(
                            cat?.type ?? cat?.categoryType ?? cat?.productType,
                          )})`,
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
                        No categories found for {form.productType} type. Please
                        create a category first.
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                        <FiTruck className="mr-2" /> Estimated Delivery Min Days
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
                        <FiTruck className="mr-2" /> Estimated Delivery Max Days
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
                  <p className="-mt-1 text-xs text-gray-500">
                    Set the delivery window for this product. It will be shown on the product page and used in checkout messaging.
                  </p>

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
                              e.target.value
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
                              e.target.value
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
              {/* Main Image Upload */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="dashboard-form-surface bg-white p-4 md:p-6 border border-gray-200"
              >
                <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-4 flex items-center">
                  <FiImage className="mr-2" /> Main Product Image *
                </h2>

                {/* Main Image Upload Area */}
                <div className="mb-3 md:mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Image (Will be shown in product listings)
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
                          Main Product Image
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
                    Additional Gallery Images ({galleryPreviews.length}/4)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 md:p-4 text-center hover:border-gray-500 transition-colors">
                    <p className="text-gray-600 mb-2 text-sm md:text-base">
                      Add up to 4 more images for product gallery
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryChange}
                      className="hidden"
                      id="gallery-upload"
                      disabled={galleryPreviews.length >= 4}
                    />
                    <label
                      htmlFor="gallery-upload"
                      className={`inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg cursor-pointer text-sm md:text-base ${
                        galleryPreviews.length >= 4
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

                  {/* Gallery Previews */}
                  {galleryPreviews.length > 0 && (
                    <div className="mt-3 md:mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gallery Preview
                      </label>
                      <div className="grid grid-cols-2 gap-2 md:gap-3">
                        {galleryPreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`Gallery ${index + 1}`}
                              className="w-full h-20 md:h-24 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removeGalleryImage(index)}
                              className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <FiX size={10} />
                            </button>
                            <div className="text-xs text-gray-500 mt-1 text-center">
                              Image {index + 1}
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
                    {videoPreviews.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-3">
                        {videoPreviews.map((preview, index) => (
                          <div key={`product-video-${index}`} className="relative">
                            <video
                              src={preview}
                              className="h-40 w-full rounded-lg bg-black object-contain"
                              preload="metadata"
                              controls
                              controlsList="nodownload"
                            />
                            <button
                              type="button"
                              onClick={() => removeVideo(index)}
                              className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                            >
                              <FiX size={14} />
                            </button>
                            <div className="text-xs text-gray-500 mt-2 text-center">
                              {videoFiles[index]?.name || `Video ${index + 1}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {videoFiles.length < MAX_PRODUCT_VIDEO_UPLOADS ? (
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

              {/* Colors */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="dashboard-form-surface bg-white p-4 md:p-6 border border-gray-200"
              >
                <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-4">
                  Available Colors
                </h2>

                <div className="space-y-3 md:space-y-4">
                  {/* Selected Colors */}
                  {form.colors.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Selected Colors
                      </label>
                      <div className="flex flex-wrap gap-1 md:gap-2">
                        {form.colors.map((color, index) => {
                          const colorObj = colorOptions.find(
                            (c) => c.value === color
                          );
                          return (
                            <div
                              key={index}
                              className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 bg-gray-100 rounded-full"
                            >
                              <div
                                className="w-3 h-3 md:w-4 md:h-4 rounded-full border"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-xs md:text-sm">
                                {colorObj?.name || color}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleColorRemove(color)}
                                className="text-gray-500 hover:text-red-600"
                              >
                                <FiX size={10} className="md:h-3 md:w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Color Options */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add Colors
                    </label>
                    <div className="grid grid-cols-4 gap-1 md:gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => handleColorAdd(color.value)}
                          className={`relative p-1 md:p-2 rounded-lg border ${
                            form.colors.includes(color.value)
                              ? "ring-1 md:ring-2 ring-gray-500"
                              : "hover:ring-1 hover:ring-gray-300"
                          }`}
                        >
                          <div
                            className="w-full h-6 md:h-8 rounded"
                            style={{ backgroundColor: color.value }}
                          />
                          <div className="text-xs mt-1 truncate">
                            {color.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add Custom Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customColorValue}
                        onChange={(event) =>
                          setCustomColorValue(event.target.value.toLowerCase())
                        }
                        className="h-10 w-14 p-1 border border-gray-300 rounded-lg bg-white cursor-pointer"
                        aria-label="Choose custom color"
                      />
                      <input
                        type="text"
                        value={customColorValue}
                        onChange={(event) => setCustomColorValue(event.target.value)}
                        placeholder="#2563eb"
                        className="flex-1 h-10 px-3 border border-gray-300 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleCustomColorAdd}
                        className="inline-flex h-10 items-center gap-1.5 px-3 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-900"
                      >
                        <FiPlus className="w-4 h-4" />
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Pick any color from the palette and click Add.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isSubmitting || filteredCategories.length === 0}
                className={`w-full py-2 md:py-3 px-3 md:px-4 rounded-lg font-medium text-white ${
                  isSubmitting || filteredCategories.length === 0
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gray-900 hover:bg-gray-800"
                } transition-all shadow-sm md:shadow-md flex items-center justify-center text-sm md:text-base`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating Product...
                  </>
                ) : filteredCategories.length === 0 ? (
                  "No Categories Available"
                ) : (
                  "Create Product"
                )}
              </motion.button>
            </div>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default ProductCreate;
