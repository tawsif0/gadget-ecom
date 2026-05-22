import React from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import {
  FiArrowLeft,
  FiArrowRight,
  FiEye,
  FiShoppingBag,
  FiShuffle,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { clearCompareItems, removeCompareItem } from "../store/compareSlice";
import usePublicSettings from "../hooks/usePublicSettings";
import {
  getPublicStockBadgeText,
  isPublicStockVisible,
} from "../utils/publicProduct";
import {
  getDefaultSelectedVariants,
  getProductPricingForSelectedVariants,
  getReadableVariantOptionLabel,
  normalizeProductVariantDefinitions,
} from "../utils/productVariants";

const baseUrl = import.meta.env.VITE_API_URL;

const getFullImageUrl = (imagePath) => {
  const value = Array.isArray(imagePath) ? imagePath[0] : imagePath;
  if (!value) return null;

  if (
    String(value).startsWith("http://") ||
    String(value).startsWith("https://") ||
    String(value).startsWith("data:")
  ) {
    return value;
  }

  if (String(value).startsWith("/")) {
    return baseUrl ? `${baseUrl}${value}` : value;
  }

  return baseUrl
    ? `${baseUrl}/uploads/products/${value}`
    : `/uploads/products/${value}`;
};

const formatMoney = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "TBA";
  return `${numericValue.toFixed(2)} Tk`;
};

const renderPricingDisplay = (pricing) => {
  if (!pricing || pricing.isTba) {
    return <span className="text-sm font-semibold text-[#2d3435]">TBA</span>;
  }

  if (pricing.hasDiscount) {
    return (
      <span className="flex flex-wrap items-baseline gap-2">
        <span className="text-xs text-gray-400 line-through">
          {formatMoney(pricing.previousPrice)}
        </span>
        <span className="text-sm font-bold text-[#2d3435]">
          {formatMoney(pricing.currentPrice)}
        </span>
      </span>
    );
  }

  return (
    <span className="text-sm font-bold text-[#2d3435]">
      {formatMoney(pricing.currentPrice)}
    </span>
  );
};

const getDeliveryWindow = (item) => {
  const min = Number(item?.deliveryMinDays || 0);
  const max = Number(item?.deliveryMaxDays || 0);
  if (max <= 0) return "Standard delivery";
  if (min > 0) return `${min}-${max} days`;
  return `${max} days`;
};

const getSellerLabel = (item) =>
  String(item?.category?.name || item?.category || "").trim() || "Store";

const getCategoryLabel = (item) =>
  String(item?.category?.name || item?.category || "General").trim();

const looksLikeHexColor = (value) =>
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value || "").trim());

const getVariantOptionDisplayLabel = (definition, option) => {
  return getReadableVariantOptionLabel({
    preset: definition?.preset,
    label: option?.label,
    value: option?.value,
    colorHex: option?.colorHex,
  });
};

const getVariantPricingGroups = (product) => {
  const definitions = normalizeProductVariantDefinitions(product);
  if (!definitions.length) return [];
  const basePricing = getProductPricingForSelectedVariants(product, []);

  return definitions
    .map((definition) => {
      const options = (definition.options || [])
        .map((option) => {
          const priceMode = String(option?.priceMode || "default")
            .trim()
            .toLowerCase();
          const usesProductPrice = priceMode === "default";
          const price = usesProductPrice
            ? basePricing?.currentPrice === null ||
              basePricing?.currentPrice === undefined
              ? null
              : Number(basePricing.currentPrice)
            : Number(option?.price);
          const comparePrice = usesProductPrice
            ? basePricing?.previousPrice === null ||
              basePricing?.previousPrice === undefined
              ? null
              : Number(basePricing.previousPrice)
            : Number(option?.comparePrice);

          if (!Number.isFinite(price) || price < 0) {
            return null;
          }

          return {
            label: getVariantOptionDisplayLabel(definition, option),
            colorHex:
              definition.preset === "color" &&
              looksLikeHexColor(option?.colorHex)
                ? String(option.colorHex).trim()
                : "",
            priceMode,
            price,
            comparePrice,
            usesProductPrice,
            showPrice: !usesProductPrice,
          };
        })
        .filter(Boolean);

      if (!options.length) return null;

      return {
        name: definition.name,
        preset: definition.preset,
        options,
      };
    })
    .filter(Boolean);
};

