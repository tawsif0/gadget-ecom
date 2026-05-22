import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  FiEye,
  FiHeart,
  FiShoppingBag,
  FiShuffle,
  FiStar,
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import {
  selectWishlistPendingIds,
  toggleWishlistItem,
} from "../../store/wishlistSlice";
import {
  COMPARE_LIMIT_MESSAGE,
  MAX_COMPARE_ITEMS,
  toggleCompareItem,
} from "../../store/compareSlice";
import { createProductSnapshot } from "../../utils/productSnapshot";
import { useCart } from "../../context/CartContext";
import {
  getDefaultSelectedVariants,
  getProductPricingForSelectedVariants,
  getSelectedVariantSignature,
  hasVariantOptionPricing,
  normalizeProductVariantDefinitions,
  normalizeSelectedVariantsPayload,
} from "../../utils/productVariants";

const baseUrl = import.meta.env.VITE_API_URL;

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

const FallbackImage = ({ className, alt }) => (
  <div
    className={`${className} flex items-center justify-center bg-linear-to-br from-gray-100 to-gray-200`}
  >
    <svg
      className="h-8 w-8 text-gray-300"
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

const ProductImage = ({ src, alt, className }) => {
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
      loading="lazy"
      decoding="async"
      crossOrigin={
        imgSrc?.startsWith("http://") || imgSrc?.startsWith("https://")
          ? "anonymous"
          : undefined
      }
    />
  );
};

const buildDiscountLabel = (pricing) => {
  if (!pricing?.hasDiscount) return "";
  const previous = Number(pricing.previousPrice || 0);
  const current = Number(pricing.currentPrice || 0);
  if (
    !Number.isFinite(previous) ||
    !Number.isFinite(current) ||
    previous <= 0
  ) {
    return "";
  }

  const percent = Math.round(((previous - current) / previous) * 100);
  return percent > 0 ? `-${percent}%` : "";
};

const formatPrice = (value) => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "TBA";
  const isWhole = Math.abs(amount % 1) < 0.001;
  return `Tk${amount.toLocaleString("en-US", {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  })}`;
};

const getCategoryLabel = (product, badgeText = "") => {
  if (typeof product?.category === "object" && product?.category?.name) {
    return String(product.category.name).trim();
  }

  if (
    typeof product?.category === "string" &&
    String(product.category).trim()
  ) {
    return String(product.category).trim();
  }

  if (String(product?.productType || "").trim()) {
    return String(product.productType).trim();
  }

  if (String(badgeText || "").trim()) {
    return String(badgeText).trim();
  }

  return "General";
};

const getSectionBadgeLabel = (categoryLabel, badgeText) => {
  const normalizedBadge = String(badgeText || "").trim();
  if (!normalizedBadge) return "";
  if (normalizedBadge.toLowerCase() === categoryLabel.toLowerCase()) return "";
  return normalizedBadge;
};

