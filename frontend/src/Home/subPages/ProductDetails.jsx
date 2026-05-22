/* eslint-disable no-constant-condition */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import {
  FaShoppingCart,
  FaPlus,
  FaMinus,
  FaHeart,
  FaShare,
  FaFacebookF,
  FaTwitter,
  FaWhatsapp,
  FaLink,
  FaPaperPlane,
  FaStar,
  FaYoutube,
  FaChevronLeft,
  FaChevronRight,
  FaTruck,
  FaUndo,
} from "react-icons/fa";
import { FiArrowLeft, FiHeart, FiShare2, FiShuffle } from "react-icons/fi";
import { toast } from "react-hot-toast";
import SearchableSelect from "../../components/SearchableSelect";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../hooks/useAuth";
import usePublicSettings from "../../hooks/usePublicSettings";
import StorefrontProductCard from "../components/StorefrontProductCard";
import ProductReviewsPanel from "../components/ProductReviewsPanel";
import {
  COMPARE_LIMIT_MESSAGE,
  MAX_COMPARE_ITEMS,
  toggleCompareItem,
} from "../../store/compareSlice";
import { addRecentlyViewedItem } from "../../store/recentlyViewedSlice";
import {
  selectWishlistPendingIds,
  toggleWishlistItem,
} from "../../store/wishlistSlice";
import {
  buildDataLayerItem,
  getDataLayerCurrency,
} from "../../utils/marketingDataLayer";
import { trackViewContent } from "../../utils/analyticsTracker";
import { createProductSnapshot } from "../../utils/productSnapshot";
import { isPublicStockVisible } from "../../utils/publicProduct";
import { applySeoMetadata } from "../../utils/seoManager";
import {
  applyMarketingTemplate,
  getActiveMarketingEntry,
} from "../../utils/marketingProfiles";
import {
  buildSelectedVariantLabel,
  getEffectiveProductPricing,
  getReadableColorLabel,
  getReadableVariantOptionLabel,
  getResolvedSelectedVariants,
  normalizeProductVariantDefinitions,
  normalizeSelectedVariantsPayload,
} from "../../utils/productVariants";
import {
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  normalizeProductVideoEntries,
  normalizeProductYouTubeUrls,
} from "../../utils/productMedia";
import { hasHtmlContent, stripHtml } from "../../utils/richText";

const baseUrl = import.meta.env.VITE_API_URL;
const VALID_PRODUCT_TABS = new Set(["description", "additional", "reviews"]);
const THUMBNAIL_VISIBLE_COUNT = 4;

const normalizeProductTabValue = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return VALID_PRODUCT_TABS.has(normalized) ? normalized : "";
};

const getStoredProductTab = (productId) => {
  if (typeof window === "undefined" || !productId) return "";

  try {
    // Check localStorage first (persists across reloads)
    const localStorageTab = normalizeProductTabValue(
      localStorage.getItem(`productTab_${productId}`),
    );
    if (localStorageTab) return localStorageTab;

    // Fallback to sessionStorage
    return normalizeProductTabValue(
      window.sessionStorage.getItem(`product-detail-tab:${productId}`),
    );
  } catch {
    return "";
  }
};

const resolveImageValue = (value) => {
  if (!value) return "";

  if (typeof value === "string") return value;
  if (Array.isArray(value)) return resolveImageValue(value[0]);

  if (typeof value === "object") {
    return (
      value.data ||
      value.url ||
      value.secure_url ||
      value.src ||
      value.path ||
      ""
    );
  }

  return "";
};

// Helper function to get full image URL
const getFullImageUrl = (imagePath) => {
  const resolvedPath = resolveImageValue(imagePath);
  if (!resolvedPath) return null;

  if (
    resolvedPath.startsWith("http://") ||
    resolvedPath.startsWith("https://") ||
    resolvedPath.startsWith("data:")
  ) {
    return resolvedPath;
  }

  if (resolvedPath.startsWith("/")) {
    return baseUrl ? `${baseUrl}${resolvedPath}` : resolvedPath;
  }

  return baseUrl
    ? `${baseUrl}/uploads/products/${resolvedPath}`
    : `/uploads/products/${resolvedPath}`;
};

// Simple fallback image component
const FallbackImage = ({ className, alt }) => (
  <div className={`${className} bg-gray-100 flex items-center justify-center`}>
    <svg
      className="w-12 h-12 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
    <span className="sr-only">{alt || "No image available"}</span>
  </div>
);