const renderVariantPricingGroups = (groups = [], productId = "") => {
  if (!groups.length) {
    return "Standard pricing only";
  }

  return (
    <div className="space-y-3">
      {groups.map((group, groupIndex) => {
        const visibleOptions = (group.options || []).slice(0, 4);
        const remainingOptionCount = Math.max(
          0,
          (group.options || []).length - visibleOptions.length,
        );

        return (
          <div key={`${productId}-group-${groupIndex}`} className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">
              {group.name}
            </p>
            <div className="flex flex-wrap gap-2">
              {visibleOptions.map((option, optionIndex) => {
                const hasDirectPrice =
                  option.showPrice &&
                  Number.isFinite(option.price) &&
                  option.price >= 0;
                const hasComparePrice =
                  option.showPrice &&
                  Number.isFinite(option.comparePrice) &&
                  option.comparePrice >= 0 &&
                  option.comparePrice > option.price;
                const needsNoExtraChargeNote = option.usesProductPrice;

                return (
                  <div
                    key={`${productId}-group-${groupIndex}-option-${optionIndex}`}
                    className="rounded-2xl border border-gray-200 bg-white/90 px-3 py-2 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      {group.preset === "color" && option.colorHex ? (
                        <span
                          className="inline-block h-3 w-3 rounded-full border border-black/10"
                          style={{ backgroundColor: option.colorHex }}
                        />
                      ) : null}
                      {group.preset === "color" ? null : (
                        <span className="text-sm font-semibold text-[#2d3435]">
                          {option.label}
                        </span>
                      )}
                    </div>

                    {hasDirectPrice ? (
                      <div className="mt-1 flex items-center gap-2">
                        {hasComparePrice ? (
                          <span className="text-xs text-gray-400 line-through">
                            {formatMoney(option.comparePrice)}
                          </span>
                        ) : null}
                        <span className="text-sm font-bold text-[#2d3435]">
                          {formatMoney(option.price)}
                        </span>
                      </div>
                    ) : needsNoExtraChargeNote ? (
                      <div className="mt-1">
                        <span className="text-[11px] font-medium text-gray-500">
                          No extra charge needed
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {remainingOptionCount > 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 px-3 py-2 text-xs font-semibold text-gray-400">
                  +{remainingOptionCount} more
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CompareProducts = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const items = useSelector((state) => state.compare.items || []);
  const { settings } = usePublicSettings();
  const [hydratedProducts, setHydratedProducts] = React.useState({});

  React.useEffect(() => {
    if (items.length === 1) {
      toast.error("Select at least 2 products to compare");
      navigate("/shop");
    }
  }, [items.length, navigate]);

  React.useEffect(() => {
    let cancelled = false;

    const productIds = [
      ...new Set(
        items.map((item) => String(item?._id || "").trim()).filter(Boolean),
      ),
    ];

    if (!productIds.length) {
      setHydratedProducts({});
      return () => {
        cancelled = true;
      };
    }

    const hydrateProducts = async () => {
      const responses = await Promise.all(
        productIds.map(async (productId) => {
          try {
            const response = await axios.get(
              `${baseUrl}/products/public/${productId}`,
            );
            const productData =
              response.data?.product ||
              response.data?.data ||
              response.data ||
              null;

            if (!productData?._id) return null;
            return [String(productData._id), productData];
          } catch (_error) {
            return null;
          }
        }),
      );

      if (cancelled) return;
      setHydratedProducts(Object.fromEntries(responses.filter(Boolean)));
    };

    hydrateProducts();

    return () => {
      cancelled = true;
    };
  }, [items]);

  const compareCards = React.useMemo(
    () =>
      items.map((item) => {
        const latestProduct =
          hydratedProducts[String(item?._id || "").trim()] || null;
        const mergedProduct = latestProduct
          ? {
              ...item,
              ...latestProduct,
              _id: String(latestProduct._id || item._id),
              category: latestProduct.category || item.category,
              images:
                Array.isArray(latestProduct.images) &&
                latestProduct.images.length
                  ? latestProduct.images
                  : item.images,
              variantDefinitions: Array.isArray(
                latestProduct.variantDefinitions,
              )
                ? latestProduct.variantDefinitions
                : item.variantDefinitions || [],
              variations: Array.isArray(latestProduct.variations)
                ? latestProduct.variations
                : item.variations || [],
            }
          : item;

        const pricing = getProductPricingForSelectedVariants(mergedProduct, []);

        return {
          ...mergedProduct,
          pricing,
          currentPrice: pricing.isTba
            ? null
            : Number(pricing.currentPrice || 0),
          variantPricingGroups: getVariantPricingGroups(mergedProduct),
        };
      }),
    [hydratedProducts, items],
  );

  const comparisonRows = React.useMemo(
    () => [
      {
        label: "Seller",
        value: (item) => getSellerLabel(item),
      },
      {
        label: "Category",
        value: (item) => getCategoryLabel(item),
      },
      {
        label: "Brand",
        value: (item) => String(item?.brand || "Unbranded").trim(),
      },
      {
        label: "Marketplace",
        value: (item) => String(item?.marketplaceType || "simple").trim(),
      },
      {
        label: "Delivery",
        value: (item) => getDeliveryWindow(item),
      },
      {
        label: "Stock",
        value: (item) =>
          isPublicStockVisible(item, settings)
            ? getPublicStockBadgeText(item, null, settings)
            : "Hidden",
      },
      {
        label: "Pricing",
        value: (item) => renderPricingDisplay(item?.pricing),
      },
      {
        label: "Variant Pricing",
        value: (item) => {
          const groups = Array.isArray(item?.variantPricingGroups)
            ? item.variantPricingGroups
            : [];
          return renderVariantPricingGroups(groups, item._id);
        },
      },
    ],
    [settings],
  );

  const bestMatch = React.useMemo(() => {
    if (!compareCards.length) return null;

    return [...compareCards].sort((left, right) => {
      const leftRating = Number(
        left?.averageRating || left?.ratingAverage || left?.rating || 0,
      );
      const rightRating = Number(
        right?.averageRating || right?.ratingAverage || right?.rating || 0,
      );
      if (rightRating !== leftRating) return rightRating - leftRating;

      const leftPrice = Number.isFinite(left.currentPrice)
        ? left.currentPrice
        : Number.MAX_SAFE_INTEGER;
      const rightPrice = Number.isFinite(right.currentPrice)
        ? right.currentPrice
        : Number.MAX_SAFE_INTEGER;

      return leftPrice - rightPrice;
    })[0];
  }, [compareCards]);

  const lowestPriceItem = React.useMemo(() => {
    const pricedItems = compareCards.filter((item) =>
      Number.isFinite(item.currentPrice),
    );
    if (!pricedItems.length) return null;
    return [...pricedItems].sort(
      (left, right) => left.currentPrice - right.currentPrice,
    )[0];
  }, [compareCards]);

  const verdictCopy = React.useMemo(() => {
    if (!bestMatch) {
      return "Add products from the storefront to compare their specs, pricing, delivery window, and variant pricing side by side.";
    }

    const bestTitle = String(bestMatch?.title || "this pick").trim();
    const lowestTitle = String(lowestPriceItem?.title || "").trim();

    if (lowestTitle && lowestTitle !== bestTitle) {
      return `${bestTitle} stands out as the strongest all-round pick, while ${lowestTitle} currently lands as the value option if price matters most.`;
    }

    return `${bestTitle} leads this comparison with the strongest overall balance of pricing, product quality, and storefront readiness.`;
  }, [bestMatch, lowestPriceItem]);

  if (!items.length) {
    return (
      <div className="site-shell py-10 sm:py-14">
        <div className="rounded-[32px] border border-gray-200 bg-white p-8 text-center shadow-[0_24px_60px_rgba(17,24,39,0.06)] sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-500">
            <FiShuffle className="h-7 w-7" />
          </div>
          <h1 className="mt-6 text-3xl font-black tracking-tight text-black sm:text-4xl">
            Product Compare
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-gray-500 sm:text-base">
            Add up to four products from the shop or product page to compare
            them side by side.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-black hover:text-black"
            >
              <FiArrowLeft className="h-4 w-4" />
              Back
            </button>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-900"
            >
              Browse Products
              <FiArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length < 2) {
    return null;
  }

  return (
    <div className="site-shell py-8 sm:py-10 lg:py-12">
      <div className="mx-auto w-full max-w-[1540px]">
        <header className="mb-14 sm:mb-16 lg:mb-20">
          <div className="mb-8 flex items-center justify-between gap-4 sm:mb-12">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="group inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-gray-500 transition hover:text-[#525e7f]"
            >
              <FiArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back
            </button>
            <button
              type="button"
              onClick={() => dispatch(clearCompareItems())}
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 transition hover:text-[#525e7f]"
            >
              Clear Selection
            </button>
          </div>

          <div className="text-center">
            <h1 className="text-4xl font-black tracking-tight text-[#2d3435] sm:text-5xl lg:text-7xl">
              Product Compare
            </h1>
            <div className="mx-auto mt-4 h-1 w-24 rounded-full bg-[#525e7f]" />
            <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.32em] text-gray-500 sm:text-xs">
              Editor&apos;s Selection
            </p>
          </div>
        </header>

        <section className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4 xl:gap-8">
          {compareCards.map((item) => {
            const imageUrl = getFullImageUrl(item?.images?.[0] || item?.image);
            const pricing = item.pricing;

            return (
              <article
                key={item._id}
                className="group flex h-full flex-col rounded-[26px] border border-gray-200/70 bg-white p-6 shadow-[0_20px_40px_rgba(45,52,53,0.06)] transition duration-500 hover:-translate-y-1"
              >
                <div className="mb-6 aspect-square shrink-0 overflow-hidden rounded-[20px] bg-[#f2f4f4] p-5">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.title}
                      className="h-full w-full object-contain mix-blend-multiply transition-transform duration-700"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                      No image
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                    {getCategoryLabel(item)}
                  </span>
                  <h2 className="line-clamp-2 text-xl font-black leading-tight tracking-tight text-[#2d3435]">
                    {item.title}
                  </h2>
                  <div className="text-lg">{renderPricingDisplay(pricing)}</div>
                </div>

                <div className="mt-8 border-t border-gray-200/60 pt-4">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Link
                      to={`/product/${item._id}`}
                      className="inline-flex h-11 flex-1 items-center justify-center rounded-[14px] border border-gray-200 text-gray-700 transition hover:border-black hover:text-black sm:h-12"
                      aria-label="View details"
                      title="View details"
                    >
                      <FiEye className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                      <span className="sr-only">View details</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => dispatch(removeCompareItem(item._id))}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-[14px] border border-gray-200 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-600 transition hover:border-red-200 hover:text-red-500"
                    >
                      <FiX className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="space-y-3">
          <div className="px-2 pb-4 sm:px-4 sm:pb-6">
            <h2 className="text-2xl font-black tracking-tight text-[#2d3435] sm:text-3xl">
              Detailed Analysis
            </h2>
          </div>

          <div
            className="hidden gap-3 px-4 lg:grid lg:[grid-template-columns:var(--compare-grid)]"
            style={{
              "--compare-grid": `200px repeat(${compareCards.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">
              Spec / Metric
            </div>
            {compareCards.map((item) => (
              <div
                key={`header-${item._id}`}
                className="px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400"
              >
                {String(item?.title || "")
                  .trim()
                  .slice(0, 22)}
              </div>
            ))}
          </div>

          {comparisonRows.map((row, index) => {
            const surfaceClassName =
              index % 2 === 0
                ? "bg-white shadow-[0_12px_30px_rgba(45,52,53,0.04)]"
                : "bg-[#f2f4f4]";

            return (
              <div
                key={row.label}
                className={`grid grid-cols-1 gap-4 rounded-[24px] p-5 sm:p-6 lg:items-center lg:[grid-template-columns:var(--compare-grid)] ${surfaceClassName}`}
                style={{
                  "--compare-grid": `200px repeat(${compareCards.length}, minmax(0, 1fr))`,
                }}
              >
                <div className="px-2 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500">
                  {row.label}
                </div>
                {compareCards.map((item) => (
                  <div
                    key={`${row.label}-${item._id}`}
                    className="rounded-full bg-white/70 px-4 py-3 text-sm font-medium text-[#2d3435] lg:bg-transparent lg:px-4 lg:py-0"
                  >
                    {row.value(item)}
                  </div>
                ))}
              </div>
            );
          })}
        </section>

        <section className="mt-16 flex flex-col items-center justify-center space-y-8 text-center sm:mt-20">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold italic text-[#2d3435] sm:text-3xl">
              The Curated Verdict
            </h2>
            <p className="mt-4 text-sm leading-7 text-gray-600 sm:text-base">
              {verdictCopy}
            </p>
          </div>

          {bestMatch ? (
            <Link
              to={`/product/${bestMatch._id}`}
              className="inline-flex items-center gap-3 rounded-full bg-[#525e7f] px-8 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-[0_18px_36px_rgba(82,94,127,0.22)] transition hover:scale-[1.02] hover:bg-[#465272]"
            >
              <FiShoppingBag className="h-4 w-4" />
              Purchase Best Match
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => dispatch(clearCompareItems())}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-gray-500 transition hover:text-red-500"
          >
            <FiTrash2 className="h-4 w-4" />
            Clear Compare
          </button>
        </section>
      </div>
    </div>
  );
};

export default CompareProducts;