const useProductCardState = (product) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isCartItemPresent, toggleCartItem } = useCart();
  const compareItems = useSelector((state) => state.compare.items || []);
  const wishlistItems = useSelector((state) => state.wishlist.items || []);
  const wishlistPendingIds = useSelector(selectWishlistPendingIds);
  const productId = String(product?._id || product?.id || "").trim();
  const variantDefinitions = useMemo(
    () => normalizeProductVariantDefinitions(product),
    [product],
  );
  const [selectedVariants, setSelectedVariants] = useState(() =>
    getDefaultSelectedVariants(product),
  );
  const resolvedSelectedVariants = useMemo(
    () => normalizeSelectedVariantsPayload(selectedVariants),
    [selectedVariants],
  );
  const selectedVariantSignature = useMemo(
    () => getSelectedVariantSignature(resolvedSelectedVariants),
    [resolvedSelectedVariants],
  );
  const pricing = useMemo(
    () =>
      getProductPricingForSelectedVariants(product, resolvedSelectedVariants),
    [product, resolvedSelectedVariants],
  );
  const canQuickAddToCart = useMemo(
    () => !hasVariantOptionPricing(product),
    [product],
  );

  const isCompared = compareItems.some(
    (item) => String(item?._id || item?.id || "") === productId,
  );
  const isWishlisted = wishlistItems.some(
    (item) => String(item?._id || item?.id || "") === productId,
  );
  const wishlistLoading = wishlistPendingIds.includes(productId);
  const isInCart = isCartItemPresent(
    productId,
    "",
    "",
    "",
    selectedVariantSignature,
  );

  useEffect(() => {
    setSelectedVariants((currentSelections) => {
      const currentByName = new Map(
        normalizeSelectedVariantsPayload(currentSelections).map((variant) => [
          String(variant?.name || "").toLowerCase(),
          variant,
        ]),
      );

      return variantDefinitions
        .map((definition) => {
          const existing = currentByName.get(definition.name.toLowerCase());
          const matchingOption = (definition.options || []).find((option) => {
            if (!existing) return false;

            if (
              definition.preset === "color" &&
              String(option.colorHex || "").toLowerCase() ===
                String(existing.colorHex || "").toLowerCase()
            ) {
              return true;
            }

            return (
              String(option.value || "").toLowerCase() ===
              String(existing.value || "").toLowerCase()
            );
          });

          if (!matchingOption) return null;

          return {
            name: definition.name,
            preset: definition.preset,
            label: matchingOption.label || matchingOption.value,
            value: matchingOption.value || matchingOption.label,
            colorHex:
              definition.preset === "color"
                ? String(
                    matchingOption.colorHex || matchingOption.value || "",
                  ).toLowerCase()
                : "",
            priceMode: matchingOption.priceMode || "default",
            price: matchingOption.price,
            comparePrice: matchingOption.comparePrice,
          };
        })
        .filter(Boolean);
    });
  }, [productId, variantDefinitions]);

  const toggleCompare = (event) => {
    event.stopPropagation();
    const snapshot = createProductSnapshot(product);
    if (!snapshot) return;
    if (!isCompared && compareItems.length >= MAX_COMPARE_ITEMS) {
      toast.error(COMPARE_LIMIT_MESSAGE);
      return;
    }
    dispatch(toggleCompareItem(snapshot));
  };

  const toggleWishlist = async (event) => {
    event.stopPropagation();
    if (wishlistLoading) return;

    try {
      await dispatch(toggleWishlistItem(product)).unwrap();
      toast.success(
        isWishlisted ? "Removed from wishlist" : "Added to wishlist",
      );
    } catch (error) {
      toast.error(error || "Failed to update wishlist");
    }
  };

  const toggleProductCart = async (event) => {
    event.stopPropagation();

    const marketplaceType = String(product?.marketplaceType || "simple")
      .trim()
      .toLowerCase();
    if (marketplaceType === "grouped") {
      toast("Choose grouped items on the product details page first.");
      navigate(`/product/${productId || product?._id || product?.id}`);
      return;
    }

    await toggleCartItem(product, 1, "", "", {
      selectedVariants: resolvedSelectedVariants,
    });
  };

  return {
    canQuickAddToCart,
    pricing,
    isCompared,
    isInCart,
    isWishlisted,
    wishlistLoading,
    toggleProductCart,
    toggleCompare,
    toggleWishlist,
  };
};

const IconButton = ({
  label,
  onClick,
  children,
  className = "",
  disabled = false,
}) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
    className={className}
  >
    {children}
  </button>
);

const getWishlistIconButtonClassName = (isWishlisted, extraClassName = "") =>
  `${extraClassName} ${
    isWishlisted
      ? "border-white bg-white text-red-600 shadow-sm"
      : "border-white bg-white text-black shadow-sm hover:text-red-500"
  }`;