// Image component with proper fallback
const ProductImage = ({ src, alt, className, isCurrent = false }) => {
  const [imgSrc, setImgSrc] = useState(getFullImageUrl(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(getFullImageUrl(src));
    setHasError(false);
  }, [src]);

  const handleError = () => {
    setHasError(true);
    if (typeof src === "string" && src.startsWith("/uploads/products/")) {
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
      loading={isCurrent ? "eager" : "lazy"}
      decoding="async"
      crossOrigin={
        imgSrc?.startsWith("http://") || imgSrc?.startsWith("https://")
          ? "anonymous"
          : undefined
      }
    />
  );
};

const ProductDetails = () => {
  const { id } = useParams();
  const buildEmptyReviewForm = () => ({
    rating: 0,
    title: "",
    comment: "",
    reviewerName: "",
    reviewerEmail: "",
  });
  const normalizeReviewSummary = (summary, fallbackReviews = []) => {
    const fallbackList = Array.isArray(fallbackReviews) ? fallbackReviews : [];
    const explicitCount = Number(summary?.ratingCount);
    const explicitAverage = Number(summary?.ratingAverage);
    const fallbackCount = fallbackList.length;
    const fallbackAverage =
      fallbackCount > 0
        ? fallbackList.reduce(
            (sum, entry) => sum + Number(entry?.rating || 0),
            0,
          ) / fallbackCount
        : 0;

    return {
      ratingAverage:
        Number.isFinite(explicitAverage) && explicitAverage >= 0
          ? explicitAverage
          : fallbackAverage,
      ratingCount:
        Number.isFinite(explicitCount) && explicitCount >= 0
          ? explicitCount
          : fallbackCount,
    };
  };
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedVariantOptions, setSelectedVariantOptions] = useState({});
  const [selectedVariationId, setSelectedVariationId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [productLoading, setProductLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({
    ratingAverage: 0,
    ratingCount: 0,
  });
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [myReview, setMyReview] = useState(null);
  const [reviewForm, setReviewForm] = useState(buildEmptyReviewForm);
  const [hoverRating, setHoverRating] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewDeleting, setReviewDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState(
    () => getStoredProductTab(id) || "description",
  );
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedProductsLoading, setRelatedProductsLoading] = useState(false);
  const [relatedCarouselHasOverflow, setRelatedCarouselHasOverflow] =
    useState(false);
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0);
  const { addToCart, isLoading: cartLoading } = useCart();
  const { user } = useAuth();
  const { settings, loaded: settingsLoaded } = usePublicSettings();
  const dispatch = useDispatch();
  const compareItems = useSelector((state) => state.compare.items || []);
  const wishlistItems = useSelector((state) => state.wishlist.items || []);
  const wishlistPendingIds = useSelector(selectWishlistPendingIds);
  const navigate = useNavigate();
  const productTopRef = useRef(null);
  const relatedCarouselRef = useRef(null);
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareTitle = product?.title || "Product";
  const shareText = product?.description
    ? stripHtml(product.description).slice(0, 140)
    : "Check this product";
  const productMediaItems = useMemo(() => {
    const imageItems = Array.isArray(product?.images)
      ? product.images
          .map((image, index) => ({
            key: `image-${index}`,
            type: "image",
            src: image,
            thumbnailSrc: image,
            alt: `${product?.title || "Product"} - ${index + 1}`,
          }))
          .filter((item) => Boolean(getFullImageUrl(item.src)))
      : [];

    const uploadedVideoItem = normalizeProductVideoEntries(product).map(
      (video, index) => ({
        key: `video-upload-${index}`,
        type: "video",
        src: getFullImageUrl(video.url),
        thumbnailSrc: getFullImageUrl(video.url),
        alt: `${product?.title || "Product"} video ${index + 1}`,
      }),
    );

    const youtubeItem = normalizeProductYouTubeUrls(product)
      .map((videoUrl, index) => {
        const youtubeThumbnail = getYouTubeThumbnailUrl(videoUrl);
        const youtubeEmbedUrl = getYouTubeEmbedUrl(videoUrl);
        if (!youtubeEmbedUrl || !youtubeThumbnail) return null;

        return {
          key: `video-youtube-${index}`,
          type: "youtube",
          src: youtubeEmbedUrl,
          thumbnailSrc: youtubeThumbnail,
          alt: `${product?.title || "Product"} YouTube video ${index + 1}`,
        };
      })
      .filter(Boolean);

    return [...imageItems, ...uploadedVideoItem, ...youtubeItem];
  }, [product]);
  const currentMediaItem =
    productMediaItems[selectedImage] || productMediaItems[0] || null;
  const currentModalMediaItem =
    productMediaItems[currentImageIndex] || productMediaItems[0] || null;
  const maxThumbnailStartIndex = Math.max(
    productMediaItems.length - THUMBNAIL_VISIBLE_COUNT,
    0,
  );
  const visibleThumbnailItems = useMemo(
    () =>
      productMediaItems
        .slice(
          thumbnailStartIndex,
          thumbnailStartIndex + THUMBNAIL_VISIBLE_COUNT,
        )
        .map((mediaItem, offset) => ({
          mediaItem,
          index: thumbnailStartIndex + offset,
        })),
    [productMediaItems, thumbnailStartIndex],
  );
  const hasThumbnailPagination =
    productMediaItems.length > THUMBNAIL_VISIBLE_COUNT;
  const canShowPreviousThumbnailPage = thumbnailStartIndex > 0;
  const canShowNextThumbnailPage = thumbnailStartIndex < maxThumbnailStartIndex;
  const isCompared = compareItems.some(
    (item) => String(item?._id || "") === String(product?._id || ""),
  );
  const isWishlisted = wishlistItems.some(
    (item) => String(item?._id || "") === String(product?._id || ""),
  );
  const wishlistLoading = wishlistPendingIds.includes(
    String(product?._id || ""),
  );
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleBackNavigation = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/shop");
  };

  useEffect(() => {
    const maxIndex = Math.max(productMediaItems.length - 1, 0);
    setSelectedImage((prev) => Math.min(prev, maxIndex));
    setCurrentImageIndex((prev) => Math.min(prev, maxIndex));
  }, [productMediaItems.length]);

  useEffect(() => {
    setThumbnailStartIndex((currentStart) => {
      if (selectedImage < currentStart) {
        return selectedImage;
      }

      if (selectedImage >= currentStart + THUMBNAIL_VISIBLE_COUNT) {
        return Math.max(
          Math.min(
            selectedImage - THUMBNAIL_VISIBLE_COUNT + 1,
            maxThumbnailStartIndex,
          ),
          0,
        );
      }

      return Math.min(currentStart, maxThumbnailStartIndex);
    });
  }, [maxThumbnailStartIndex, selectedImage]);

  useEffect(() => {
    setThumbnailStartIndex((currentStart) =>
      Math.min(currentStart, maxThumbnailStartIndex),
    );
  }, [maxThumbnailStartIndex]);

  useEffect(() => {
    setThumbnailStartIndex(0);
  }, [product?._id]);

  useEffect(() => {
    const container = relatedCarouselRef.current;
    if (!container) {
      setRelatedCarouselHasOverflow(false);
      return undefined;
    }

    const updateOverflow = () => {
      const node = relatedCarouselRef.current;
      if (!node) return;
      setRelatedCarouselHasOverflow(node.scrollWidth > node.clientWidth + 2);
    };

    updateOverflow();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateOverflow());
      observer.observe(container);
      return () => observer.disconnect();
    }

    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateOverflow);
      return () => window.removeEventListener("resize", updateOverflow);
    }

    return undefined;
  }, [relatedProductsLoading, relatedProducts.length]);

  const handleScrollToReviews = () => {
    if (typeof document === "undefined") return;
    setActiveTab("reviews");

    setTimeout(() => {
      const reviewSection = document.getElementById("reviews");
      if (reviewSection) {
        reviewSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
  };

  const handleScrollToTopCapture = (event) => {
    if (typeof window === "undefined") return;
    const interactive = event.target?.closest?.(
      'button, a, [role="button"], input[type="submit"]',
    );
    if (!interactive) return;

    if (interactive.hasAttribute("data-no-scroll-top")) return;
    if (interactive.closest("[data-review-section]")) return;
    if (interactive.closest("[data-skip-scroll-top]")) return;

    const topTarget = productTopRef.current;
    if (topTarget && typeof topTarget.scrollIntoView === "function") {
      topTarget.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    if (!id) return;

    const loadReviews = async () => {
      try {
        setReviewsLoading(true);
        const response = await axios.get(
          `${baseUrl}/products/public/${id}/reviews`,
        );
        const nextReviews = Array.isArray(response.data?.reviews)
          ? response.data.reviews
          : [];
        setReviews(nextReviews);
        setReviewSummary(
          normalizeReviewSummary(response.data?.summary, nextReviews),
        );
      } catch (error) {
        setReviews([]);
        setReviewSummary(
          normalizeReviewSummary({
            ratingAverage: Number(product?.ratingAverage || 0),
            ratingCount: Number(product?.ratingCount || 0),
          }),
        );
      } finally {
        setReviewsLoading(false);
      }
    };

    loadReviews();
  }, [id, product?.ratingAverage, product?.ratingCount]);

  useEffect(() => {
    if (!id || !isLoggedIn) {
      setMyReview(null);
      setReviewForm(buildEmptyReviewForm());
      return;
    }

    const loadMyReview = async () => {
      try {
        const response = await axios.get(
          `${baseUrl}/products/${id}/reviews/me`,
          {
            headers: getAuthHeaders(),
          },
        );
        const review = response.data?.review || null;
        setMyReview(review);
        if (review) {
          setReviewForm({
            rating: Number(review.rating || 0),
            title: review.title || "",
            comment: review.comment || "",
            reviewerName: review.reviewerName || user?.name || "",
            reviewerEmail: review.reviewerEmail || user?.email || "",
          });
        } else {
          setReviewForm({
            ...buildEmptyReviewForm(),
            reviewerName: user?.name || "",
            reviewerEmail: user?.email || "",
          });
        }
      } catch (_error) {
        setMyReview(null);
        setReviewForm(buildEmptyReviewForm());
      }
    };

    loadMyReview();
  }, [id, isLoggedIn, user?.email, user?.name]);

  // Fetch product details
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setProductLoading(true);
        const response = await axios.get(`${baseUrl}/products/public/${id}`);

        const productData =
          response.data.product || response.data.data || response.data;

        if (productData) {
          const normalizedId = productData._id || productData.id;
          setProduct(
            normalizedId
              ? { ...productData, _id: normalizedId }
              : productData,
          );

          setSelectedVariantOptions({});
          setSelectedColor("");

          if (
            productData.marketplaceType === "variable" &&
            Array.isArray(productData.variations) &&
            productData.variations.length > 0
          ) {
            setSelectedVariationId("");
          }
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        toast.error("Failed to load product details", {
          autoClose: 3000,
        });
      } finally {
        setProductLoading(false);
      }
    };

    if (id) {
      fetchProduct();
    }
  }, [id]);

  useEffect(() => {
    if (!product?._id) return;

    const hasAdditionalInfo = Boolean(
      (Array.isArray(product.specifications) &&
        product.specifications.length > 0) ||
      product.brand ||
      product.weight ||
      product.dimensions,
    );

    const availableTabs = [
      product.description ? "description" : null,
      hasAdditionalInfo ? "additional" : null,
      "reviews",
    ].filter(Boolean);

    const storedTab = getStoredProductTab(product._id);

    setActiveTab((currentTab) => {
      if (availableTabs.includes(storedTab)) {
        return storedTab;
      }

      if (availableTabs.includes(currentTab)) {
        return currentTab;
      }

      return availableTabs[0] || "reviews";
    });
  }, [
    product?._id,
    product?.brand,
    product?.description,
    product?.dimensions,
    product?.weight,
    product?.specifications,
  ]);

  useEffect(() => {
    if (!product?._id) return;
    const snapshot = createProductSnapshot(product);
    if (!snapshot) return;
    dispatch(addRecentlyViewedItem(snapshot));
  }, [dispatch, product]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!product?._id) return;
    window.__CURRENT_PRODUCT_ID__ = String(product._id || "").trim();
    window.dispatchEvent(new Event("marketing:product-context"));
    return () => {
      if (window.__CURRENT_PRODUCT_ID__ === String(product._id || "").trim()) {
        window.__CURRENT_PRODUCT_ID__ = "";
        window.dispatchEvent(new Event("marketing:product-context"));
      }
    };
  }, [product?._id]);

  useEffect(() => {
    if (!product?._id) {
      setRelatedProducts([]);
      return;
    }

    const resolveCategoryId = (value) => {
      if (!value) return "";
      if (typeof value === "string") return value;
      return value?._id ? String(value._id) : "";
    };

    const categoryId = resolveCategoryId(product.category);
    const productType = String(product.productType || "").trim();
    let cancelled = false;

    const fetchRelatedProducts = async () => {
      try {
        setRelatedProductsLoading(true);
        const response = await axios.get(`${baseUrl}/products/public`, {
          timeout: 15000,
        });
        const payload =
          response.data?.products || response.data?.data || response.data;
        const products = Array.isArray(payload) ? payload : [];

        const otherProducts = products.filter(
          (entry) => String(entry?._id || "") !== String(product._id || ""),
        );

        const resolveEntryCategoryId = (value) => {
          if (!value) return "";
          if (typeof value === "string") return value;
          return value?._id ? String(value._id) : "";
        };

        let resolvedRelated = otherProducts;
        if (categoryId) {
          const sameCategory = otherProducts.filter(
            (entry) => resolveEntryCategoryId(entry.category) === categoryId,
          );
          if (sameCategory.length > 0) resolvedRelated = sameCategory;
        }

        if (!categoryId && productType) {
          const sameType = otherProducts.filter(
            (entry) => String(entry?.productType || "").trim() === productType,
          );
          if (sameType.length > 0) resolvedRelated = sameType;
        }

        if (!cancelled) {
          setRelatedProducts(resolvedRelated.slice(0, 8));
        }
      } catch (_error) {
        if (!cancelled) setRelatedProducts([]);
      } finally {
        if (!cancelled) setRelatedProductsLoading(false);
      }
    };

    fetchRelatedProducts();
    return () => {
      cancelled = true;
    };
  }, [product?._id, product?.category, product?.productType]);

  useEffect(() => {
    if (!settingsLoaded || !product?._id || typeof window === "undefined") {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      const resolvedPrice =
        Number(product?.salePrice ?? product?.price ?? 0) > 0
          ? Number(product?.salePrice ?? product?.price ?? 0)
          : Number(product?.price || 0);

      trackViewContent({
        ecommerce: {
          currency: getDataLayerCurrency(),
          value: Number.isFinite(resolvedPrice) ? resolvedPrice : 0,
          items: [
            buildDataLayerItem({
              productId: product._id,
              title: product.title,
              price: resolvedPrice,
              category:
                product?.category?.name ||
                product?.category ||
                product?.productType ||
                "",
              brand: product?.brand || "",
            }),
          ],
        },
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    settingsLoaded,
    product?._id,
    product?.brand,
    product?.category,
    product?.category?.name,
    product?.price,
    product?.productType,
    product?.salePrice,
    product?.title,
  ]);

  useEffect(() => {
    if (!product?._id) return;

    const website = settings?.website || {};
    const seo = settings?.seo || {};
    const pageSeo = settings?.seoAnalytics?.pages?.productDetails || {};
    const hasExplicitEntries = Boolean(
      settings?.seoAnalytics?.hasExplicitEntries,
    );
    const storeName =
      String(website.storeName || "E-Commerce").trim() || "E-Commerce";
    const seoEntry = getActiveMarketingEntry(settings, {
      type: "seo",
      pathname: `/product/${product._id}`,
      productId: product._id,
    });
    const templateReplacements = {
      storeName,
      pageName: product?.title || "Product",
      productName: product?.title || "Product",
      productCategory:
        product?.category?.name ||
        product?.category ||
        product?.productType ||
        "",
      productDescription: stripHtml(product?.description || ""),
    };
    const seoTitle = String(
      applyMarketingTemplate(seoEntry?.metaTitle, templateReplacements) ||
        product?.seoTitle ||
        product?.title ||
        "Product",
    ).trim();
    const seoDescription = String(
      applyMarketingTemplate(seoEntry?.metaDescription, templateReplacements) ||
        product?.seoDescription ||
        stripHtml(product?.description || "") ||
        (!hasExplicitEntries ? pageSeo.metaDescription : "") ||
        (!hasExplicitEntries ? seo.metaDescription : "") ||
        "",
    ).trim();
    const seoImage =
      getFullImageUrl(product?.images?.[0] || product?.image || "") ||
      String(
        applyMarketingTemplate(
          seoEntry?.openGraphImage,
          templateReplacements,
        ) ||
          (!hasExplicitEntries ? pageSeo.openGraphImage : "") ||
          (!hasExplicitEntries ? seo.openGraphImage : "") ||
          website.headerIconUrl ||
          website.logoUrl ||
          "",
      ).trim();

    applySeoMetadata({
      title: seoTitle,
      description: seoDescription,
      keywords: String(
        applyMarketingTemplate(seoEntry?.metaKeywords, templateReplacements) ||
          (!hasExplicitEntries ? pageSeo.metaKeywords : "") ||
          (!hasExplicitEntries ? seo.metaKeywords : "") ||
          "",
      ).trim(),
      image: seoImage,
      url: typeof window !== "undefined" ? window.location.href : "",
      siteName: storeName,
      type: "product",
    });
  }, [
    product?._id,
    product?.description,
    product?.image,
    product?.images,
    product?.title,
    settings,
  ]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const normalizedTab =
        normalizeProductTabValue(activeTab) || "description";
      localStorage.setItem(`productTab_${id}`, normalizedTab);
      // Also save to sessionStorage for backward compatibility
      try {
        window.sessionStorage.setItem(
          `product-detail-tab:${id}`,
          normalizedTab,
        );
      } catch (e) {
        // sessionStorage might be disabled, ignore
      }
    }
  }, [activeTab, id]);

  const marketplaceType = String(product?.marketplaceType || "simple");
  const priceType = String(product?.priceType || "single");
  const isTbaPrice = priceType === "tba";
  const isRecurringProduct = Boolean(product?.isRecurring);
  const showPublicStock = isPublicStockVisible(product, settings);
  const productVariantDefinitions = useMemo(
    () => normalizeProductVariantDefinitions(product || {}),
    [product],
  );
  const hasColorVariantDefinition = productVariantDefinitions.some(
    (definition) =>
      definition.preset === "color" ||
      definition.name.toLowerCase() === "color",
  );
  const legacyColorOptions =
    !hasColorVariantDefinition && Array.isArray(product?.colors)
      ? product.colors
      : [];
  const selectedVariation =
    marketplaceType === "variable"
      ? (product?.variations || []).find(
          (variation) =>
            String(variation?._id || "") === String(selectedVariationId || ""),
        ) || null
      : null;
  const selectedVariantSelections = useMemo(
    () =>
      productVariantDefinitions
        .map((definition, index) => {
          const selected = selectedVariantOptions[index];
          if (!selected) return null;

          return {
            name: definition.name,
            preset: definition.preset,
            label: selected.label || selected.value || "",
            value: selected.value || selected.label || "",
            colorHex: selected.colorHex || "",
            priceMode: selected.priceMode || "default",
            price: selected.price,
            comparePrice: selected.comparePrice,
          };
        })
        .filter(Boolean),
    [productVariantDefinitions, selectedVariantOptions],
  );
  const hasAllVariantSelections = useMemo(
    () =>
      productVariantDefinitions.every((_, index) =>
        Boolean(selectedVariantOptions[index]),
      ),
    [productVariantDefinitions, selectedVariantOptions],
  );
  const resolvedSelectedVariants = useMemo(
    () =>
      hasAllVariantSelections
        ? getResolvedSelectedVariants(product || {}, selectedVariantSelections)
        : normalizeSelectedVariantsPayload(selectedVariantSelections),
    [hasAllVariantSelections, product, selectedVariantSelections],
  );
  const selectedVariantLabel = useMemo(
    () => buildSelectedVariantLabel(resolvedSelectedVariants),
    [resolvedSelectedVariants],
  );
  const resolvedSelectedColor = useMemo(() => {
    const colorDefinitionIndex = productVariantDefinitions.findIndex(
      (definition) =>
        definition.preset === "color" ||
        definition.name.toLowerCase() === "color",
    );

    if (colorDefinitionIndex >= 0) {
      const selectedOption = selectedVariantOptions[colorDefinitionIndex];
      return String(
        selectedOption?.colorHex ||
          selectedOption?.value ||
          selectedColor ||
          "",
      )
        .trim()
        .toLowerCase();
    }

    return String(selectedColor || "")
      .trim()
      .toLowerCase();
  }, [productVariantDefinitions, selectedColor, selectedVariantOptions]);
  const currentPricing = useMemo(() => {
    if (!product) {
      return {
        currentPrice: 0,
        previousPrice: null,
      };
    }

    if (marketplaceType === "variable" && selectedVariation) {
      const hasVariationSalePrice =
        selectedVariation?.salePrice !== null &&
        selectedVariation?.salePrice !== undefined &&
        String(selectedVariation.salePrice).trim() !== "";
      const salePrice = hasVariationSalePrice
        ? Number(selectedVariation.salePrice)
        : null;
      const regularPrice = Number(selectedVariation.price);

      return getEffectiveProductPricing({
        basePrice:
          Number.isFinite(salePrice) && salePrice >= 0
            ? salePrice
            : regularPrice,
        baseComparePrice:
          Number.isFinite(salePrice) &&
          salePrice >= 0 &&
          Number.isFinite(regularPrice) &&
          regularPrice > salePrice
            ? regularPrice
            : null,
        selectedVariants: resolvedSelectedVariants,
      });
    }

    const hasSalePrice =
      String(product?.priceType || "single") === "best" &&
      product?.salePrice !== null &&
      product?.salePrice !== undefined &&
      String(product.salePrice).trim() !== "";
    const salePrice = hasSalePrice ? Number(product.salePrice) : null;
    const regularPrice = Number(product.price);

    return getEffectiveProductPricing({
      basePrice:
        Number.isFinite(salePrice) && salePrice >= 0 ? salePrice : regularPrice,
      baseComparePrice:
        Number.isFinite(salePrice) &&
        salePrice >= 0 &&
        Number.isFinite(regularPrice) &&
        regularPrice > salePrice
          ? regularPrice
          : null,
      selectedVariants: resolvedSelectedVariants,
    });
  }, [marketplaceType, product, resolvedSelectedVariants, selectedVariation]);

  const getCurrentPrice = () => Number(currentPricing.currentPrice || 0);

  const getCurrentStock = () => {
    if (!product) return 0;
    if (marketplaceType === "variable") {
      return Number(selectedVariation?.stock || 0);
    }
    return Number(product.stock || 0);
  };

  const isInStock = () => {
    if (!product) return false;
    if (product.allowBackorder) return true;
    return getCurrentStock() > 0;
  };

  // Handle quantity changes
  const increaseQuantity = () =>
    setQuantity((prev) => {
      if (product?.allowBackorder) return prev + 1;
      const maxStock = getCurrentStock();
      if (!maxStock) return 1;
      return Math.min(prev + 1, maxStock);
    });
  const decreaseQuantity = () =>
    setQuantity((prev) => (prev > 1 ? prev - 1 : 1));

  // Handle add to cart
  const handleAddToCart = async () => {
    if (!product) return;

    if (isTbaPrice) {
      toast.error("This product price is TBA and cannot be purchased now.");
      return;
    }

    if (marketplaceType === "grouped") {
      toast.error("Please add individual grouped items from below.");
      return;
    }

    if (marketplaceType === "variable" && !selectedVariationId) {
      toast.error("Please select a size");
      return;
    }

    if (!isInStock()) {
      toast.error("This item is currently out of stock");
      return;
    }

    setLoading(true);

    try {
      const combinedVariationLabel = [
        String(selectedVariation?.label || "").trim(),
        selectedVariantLabel,
      ]
        .filter(Boolean)
        .join(" | ");
      const result = await addToCart(
        product,
        quantity,
        resolvedSelectedColor,
        "",
        {
          variationId: selectedVariationId || "",
          variationLabel: combinedVariationLabel,
          selectedVariants: resolvedSelectedVariants,
          unitPrice: getCurrentPrice(),
        },
      );
      if (!result?.success) {
        toast.error(result?.error || "Failed to add to cart");
      }
    } catch (err) {
      console.error("Error adding to cart:", err);
      toast.error("Failed to add to cart", {
        autoClose: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle buy now
  // ProductDetails.jsx - Update handleBuyNow function
  const handleBuyNow = async () => {
    if (isTbaPrice) {
      toast.error("This product price is TBA and cannot be purchased now.");
      return;
    }

    if (marketplaceType === "grouped") {
      toast.error("Please add individual grouped items from below.");
      return;
    }

    try {
      if (marketplaceType === "variable" && !selectedVariationId) {
        toast.error("Please select a size");
        return;
      }

      if (!isInStock()) {
        toast.error("This item is currently out of stock");
        return;
      }

      const combinedVariationLabel = [
        String(selectedVariation?.label || "").trim(),
        selectedVariantLabel,
      ]
        .filter(Boolean)
        .join(" | ");
      // Add to cart first
      const result = await addToCart(
        product,
        quantity,
        resolvedSelectedColor,
        "",
        {
          variationId: selectedVariationId || "",
          variationLabel: combinedVariationLabel,
          selectedVariants: resolvedSelectedVariants,
          unitPrice: getCurrentPrice(),
        },
      );

      if (result.success) {
        // Navigate to checkout regardless of login status
        navigate("/checkout");
      } else {
        toast.error("Failed to add item to cart", {
          autoClose: 3000,
        });
      }
    } catch (err) {
      console.error("Error in buy now:", err);
      toast.error("Failed to proceed", {
        autoClose: 3000,
      });
    }
  };

  const renderStars = (rating = 0) =>
    Array.from({ length: 5 }).map((_, index) => (
      <FaStar
        key={`star-${index}`}
        className={`w-4 h-4 ${
          index < Math.round(Number(rating || 0))
            ? "text-yellow-500 fill-yellow-500"
            : "text-gray-300"
        }`}
      />
    ));

  const refreshReviews = async () => {
    if (!id) return;
    try {
      const response = await axios.get(
        `${baseUrl}/products/public/${id}/reviews`,
      );
      const nextReviews = Array.isArray(response.data?.reviews)
        ? response.data.reviews
        : [];
      setReviews(nextReviews);
      setReviewSummary(
        normalizeReviewSummary(response.data?.summary, nextReviews),
      );
    } catch (_error) {
      // Keep the current UI state if refresh fails.
    }
  };

  const handleToggleWishlist = async () => {
    if (!product?._id) return;

    try {
      await dispatch(toggleWishlistItem(product)).unwrap();
      toast.success(
        isWishlisted ? "Removed from wishlist" : "Added to wishlist",
      );
    } catch (error) {
      toast.error(error || "Failed to update wishlist");
    }
  };

  const handleToggleCompare = () => {
    if (!product?._id) return;
    const snapshot = createProductSnapshot(product);
    if (!snapshot) return;
    const exists = compareItems.some(
      (item) => String(item?._id || "") === String(snapshot._id),
    );
    if (!exists && compareItems.length >= MAX_COMPARE_ITEMS) {
      toast.error(COMPARE_LIMIT_MESSAGE);
      return;
    }
    dispatch(toggleCompareItem(snapshot));
    toast.success(exists ? "Removed from compare" : "Added to compare");
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      toast.success("Product link copied");
    } catch (_error) {
      toast.error("Failed to copy product link");
    }
  };

  const handleSharePlatform = (platform) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(`${shareTitle} - ${shareText}`);
    const platformUrls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    };

    const targetUrl = platformUrls[platform];
    if (!targetUrl) return;
    window.open(
      targetUrl,
      "_blank",
      "noopener,noreferrer,width=640,height=640",
    );
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied");
    } catch (_error) {
      toast.error("Failed to copy link");
    }
  };

  const handleNavigateToProduct = (productId) => {
    const resolvedId = String(productId || "").trim();
    if (!resolvedId) return;
    navigate(`/product/${resolvedId}`);
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  };

  const scrollRelatedCarousel = (direction) => {
    const container = relatedCarouselRef.current;
    if (!container) return;
    const delta = Math.max(240, container.clientWidth);
    container.scrollBy({
      left: direction * delta,
      behavior: "smooth",
    });
  };

  const getRelatedProductPricing = (entry) => {
    const formatPrice = (value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return null;
      return `${Math.round(parsed)} Tk`;
    };

    const priceType = String(entry?.priceType || "single")
      .trim()
      .toLowerCase();
    if (priceType === "tba") {
      return {
        isTba: true,
        isRange: false,
        hasDiscount: false,
        currentValue: null,
        previousValue: null,
        currentText: "TBA",
        previousText: null,
      };
    }

    const marketplaceType = String(entry?.marketplaceType || "simple")
      .trim()
      .toLowerCase();

    if (
      marketplaceType === "variable" &&
      Array.isArray(entry?.variations) &&
      entry.variations.length > 0
    ) {
      const prices = entry.variations
        .filter((variation) => variation?.isActive !== false)
        .map((variation) => {
          const hasSalePrice =
            variation?.salePrice !== null &&
            variation?.salePrice !== undefined &&
            String(variation.salePrice).trim() !== "";
          const salePrice = hasSalePrice ? Number(variation.salePrice) : NaN;
          const regularPrice = Number(variation?.price);

          if (Number.isFinite(salePrice) && salePrice >= 0) return salePrice;
          if (Number.isFinite(regularPrice) && regularPrice >= 0)
            return regularPrice;
          return null;
        })
        .filter((price) => price !== null);

      if (prices.length > 0) {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const currentText =
          min !== max
            ? `${formatPrice(min) || ""} - ${formatPrice(max) || ""}`.trim()
            : formatPrice(min) || "";

        return {
          isTba: false,
          isRange: min !== max,
          hasDiscount: false,
          currentValue: Number.isFinite(min) ? min : null,
          previousValue: null,
          currentText,
          previousText: null,
        };
      }
    }

    const regularPrice = Number(entry?.price);
    const normalizedRegularPrice =
      Number.isFinite(regularPrice) && regularPrice >= 0 ? regularPrice : 0;

    const hasSalePrice =
      priceType === "best" &&
      entry?.salePrice !== null &&
      entry?.salePrice !== undefined &&
      String(entry.salePrice).trim() !== "";
    const salePrice = hasSalePrice ? Number(entry.salePrice) : NaN;
    const normalizedSalePrice =
      Number.isFinite(salePrice) && salePrice >= 0 ? salePrice : null;

    const hasDiscount =
      normalizedSalePrice !== null &&
      normalizedSalePrice < normalizedRegularPrice;

    const currentValue = hasDiscount
      ? normalizedSalePrice
      : normalizedRegularPrice;

    return {
      isTba: false,
      isRange: false,
      hasDiscount,
      currentValue,
      previousValue: normalizedRegularPrice,
      currentText: formatPrice(currentValue) || "",
      previousText: hasDiscount ? formatPrice(normalizedRegularPrice) : null,
    };
  };

  const handleRelatedWishlist = async (entry) => {
    if (!entry?._id) return;

    const alreadyWishlisted = wishlistItems.some(
      (item) => String(item?._id || "") === String(entry._id || ""),
    );

    try {
      await dispatch(toggleWishlistItem(entry)).unwrap();
      toast.success(
        alreadyWishlisted ? "Removed from wishlist" : "Added to wishlist",
      );
    } catch (error) {
      toast.error(error || "Failed to update wishlist");
    }
  };

  const handleRelatedCompare = (event, entry) => {
    event.stopPropagation();
    const snapshot = createProductSnapshot(entry);
    if (!snapshot) return;

    const exists = compareItems.some(
      (item) => String(item?._id || "") === String(snapshot._id || ""),
    );
    if (!exists && compareItems.length >= MAX_COMPARE_ITEMS) {
      toast.error(COMPARE_LIMIT_MESSAGE);
      return;
    }
    dispatch(toggleCompareItem(snapshot));
    toast.success(exists ? "Removed from compare" : "Added to compare");
  };

  const handleRelatedAddToCart = async (event, entry) => {
    event.stopPropagation();

    if (!entry?._id) return;

    const priceType = String(entry?.priceType || "single")
      .trim()
      .toLowerCase();
    if (priceType === "tba") {
      toast.error(
        "This product price is TBA and cannot be purchased right now",
      );
      return;
    }

    const marketplaceType = String(entry?.marketplaceType || "simple")
      .trim()
      .toLowerCase();

    if (
      marketplaceType === "variable" &&
      Array.isArray(entry?.variations) &&
      entry.variations.length > 0
    ) {
      handleNavigateToProduct(entry._id);
      return;
    }

    if (marketplaceType === "grouped") {
      handleNavigateToProduct(entry._id);
      return;
    }

    try {
      await addToCart(entry, 1);
    } catch (_error) {
      // addToCart already handles toast
    }
  };

  const handleRelatedBuyNow = async (event, entry) => {
    event.stopPropagation();

    if (!entry?._id) return;

    const priceType = String(entry?.priceType || "single")
      .trim()
      .toLowerCase();
    if (priceType === "tba") {
      toast.error(
        "This product price is TBA and cannot be purchased right now",
      );
      return;
    }

    const marketplaceType = String(entry?.marketplaceType || "simple")
      .trim()
      .toLowerCase();

    if (marketplaceType === "variable" || marketplaceType === "grouped") {
      handleNavigateToProduct(entry._id);
      return;
    }

    if (!entry.allowBackorder && Number(entry.stock || 0) <= 0) {
      toast.error("This item is currently out of stock");
      return;
    }

    try {
      const result = await addToCart(entry, 1);
      if (result?.success) {
        navigate("/checkout");
        if (typeof window !== "undefined") window.scrollTo(0, 0);
      }
    } catch (_error) {
      // addToCart already handles toast
    }
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();

    if (!reviewForm.comment.trim()) {
      toast.error("Please write your review comment");
      return;
    }

    if (Number(reviewForm.rating || 0) < 1) {
      toast.error("Please choose a star rating");
      return;
    }

    if (!isLoggedIn && !String(reviewForm.reviewerName || "").trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (
      !isLoggedIn &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        String(reviewForm.reviewerEmail || "").trim(),
      )
    ) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setReviewSubmitting(true);
      const endpoint = isLoggedIn
        ? `${baseUrl}/products/${id}/reviews`
        : `${baseUrl}/products/public/${id}/reviews`;
      const response = await axios.post(
        endpoint,
        {
          rating: Number(reviewForm.rating || 0),
          title: String(reviewForm.title || "").trim(),
          comment: String(reviewForm.comment || "").trim(),
          reviewerName: String(reviewForm.reviewerName || "").trim(),
          reviewerEmail: String(reviewForm.reviewerEmail || "").trim(),
        },
        isLoggedIn ? { headers: getAuthHeaders() } : undefined,
      );

      if (isLoggedIn && response.data?.review) {
        setMyReview(response.data.review);
      }
      if (response.data?.summary) {
        setReviewSummary(normalizeReviewSummary(response.data.summary));
      }

      setReviewForm(
        isLoggedIn
          ? {
              ...buildEmptyReviewForm(),
              reviewerName: user?.name || "",
              reviewerEmail: user?.email || "",
            }
          : buildEmptyReviewForm(),
      );
      setHoverRating(null);
      toast.success(response.data?.message || "Review submitted");
      await refreshReviews();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit review");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!id) return;

    try {
      setReviewDeleting(true);
      const response = await axios.delete(
        `${baseUrl}/products/${id}/reviews/me`,
        {
          headers: getAuthHeaders(),
        },
      );
      setMyReview(null);
      setReviewForm({
        ...buildEmptyReviewForm(),
        reviewerName: user?.name || "",
        reviewerEmail: user?.email || "",
      });
      if (response.data?.summary) {
        setReviewSummary(normalizeReviewSummary(response.data.summary));
      }
      toast.success(response.data?.message || "Review deleted");
      await refreshReviews();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete review");
    } finally {
      setReviewDeleting(false);
    }
  };

  // Image modal navigation
  const nextImage = () => {
    if (!productMediaItems.length) return;
    setCurrentImageIndex((prev) =>
      prev === productMediaItems.length - 1 ? 0 : prev + 1,
    );
  };

  const prevImage = () => {
    if (!productMediaItems.length) return;
    setCurrentImageIndex((prev) =>
      prev === 0 ? productMediaItems.length - 1 : prev - 1,
    );
  };

  const nextSelectedImage = () => {
    if (!productMediaItems.length) return;
    setSelectedImage((prev) =>
      prev === productMediaItems.length - 1 ? 0 : prev + 1,
    );
  };

  const prevSelectedImage = () => {
    if (!productMediaItems.length) return;
    setSelectedImage((prev) =>
      prev === 0 ? productMediaItems.length - 1 : prev - 1,
    );
  };

  const showPreviousThumbnailPage = () => {
    setThumbnailStartIndex((prev) => Math.max(prev - 1, 0));
  };

  const showNextThumbnailPage = () => {
    setThumbnailStartIndex((prev) =>
      Math.min(prev + 1, maxThumbnailStartIndex),
    );
  };

  const currentPrice = Number(currentPricing.currentPrice || 0);
  const currentStock = getCurrentStock();
  const recurringInterval = String(product?.recurringInterval || "monthly");
  const recurringIntervalCount = Math.max(
    1,
    Number(product?.recurringIntervalCount || 1),
  );
  const recurringTotalCycles = Math.max(
    0,
    Number(product?.recurringTotalCycles || 0),
  );
  const recurringTrialDays = Math.max(
    0,
    Number(product?.recurringTrialDays || 0),
  );
  const regularPriceForDisplay =
    currentPricing.previousPrice !== null
      ? Number(currentPricing.previousPrice || 0)
      : marketplaceType === "variable"
        ? Number(selectedVariation?.price || currentPrice || 0)
        : Number(product?.price || currentPrice || 0);
  const hasDiscountPrice =
    !isTbaPrice &&
    Number.isFinite(regularPriceForDisplay) &&
    regularPriceForDisplay > Number(currentPrice || 0);
  const discountPercentForDisplay =
    hasDiscountPrice && regularPriceForDisplay > 0
      ? Math.round(
          ((regularPriceForDisplay - Number(currentPrice || 0)) /
            regularPriceForDisplay) *
            100,
        )
      : null;
  const variationPriceBounds = (() => {
    if (marketplaceType !== "variable" || !Array.isArray(product?.variations))
      return null;
    const prices = product.variations
      .filter((variation) => variation?.isActive !== false)
      .map((variation) => {
        const hasSalePrice =
          variation?.salePrice !== null &&
          variation?.salePrice !== undefined &&
          String(variation.salePrice).trim() !== "";
        const salePrice = hasSalePrice ? Number(variation.salePrice) : NaN;
        const regularPrice = Number(variation?.price);
        if (Number.isFinite(salePrice) && salePrice >= 0) return salePrice;
        if (Number.isFinite(regularPrice) && regularPrice >= 0)
          return regularPrice;
        return NaN;
      })
      .filter((value) => Number.isFinite(value));
    if (!prices.length) return null;
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  })();
  const showVariationPriceRange = Boolean(
    !selectedVariationId &&
    variationPriceBounds &&
    variationPriceBounds.min !== variationPriceBounds.max,
  );
  const categoryLabel = String(
    typeof product?.category === "object"
      ? product?.category?.name || ""
      : product?.category || "",
  ).trim();
  const brandLabel = String(product?.brand || "").trim();
  const recurringIntervalLabel = (
    {
      daily: "day",
      weekly: "week",
      monthly: "month",
      yearly: "year",
    }[recurringInterval] || recurringInterval
  ).trim();
  const recurringLabel = isRecurringProduct
    ? `Renews every ${recurringIntervalCount > 1 ? `${recurringIntervalCount} ` : ""}${recurringIntervalLabel}${recurringIntervalCount > 1 ? "s" : ""}${
        recurringTrialDays > 0 ? ` after a ${recurringTrialDays}-day trial` : ""
      }${recurringTotalCycles > 0 ? ` for ${recurringTotalCycles} cycles` : ""}`
    : "";
  const publicStockText =
    showPublicStock && currentStock > 0 ? `${currentStock} in stock` : "";
  const availabilityBadge = (() => {
    if (isTbaPrice) {
      return {
        label: "Price pending",
        className: "border border-gray-200 bg-gray-50 text-gray-700",
      };
    }

    if (
      marketplaceType === "variable" &&
      Array.isArray(product?.variations) &&
      product.variations.length > 0 &&
      !selectedVariationId
    ) {
      return {
        label: "Select size",
        className: "border border-gray-200 bg-white text-gray-700",
      };
    }

    if (product?.allowBackorder && currentStock <= 0) {
      return {
        label: "Backorder available",
        className: "border border-gray-200 bg-white text-gray-700",
      };
    }

    if (!isInStock()) {
      return {
        label: "Out of stock",
        className: "bg-rose-50 text-rose-700",
      };
    }

    if (publicStockText) {
      return {
        label: publicStockText,
        className: "bg-emerald-50 text-emerald-700",
      };
    }

    return null;
  })();
  const purchaseActionDisabled =
    loading ||
    cartLoading ||
    !isInStock() ||
    (marketplaceType === "variable" &&
      Array.isArray(product?.variations) &&
      product.variations.length > 0 &&
      !selectedVariationId);
  const quantityStatusText =
    currentStock > 0
      ? publicStockText
      : product?.allowBackorder
        ? "Backorders allowed"
        : "Out of stock";
  const quantityStatusToneClass =
    currentStock > 0
      ? "bg-emerald-50 text-emerald-700"
      : product?.allowBackorder
        ? "bg-white text-gray-700 shadow-sm"
        : "bg-rose-50 text-rose-600";
  const summaryHighlights = [
    categoryLabel ? { label: "Category", value: categoryLabel } : null,
    brandLabel ? { label: "Brand", value: brandLabel } : null,
    {
      label: "Delivery",
      value:
        Number(product?.deliveryMaxDays || 0) > 0
          ? Number(product?.deliveryMinDays || 0) > 0
            ? `${product.deliveryMinDays}-${product.deliveryMaxDays} days`
            : `${product.deliveryMaxDays} days`
          : "Shown at checkout",
    },
    {
      label: isRecurringProduct ? "Plan" : "Pricing",
      value: isRecurringProduct
        ? recurringLabel
        : priceType === "best"
          ? "Offer pricing"
          : priceType === "tba"
            ? "TBA"
            : "Standard price",
    },
  ].filter(Boolean);
  const additionalInfoRows = (() => {
    const rows = [];

    if (Array.isArray(product?.specifications)) {
      product.specifications.forEach((spec) => {
        const label = String(spec?.key || "").trim();
        const value = String(spec?.value || "").trim();
        if (!label || !value) return;
        rows.push({ label, value });
      });
    }

    if (String(product?.brand || "").trim()) {
      const hasBrandRow = rows.some(
        (row) =>
          String(row.label || "")
            .trim()
            .toLowerCase() === "brand",
      );
      if (!hasBrandRow) {
        rows.unshift({ label: "Brand", value: String(product.brand).trim() });
      }
    }

    if (Number(product?.weight || 0) > 0) {
      rows.push({ label: "Weight", value: `${Number(product.weight)}KG` });
    }

    if (String(product?.dimensions || "").trim()) {
      rows.push({
        label: "Dimensions",
        value: String(product.dimensions).trim(),
      });
    }

    return rows;
  })();
  const featureColumns = (() => {
    const items = Array.isArray(product?.features)
      ? product.features
          .map((feature) => String(feature || "").trim())
          .filter(Boolean)
      : [];
    if (!items.length) return [];
    const midpoint = Math.ceil(items.length / 2);
    return [items.slice(0, midpoint), items.slice(midpoint)].filter(
      (column) => column.length,
    );
  })();
  // Loading state
  if (productLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="mt-6 text-gray-600 font-medium">
            Loading product details...
          </p>
        </div>
      </div>
    );
  }

  // Product not found
  if (!product) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-7.536 5.879a1 1 0 001.415 0 3 3 0 014.242 0 1 1 0 001.415-1.415 5 5 0 00-7.072 0 1 1 0 000 1.415z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Product Not Found
          </h2>
          <p className="text-gray-600 mb-8">
            The product you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate("/shop")}
            className="px-8 py-3.5 bg-black text-white rounded-lg hover:bg-gray-900 font-medium transition-all duration-300 transform hover:-translate-y-0.5"
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-white"
      onClickCapture={handleScrollToTopCapture}
    >
      {/* Image Modal */}
      <AnimatePresence>
        {showImageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-skip-scroll-top
            className="fixed inset-0 app-layer-modal bg-black bg-opacity-95 flex items-center justify-center p-4"
            onClick={() => setShowImageModal(false)}
          >
            <div
              className="relative max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute -top-14 right-0 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                Close
              </button>

              <div className="relative">
                {currentModalMediaItem?.type === "video" ? (
                  <video
                    src={currentModalMediaItem.src}
                    className="w-full max-h-[80vh] rounded-lg bg-black object-contain"
                    controls
                    controlsList="nodownload"
                    preload="metadata"
                  />
                ) : currentModalMediaItem?.type === "youtube" ? (
                  <div className="aspect-video overflow-hidden rounded-lg bg-black">
                    <iframe
                      src={currentModalMediaItem.src}
                      title={currentModalMediaItem.alt}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <ProductImage
                    src={currentModalMediaItem?.src}
                    alt={currentModalMediaItem?.alt || product.title}
                    className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
                  />
                )}

                {productMediaItems.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition-all"
                    >
                      <FaChevronLeft />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-70 transition-all"
                    >
                      <FaChevronRight />
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="site-shell py-6 sm:py-8 lg:py-10">
        <div
          ref={productTopRef}
          id="product-top"
          className="scroll-mt-storefront"
        />

        <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
          {/* Product images */}
          <div className="storefront-sticky-offset lg:sticky lg:self-start">
            <div className="flex flex-col-reverse gap-4 md:flex-row md:items-start md:gap-6">
              {productMediaItems.length > 1 ? (
                <div className="mx-auto flex items-center justify-center gap-3 md:mx-0 md:flex-col">
                  {hasThumbnailPagination ? (
                    <button
                      type="button"
                      data-no-scroll-top
                      onClick={showPreviousThumbnailPage}
                      disabled={!canShowPreviousThumbnailPage}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm transition hover:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Previous thumbnails"
                    >
                      <FaChevronLeft className="h-4 w-4 md:-rotate-90" />
                    </button>
                  ) : null}

                  <div className="w-full max-w-73flow-hidden md:w-16 md:max-w-16w-[4.5rem] lg:max-w-18">
                    <div className="grid grid-cols-4 gap-3 md:grid-cols-1">
                      {visibleThumbnailItems.map(({ mediaItem, index }) => (
                        <button
                          key={mediaItem.key}
                          type="button"
                          data-no-scroll-top
                          onClick={() => setSelectedImage(index)}
                          className={`aspect-square w-16 shrink-0 overflow-hidden rounded-2xl border bg-white p-2 transition-all hover:scale-95 active:scale-90 lg:w-18 ${
                            selectedImage === index
                              ? "border-2 border-black shadow-[0_10px_22px_rgba(0,0,0,0.08)]"
                              : "border-black/10 hover:border-black/70"
                          }`}
                        >
                          {mediaItem.type === "youtube" ? (
                            <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
                              <img
                                src={mediaItem.thumbnailSrc}
                                alt={mediaItem.alt}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/92 shadow-lg ring-1 ring-black/5">
                                  <FaYoutube className="h-4 w-4 text-red-600" />
                                </span>
                              </div>
                            </div>
                          ) : mediaItem.type === "video" ? (
                            <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
                              <video
                                src={mediaItem.src}
                                className="h-full w-full object-cover"
                                muted
                                preload="metadata"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                                <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-black">
                                  Video
                                </span>
                              </div>
                            </div>
                          ) : (
                            <ProductImage
                              src={mediaItem.src}
                              alt={mediaItem.alt}
                              className="h-full w-full object-contain mix-blend-multiply"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {hasThumbnailPagination ? (
                    <button
                      type="button"
                      data-no-scroll-top
                      onClick={showNextThumbnailPage}
                      disabled={!canShowNextThumbnailPage}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-black shadow-sm transition hover:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Next thumbnails"
                    >
                      <FaChevronRight className="h-4 w-4 md:rotate-90" />
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="relative flex-1 overflow-hidden rounded-4xl pt-0 px-2 pb-2 sm:rounded-[2.25rem] sm:px-4 sm:pb-4 lg:px-6 lg:pb-6">
                <button
                  type="button"
                  data-no-scroll-top
                  onClick={() => {
                    setCurrentImageIndex(selectedImage);
                    setShowImageModal(true);
                  }}
                  className="group relative z-10 block aspect-square w-full cursor-zoom-in p-0 m-0"
                  aria-label="Open product media"
                >
                  <div className="flex h-full items-center justify-center p-0 m-0">
                    {currentMediaItem?.type === "video" ? (
                      <video
                        src={currentMediaItem.src}
                        className="h-full max-h-112 w-full rounded-3xl bg-black object-contain"
                        controls
                        controlsList="nodownload"
                        preload="metadata"
                      />
                    ) : currentMediaItem?.type === "youtube" ? (
                      <div className="aspect-video w-full overflow-hidden rounded-3xl bg-black">
                        <iframe
                          src={currentMediaItem.src}
                          title={currentMediaItem.alt}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <ProductImage
                        src={currentMediaItem?.src}
                        alt={currentMediaItem?.alt || product.title}
                        isCurrent
                        className="h-full max-h-112 w-full object-contain mix-blend-multiply transition-transform duration-700"
                      />
                    )}
                  </div>
                </button>

                {productMediaItems.length > 1 ? (
                  <>
                    <button
                      type="button"
                      data-no-scroll-top
                      onClick={(event) => {
                        event.stopPropagation();
                        prevSelectedImage();
                      }}
                      className="absolute left-4 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-black shadow-sm transition-all hover:scale-95 active:scale-90 sm:left-6 sm:h-11 sm:w-11"
                      aria-label="Previous image"
                    >
                      <FaChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      data-no-scroll-top
                      onClick={(event) => {
                        event.stopPropagation();
                        nextSelectedImage();
                      }}
                      className="absolute right-4 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-black shadow-sm transition-all hover:scale-95 active:scale-90 sm:right-6 sm:h-11 sm:w-11"
                      aria-label="Next image"
                    >
                      <FaChevronRight className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Product summary */}
          <div className=" p-5 text-left sm:p-6 lg:p-4">
            <div className="mb-5">
              <button
                type="button"
                data-no-scroll-top
                onClick={handleBackNavigation}
                className="group inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500 transition hover:-translate-x-1 hover:text-black"
              >
                <FiArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                <span>Back</span>
              </button>
            </div>
            <nav
              aria-label="Breadcrumb"
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400"
            >
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <li>
                  <button
                    type="button"
                    data-no-scroll-top
                    onClick={() => navigate("/")}
                    className="hover:text-black transition-colors"
                  >
                    Home
                  </button>
                </li>
                <li aria-hidden="true" className="text-gray-300">
                  /
                </li>
                <li>
                  <button
                    type="button"
                    data-no-scroll-top
                    onClick={() => navigate("/shop")}
                    className="hover:text-black transition-colors"
                  >
                    Shop
                  </button>
                </li>
                {product.category ? (
                  <>
                    <li aria-hidden="true" className="text-gray-300">
                      /
                    </li>
                    <li>
                      {typeof product.category === "object" &&
                      product.category?._id ? (
                        <button
                          type="button"
                          data-no-scroll-top
                          onClick={() =>
                            navigate(`/shop?category=${product.category._id}`)
                          }
                          className="hover:text-black transition-colors"
                        >
                          {product.category?.name || "Category"}
                        </button>
                      ) : (
                        <span className="text-gray-600">
                          {typeof product.category === "object"
                            ? product.category?.name || "Category"
                            : product.category}
                        </span>
                      )}
                    </li>
                  </>
                ) : null}
              </ol>
            </nav>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {categoryLabel ? (
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-black">
                  {categoryLabel}
                </span>
              ) : null}
              {!isTbaPrice &&
              discountPercentForDisplay &&
              discountPercentForDisplay > 0 ? (
                <span className="app-btn-primary inline-flex items-center rounded-full px-3! py-1! text-[10px]! font-bold uppercase tracking-widest">
                  Save {discountPercentForDisplay}%
                </span>
              ) : null}
              {availabilityBadge ? (
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${availabilityBadge.className}`}
                >
                  {availabilityBadge.label}
                </span>
              ) : null}
            </div>

            <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-black sm:text-5xl">
              {product.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-400">
              {brandLabel ? (
                <span>
                  Brand:{" "}
                  <span className="font-bold text-black">{brandLabel}</span>
                </span>
              ) : null}
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-black/10 bg-white p-6 shadow-[0_12px_30px_rgba(0,0,0,0.04)] sm:p-8">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                <p className="text-4xl font-bold tracking-tight text-black">
                  {isTbaPrice ? (
                    <span className="text-gray-700">TBA</span>
                  ) : showVariationPriceRange ? (
                    <>
                      <span>{variationPriceBounds.min.toFixed(2)}</span>
                      <span className="mx-1 text-gray-400">-</span>
                      <span>{variationPriceBounds.max.toFixed(2)}</span>
                      <span className="ml-1 text-base font-semibold text-gray-700 sm:text-lg">
                        Tk
                      </span>
                    </>
                  ) : (
                    <>
                      <span>{currentPrice.toFixed(2)}</span>
                      <span className="ml-1 text-base font-semibold text-gray-700 sm:text-lg">
                        Tk
                      </span>
                    </>
                  )}
                </p>

                {!isTbaPrice && !showVariationPriceRange && hasDiscountPrice ? (
                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                    Offer price
                  </span>
                ) : null}
              </div>

              {!isTbaPrice && !showVariationPriceRange && hasDiscountPrice ? (
                <p className="mt-2 text-sm text-zinc-400 line-through">
                  {regularPriceForDisplay.toFixed(2)} Tk
                </p>
              ) : null}

              {isRecurringProduct && recurringLabel ? (
                <p className="mt-3 text-sm text-zinc-500">{recurringLabel}</p>
              ) : null}
            </div>

            {summaryHighlights.length > 0 ? (
              <div className="mt-6 grid grid-cols-1 overflow-hidden rounded-[1.6rem] border border-black/10 bg-black/10 shadow-sm sm:grid-cols-2">
                {summaryHighlights.map((item) => (
                  <div
                    key={`${item.label}-${item.value}`}
                    className="border-b border-black/10 bg-white p-5 last:border-b-0 sm:border-b-0 sm:odd:border-r sm:odd:border-black/10"
                  >
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.24em] text-zinc-400">
                      {item.label}
                    </p>
                    <p className="text-sm font-bold text-black">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-10 border-t border-black/8 pt-8">
              {isTbaPrice ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  Price is TBA for this product. Checkout is disabled until
                  price is updated.
                </div>
              ) : marketplaceType === "grouped" ? (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  This is a grouped product. Select an item from the grouped
                  products list.
                </div>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleAddToCart();
                  }}
                >
                  {marketplaceType === "variable" &&
                  Array.isArray(product.variations) &&
                  product.variations.length > 0 ? (
                    <div>
                      <div className="flex items-end justify-between gap-3">
                        <label
                          htmlFor="product-variation"
                          className="text-[10px] font-bold uppercase tracking-[0.2em] text-black"
                        >
                          Select Size
                        </label>
                        <button
                          type="button"
                          data-no-scroll-top
                          onClick={() => setSelectedVariationId("")}
                          className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 transition hover:text-black"
                        >
                          Clear
                        </button>
                      </div>
                      <SearchableSelect
                        value={selectedVariationId}
                        onChange={(value) => {
                          setSelectedVariationId(value);
                          setQuantity(1);
                        }}
                        options={[
                          { value: "", label: "Select size" },
                          ...product.variations
                            .filter(
                              (variation) => variation?.isActive !== false,
                            )
                            .map((variation) => ({
                              value: String(variation?._id || ""),
                              label: variation.label,
                            })),
                        ]}
                        placeholder="Select size"
                        searchable={false}
                        className="min-w-0"
                        buttonClassName="mt-1.5 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black"
                        menuClassName="rounded-2xl"
                      />
                    </div>
                  ) : null}

                  {productVariantDefinitions.length > 0 ? (
                    <div className="space-y-4">
                      {productVariantDefinitions.map(
                        (definition, definitionIndex) => {
                          const selectedOption =
                            selectedVariantOptions[definitionIndex];
                          const isColorDefinition =
                            definition.preset === "color" ||
                            definition.name.toLowerCase() === "color";

                          return (
                            <div key={`variant-definition-${definitionIndex}`}>
                              <div className="flex items-end justify-between gap-3">
                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">
                                  {definition.name || "Variant"}
                                </label>
                                <button
                                  type="button"
                                  data-no-scroll-top
                                  onClick={() => {
                                    setSelectedVariantOptions((prev) => {
                                      const next = { ...prev };
                                      delete next[definitionIndex];
                                      return next;
                                    });
                                    if (isColorDefinition) {
                                      setSelectedColor("");
                                    }
                                  }}
                                  className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400 transition hover:text-black"
                                >
                                  Clear
                                </button>
                              </div>

                              {isColorDefinition ? (
                                <div
                                  className="mt-2 flex flex-wrap gap-3"
                                  role="radiogroup"
                                >
                                  {definition.options.map(
                                    (option, optionIndex) => {
                                      const optionColor = String(
                                        option?.colorHex || option?.value || "",
                                      )
                                        .trim()
                                        .toLowerCase();
                                      const isSelected =
                                        String(
                                          selectedOption?.colorHex ||
                                            selectedOption?.value ||
                                            "",
                                        )
                                          .trim()
                                          .toLowerCase() === optionColor;

                                      return (
                                        <button
                                          key={`variant-color-${definitionIndex}-${optionIndex}`}
                                          type="button"
                                          data-no-scroll-top
                                          onClick={() => {
                                            setSelectedVariantOptions(
                                              (prev) => {
                                                const currentValue = String(
                                                  prev?.[definitionIndex]
                                                    ?.colorHex ||
                                                    prev?.[definitionIndex]
                                                      ?.value ||
                                                    "",
                                                )
                                                  .trim()
                                                  .toLowerCase();

                                                if (
                                                  currentValue === optionColor
                                                ) {
                                                  const next = { ...prev };
                                                  delete next[definitionIndex];
                                                  return next;
                                                }

                                                return {
                                                  ...prev,
                                                  [definitionIndex]: option,
                                                };
                                              },
                                            );
                                            setSelectedColor((prev) =>
                                              String(prev || "")
                                                .trim()
                                                .toLowerCase() === optionColor
                                                ? ""
                                                : optionColor,
                                            );
                                          }}
                                          className={`group shrink-0 rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-black/40 ${
                                            isSelected
                                              ? "ring-2 ring-black ring-offset-2"
                                              : "hover:scale-110"
                                          }`}
                                          title={
                                            getReadableVariantOptionLabel({
                                              preset: "color",
                                              label: option?.label,
                                              value: option?.value,
                                              colorHex: option?.colorHex,
                                            }) || `Color ${optionIndex + 1}`
                                          }
                                        >
                                          <div className="relative h-10 w-10 rounded-full border border-black/10 sm:h-11 sm:w-11">
                                            <div
                                              className="absolute inset-0.5 rounded-full"
                                              style={{
                                                backgroundColor: optionColor,
                                              }}
                                            />
                                          </div>
                                        </button>
                                      );
                                    },
                                  )}
                                </div>
                              ) : (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {definition.options.map(
                                    (option, optionIndex) => {
                                      const optionValue = String(
                                        option?.label || option?.value || "",
                                      ).trim();
                                      const isSelected =
                                        String(
                                          selectedOption?.label ||
                                            selectedOption?.value ||
                                            "",
                                        ).trim() === optionValue;

                                      return (
                                        <button
                                          key={`variant-option-${definitionIndex}-${optionIndex}`}
                                          type="button"
                                          data-no-scroll-top
                                          onClick={() =>
                                            setSelectedVariantOptions(
                                              (prev) => {
                                                const currentValue = String(
                                                  prev?.[definitionIndex]
                                                    ?.label ||
                                                    prev?.[definitionIndex]
                                                      ?.value ||
                                                    "",
                                                ).trim();

                                                if (
                                                  currentValue === optionValue
                                                ) {
                                                  const next = { ...prev };
                                                  delete next[definitionIndex];
                                                  return next;
                                                }

                                                return {
                                                  ...prev,
                                                  [definitionIndex]: option,
                                                };
                                              },
                                            )
                                          }
                                          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                                            isSelected
                                              ? "app-btn-primary"
                                              : "border-black/10 bg-white text-black hover:border-black"
                                          }`}
                                        >
                                          {optionValue}
                                        </button>
                                      );
                                    },
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  ) : null}

                  {legacyColorOptions && legacyColorOptions.length > 0 ? (
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">
                        Select Color
                      </div>
                      <div
                        className="mt-2 flex flex-wrap gap-3"
                        role="radiogroup"
                        aria-label="Color"
                      >
                        {legacyColorOptions.map((color, index) => {
                          const isSelected = selectedColor === color;
                          const label = String(color || "").trim();
                          const displayLabel = getReadableColorLabel(
                            label,
                            `Color ${index + 1}`,
                          );

                          return (
                            <button
                              key={`${color}-${index}`}
                              type="button"
                              data-no-scroll-top
                              onClick={() =>
                                setSelectedColor((prev) =>
                                  String(prev || "")
                                    .trim()
                                    .toLowerCase() ===
                                  String(color || "")
                                    .trim()
                                    .toLowerCase()
                                    ? ""
                                    : color,
                                )
                              }
                              role="radio"
                              aria-checked={isSelected}
                              aria-label={displayLabel}
                              title={displayLabel}
                              className={`group shrink-0 rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-black/40 ${
                                isSelected
                                  ? "ring-2 ring-black ring-offset-2"
                                  : "hover:scale-110"
                              }`}
                            >
                              <div className="relative">
                                <div className="relative h-10 w-10 rounded-full border border-black/10 transition-all duration-200 sm:h-11 sm:w-11">
                                  <div
                                    className="absolute inset-0.5 rounded-full"
                                    style={{ backgroundColor: color }}
                                    aria-hidden="true"
                                  >
                                    <div className="absolute left-0.5 top-0.5 h-2 w-2 rounded-full bg-white/30 blur-sm sm:h-3 sm:w-3" />
                                  </div>

                                  {isSelected ? (
                                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black shadow-sm sm:h-6 sm:w-6">
                                      <svg
                                        className="h-2.5 w-2.5 text-white sm:h-3 sm:w-3"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth="3"
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    <div className="rounded-3xl border border-black/10 bg-zinc-50 p-5 sm:p-6">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">
                          Quantity
                        </p>
                        {quantityStatusText ? (
                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${quantityStatusToneClass}`}
                          >
                            {quantityStatusText}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center rounded-lg! border border-black/10 bg-white shadow-sm w-fit overflow-hidden">
                        <button
                          type="button"
                          data-no-scroll-top
                          onClick={decreaseQuantity}
                          className="p-4 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-black"
                          aria-label="Decrease quantity"
                        >
                          <FaMinus className="h-4 w-4" />
                        </button>
                        <label className="sr-only" htmlFor="quantity-input">
                          {product.title} quantity
                        </label>
                        <input
                          id="quantity-input"
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(event) => {
                            const parsed = Math.max(
                              1,
                              Number(event.target.value || 1),
                            );
                            if (product?.allowBackorder) {
                              setQuantity(parsed);
                              return;
                            }
                            if (!currentStock) {
                              setQuantity(1);
                              return;
                            }
                            setQuantity(Math.min(parsed, currentStock));
                          }}
                          className="h-14 w-18 border-0 bg-transparent text-center text-xl font-bold text-black outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          inputMode="numeric"
                          autoComplete="off"
                        />
                        <button
                          type="button"
                          data-no-scroll-top
                          onClick={increaseQuantity}
                          disabled={
                            !product.allowBackorder && quantity >= currentStock
                          }
                          className="bg-black text-white m-1 inline-flex h-12! w-12! items-center justify-center rounded-lg! transition disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="Increase quantity"
                        >
                          <FaPlus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <button
                        type="submit"
                        disabled={purchaseActionDisabled}
                        className="app-btn-primary inline-flex items-center justify-center gap-3 rounded-xl px-6 py-5 text-sm font-bold uppercase tracking-[0.18em] transition-all disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FaShoppingCart className="h-4 w-4" />
                        {loading || cartLoading ? "Adding..." : "Add to Cart"}
                      </button>

                      <button
                        type="button"
                        data-no-scroll-top
                        onClick={handleBuyNow}
                        disabled={purchaseActionDisabled}
                        className="rounded-xl border-2 border-black bg-white px-6 py-5 text-sm font-bold uppercase tracking-[0.18em] text-black transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  data-no-scroll-top
                  onClick={handleToggleCompare}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-black/10 px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.18em] text-black transition-all hover:border-black"
                >
                  <FiShuffle className="h-4 w-4" />
                  {isCompared ? "Remove Compare" : "Compare"}
                </button>
                <button
                  type="button"
                  data-no-scroll-top
                  onClick={handleToggleWishlist}
                  disabled={wishlistLoading}
                  className={`sm:flex-[1.4] flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.18em] transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                    isWishlisted
                      ? "border-red-500 bg-red-50 text-red-600"
                      : "border-black bg-white text-black"
                  }`}
                  style={
                    !isWishlisted
                      ? {
                          borderColor: "rgba(0, 0, 0, 0.1)",
                        }
                      : undefined
                  }
                  onMouseEnter={(e) => {
                    if (!isWishlisted) {
                      e.currentTarget.style.backgroundColor =
                        "var(--brand-theme-color)";
                      e.currentTarget.style.color =
                        "var(--brand-button-text-color)";
                      e.currentTarget.style.borderColor =
                        "var(--brand-theme-color)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isWishlisted) {
                      e.currentTarget.style.backgroundColor = "white";
                      e.currentTarget.style.color = "black";
                      e.currentTarget.style.borderColor = "rgba(0, 0, 0, 0.1)";
                    }
                  }}
                >
                  {isWishlisted ? (
                    <FaHeart className="h-4 w-4 fill-current" />
                  ) : (
                    <FiHeart className="h-4 w-4" />
                  )}
                  {isWishlisted ? "Wishlisted" : "Add to Wishlist"}
                </button>
                <button
                  type="button"
                  data-no-scroll-top
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-black/10 px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.18em] text-black transition-all hover:border-black"
                >
                  <FiShare2 className="h-4 w-4" />
                  Share
                </button>
              </div>

              <div className="mt-10 rounded-[1.6rem] border border-black/10 bg-white p-5 shadow-sm sm:p-6">
                <div className="space-y-4 text-[11px] font-bold">
                  {product.sku ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="uppercase tracking-[0.15em] text-zinc-400">
                        SKU:
                      </span>
                      <span className="text-right text-black">
                        {product.sku}
                      </span>
                    </div>
                  ) : null}
                  {product.category ? (
                    <div className="flex items-start justify-between gap-4">
                      <span className="uppercase tracking-[0.15em] text-zinc-400">
                        Category:
                      </span>
                      <span className="text-right text-black">
                        {typeof product.category === "object"
                          ? product.category?.name || "Category"
                          : product.category}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-black/8 pt-4 text-sm text-gray-700">
                  <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                    Social:
                  </span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      data-no-scroll-top
                      onClick={() => handleSharePlatform("facebook")}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:text-white hover:scale-110"
                      style={{
                        borderColor: "rgba(0, 0, 0, 0.1)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "var(--brand-theme-color)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                      aria-label="Share on Facebook"
                    >
                      <FaFacebookF className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      data-no-scroll-top
                      onClick={() => handleSharePlatform("twitter")}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:text-white hover:scale-110"
                      style={{
                        borderColor: "rgba(0, 0, 0, 0.1)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "var(--brand-theme-color)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                      aria-label="Share on X"
                    >
                      <FaTwitter className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      data-no-scroll-top
                      onClick={() => handleSharePlatform("whatsapp")}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:text-white hover:scale-110"
                      style={{
                        borderColor: "rgba(0, 0, 0, 0.1)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "var(--brand-theme-color)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                      aria-label="Share on WhatsApp"
                    >
                      <FaWhatsapp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      data-no-scroll-top
                      onClick={() => handleSharePlatform("telegram")}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:text-white hover:scale-110"
                      style={{
                        borderColor: "rgba(0, 0, 0, 0.1)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "var(--brand-theme-color)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                      aria-label="Share on Telegram"
                    >
                      <FaPaperPlane className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      data-no-scroll-top
                      onClick={handleCopyShareLink}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all hover:text-white hover:scale-110"
                      style={{
                        borderColor: "rgba(0, 0, 0, 0.1)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "var(--brand-theme-color)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                      aria-label="Copy share link"
                    >
                      <FaLink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div className="pt-16 sm:pt-20">
          <div className="overflow-hidden bg-white">
            <div className="border-b border-black/10">
              <div
                role="tablist"
                aria-label="Product details tabs"
                className="flex flex-wrap gap-x-8 gap-y-3 px-0"
              >
                <button
                  type="button"
                  data-no-scroll-top
                  id="product-tab-description"
                  role="tab"
                  aria-selected={activeTab === "description"}
                  aria-controls="product-tabpanel-description"
                  tabIndex={activeTab === "description" ? 0 : -1}
                  onClick={() => setActiveTab("description")}
                  className={`-mb-px border-b-2 pb-5 text-xs font-bold uppercase tracking-[0.26em] transition sm:pb-6 ${
                    activeTab === "description"
                      ? "border-black text-black"
                      : "border-transparent text-zinc-400 hover:text-black"
                  }`}
                >
                  Description
                </button>
                <button
                  type="button"
                  data-no-scroll-top
                  id="product-tab-additional"
                  role="tab"
                  aria-selected={activeTab === "additional"}
                  aria-controls="product-tabpanel-additional"
                  tabIndex={activeTab === "additional" ? 0 : -1}
                  onClick={() => setActiveTab("additional")}
                  className={`-mb-px border-b-2 pb-5 text-xs font-bold uppercase tracking-[0.26em] transition sm:pb-6 ${
                    activeTab === "additional"
                      ? "border-black text-black"
                      : "border-transparent text-zinc-400 hover:text-black"
                  }`}
                >
                  Additional information
                </button>
                <button
                  type="button"
                  data-no-scroll-top
                  id="product-tab-reviews"
                  role="tab"
                  aria-selected={activeTab === "reviews"}
                  aria-controls="product-tabpanel-reviews"
                  tabIndex={activeTab === "reviews" ? 0 : -1}
                  onClick={() => setActiveTab("reviews")}
                  className={`-mb-px border-b-2 pb-5 text-xs font-bold uppercase tracking-[0.26em] transition sm:pb-6 ${
                    activeTab === "reviews"
                      ? "border-black text-black"
                      : "border-transparent text-zinc-400 hover:text-black"
                  }`}
                >
                  Reviews ({Number(reviewSummary.ratingCount || 0)})
                </button>
              </div>
            </div>

            <div className="pt-12">
              {activeTab === "description" ? (
                <div
                  id="product-tabpanel-description"
                  role="tabpanel"
                  aria-labelledby="product-tab-description"
                  className="space-y-14"
                >
                  {product.description ? (
                    hasHtmlContent(product.description) ? (
                      <div
                        className="prose max-w-3xl wrap-break-word text-zinc-500 *:wrap-break-word"
                        dangerouslySetInnerHTML={{
                          __html: product.description,
                        }}
                      />
                    ) : (
                      <div className="max-w-3xl whitespace-pre-line text-base leading-8 text-zinc-500">
                        {product.description}
                      </div>
                    )
                  ) : (
                    <div className="max-w-3xl whitespace-pre-line text-base leading-8 text-zinc-500">
                      No description available.
                    </div>
                  )}

                  {featureColumns.length > 0 ? (
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
                      {featureColumns.map((column, columnIndex) => (
                        <div key={`feature-column-${columnIndex}`}>
                          <h3 className="mb-8 text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-400">
                            {columnIndex === 0
                              ? "Core Technologies"
                              : "Product Highlights"}
                          </h3>
                          <div className="space-y-4">
                            {column.map((feature) => (
                              <div
                                key={`${columnIndex}-${feature}`}
                                className="group flex items-center gap-4 rounded-xl border border-black/8 bg-zinc-50 p-5 transition-colors hover:border-black"
                              >
                                <div className="h-2 w-2 rounded-full bg-black transition-transform group-hover:scale-125" />
                                <span className="text-xs font-bold uppercase tracking-widest text-black">
                                  {feature}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {marketplaceType === "grouped" &&
                  Array.isArray(product.groupedProducts) &&
                  product.groupedProducts.length > 0 ? (
                    <div>
                      <h3 className="mb-6 text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-400">
                        Grouped Products
                      </h3>
                      <div className="space-y-4">
                        {product.groupedProducts.map((groupedProduct) => {
                          const groupedPriceType = String(
                            groupedProduct?.priceType || "single",
                          );
                          const groupedPrice =
                            Number(groupedProduct?.salePrice) > 0
                              ? Number(groupedProduct.salePrice)
                              : Number(groupedProduct?.price || 0);

                          return (
                            <div
                              key={groupedProduct._id}
                              className="flex items-center gap-4 rounded-3xl border border-black/10 bg-white p-4 shadow-sm"
                            >
                              <ProductImage
                                src={groupedProduct?.images?.[0]}
                                alt={groupedProduct?.title}
                                className="h-20 w-20 rounded-2xl bg-zinc-50 object-contain p-3 mix-blend-multiply"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-black">
                                  {groupedProduct?.title}
                                </p>
                                <p className="mt-1 text-sm text-zinc-500">
                                  {groupedPriceType === "tba"
                                    ? "TBA"
                                    : Number.isFinite(groupedPrice)
                                      ? `${groupedPrice.toFixed(2)} Tk`
                                      : "Price not available"}
                                </p>
                              </div>
                              <button
                                type="button"
                                data-no-scroll-top
                                onClick={() =>
                                  navigate(`/product/${groupedProduct._id}`)
                                }
                                className="rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white transition"
                                style={{
                                  backgroundColor: "var(--brand-theme-color)",
                                }}
                              >
                                View
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {activeTab === "additional" ? (
                <div
                  id="product-tabpanel-additional"
                  role="tabpanel"
                  aria-labelledby="product-tab-additional"
                >
                  {additionalInfoRows.length > 0 ? (
                    <div className="overflow-hidden rounded-[1.8rem] border border-black/10 bg-white shadow-sm">
                      <div className="scrollbar-none overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <tbody className="divide-y divide-black/8">
                            {additionalInfoRows.map((row) => (
                              <tr
                                key={`${row.label}-${row.value}`}
                                className="align-top"
                              >
                                <th
                                  scope="row"
                                  className="w-56 bg-zinc-50 px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400"
                                >
                                  {row.label}
                                </th>
                                <td className="px-5 py-4 whitespace-pre-line text-zinc-600">
                                  {row.value}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">
                      No additional information available.
                    </p>
                  )}
                </div>
              ) : null}

              {activeTab === "reviews" ? (
                <div
                  id="product-tabpanel-reviews"
                  role="tabpanel"
                  aria-labelledby="product-tab-reviews"
                >
                  <section
                    id="reviews"
                    data-review-section
                    className="scrollbar-none scroll-mt-storefront overflow-hidden"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <ProductReviewsPanel
                        isLoggedIn={isLoggedIn}
                        myReview={myReview}
                        productTitle={product?.title || "Product"}
                        reviewSummary={reviewSummary}
                        reviews={reviews}
                        reviewsLoading={reviewsLoading}
                        reviewForm={reviewForm}
                        hoverRating={hoverRating}
                        reviewSubmitting={reviewSubmitting}
                        reviewDeleting={reviewDeleting}
                        user={user}
                        onLoginNavigate={() => navigate("/login")}
                        onFieldChange={(field, value) =>
                          setReviewForm((prev) => ({
                            ...prev,
                            [field]: value,
                          }))
                        }
                        onHoverRatingChange={setHoverRating}
                        onRatingChange={(rating) =>
                          setReviewForm((prev) => ({ ...prev, rating }))
                        }
                        onSubmitReview={handleSubmitReview}
                        onDeleteReview={handleDeleteReview}
                        onEditReview={(review) => {
                          setMyReview(review);
                          setReviewForm({
                            rating: Number(review.rating || 0),
                            title: review.title || "",
                            comment: review.comment || "",
                            reviewerName:
                              review.reviewerName || user?.name || "",
                            reviewerEmail:
                              review.reviewerEmail || user?.email || "",
                          });
                          if (typeof document !== "undefined") {
                            document
                              .getElementById("review-form")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                          }
                        }}
                      />
                      {false ? (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                            <h2 className="text-2xl font-bold text-gray-900">
                              Product Reviews
                            </h2>
                            <div className="text-sm text-gray-600">
                              {Number(reviewSummary.ratingAverage || 0).toFixed(
                                1,
                              )}{" "}
                              / 5 ({Number(reviewSummary.ratingCount || 0)}{" "}
                              reviews)
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white border border-gray-200 rounded-xl p-5">
                              {reviewsLoading ? (
                                <p className="text-gray-600">
                                  Loading reviews...
                                </p>
                              ) : reviews.length === 0 ? (
                                <p className="text-gray-600">
                                  No reviews yet. Be the first to review.
                                </p>
                              ) : (
                                <div className="space-y-4 max-h-130 overflow-auto pr-1">
                                  {reviews.map((review) => (
                                    <div
                                      key={review._id}
                                      className="border border-gray-200 rounded-2xl p-4 bg-linear-to-br from-white via-gray-50 to-white shadow-sm"
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="space-y-1">
                                          <p className="font-semibold text-gray-900 flex items-center gap-2">
                                            {review.user?.name ||
                                              review.reviewerName ||
                                              "Customer"}
                                            {review.verifiedPurchase ? (
                                              <span className="text-[10px] px-2 py-1 rounded-full bg-green-100 text-green-700">
                                                Verified
                                              </span>
                                            ) : null}
                                          </p>
                                          <div className="flex items-center gap-1">
                                            {renderStars(review.rating || 0)}
                                            <span className="text-xs text-gray-500">
                                              {new Date(
                                                review.createdAt,
                                              ).toLocaleDateString()}
                                            </span>
                                          </div>
                                        </div>
                                        {user &&
                                          String(
                                            review.user?._id ||
                                              review.user ||
                                              review.userId ||
                                              "",
                                          ) ===
                                            String(
                                              user._id || user.id || "",
                                            ) && (
                                            <div className="flex gap-2">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setMyReview(review);
                                                  setReviewForm({
                                                    rating: Number(
                                                      review.rating || 5,
                                                    ),
                                                    title: review.title || "",
                                                    comment:
                                                      review.comment || "",
                                                    reviewerName:
                                                      review.reviewerName ||
                                                      user?.name ||
                                                      "",
                                                    reviewerEmail:
                                                      review.reviewerEmail ||
                                                      user?.email ||
                                                      "",
                                                  });
                                                  if (
                                                    typeof document !==
                                                    "undefined"
                                                  ) {
                                                    document
                                                      .getElementById(
                                                        "review-form",
                                                      )
                                                      ?.scrollIntoView({
                                                        behavior: "smooth",
                                                        block: "start",
                                                      });
                                                  }
                                                }}
                                                className="text-xs px-3 py-1 rounded-full border border-gray-200 hover:border-gray-400"
                                              >
                                                Edit
                                              </button>
                                              <button
                                                type="button"
                                                onClick={handleDeleteReview}
                                                className="text-xs px-3 py-1 rounded-full border border-red-200 text-red-600 hover:border-red-400"
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          )}
                                      </div>
                                      {review.title ? (
                                        <p className="text-sm font-semibold text-gray-900 mt-2">
                                          {review.title}
                                        </p>
                                      ) : null}
                                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap leading-relaxed">
                                        {review.comment}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div
                              id="review-form"
                              className="bg-white border border-gray-200 rounded-xl p-5"
                            >
                              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                {myReview
                                  ? "Update Your Review"
                                  : "Write a Review"}
                              </h3>
                              {myReview ? <></> : null}
                              <form
                                onSubmit={handleSubmitReview}
                                className="space-y-3"
                              >
                                {!isLoggedIn ? (
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Name
                                      </label>
                                      <input
                                        type="text"
                                        value={reviewForm.reviewerName}
                                        onChange={(event) =>
                                          setReviewForm((prev) => ({
                                            ...prev,
                                            reviewerName: event.target.value,
                                          }))
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="Your name"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email
                                      </label>
                                      <input
                                        type="email"
                                        value={reviewForm.reviewerEmail}
                                        onChange={(event) =>
                                          setReviewForm((prev) => ({
                                            ...prev,
                                            reviewerEmail: event.target.value,
                                          }))
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="you@example.com"
                                      />
                                    </div>
                                  </div>
                                ) : null}

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Rating
                                  </label>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => {
                                      const active =
                                        (hoverRating || reviewForm.rating) >=
                                        star;
                                      return (
                                        <button
                                          key={star}
                                          type="button"
                                          onMouseEnter={() =>
                                            setHoverRating(star)
                                          }
                                          onMouseLeave={() =>
                                            setHoverRating(null)
                                          }
                                          onClick={() =>
                                            setReviewForm((prev) => ({
                                              ...prev,
                                              rating: star,
                                            }))
                                          }
                                          className="p-1"
                                          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
                                        >
                                          <svg
                                            className="w-7 h-7"
                                            fill={
                                              active ? "currentColor" : "none"
                                            }
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            viewBox="0 0 24 24"
                                            style={{
                                              color: active
                                                ? "var(--brand-theme-color)"
                                                : "#d1d5db",
                                            }}
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              d="M11.48 3.499a.75.75 0 011.04 0l2.12 2.063a.75.75 0 00.564.218l2.94-.226a.75.75 0 01.792.98l-.966 2.82a.75.75 0 00.186.766l2.118 2.063a.75.75 0 01-.428 1.287l-2.937.328a.75.75 0 00-.6.43l-1.14 2.63a.75.75 0 01-1.38 0l-1.14-2.63a.75.75 0 00-.6-.43l-2.938-.328a.75.75 0 01-.427-1.287l2.118-2.063a.75.75 0 00.186-.766l-.966-2.82a.75.75 0 01.792-.98l2.94.226a.75.75 0 00.564-.218L11.48 3.5z"
                                            />
                                          </svg>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title (optional)
                                  </label>
                                  <input
                                    type="text"
                                    value={reviewForm.title}
                                    onChange={(event) =>
                                      setReviewForm((prev) => ({
                                        ...prev,
                                        title: event.target.value,
                                      }))
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="Short summary of your experience"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Comment
                                  </label>
                                  <textarea
                                    rows={5}
                                    value={reviewForm.comment}
                                    onChange={(event) =>
                                      setReviewForm((prev) => ({
                                        ...prev,
                                        comment: event.target.value,
                                      }))
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="Share your review"
                                  />
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="submit"
                                    disabled={reviewSubmitting}
                                    className="app-btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
                                  >
                                    {reviewSubmitting
                                      ? myReview
                                        ? "Updating..."
                                        : "Submitting..."
                                      : myReview
                                        ? "Update Review"
                                        : "Submit Review"}
                                  </button>
                                  {myReview ? (
                                    <button
                                      type="button"
                                      onClick={handleDeleteReview}
                                      disabled={reviewDeleting}
                                      className="px-4 py-2 border border-red-200 text-red-700 rounded-lg text-sm font-medium disabled:opacity-60"
                                    >
                                      {reviewDeleting
                                        ? "Deleting..."
                                        : "Delete Review"}
                                    </button>
                                  ) : null}
                                </div>
                              </form>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </motion.div>
                  </section>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {relatedProductsLoading || relatedProducts.length > 0 ? (
          <section className="mx-auto mt-32 w-full max-w-310 pb-6">
            <div className="mb-14 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">
                  Related products
                </h2>
                <div className="mt-3 h-1 w-12 bg-black" />
              </div>
              <button
                type="button"
                data-no-scroll-top
                onClick={() => {
                  const categoryId =
                    product?.category && typeof product.category === "object"
                      ? String(product.category?._id || "").trim()
                      : "";
                  navigate(
                    categoryId ? `/shop?category=${categoryId}` : "/shop",
                  );
                  if (typeof window !== "undefined") window.scrollTo(0, 0);
                }}
                className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 transition-colors hover:text-black"
              >
                View all collection
              </button>
            </div>

            <div className="storefront-card-grid">
              {relatedProductsLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={`related-skeleton-${index}`}
                      className="storefront-card-grid__item animate-pulse"
                    >
                      <div className="storefront-product-card rounded-[22px] border border-zinc-100 bg-white p-3 shadow-sm">
                        <div className="aspect-square rounded-[18px] bg-zinc-100" />
                        <div className="mt-4 space-y-3">
                          <div className="h-3 w-24 rounded bg-zinc-100" />
                          <div className="h-4 w-4/5 rounded bg-zinc-100" />
                          <div className="h-10 w-full rounded bg-zinc-100" />
                        </div>
                      </div>
                    </div>
                  ))
                : relatedProducts.map((entry) => (
                    <div key={entry._id} className="storefront-card-grid__item">
                      <StorefrontProductCard
                        product={entry}
                        className="h-full"
                        onViewDetails={() => handleNavigateToProduct(entry._id)}
                      />
                    </div>
                  ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

export default ProductDetails;
