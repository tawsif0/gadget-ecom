/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import {
  FiFilter,
  FiX,
  FiEye,
  FiHeart,
  FiGrid,
  FiList,
  FiShoppingBag,
  FiShuffle,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import { FaImage } from "react-icons/fa6";
import { motion } from "framer-motion";
import usePublicSettings from "../../hooks/usePublicSettings";
import {
  formatDocumentTitle,
  getDefaultPublicSettings,
} from "../../utils/publicSettings";
import { applySeoMetadata } from "../../utils/seoManager";
import {
  applyMarketingTemplate,
  getActiveMarketingEntry,
} from "../../utils/marketingProfiles";
import {
  buildCatalogDataLayerPayload,
  pushDataLayerEvent,
} from "../../utils/marketingDataLayer";
import {
  selectWishlistPendingIds,
  toggleWishlistItem,
} from "../../store/wishlistSlice";
import {
  getPublicStockBadgeText,
  isPublicStockVisible,
} from "../../utils/publicProduct";
import { hasVariantOptionPricing } from "../../utils/productVariants";
import {
  COMPARE_LIMIT_MESSAGE,
  MAX_COMPARE_ITEMS,
  toggleCompareItem,
} from "../../store/compareSlice";
import { createProductSnapshot } from "../../utils/productSnapshot";
import SearchableSelect from "../../components/SearchableSelect";
import StorefrontProductCard from "../components/StorefrontProductCard";
import { useCart } from "../../context/CartContext";
const INITIAL_DISPLAY_LIMIT = 20;

const DEFAULT_STOREFRONT = getDefaultPublicSettings().storefront;

const applyTemplate = (value, replacements = {}) => {
  let resolved = String(value || "").trim();
  Object.entries(replacements).forEach(([key, replacement]) => {
    resolved = resolved.replaceAll(
      `{${key}}`,
      String(replacement || "").trim(),
    );
  });
  return resolved;
};

const getSafeStoreName = (value) => {
  const normalized = String(value || "").trim();
  return normalized.length > 1 ? normalized : "E-Commerce";
};

const ProductGrid = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { isProductInCart: isProductInCartById, toggleProductInCart } =
    useCart();
  const compareItems = useSelector((state) => state.compare.items || []);
  const wishlistItems = useSelector((state) => state.wishlist.items || []);
  const wishlistPendingIds = useSelector(selectWishlistPendingIds);
  const sortOptions = [
    { value: "featured", label: "Featured" },
    { value: "newest", label: "Newest First" },
    { value: "price-low", label: "Price: Low to High" },
    { value: "price-high", label: "Price: High to Low" },
    { value: "name", label: "Name: A to Z" },
  ];
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCategoryType, setSelectedCategoryType] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [collectionType, setCollectionType] = useState("all");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(INITIAL_DISPLAY_LIMIT);
  const [allProductsVisible, setAllProductsVisible] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    const savedViewMode = localStorage.getItem("shopViewMode");
    return savedViewMode || "grid"; // Default to grid if nothing saved
  });
  const [sortBy, setSortBy] = useState("featured");
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [expandedFilters, setExpandedFilters] = useState({
    categories: true,
    types: true,
    price: true,
  });
  const { settings, loaded: settingsLoaded } = usePublicSettings();
  const branding = React.useMemo(
    () => ({
      storeName: getSafeStoreName(settings?.website?.storeName),
      tagline: String(settings?.website?.tagline || "").trim(),
    }),
    [settings],
  );
  const storefront = React.useMemo(
    () => ({
      ...DEFAULT_STOREFRONT,
      ...(settings?.storefront || {}),
    }),
    [settings],
  );
  const catalogBrands = React.useMemo(() => {
    const mergedBrands = [];
    const seen = new Set();

    const addBrand = (brand) => {
      const name = String(brand?.name || brand?.brand || "").trim();
      if (!name) return;

      const key = name.toLowerCase();
      if (seen.has(key)) return;

      seen.add(key);
      mergedBrands.push({
        _id: String(brand?._id || brand?.id || name).trim(),
        name,
        slug: String(brand?.slug || "").trim(),
        description: String(brand?.description || "").trim(),
        logoUrl: String(brand?.logoUrl || brand?.logo || "").trim(),
      });
    };

    (Array.isArray(brands) ? brands : []).forEach(addBrand);
    products.forEach((product) => addBrand({ name: product?.brand || "" }));

    return mergedBrands;
  }, [brands, products]);
  const catalogDataLayerSignatureRef = React.useRef("");

  React.useEffect(() => {
    if (!settings) return;

    const website = settings?.website || {};
    const seo = settings?.seo || {};
    const pageSeo = settings?.seoAnalytics?.pages?.shop || {};
    const hasExplicitEntries = Boolean(
      settings?.seoAnalytics?.hasExplicitEntries,
    );
    const seoEntry = getActiveMarketingEntry(settings, {
      type: "seo",
      pathname: "/shop",
    });
    const storeName =
      String(website.storeName || "E-Commerce").trim() || "E-Commerce";
    const shopTitle = String(
      applyMarketingTemplate(seoEntry?.metaTitle, {
        storeName,
        pageName: "Shop",
      }) ||
        (!hasExplicitEntries ? pageSeo.metaTitle : "") ||
        (!hasExplicitEntries ? seo.metaTitle : "") ||
        storefront?.catalogTitle ||
        "Shop",
    ).trim();
    const shopDescription = String(
      applyMarketingTemplate(seoEntry?.metaDescription, {
        storeName,
        pageName: "Shop",
      }) ||
        (!hasExplicitEntries ? pageSeo.metaDescription : "") ||
        (!hasExplicitEntries ? seo.metaDescription : "") ||
        storefront?.catalogDescription ||
        "",
    ).trim();

    applySeoMetadata({
      title: formatDocumentTitle(settings, shopTitle || "Shop"),
      description: shopDescription,
      keywords: String(
        applyMarketingTemplate(seoEntry?.metaKeywords, {
          storeName,
          pageName: "Shop",
        }) ||
          (!hasExplicitEntries ? pageSeo.metaKeywords : "") ||
          (!hasExplicitEntries ? seo.metaKeywords : "") ||
          "",
      ).trim(),
      image: String(
        applyMarketingTemplate(seoEntry?.openGraphImage, {
          storeName,
          pageName: "Shop",
        }) ||
          (!hasExplicitEntries ? pageSeo.openGraphImage : "") ||
          (!hasExplicitEntries ? seo.openGraphImage : "") ||
          website.headerIconUrl ||
          website.logoUrl ||
          "",
      ).trim(),
      url: typeof window !== "undefined" ? window.location.href : "",
      siteName: storeName,
    });
  }, [settings, storefront?.catalogDescription, storefront?.catalogTitle]);

  const baseUrl = import.meta.env.VITE_API_URL;
  const persistCurrentShopScroll = React.useCallback(() => {
    if (typeof window === "undefined") return;

    window.sessionStorage.setItem(
      `shop-scroll:${location.pathname}${location.search}`,
      String(window.scrollY || window.pageYOffset || 0),
    );
  }, [location.pathname, location.search]);

  const getCategoryIdFromProduct = (product) => {
    if (!product?.category) return null;
    return typeof product.category === "string"
      ? product.category
      : product.category._id || null;
  };
  const getProductDisplayPrice = (product) => {
    if (!product) return 0;
    if (String(product.priceType || "single") === "tba") return 0;

    if (
      String(product.marketplaceType || "simple") === "variable" &&
      Array.isArray(product.variations) &&
      product.variations.length > 0
    ) {
      const variationPrices = product.variations
        .filter((variation) => variation?.isActive !== false)
        .map((variation) => {
          const hasSalePrice =
            variation?.salePrice !== null &&
            variation?.salePrice !== undefined &&
            String(variation.salePrice).trim() !== "";
          if (hasSalePrice) {
            const salePrice = Number(variation.salePrice);
            if (Number.isFinite(salePrice) && salePrice >= 0) return salePrice;
          }
          const regularPrice = Number(variation?.price);
          return Number.isFinite(regularPrice) && regularPrice >= 0
            ? regularPrice
            : null;
        })
        .filter((price) => price !== null);

      if (variationPrices.length > 0) {
        return Math.min(...variationPrices);
      }
    }

    const hasSalePrice =
      String(product?.priceType || "single") === "best" &&
      product?.salePrice !== null &&
      product?.salePrice !== undefined &&
      String(product.salePrice).trim() !== "";
    if (hasSalePrice) {
      const salePrice = Number(product.salePrice);
      if (Number.isFinite(salePrice) && salePrice >= 0) return salePrice;
    }

    const regularPrice = Number(product.price);
    if (Number.isFinite(regularPrice) && regularPrice >= 0) return regularPrice;

    return 0;
  };
  const getProductPricing = (product) => {
    const priceType = String(product?.priceType || "single");
    if (priceType === "tba") {
      return {
        priceType,
        isTba: true,
        currentPrice: null,
        previousPrice: null,
        hasDiscount: false,
      };
    }

    const currentPrice = getProductDisplayPrice(product);
    const previousPrice = Number(product?.price || currentPrice || 0);
    const hasDiscount =
      priceType === "best" &&
      Number.isFinite(previousPrice) &&
      previousPrice > Number(currentPrice || 0) &&
      Number(currentPrice || 0) > 0;

    return {
      priceType,
      isTba: false,
      currentPrice,
      previousPrice,
      hasDiscount,
    };
  };
  const getProductCardMetaLine = (product) =>
    product?.dimensions ? `Dim: ${product.dimensions}` : "";
  const visibleProducts = React.useMemo(() => products, [products]);
  const visibleCategories = React.useMemo(() => {
    return categories.filter((category) => {
      const hasProduct = visibleProducts.some(
        (product) => getCategoryIdFromProduct(product) === category._id,
      );
      return hasProduct;
    });
  }, [categories, visibleProducts]);
  const visibleCategoryTypes = React.useMemo(() => {
    const types = [];
    visibleCategories.forEach((category) => {
      if (category.type && !types.includes(category.type)) {
        types.push(category.type);
      }
    });
    return types;
  }, [visibleCategories]);

  const isProductCompared = React.useCallback(
    (productId) =>
      compareItems.some(
        (item) => String(item?._id || "") === String(productId || ""),
      ),
    [compareItems],
  );

  const isProductWishlisted = React.useCallback(
    (productId) =>
      wishlistItems.some(
        (item) => String(item?._id || "") === String(productId || ""),
      ),
    [wishlistItems],
  );

  const isProductInCart = React.useCallback(
    (productId) => isProductInCartById(productId),
    [isProductInCartById],
  );

  const handleToggleCompare = React.useCallback(
    (product) => {
      const snapshot = createProductSnapshot(product);
      if (!snapshot) return;
      const exists = compareItems.some(
        (item) => String(item?._id || "") === String(snapshot._id || ""),
      );
      if (!exists && compareItems.length >= MAX_COMPARE_ITEMS) {
        toast.error(COMPARE_LIMIT_MESSAGE);
        return;
      }
      dispatch(toggleCompareItem(snapshot));
    },
    [compareItems, dispatch],
  );

  const handleToggleCart = React.useCallback(
    async (product) => {
      const marketplaceType = String(product?.marketplaceType || "simple")
        .trim()
        .toLowerCase();

      if (["variable", "grouped"].includes(marketplaceType)) {
        persistCurrentShopScroll();
        navigate(`/product/${product?._id || product?.id}`);
        return;
      }

      await toggleProductInCart(product, 1);
    },
    [navigate, persistCurrentShopScroll, toggleProductInCart],
  );

  const handleToggleWishlist = React.useCallback(
    async (product) => {
      await dispatch(toggleWishlistItem(product));
    },
    [dispatch],
  );

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem("shopViewMode", mode);
  };
  const collectionLabel =
    collectionType === "deals"
      ? "Daily Deals"
      : collectionType === "new-arrivals"
        ? "New Arrivals"
        : "";
  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const categoryParam = params.get("category");
    const typeParam = params.get("type");
    const brandParam = params.get("brand");
    const searchParam = params.get("search");
    const collectionParam = String(params.get("collection") || "all")
      .trim()
      .toLowerCase();
    const sortParam = String(params.get("sort") || "")
      .trim()
      .toLowerCase();

    if (categoryParam) {
      setSelectedCategory(categoryParam);
    } else {
      setSelectedCategory("all");
    }

    if (typeParam) {
      setSelectedCategoryType(typeParam);
    } else {
      setSelectedCategoryType("all");
    }

    if (brandParam) {
      setSelectedBrand(String(brandParam).trim());
    } else {
      setSelectedBrand("");
    }

    if (searchParam) {
      setSearchTerm(searchParam);
    } else {
      setSearchTerm("");
    }

    if (["deals", "new-arrivals"].includes(collectionParam)) {
      setCollectionType(collectionParam);
      setSortBy(collectionParam === "new-arrivals" ? "newest" : "featured");
    } else {
      setCollectionType("all");
      if (
        ["featured", "price-low", "price-high", "name", "newest"].includes(
          sortParam,
        )
      ) {
        setSortBy(sortParam);
      } else {
        setSortBy("featured");
      }
    }
  }, [location.search]);

  // Fetch products and categories
  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBrands();
  }, []);

  // Filter products when dependencies change
  useEffect(() => {
    if (products.length > 0 && categories.length > 0) {
      filterProducts();
    }
  }, [
    products,
    selectedCategory,
    selectedCategoryType,
    selectedBrand,
    searchTerm,
    collectionType,
    categories,
    sortBy,
    priceRange,
    visibleProducts,
  ]);
  useEffect(() => {
    // Reset display limit when filters change
    if (!allProductsVisible) {
      setDisplayLimit(INITIAL_DISPLAY_LIMIT);
    }
  }, [
    selectedCategory,
    selectedCategoryType,
    selectedBrand,
    searchTerm,
    collectionType,
    priceRange,
    sortBy,
  ]);

  useEffect(() => {
    if (
      !settingsLoaded ||
      !products.length ||
      !categories.length ||
      typeof window === "undefined"
    ) {
      return undefined;
    }

    const visibleCatalogProducts = filteredProducts.slice(0, displayLimit);
    const pagePath = `${location.pathname}${location.search || ""}`;
    const normalizeListKey = (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    const itemListId = collectionLabel
      ? `collection:${normalizeListKey(collectionType)}`
      : selectedBrand
        ? `brand:${normalizeListKey(selectedBrand)}`
        : selectedCategory !== "all"
          ? `category:${normalizeListKey(selectedCategory)}`
          : "shop";
    const itemListName = collectionLabel
      ? collectionLabel
      : selectedBrand
        ? `${selectedBrand} Products`
        : selectedCategory !== "all" && categoryName
          ? `${categoryName} Products`
          : "All Products";

    const currentSignature = JSON.stringify({
      pageKey: "shop",
      pagePath,
      selectedCategory,
      selectedCategoryType,
      selectedBrand,
      collectionType,
      searchTerm,
      sortBy,
      displayLimit,
      categoryIds: categories.map((category) => String(category?._id || "")),
      brandNames: catalogBrands.map((brand) => String(brand?.name || "")),
      productIds: visibleCatalogProducts.map((product) =>
        String(product?._id || product?.id || ""),
      ),
    });

    if (catalogDataLayerSignatureRef.current === currentSignature) {
      return;
    }

    catalogDataLayerSignatureRef.current = currentSignature;

    const frame = window.requestAnimationFrame(() => {
      pushDataLayerEvent(
        "view_item_list",
        buildCatalogDataLayerPayload({
          pageKey: "shop",
          pagePath,
          itemListId,
          itemListName,
          selectedCategoryId:
            selectedCategory === "all" ? "" : selectedCategory,
          selectedCategoryName:
            selectedCategory === "all" ? "" : categoryName,
          selectedCategoryType,
          selectedBrand,
          collectionType,
          searchTerm,
          sortBy,
          categories,
          brands: catalogBrands,
          catalogProducts: filteredProducts,
          items: visibleCatalogProducts,
        }),
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    categories,
    catalogBrands,
    categoryName,
    collectionLabel,
    collectionType,
    displayLimit,
    filteredProducts,
    location.pathname,
    location.search,
    products.length,
    searchTerm,
    selectedBrand,
    selectedCategory,
    selectedCategoryType,
    settingsLoaded,
    sortBy,
  ]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${baseUrl}/products/public`);
      if (response.data.success) {
        const productsData = response.data.products || [];
        setProducts(productsData);

        // Set initial price range based on products
        const prices = productsData.map((p) => getProductDisplayPrice(p));
        const maxPrice = Math.max(...prices) > 0 ? Math.max(...prices) : 10000;
        setPriceRange([0, maxPrice]);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${baseUrl}/categories/public`);
      if (response.data.success) {
        const categoriesData = response.data.categories || [];
        setCategories(categoriesData);

        const params = new URLSearchParams(location.search);
        const categoryParam = params.get("category");

        if (categoryParam) {
          const selectedCat = categoriesData.find(
            (cat) => cat._id === categoryParam,
          );
          if (selectedCat) {
            setCategoryName(selectedCat.name);
          } else {
            setCategoryName("");
          }
        } else {
          setCategoryName("");
        }
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await axios.get(`${baseUrl}/brands/public`);
      if (response.data.success) {
        setBrands(
          Array.isArray(response.data.brands) ? response.data.brands : [],
        );
      }
    } catch (error) {
      console.error("Error fetching brands:", error);
      setBrands([]);
    }
  };

  const filterProducts = () => {
    let filtered = [...visibleProducts];

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((product) => {
        if (!product.category) return false;

        let categoryId;
        if (typeof product.category === "string") {
          categoryId = product.category;
        } else if (product.category._id) {
          categoryId = product.category._id;
        } else {
          return false;
        }

        return categoryId === selectedCategory;
      });

      const selectedCat = categories.find(
        (cat) => cat._id === selectedCategory,
      );
      setCategoryName(selectedCat?.name || "");
    } else {
      setCategoryName("");
    }

    // Filter by category type
    if (selectedCategoryType !== "all") {
      filtered = filtered.filter((product) => {
        let category = null;
        if (product.category) {
          if (typeof product.category === "string") {
            category = categories.find((cat) => cat._id === product.category);
          } else if (product.category._id) {
            category = categories.find(
              (cat) => cat._id === product.category._id,
            );
          }
        }

        return category && category.type === selectedCategoryType;
      });
    }

    const normalizedBrand = String(selectedBrand || "")
      .trim()
      .toLowerCase();
    if (normalizedBrand) {
      filtered = filtered.filter(
        (product) =>
          String(product?.brand || "")
            .trim()
            .toLowerCase() === normalizedBrand,
      );
    }

    // Filter by search term
    const trimmedSearch = (searchTerm || "").trim().toLowerCase();
    if (trimmedSearch) {
      filtered = filtered.filter((product) => {
        const title = (product.title || "").toLowerCase();
        const description = (product.description || "").toLowerCase();
        const brand = (product.brand || "").toLowerCase();
        const productType = (product.productType || "").toLowerCase();
        const marketplaceType = (product.marketplaceType || "").toLowerCase();
        const categoryNameText =
          (typeof product.category === "object"
            ? product.category?.name
            : "") || "";

        return (
          title.includes(trimmedSearch) ||
          description.includes(trimmedSearch) ||
          brand.includes(trimmedSearch) ||
          productType.includes(trimmedSearch) ||
          marketplaceType.includes(trimmedSearch) ||
          categoryNameText.toLowerCase().includes(trimmedSearch)
        );
      });
    }

    if (collectionType === "deals") {
      filtered = filtered.filter(
        (product) => getProductPricing(product).hasDiscount,
      );
    }

    // Filter by price range
    filtered = filtered.filter((product) => {
      if (String(product?.priceType || "single") === "tba") return true;
      const price = getProductDisplayPrice(product);
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Sort products
    switch (sortBy) {
      case "price-low":
        filtered.sort(
          (a, b) => getProductDisplayPrice(a) - getProductDisplayPrice(b),
        );
        break;
      case "price-high":
        filtered.sort(
          (a, b) => getProductDisplayPrice(b) - getProductDisplayPrice(a),
        );
        break;
      case "name":
        filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        break;
      case "newest":
        filtered.sort(
          (a, b) =>
            new Date(b?.createdAt || 0).getTime() -
            new Date(a?.createdAt || 0).getTime(),
        );
        break;
      case "featured":
      default:
        if (collectionType === "new-arrivals") {
          filtered.sort(
            (a, b) =>
              new Date(b?.createdAt || 0).getTime() -
              new Date(a?.createdAt || 0).getTime(),
          );
        }
        break;
    }

    setFilteredProducts(filtered);
  };

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
    return baseUrl
      ? `${baseUrl}/uploads/products/${imagePath}`
      : `/uploads/products/${imagePath}`;
  };

  // Helper function to get category type for a product
  const getCategoryTypeForProduct = (product) => {
    if (!product.category) return null;

    let category = null;
    if (typeof product.category === "string") {
      category = categories.find((cat) => cat._id === product.category);
    } else if (product.category._id) {
      category = categories.find((cat) => cat._id === product.category._id);
    }

    return category?.type || null;
  };

  // Helper function to get category name for a product
  const getCategoryNameForProduct = (product) => {
    if (!product.category) return null;

    let category = null;
    if (typeof product.category === "string") {
      category = categories.find((cat) => cat._id === product.category);
    } else if (product.category._id) {
      category = categories.find((cat) => cat._id === product.category._id);
    }

    return category?.name || null;
  };

  const highlightText = (text, term) => {
    if (!text || !term) return text;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = String(text).split(regex);
    return parts.map((part, idx) =>
      regex.test(part) ? (
        <span key={idx} className="bg-yellow-200 text-black px-0.5 rounded">
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  const resetFilters = () => {
    setSelectedCategory("all");
    setSelectedCategoryType("all");
    setSelectedBrand("");
    setCategoryName("");
    setSearchTerm("");
    setSortBy("featured");

    // Reset price range to initial values
    const prices = products.map((p) => getProductDisplayPrice(p));
    const maxPrice = Math.max(...prices) > 0 ? Math.max(...prices) : 10000;
    setPriceRange([0, maxPrice]);

    // Clear URL parameters
    navigate("/shop", { replace: true });
  };

  const toggleFilterSection = (section) => {
    setExpandedFilters((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const ProductImage = ({ src, alt, className = "" }) => {
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
      return (
        <div
          className={`flex flex-col items-center justify-center bg-gray-100 text-gray-400 ${className}`}
        >
          <FaImage className="text-2xl mb-2" />
          <span className="text-xs">No Image</span>
        </div>
      );
    }

    const isRemote =
      imgSrc?.startsWith("http://") || imgSrc?.startsWith("https://");

    return (
      <img
        src={imgSrc}
        alt={alt}
        className={`object-cover ${className}`}
        onError={handleError}
        crossOrigin={isRemote ? "anonymous" : undefined}
      />
    );
  };
  const handleViewMore = () => {
    if (!allProductsVisible) {
      // Show all products
      setAllProductsVisible(true);
      setDisplayLimit(filteredProducts.length);
    } else {
      // Reset to initial shelf size
      setAllProductsVisible(false);
      setDisplayLimit(INITIAL_DISPLAY_LIMIT);
    }
  };
  const LoadingSkeleton = () => (
    <section className="bg-[#f5f5f5] py-4 md:py-8 lg:py-12">
      <div className="site-shell">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
          {/* Desktop Filters Skeleton */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="space-y-6">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-gray-100 animate-pulse rounded-2xl h-48"
                ></div>
              ))}
            </div>
          </div>

          {/* Products Grid Skeleton */}
          <div className="lg:col-span-3">
            <div className="storefront-card-grid">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="storefront-card-grid__item bg-gray-100 animate-pulse rounded-2xl h-64 sm:h-72 md:h-80"
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  if (loading) return <LoadingSkeleton />;

  const publicStockSummaryEnabled = Boolean(
    settings?.publicStockSummaryEnabled ??
    settings?.marketplace?.publicStockSummaryEnabled,
  );
  const catalogProductCount = products.length;
  const catalogDealCount = products.filter(
    (product) => getProductPricing(product).hasDiscount,
  ).length;
  const catalogStockUnits = products.reduce((total, product) => {
    if (String(product?.priceType || "single").toLowerCase() === "tba") {
      return total;
    }

    const stock = Number(product?.stock || 0);
    return stock > 0 ? total + stock : total;
  }, 0);
  const totalCategoryCount = visibleCategories.length;
  const tbaProductCount = filteredProducts.filter(
    (product) => String(product?.priceType || "single").toLowerCase() === "tba",
  ).length;
  const storeName = getSafeStoreName(branding.storeName);
  const tagline = String(branding.tagline || "").trim();
  const catalogTitle =
    applyTemplate(storefront?.catalogTitle, { storeName }) ||
    applyTemplate(DEFAULT_STOREFRONT.catalogTitle, { storeName });
  const catalogDescription =
    String(
      storefront?.catalogDescription || DEFAULT_STOREFRONT.catalogDescription,
    ).trim() || DEFAULT_STOREFRONT.catalogDescription;

  return (
    <section className="min-h-screen bg-[radial-gradient(circle_at_top,#ffffff_0%,#f6f8fb_40%,#edf2f7_100%)]">
      <div className="site-shell py-10 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-black tracking-tight text-gray-950 sm:text-4xl lg:text-5xl">
            {catalogTitle}
          </h1>
          <div className="mx-auto mt-5 h-px w-28 bg-gray-200" />
        </div>
      </div>

      {/* Main Content */}
      <div className="site-shell pb-6 md:pb-8 lg:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
          {/* Desktop Filters */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="site-card storefront-sticky-offset sticky p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-black">Filters</h3>
                {(selectedCategory !== "all" ||
                  selectedCategoryType !== "all" ||
                  selectedBrand ||
                  searchTerm ||
                  sortBy !== "featured" ||
                  priceRange[1] <
                    Math.max(
                      ...products.map((p) => getProductDisplayPrice(p)),
                    )) && (
                  <button
                    onClick={resetFilters}
                    className="text-sm text-gray-500 hover:text-black transition-colors"
                  >
                    Reset All
                  </button>
                )}
              </div>

              {/* Categories */}
              <div className="mb-6 md:mb-8">
                <button
                  onClick={() => toggleFilterSection("categories")}
                  className="w-full flex items-center justify-between text-left font-semibold text-black mb-4"
                >
                  <span>Categories</span>
                  {expandedFilters.categories ? (
                    <FiChevronUp />
                  ) : (
                    <FiChevronDown />
                  )}
                </button>

                {expandedFilters.categories && (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setSelectedCategory("all");
                        navigate("/shop");
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedCategory === "all"
                          ? "bg-black text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      All Categories
                    </button>
                    {visibleCategories.map((category) => (
                      <button
                        key={category._id}
                        onClick={() => {
                          setSelectedCategory(category._id);
                          navigate(`/shop?category=${category._id}`);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
                          selectedCategory === category._id
                            ? "bg-gray-900 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <span>{category.name}</span>
                        {category.type && (
                          <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">
                            {category.type}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category Types */}
              <div className="mb-6 md:mb-8">
                <button
                  onClick={() => toggleFilterSection("types")}
                  className="w-full flex items-center justify-between text-left font-semibold text-black mb-4"
                >
                  <span>Category Type</span>
                  {expandedFilters.types ? <FiChevronUp /> : <FiChevronDown />}
                </button>

                {expandedFilters.types && (
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedCategoryType("all")}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        selectedCategoryType === "all"
                          ? "bg-black text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      All Types
                    </button>
                    {visibleCategoryTypes.length > 0 ? (
                      visibleCategoryTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => setSelectedCategoryType(type)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                            selectedCategoryType === type
                              ? "bg-gray-900 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {type}
                        </button>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500 italic px-3 py-2">
                        {visibleCategories.length > 0
                          ? "No category types defined"
                          : "Loading categories..."}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Price Range */}
              <div className="mb-6 md:mb-8">
                <button
                  onClick={() => toggleFilterSection("price")}
                  className="w-full flex items-center justify-between text-left font-semibold text-black mb-4"
                >
                  <span>Price Range</span>
                  {expandedFilters.price ? <FiChevronUp /> : <FiChevronDown />}
                </button>

                {expandedFilters.price && (
                  <div className="space-y-4">
                    <div className="hidden items-center justify-between text-sm text-gray-600">
                      <span>{priceRange[0].toFixed(2)} Tk</span>
                      <span>{priceRange[1].toFixed(2)} Tk</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={
                        Math.max(
                          ...products.map((p) => getProductDisplayPrice(p)),
                        ) || 10000
                      }
                      value={priceRange[1]}
                      onChange={(e) =>
                        setPriceRange([priceRange[0], parseInt(e.target.value)])
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{priceRange[0].toFixed(2)} Tk</span>
                      <span>{priceRange[1].toFixed(2)} Tk</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Results Info */}
              <div className="pt-4 sm:pt-6 border-t border-gray-200 text-sm text-gray-600">
                <div className="text-center">
                  Showing {filteredProducts.length} of {products.length}{" "}
                  products
                </div>
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="lg:col-span-3">
            {/* Mobile Filter Toggle & Controls */}
            <div className="lg:hidden mb-6">
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => setShowMobileFilters(true)}
                  className="app-btn-primary rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm hover:shadow-md transition-shadow"
                >
                  <FiFilter /> Filters
                  {(selectedCategory !== "all" ||
                    selectedCategoryType !== "all" ||
                    selectedBrand) && (
                    <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs text-black">
                      !
                    </span>
                  )}
                </button>

                <div className="flex items-center gap-3">
                  {/* View Mode */}
                  <div className="hidden xs:flex items-center gap-1 bg-gray-100 rounded-full p-1">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-1.5 sm:p-2 rounded-full ${
                        viewMode === "grid"
                          ? "bg-black text-white"
                          : "text-gray-600"
                      }`}
                    >
                      <FiGrid className="text-sm sm:text-base" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-1.5 sm:p-2 rounded-full ${
                        viewMode === "list"
                          ? "bg-black text-white"
                          : "text-gray-600"
                      }`}
                    >
                      <FiList className="text-sm sm:text-base" />
                    </button>
                  </div>

                  {/* Sort Dropdown */}
                  <div className="w-[180px]">
                    <SearchableSelect
                      value={sortBy}
                      onChange={setSortBy}
                      options={sortOptions}
                      placeholder="Sort by"
                      searchable={false}
                      className="min-w-0"
                      buttonClassName="min-h-[48px] rounded-full border-black px-5 py-3 text-[15px] font-medium text-slate-800 shadow-none"
                      menuClassName="rounded-[24px] border-black/10 p-2"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl xs:text-2xl font-black tracking-tight text-gray-950">
                  {collectionLabel
                    ? collectionLabel
                    : selectedBrand
                      ? `${selectedBrand} Products`
                      : selectedCategory !== "all" && categoryName
                        ? `${categoryName} Products`
                        : "All Products"}
                </h2>
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                  {filteredProducts.length} items
                </span>
                {searchTerm ? (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    Search:
                    <span className="ml-1 text-amber-900">{searchTerm}</span>
                  </span>
                ) : null}
                {selectedBrand ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    Brand:
                    <span className="ml-1 text-slate-950">{selectedBrand}</span>
                  </span>
                ) : null}
              </div>

              {/* Desktop Controls */}
              <div className="hidden lg:flex items-center gap-4">
                <div className="flex items-center gap-2 bg-gray-100 rounded-full p-1">
                  <button
                    onClick={() => handleSetViewMode("grid")}
                    className={`p-2 rounded-full ${
                      viewMode === "grid"
                        ? "bg-black text-white"
                        : "text-gray-600"
                    }`}
                  >
                    <FiGrid />
                  </button>
                  <button
                    onClick={() => handleSetViewMode("list")}
                    className={`p-2 rounded-full ${
                      viewMode === "list"
                        ? "bg-black text-white"
                        : "text-gray-600"
                    }`}
                  >
                    <FiList />
                  </button>
                </div>

                <div className="w-[220px]">
                  <SearchableSelect
                    value={sortBy}
                    onChange={setSortBy}
                    options={sortOptions}
                    placeholder="Sort by"
                    searchable={false}
                    buttonClassName="min-h-[48px] rounded-full border-black px-5 py-3 text-[15px] font-medium text-slate-800 shadow-none"
                    menuClassName="rounded-[24px] border-black/10 p-2"
                  />
                </div>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-3 sm:mb-4">
                  No Products Found
                </h3>
                <p className="text-gray-600 mb-6 text-sm sm:text-base">
                  {selectedCategory !== "all" ||
                  selectedCategoryType !== "all" ||
                  selectedBrand ||
                  searchTerm ||
                  collectionType !== "all"
                    ? "No products found with the current filters"
                    : "Try adjusting your filters or check back later for new arrivals"}
                </p>
                <button
                  onClick={resetFilters}
                  className="px-5 sm:px-6 py-2.5 sm:py-3 bg-black text-white rounded-full hover:bg-gray-900 transition-colors text-sm sm:text-base"
                >
                  Reset Filters
                </button>
              </div>
            ) : viewMode === "grid" ? (
              /* Grid View */
              <>
                <div className="storefront-card-grid">
                  {filteredProducts.slice(0, displayLimit).map((product) => (
                    <div
                      key={product._id}
                      className="storefront-card-grid__item"
                    >
                      <StorefrontProductCard
                        product={product}
                        title={highlightText(product.title, searchTerm)}
                        metaLine={getProductCardMetaLine(product)}
                        className="w-full!"
                        onViewDetails={() => {
                          persistCurrentShopScroll();
                          navigate(`/product/${product._id}`);
                        }}
                      />
                    </div>
                  ))}
                </div>
                {filteredProducts.length > INITIAL_DISPLAY_LIMIT && (
                  <div className="text-center mt-8">
                    <button
                      onClick={handleViewMore}
                      className="px-6 py-3 bg-gray-900 text-white rounded-full font-semibold hover:bg-black transition-colors text-sm sm:text-base"
                    >
                      {allProductsVisible ? (
                        <>
                          <FiChevronUp className="inline mr-2" />
                          Show Less Products
                        </>
                      ) : (
                        <>
                          View More Products (
                          {filteredProducts.length - INITIAL_DISPLAY_LIMIT}{" "}
                          more)
                          <FiChevronDown className="inline ml-2" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* List View */
              <>
                <div className="grid gap-4 md:gap-6">
                  {filteredProducts
                    .slice(0, displayLimit)
                    .map((product, index) => {
                      const categoryType = getCategoryTypeForProduct(product);
                      const pricing = getProductPricing(product);
                      const compared = isProductCompared(product._id);
                      const productTypeLabel = String(
                        product.productType || "",
                      ).trim();
                      const categoryTypeLabel = String(
                        categoryType || "",
                      ).trim();
                      const showProductTypeBadge = Boolean(productTypeLabel);
                      const showCategoryTypeBadge =
                        Boolean(categoryTypeLabel) &&
                        categoryTypeLabel.toLowerCase() !==
                          productTypeLabel.toLowerCase();
                      return (
                        <motion.div
                          key={product._id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="group bg-white rounded-xl sm:rounded-2xl border border-gray-200 hover:shadow-xl transition-all duration-500 overflow-hidden hover:-translate-y-1 cursor-pointer"
                          onClick={() => {
                            persistCurrentShopScroll();
                            navigate(`/product/${product._id}`);
                          }}
                        >
                          <div className="flex flex-col lg:flex-row lg:h-64">
                            {/* Image - Left Side */}
                            <div className="relative lg:shrink-0 overflow-hidden">
                              <div className="w-full h-64 lg:h-full p-6 flex items-center justify-center">
                                <div className="relative mx-auto h-full w-full rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:scale-[0.94] hover:shadow-2xl lg:h-52 lg:w-52">
                                  <ProductImage
                                    src={product.images && product.images[0]}
                                    alt={product.title}
                                    className="w-full h-full object-cover"
                                  />
                                  {!product.images?.[0] && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-gray-100 to-gray-200">
                                      <div className="text-center text-gray-400 p-6">
                                        <svg
                                          className="w-16 h-16 mx-auto mb-2"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                          />
                                        </svg>
                                        <p className="text-sm font-medium">
                                          No Image
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Content - Right Side */}
                            <div className="flex-1 p-6 lg:pl-2">
                              <div className="flex flex-col h-full">
                                {/* Header */}
                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1 min-w-0 pr-4">
                                      <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-1 hover:text-black transition-colors group-hover:underline">
                                        {highlightText(
                                          product.title,
                                          searchTerm,
                                        )}
                                      </h2>
                                      {/* Category & Price Badges */}
                                      <div className="flex flex-wrap items-center gap-2 mb-4">
                                        {product.category?.name && (
                                          <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg">
                                            {product.category.name}
                                          </span>
                                        )}
                                        {showProductTypeBadge && (
                                          <span className="px-3 py-1.5 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-lg">
                                            {productTypeLabel}
                                          </span>
                                        )}
                                        {product.marketplaceType && (
                                          <span className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg capitalize">
                                            {product.marketplaceType}
                                          </span>
                                        )}
                                        {isPublicStockVisible(
                                          product,
                                          settings,
                                        ) && (
                                          <span className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg">
                                            {getPublicStockBadgeText(
                                              product,
                                              null,
                                              settings,
                                            )}
                                          </span>
                                        )}

                                        <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded">
                                          {product.brand}
                                        </span>
                                        {showCategoryTypeBadge && (
                                          <span className=" bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                                            {categoryTypeLabel}
                                          </span>
                                        )}
                                      </div>

                                      {/* Description */}
                                      {product.description && (
                                        <p className="text-gray-600 leading-relaxed line-clamp-2 text-sm mb-4">
                                          {highlightText(
                                            product.description,
                                            searchTerm,
                                          )}
                                        </p>
                                      )}

                                      {/* Dimensions */}
                                      {product.dimensions ? (
                                        <div className="flex flex-col gap-2 mb-6">
                                          {product.dimensions && (
                                            <div className="text-xs font-medium text-gray-500">
                                              Dim: {product.dimensions}
                                            </div>
                                          )}
                                        </div>
                                      ) : null}
                                    </div>

                                    {/* Price & View Button - Right Aligned */}
                                    <div className="flex flex-col items-end gap-4 mt-2 lg:mt-0 lg:text-right">
                                      {(() => {
                                        const inCart = isProductInCart(
                                          product._id,
                                        );
                                        const showCardCartButton =
                                          !hasVariantOptionPricing(product);
                                        return (
                                          <>
                                            {pricing.isTba ? (
                                              <div className="text-2xl font-bold text-black whitespace-nowrap">
                                                TBA
                                              </div>
                                            ) : (
                                              <div className="flex items-baseline gap-2 whitespace-nowrap">
                                                {pricing.hasDiscount && (
                                                  <span className="text-sm text-gray-400 line-through">
                                                    {`${pricing.previousPrice.toFixed(2)} Tk`}
                                                  </span>
                                                )}
                                                <div className="text-2xl font-bold text-black">
                                                  {`${Number(pricing.currentPrice || 0).toFixed(2)} Tk`}
                                                </div>
                                              </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                              {showCardCartButton ? (
                                                <button
                                                  type="button"
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    await handleToggleCart(
                                                      product,
                                                    );
                                                  }}
                                                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition-colors ${
                                                    inCart
                                                      ? "border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700"
                                                      : "border-gray-300 bg-white text-gray-600 hover:border-black hover:text-black"
                                                  }`}
                                                >
                                                  <FiShoppingBag className="h-4 w-4" />
                                                </button>
                                              ) : null}
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleToggleCompare(product);
                                                }}
                                                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white shadow-sm transition-colors ${
                                                  compared
                                                    ? "border-black bg-black text-white"
                                                    : "border-gray-300 text-gray-600 hover:border-black hover:text-black"
                                                }`}
                                              >
                                                <FiShuffle className="h-4 w-4" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  await handleToggleWishlist(
                                                    product,
                                                  );
                                                }}
                                                disabled={wishlistPendingIds.includes(
                                                  String(product._id || ""),
                                                )}
                                                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-60 ${
                                                  isProductWishlisted(
                                                    product._id,
                                                  )
                                                    ? "border-red-500 bg-red-50 text-red-600"
                                                    : "border-black bg-white text-black hover:border-red-500 hover:text-red-500"
                                                }`}
                                              >
                                                <FiHeart
                                                  className={`h-4 w-4 ${
                                                    isProductWishlisted(
                                                      product._id,
                                                    )
                                                      ? "fill-current"
                                                      : ""
                                                  }`}
                                                />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  persistCurrentShopScroll();
                                                  navigate(
                                                    `/product/${product._id}`,
                                                  );
                                                }}
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-black transition hover:border-black hover:bg-gray-50"
                                                aria-label="View details"
                                                title="View details"
                                              >
                                                <FiEye className="h-4 w-4" />
                                                <span className="sr-only">
                                                  View details
                                                </span>
                                              </button>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
                {filteredProducts.length > INITIAL_DISPLAY_LIMIT && (
                  <div className="text-center mt-8">
                    <button
                      onClick={handleViewMore}
                      className="px-6 py-3 bg-gray-900 text-white rounded-full font-semibold hover:bg-black transition-colors text-sm sm:text-base"
                    >
                      {allProductsVisible ? (
                        <>
                          <FiChevronUp className="inline mr-2" />
                          Show Less Products
                        </>
                      ) : (
                        <>
                          View More Products (
                          {filteredProducts.length - INITIAL_DISPLAY_LIMIT}{" "}
                          more)
                          <FiChevronDown className="inline ml-2" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Filters Modal */}
      {showMobileFilters && (
        <div className="app-layer-drawer-overlay fixed inset-0 bg-black/60 backdrop-blur-sm lg:hidden">
          <div className="app-layer-drawer absolute right-0 top-0 h-full w-full max-w-xs bg-white overflow-y-auto sm:max-w-sm">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-black">Filters</h3>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <FiX className="text-xl" />
                </button>
              </div>

              {/* Mobile filter content */}
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold text-black mb-3">Categories</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    <button
                      onClick={() => {
                        setSelectedCategory("all");
                        navigate("/shop");
                        setShowMobileFilters(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg ${
                        selectedCategory === "all"
                          ? "bg-black text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      All Categories
                    </button>
                    {visibleCategories.map((category) => (
                      <button
                        key={category._id}
                        onClick={() => {
                          setSelectedCategory(category._id);
                          navigate(`/shop?category=${category._id}`);
                          setShowMobileFilters(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg ${
                          selectedCategory === category._id
                            ? "bg-gray-900 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-black mb-3">
                    Category Type
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    <button
                      onClick={() => {
                        setSelectedCategoryType("all");
                        setShowMobileFilters(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg ${
                        selectedCategoryType === "all"
                          ? "bg-black text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      All Types
                    </button>
                    {visibleCategoryTypes.length > 0 ? (
                      visibleCategoryTypes.map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            setSelectedCategoryType(type);
                            setShowMobileFilters(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg ${
                            selectedCategoryType === type
                              ? "bg-gray-900 text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {type}
                        </button>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500 italic px-3 py-2">
                        {categories.length > 0
                          ? "No category types defined"
                          : "Loading categories..."}
                      </div>
                    )}
                  </div>
                </div>

                {/* Price Range in Mobile */}
                <div>
                  <h4 className="font-semibold text-black mb-3">Price Range</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{priceRange[0].toFixed(2)} Tk</span>
                      <span>{priceRange[1].toFixed(2)} Tk</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={
                        Math.max(
                          ...products.map((p) => getProductDisplayPrice(p)),
                        ) || 10000
                      }
                      value={priceRange[1]}
                      onChange={(e) =>
                        setPriceRange([priceRange[0], parseInt(e.target.value)])
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      resetFilters();
                      setShowMobileFilters(false);
                    }}
                    className="flex-1 py-3 bg-gray-100 text-black rounded-full font-semibold text-sm"
                  >
                    Reset All
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProductGrid;