const getCompareIconButtonClassName = (
  isCompared,
  tone = "light",
  extraClassName = "",
) => {
  const baseClassName = `${extraClassName} inline-flex items-center justify-center rounded-full border transition`;

  if (tone === "dark") {
    return `${baseClassName} ${
      isCompared
        ? "border-white bg-white text-[#1B1C18] shadow-sm"
        : "border-white/14 bg-white/6 text-white/45 shadow-sm hover:border-white/28 hover:bg-white/10 hover:text-white"
    }`;
  }

  if (tone === "overlay") {
    return `${baseClassName} ${
      isCompared
        ? "border-black bg-black text-white shadow-sm"
        : "border-white bg-white/95 text-[#535A63] shadow-sm hover:border-black hover:text-[#1B1C18]"
    }`;
  }

  return `${baseClassName} ${
    isCompared
      ? "border-black bg-black text-white shadow-sm"
      : "border-[#E7E0D4] bg-white text-[#5A564C] shadow-sm hover:border-black hover:text-[#1B1C18]"
  }`;
};

const getCartIconButtonClassName = (
  isInCart,
  tone = "light",
  extraClassName = "",
) => {
  const baseClassName = `${extraClassName} inline-flex items-center justify-center rounded-full border transition`;

  if (tone === "dark") {
    return `${baseClassName} ${
      isInCart
        ? "border-emerald-400 bg-emerald-400 text-[#112015] shadow-sm"
        : "border-white/14 bg-white/6 text-white/55 shadow-sm hover:border-white/28 hover:bg-white/10 hover:text-white"
    }`;
  }

  if (tone === "overlay") {
    return `${baseClassName} ${
      isInCart
        ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
        : "border-white bg-white text-black shadow-sm hover:border-black hover:text-black"
    }`;
  }

  return `${baseClassName} ${
    isInCart
      ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
      : "border-[#E7E0D4] bg-white text-[#5A564C] shadow-sm hover:border-[#1B1C18] hover:text-[#1B1C18]"
  }`;
};

const PopularCard = ({
  product,
  categoryLabel,
  sectionBadgeLabel,
  discountLabel,
  pricing,
  showCartButton,
  isCompared,
  isInCart,
  isWishlisted,
  wishlistLoading,
  toggleProductCart,
  onViewDetails,
  toggleCompare,
  toggleWishlist,
}) => (
  <article
    role="button"
    tabIndex={0}
    onClick={onViewDetails}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onViewDetails();
      }
    }}
    className="home-spotlight-card home-showcase-font group relative flex h-full min-h-[13rem] cursor-pointer flex-col overflow-hidden rounded-xl border border-white/6 bg-[#262722] transition duration-300 hover:-translate-y-[2px] hover:border-[#D4AF37]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/40 sm:min-h-[14.25rem] md:min-h-[16.5rem] lg:min-h-[17.75rem]"
  >
    <div className="relative aspect-square overflow-hidden bg-black">
      <IconButton
        label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        onClick={toggleWishlist}
        disabled={wishlistLoading}
        className={`${getWishlistIconButtonClassName(
          isWishlisted,
          "absolute right-3 top-3 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border transition sm:h-9 sm:w-9",
        )} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <FiHeart className={`h-4 w-4 ${isWishlisted ? "fill-current" : ""}`} />
      </IconButton>
      <ProductImage
        src={product?.images?.[0] || product?.image}
        alt={product?.title}
        className="h-full w-full object-cover opacity-90 transition-transform duration-1000"
      />
    </div>

    <div className="flex flex-1 flex-col gap-2.5 p-3.5 sm:gap-3 sm:p-4 md:p-5">
      <div>
        <div className="mb-2.5 flex min-h-[1.55rem] flex-wrap items-center gap-1.5 sm:mb-3 sm:min-h-[1.75rem] sm:gap-2">
          {sectionBadgeLabel ? (
            <span className="home-showcase-label rounded-full border border-white/14 bg-white/6 px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.22em] text-white/82 sm:text-[8px] sm:tracking-[0.28em]">
              {sectionBadgeLabel}
            </span>
          ) : null}
          {discountLabel ? (
            <span className="home-showcase-label rounded-full border border-white/14 bg-white/6 px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.22em] text-white sm:text-[8px] sm:tracking-[0.28em]">
              {discountLabel}
            </span>
          ) : null}
        </div>
        <h3 className="line-clamp-1 text-sm font-extrabold leading-tight text-white sm:text-base md:text-lg">
          {product?.title}
        </h3>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-white/6 pt-3 sm:pt-4">
        <span className="home-showcase-label text-xs font-bold text-white sm:text-sm">
          {pricing.isTba ? "TBA" : formatPrice(pricing.currentPrice)}
        </span>
        <div className="flex items-center gap-1.5 sm:gap-3">
          {showCartButton ? (
            <IconButton
              label={isInCart ? "Remove from cart" : "Add to cart"}
              onClick={toggleProductCart}
              className={getCartIconButtonClassName(
                isInCart,
                "dark",
                "h-8 w-8 sm:h-9 sm:w-9",
              )}
            >
              <FiShoppingBag className="h-4 w-4" />
            </IconButton>
          ) : null}
          <IconButton
            label={isCompared ? "Remove from compare" : "Add to compare"}
            onClick={toggleCompare}
            className={getCompareIconButtonClassName(
              isCompared,
              "dark",
              "h-8 w-8 sm:h-9 sm:w-9",
            )}
          >
            <FiShuffle className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="View details"
            onClick={(event) => {
              event.stopPropagation();
              onViewDetails();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-transform duration-300 hover:translate-x-1 hover:text-white sm:h-9 sm:w-9"
          >
            <FiEye className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  </article>
);

const HotDealCard = ({
  product,
  categoryLabel,
  sectionBadgeLabel,
  discountLabel,
  pricing,
  showCartButton,
  isCompared,
  isInCart,
  isWishlisted,
  wishlistLoading,
  toggleProductCart,
  onViewDetails,
  toggleCompare,
  toggleWishlist,
}) => (
  <article
    role="button"
    tabIndex={0}
    onClick={onViewDetails}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onViewDetails();
      }
    }}
    className="home-showcase-font home-showcase-shadow group flex h-full min-h-[12.75rem] cursor-pointer flex-col rounded-xl bg-white p-2.5 transition duration-300 hover:-translate-y-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/40 sm:min-h-[14rem] sm:p-3 md:min-h-[15.75rem] lg:min-h-[17rem]"
  >
    <div className="relative mb-2.5 aspect-square overflow-hidden rounded-lg bg-[#F5F3ED] sm:mb-3">
      {discountLabel ? (
        <span className="home-showcase-label absolute right-2 top-2 z-10 rounded-sm bg-[#1B1C18] px-1.5 py-0.5 text-[8px] font-bold text-white sm:text-[9px]">
          {discountLabel}
        </span>
      ) : null}
      <ProductImage
        src={product?.images?.[0] || product?.image}
        alt={product?.title}
        className="h-full w-full object-cover transition-transform duration-700"
      />
    </div>

    <div className="flex flex-1 flex-col text-left">
      <div className="mb-2.5 flex min-h-[1.55rem] flex-wrap items-center gap-1.5 sm:mb-3 sm:min-h-[1.7rem] sm:gap-2">
        {sectionBadgeLabel ? (
          <span className="home-showcase-label rounded-full border border-black/10 bg-black/5 px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-[#1B1C18] sm:text-[9px] sm:tracking-[0.22em]">
            {sectionBadgeLabel}
          </span>
        ) : null}
      </div>
      <h3 className="line-clamp-1 text-[13px] font-extrabold text-[#1B1C18] sm:text-sm">
        {product?.title}
      </h3>
      <div className="mt-auto flex items-end justify-between pt-3 sm:pt-4">
        <div className="space-y-1">
          <p className="home-showcase-label text-xs font-bold text-[#1B1C18] sm:text-sm">
            {pricing.isTba ? "TBA" : formatPrice(pricing.currentPrice)}
          </p>
          {pricing.hasDiscount ? (
            <p className="home-showcase-label text-[10px] text-[#8B8579] line-through">
              {formatPrice(pricing.previousPrice)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {showCartButton ? (
            <IconButton
              label={isInCart ? "Remove from cart" : "Add to cart"}
              onClick={toggleProductCart}
              className={getCartIconButtonClassName(
                isInCart,
                "light",
                "h-8 w-8 sm:h-9 sm:w-9",
              )}
            >
              <FiShoppingBag className="h-4 w-4" />
            </IconButton>
          ) : null}
          <IconButton
            label={isCompared ? "Remove from compare" : "Add to compare"}
            onClick={toggleCompare}
            className={getCompareIconButtonClassName(
              isCompared,
              "light",
              "h-8 w-8 sm:h-9 sm:w-9",
            )}
          >
            <FiShuffle className="h-4 w-4" />
          </IconButton>
          <IconButton
            label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            onClick={toggleWishlist}
            disabled={wishlistLoading}
            className={`${getWishlistIconButtonClassName(
              isWishlisted,
              "inline-flex h-8 w-8 items-center justify-center rounded-full border transition sm:h-9 sm:w-9",
            )} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <FiHeart
              className={`h-4 w-4 ${isWishlisted ? "fill-current" : ""}`}
            />
          </IconButton>
        </div>
      </div>
    </div>
  </article>
);

const FeaturedCard = ({
  product,
  categoryLabel,
  pricing,
  showCartButton,
  isCompared,
  isInCart,
  isWishlisted,
  wishlistLoading,
  toggleProductCart,
  onViewDetails,
  toggleCompare,
  toggleWishlist,
}) => (
  <article
    role="button"
    tabIndex={0}
    onClick={onViewDetails}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onViewDetails();
      }
    }}
    className="home-showcase-font group flex h-full min-h-[13.5rem] cursor-pointer flex-col rounded-2xl bg-white p-2.5 transition duration-300 hover:-translate-y-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/35 sm:min-h-[15.25rem] sm:p-3 md:min-h-[17.75rem] lg:min-h-[19rem]"
  >
    <div className="relative aspect-[4/4.8] overflow-hidden rounded-[1rem] bg-[#F5F3ED] home-showcase-shadow sm:aspect-[4/5]">
      <IconButton
        label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        onClick={toggleWishlist}
        disabled={wishlistLoading}
        className={`${getWishlistIconButtonClassName(
          isWishlisted,
          "absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border transition sm:h-9 sm:w-9",
        )} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <FiHeart className={`h-4 w-4 ${isWishlisted ? "fill-current" : ""}`} />
      </IconButton>
      <ProductImage
        src={product?.images?.[0] || product?.image}
        alt={product?.title}
        className="h-full w-full object-cover transition-transform duration-700"
      />
    </div>

    <div className="flex flex-1 flex-col px-1 pt-3 text-left sm:pt-4">
      <span className="home-showcase-label text-[9px] uppercase tracking-[0.2em] text-[#807462] sm:text-[10px] sm:tracking-[0.3em]">
        {pricing.isTba
          ? "Price on request"
          : `From ${formatPrice(pricing.currentPrice)}`}
      </span>
      <h3 className="mt-2 line-clamp-1 text-sm font-extrabold text-[#1B1C18] sm:text-base lg:text-lg">
        {product?.title}
      </h3>
      <div className="mt-auto flex items-center gap-2.5 pt-3 sm:gap-4 sm:pt-4">
        {showCartButton ? (
          <IconButton
            label={isInCart ? "Remove from cart" : "Add to cart"}
            onClick={toggleProductCart}
            className={getCartIconButtonClassName(
              isInCart,
              "light",
              "h-8 w-8 sm:h-9 sm:w-9",
            )}
          >
            <FiShoppingBag className="h-4 w-4" />
          </IconButton>
        ) : null}
        <IconButton
          label={isCompared ? "Remove from compare" : "Add to compare"}
          onClick={toggleCompare}
          className={getCompareIconButtonClassName(
            isCompared,
            "light",
            "h-8 w-8 sm:h-9 sm:w-9",
          )}
        >
          <FiShuffle className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="View details"
          onClick={(event) => {
            event.stopPropagation();
            onViewDetails();
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#62594C] transition hover:text-[#1B1C18] sm:h-9 sm:w-9"
        >
          <FiEye className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  </article>
);

const BestSellingCard = ({
  product,
  categoryLabel,
  pricing,
  showCartButton,
  isCompared,
  isInCart,
  isWishlisted,
  wishlistLoading,
  toggleProductCart,
  onViewDetails,
  toggleCompare,
  toggleWishlist,
}) => {
  const ratingValue = Number(product?.averageRating || product?.rating || 0);
  const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onViewDetails}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onViewDetails();
        }
      }}
      className="home-showcase-font group flex h-full min-h-[13rem] cursor-pointer flex-col text-left transition duration-300 hover:-translate-y-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/35 sm:min-h-[14.5rem] md:min-h-[16.25rem] lg:min-h-[17.5rem]"
    >
      <div className="home-showcase-shadow relative mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-white p-4 sm:mb-4 sm:p-6">
        <ProductImage
          src={product?.images?.[0] || product?.image}
          alt={product?.title}
          className="max-h-full w-full object-contain transition-transform duration-500"
        />
      </div>

      <div className="px-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="line-clamp-1 text-[13px] font-extrabold text-[#1B1C18] sm:text-sm">
            {product?.title}
          </h3>
          <div className="flex items-center text-[10px] font-bold text-[#1B1C18]">
            {hasRating ? (
              <>
                <FiStar className="mr-1 h-3.5 w-3.5 fill-current" />
                {ratingValue.toFixed(1)}
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="home-showcase-label text-xs font-bold text-[#1B1C18] sm:text-sm">
            {pricing.isTba ? "TBA" : formatPrice(pricing.currentPrice)}
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {showCartButton ? (
              <IconButton
                label={isInCart ? "Remove from cart" : "Add to cart"}
                onClick={toggleProductCart}
                className={getCartIconButtonClassName(
                  isInCart,
                  "light",
                  "h-8 w-8 sm:h-9 sm:w-9",
                )}
              >
                <FiShoppingBag className="h-4 w-4" />
              </IconButton>
            ) : null}
            <IconButton
              label={isCompared ? "Remove from compare" : "Add to compare"}
              onClick={toggleCompare}
              className={getCompareIconButtonClassName(
                isCompared,
                "light",
                "h-8 w-8 sm:h-9 sm:w-9",
              )}
            >
              <FiShuffle className="h-4 w-4" />
            </IconButton>
            <IconButton
              label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
              onClick={toggleWishlist}
              disabled={wishlistLoading}
              className={`${getWishlistIconButtonClassName(
                isWishlisted,
                "inline-flex h-8 w-8 items-center justify-center rounded-full border transition sm:h-9 sm:w-9",
              )} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <FiHeart
                className={`h-4 w-4 ${isWishlisted ? "fill-current" : ""}`}
              />
            </IconButton>
          </div>
        </div>
      </div>
    </article>
  );
};

const LatestCard = ({
  product,
  pricing,
  showCartButton,
  isCompared,
  isInCart,
  isWishlisted,
  wishlistLoading,
  toggleProductCart,
  onViewDetails,
  toggleCompare,
  toggleWishlist,
}) => (
  <article
    role="button"
    tabIndex={0}
    onClick={onViewDetails}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onViewDetails();
      }
    }}
    className="home-showcase-font group flex h-full min-h-[13rem] cursor-pointer flex-col text-center transition duration-300 hover:-translate-y-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/35 sm:min-h-[14.5rem] md:min-h-[16.25rem] lg:min-h-[17.5rem]"
  >
    <div className="home-showcase-shadow relative mb-3 aspect-square overflow-hidden rounded-2xl bg-[#F5F3ED] sm:mb-4">
      <div className="home-showcase-label absolute right-3 top-3 z-10 rounded-full bg-white/80 px-2 py-1 text-[7px] font-bold uppercase tracking-[0.18em] text-[#1B1C18] backdrop-blur-md sm:text-[8px] sm:tracking-[0.28em]">
        New
      </div>
      <ProductImage
        src={product?.images?.[0] || product?.image}
        alt={product?.title}
        className="h-full w-full object-cover transition-transform duration-700"
      />
      <div className="absolute bottom-3 right-3 flex gap-1.5 sm:gap-2">
        {showCartButton ? (
          <IconButton
            label={isInCart ? "Remove from cart" : "Add to cart"}
            onClick={toggleProductCart}
            className={getCartIconButtonClassName(
              isInCart,
              "overlay",
              "h-8 w-8 sm:h-9 sm:w-9",
            )}
          >
            <FiShoppingBag className="h-4 w-4" />
          </IconButton>
        ) : null}
        <IconButton
          label={isCompared ? "Remove from compare" : "Add to compare"}
          onClick={toggleCompare}
          className={getCompareIconButtonClassName(
            isCompared,
            "overlay",
            "h-8 w-8 backdrop-blur-sm sm:h-9 sm:w-9",
          )}
        >
          <FiShuffle className="h-4 w-4" />
        </IconButton>
        <IconButton
          label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          onClick={toggleWishlist}
          disabled={wishlistLoading}
          className={`${getWishlistIconButtonClassName(
            isWishlisted,
            "inline-flex h-8 w-8 items-center justify-center rounded-full border transition sm:h-9 sm:w-9",
          )} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <FiHeart
            className={`h-4 w-4 ${isWishlisted ? "fill-current" : ""}`}
          />
        </IconButton>
      </div>
    </div>

    <div className="px-2">
      <span className="home-showcase-label mb-1 block text-[8px] font-bold uppercase tracking-[0.2em] text-[#1B1C18] sm:text-[9px] sm:tracking-[0.34em]">
        Fresh Arrival
      </span>
      <h3 className="line-clamp-1 text-[13px] font-extrabold text-[#1B1C18] sm:text-sm">
        {product?.title}
      </h3>
      <p className="home-showcase-label mt-1 text-[11px] font-bold text-[#1B1C18] sm:text-xs">
        {pricing.isTba ? "TBA" : formatPrice(pricing.currentPrice)}
      </p>
    </div>
  </article>
);

const LandingSectionProductCard = ({
  product,
  variant,
  badgeText = "",
  onViewDetails,
}) => {
  const {
    canQuickAddToCart,
    pricing,
    isCompared,
    isInCart,
    isWishlisted,
    wishlistLoading,
    toggleProductCart,
    toggleCompare,
    toggleWishlist,
  } = useProductCardState(product);
  const showCartButton = canQuickAddToCart;
  const discountLabel = buildDiscountLabel(pricing);
  const categoryLabel = getCategoryLabel(product, badgeText);
  const sectionBadgeLabel = getSectionBadgeLabel(categoryLabel, badgeText);
  const handleViewDetails = () => {
    if (typeof onViewDetails === "function") {
      onViewDetails(product);
    }
  };

  const sharedProps = {
    product,
    categoryLabel,
    sectionBadgeLabel,
    discountLabel,
    pricing,
    showCartButton,
    isCompared,
    isInCart,
    isWishlisted,
    wishlistLoading,
    toggleProductCart,
    onViewDetails: handleViewDetails,
    toggleCompare,
    toggleWishlist,
  };

  switch (variant) {
    case "hot-deals":
      return <HotDealCard {...sharedProps} />;
    case "featured":
      return <FeaturedCard {...sharedProps} />;
    case "best-selling":
      return <BestSellingCard {...sharedProps} />;
    case "latest":
      return <LatestCard {...sharedProps} />;
    case "popular":
    default:
      return <PopularCard {...sharedProps} />;
  }
};

export default LandingSectionProductCard;
