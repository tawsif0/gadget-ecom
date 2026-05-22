import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import usePublicSettings from "../../hooks/usePublicSettings";
import { getDefaultPublicSettings } from "../../utils/publicSettings";

const baseUrl = import.meta.env.VITE_API_URL;

const toImageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:")
  ) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return baseUrl ? `${baseUrl}${raw}` : raw;
  }
  return baseUrl
    ? `${baseUrl}/uploads/products/${raw}`
    : `/uploads/products/${raw}`;
};

const getPricing = (product) => {
  const priceType = String(product?.priceType || "single").toLowerCase();
  if (priceType === "tba") {
    return {
      isTba: true,
      currentPrice: null,
      previousPrice: null,
      hasDiscount: false,
    };
  }

  const currentPrice =
    Number(product?.salePrice ?? product?.price ?? 0) > 0
      ? Number(product?.salePrice ?? product?.price ?? 0)
      : Number(product?.price || 0);
  const previousPrice = Number(product?.price || currentPrice || 0);

  return {
    isTba: false,
    currentPrice,
    previousPrice,
    hasDiscount: priceType === "best" && previousPrice > currentPrice,
  };
};

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

const ProductMiniCard = ({ product, onClick }) => {
  const pricing = getPricing(product);
  const imageUrl = toImageUrl(product?.images?.[0]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="site-card-soft group flex h-full flex-col p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative overflow-hidden rounded-[18px] bg-gray-50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product?.title || "Product"}
            className="h-40 w-full object-cover transition duration-500"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
            No image
          </div>
        )}
        {pricing.hasDiscount ? (
          <span className="absolute left-2 top-2 rounded-full bg-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
            Deal
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <p className="line-clamp-2 min-h-[2.7rem] text-sm font-semibold leading-5 text-black">
          {product?.title || "Untitled product"}
        </p>
        <p className="mt-1 line-clamp-1 text-xs text-gray-500">
          {product?.brand ||
            (typeof product?.category === "object"
              ? product.category?.name
              : product?.productType) ||
            "Marketplace product"}
        </p>

        <div className="mt-auto pt-4">
          {pricing.isTba ? (
            <div className="text-lg font-black text-black">TBA</div>
          ) : (
            <div className="flex items-end gap-2">
              <span className="text-lg font-black text-black">
                {Number(pricing.currentPrice || 0).toFixed(2)} Tk
              </span>
              {pricing.hasDiscount ? (
                <span className="text-xs text-gray-400 line-through">
                  {Number(pricing.previousPrice || 0).toFixed(2)} Tk
                </span>
              ) : null}
            </div>
          )}
          <div className="app-btn-secondary mt-3 px-3 py-2 text-xs group-hover:border-black">
            View product
          </div>
        </div>
      </div>
    </button>
  );
};

const MarketplaceHomeFloors = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const { settings } = usePublicSettings();
  const branding = useMemo(
    () => ({
      storeName:
        String(settings?.website?.storeName || "E-Commerce").trim() ||
        "E-Commerce",
      tagline: String(settings?.website?.tagline || "").trim(),
    }),
    [settings],
  );
  const storefront = useMemo(
    () => ({
      ...DEFAULT_STOREFRONT,
      ...(settings?.storefront || {}),
    }),
    [settings],
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const [productResponse, categoryResponse] = await Promise.all([
          axios.get(`${baseUrl}/products/public`),
          axios.get(`${baseUrl}/categories/public`),
        ]);

        if (!mounted) return;

        setProducts(
          Array.isArray(productResponse.data?.products)
            ? productResponse.data.products
            : [],
        );
        setCategories(
          Array.isArray(categoryResponse.data?.categories)
            ? categoryResponse.data.categories
            : [],
        );
      } catch {
        if (!mounted) return;
        setProducts([]);
        setCategories([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const productCountByCategory = useMemo(() => {
    const countMap = new Map();
    products.forEach((product) => {
      const categoryId =
        typeof product?.category === "string"
          ? product.category
          : product?.category?._id;
      if (!categoryId) return;
      countMap.set(categoryId, Number(countMap.get(categoryId) || 0) + 1);
    });
    return countMap;
  }, [products]);

  const featuredCategories = useMemo(() => {
    return [...categories]
      .filter((category) => productCountByCategory.has(category._id))
      .sort(
        (left, right) =>
          Number(productCountByCategory.get(right._id) || 0) -
          Number(productCountByCategory.get(left._id) || 0),
      )
      .slice(0, 8);
  }, [categories, productCountByCategory]);

  const dealProducts = useMemo(() => {
    return [...products]
      .filter((product) => {
        const pricing = getPricing(product);
        return pricing.hasDiscount && !pricing.isTba;
      })
      .sort((left, right) => {
        const leftGap =
          Number(getPricing(left).previousPrice || 0) -
          Number(getPricing(left).currentPrice || 0);
        const rightGap =
          Number(getPricing(right).previousPrice || 0) -
          Number(getPricing(right).currentPrice || 0);
        return rightGap - leftGap;
      })
      .slice(0, 10);
  }, [products]);

  const newestProducts = useMemo(() => {
    return [...products]
      .sort(
        (left, right) =>
          new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0),
      )
      .slice(0, 10);
  }, [products]);

  const categoryFloors = useMemo(() => {
    return featuredCategories
      .slice(0, 4)
      .map((category) => {
        const items = products
          .filter((product) => {
            const categoryId =
              typeof product?.category === "string"
                ? product.category
                : product?.category?._id;
            return String(categoryId || "") === String(category._id || "");
          })
          .slice(0, 4);

        return {
          ...category,
          items,
        };
      })
      .filter((floor) => floor.items.length > 0);
  }, [featuredCategories, products]);

  const dealProductCount = useMemo(() => {
    return products.filter(
      (product) =>
        String(product?.priceType || "single").toLowerCase() === "best",
    ).length;
  }, [products]);

  const tbaProductCount = useMemo(() => {
    return products.filter(
      (product) =>
        String(product?.priceType || "single").toLowerCase() === "tba",
    ).length;
  }, [products]);
  const storeName =
    String(branding.storeName || "E-Commerce").trim() || "E-Commerce";
  const highlightsEyebrow =
    String(
      storefront?.highlightsEyebrow || DEFAULT_STOREFRONT.highlightsEyebrow,
    ).trim() || DEFAULT_STOREFRONT.highlightsEyebrow;
  const highlightsTitle =
    applyTemplate(storefront?.highlightsTitle, { storeName }) ||
    applyTemplate(DEFAULT_STOREFRONT.highlightsTitle, { storeName });
  const highlightsDescription =
    String(
      storefront?.highlightsDescription ||
        DEFAULT_STOREFRONT.highlightsDescription,
    ).trim() || DEFAULT_STOREFRONT.highlightsDescription;
  const flashEyebrow =
    String(
      storefront?.flashEyebrow || DEFAULT_STOREFRONT.flashEyebrow,
    ).trim() || DEFAULT_STOREFRONT.flashEyebrow;
  const flashTitle =
    applyTemplate(storefront?.flashTitle, { storeName }) ||
    DEFAULT_STOREFRONT.flashTitle;
  const flashDescription =
    String(
      storefront?.flashDescription || DEFAULT_STOREFRONT.flashDescription,
    ).trim() || DEFAULT_STOREFRONT.flashDescription;
  const flashPrimaryLabel =
    String(
      storefront?.flashPrimaryLabel || DEFAULT_STOREFRONT.flashPrimaryLabel,
    ).trim() || DEFAULT_STOREFRONT.flashPrimaryLabel;
  const flashSecondaryLabel =
    String(
      storefront?.flashSecondaryLabel || DEFAULT_STOREFRONT.flashSecondaryLabel,
    ).trim() || DEFAULT_STOREFRONT.flashSecondaryLabel;
  const trustEyebrow =
    String(
      storefront?.trustEyebrow || DEFAULT_STOREFRONT.trustEyebrow,
    ).trim() || DEFAULT_STOREFRONT.trustEyebrow;
  const trustBullets =
    Array.isArray(storefront?.trustBullets) &&
    storefront.trustBullets.length > 0
      ? storefront.trustBullets
      : DEFAULT_STOREFRONT.trustBullets;
  const topCategoriesEyebrow =
    String(
      storefront?.topCategoriesEyebrow ||
        DEFAULT_STOREFRONT.topCategoriesEyebrow,
    ).trim() || DEFAULT_STOREFRONT.topCategoriesEyebrow;
  const dealsEyebrow =
    String(
      storefront?.dealsEyebrow || DEFAULT_STOREFRONT.dealsEyebrow,
    ).trim() || DEFAULT_STOREFRONT.dealsEyebrow;
  const dealsTitle =
    applyTemplate(storefront?.dealsTitle, { storeName }) ||
    DEFAULT_STOREFRONT.dealsTitle;
  const dealsButtonLabel =
    String(
      storefront?.dealsButtonLabel || DEFAULT_STOREFRONT.dealsButtonLabel,
    ).trim() || DEFAULT_STOREFRONT.dealsButtonLabel;
  const categoryFloorEyebrow =
    String(
      storefront?.categoryFloorEyebrow ||
        DEFAULT_STOREFRONT.categoryFloorEyebrow,
    ).trim() || DEFAULT_STOREFRONT.categoryFloorEyebrow;
  const categoryFloorDescription =
    String(
      storefront?.categoryFloorDescription ||
        DEFAULT_STOREFRONT.categoryFloorDescription,
    ).trim() || DEFAULT_STOREFRONT.categoryFloorDescription;
  const categoryFloorButtonLabel =
    String(
      storefront?.categoryFloorButtonLabel ||
        DEFAULT_STOREFRONT.categoryFloorButtonLabel,
    ).trim() || DEFAULT_STOREFRONT.categoryFloorButtonLabel;
  const categoryFloorPanelButtonLabel =
    String(
      storefront?.categoryFloorPanelButtonLabel ||
        DEFAULT_STOREFRONT.categoryFloorPanelButtonLabel,
    ).trim() || DEFAULT_STOREFRONT.categoryFloorPanelButtonLabel;
  const recommendedEyebrow =
    String(
      storefront?.recommendedEyebrow || DEFAULT_STOREFRONT.recommendedEyebrow,
    ).trim() || DEFAULT_STOREFRONT.recommendedEyebrow;
  const recommendedTitle =
    applyTemplate(storefront?.recommendedTitle, { storeName }) ||
    DEFAULT_STOREFRONT.recommendedTitle;
  const recommendedButtonLabel =
    String(
      storefront?.recommendedButtonLabel ||
        DEFAULT_STOREFRONT.recommendedButtonLabel,
    ).trim() || DEFAULT_STOREFRONT.recommendedButtonLabel;

  if (loading) {
    return (
      <section className="bg-[#f5f5f5] py-6">
        <div className="site-shell grid gap-6">
          <div className="h-36 animate-pulse rounded-[32px] bg-white" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-80 animate-pulse rounded-[32px] bg-white"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[radial-gradient(circle_at_top,#ffffff_0%,#f6f8fb_42%,#edf2f7_100%)] pb-14">
      <div className="site-shell grid gap-6">
        <div className="site-card overflow-hidden">
          <div className="grid gap-6 px-4 py-5 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-7">
            <div>
              <p className="site-kicker">{highlightsEyebrow}</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-black sm:text-3xl lg:text-4xl">
                {highlightsTitle}
              </h2>
              <p className="site-copy mt-3 max-w-3xl text-sm sm:text-base">
                {branding.tagline || highlightsDescription}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {featuredCategories.map((category) => (
                  <button
                    key={category._id}
                    type="button"
                    onClick={() => navigate(`/shop?category=${category._id}`)}
                    className="app-btn-secondary px-3 py-2 text-xs"
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Live products", value: products.length },
                { label: "Deal listings", value: dealProductCount },
                { label: "TBA items", value: tbaProductCount },
              ].map((item) => (
                <div key={item.label} className="site-metric">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-black text-black">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="site-card-dark p-6">
            <p className="site-kicker !text-white/58">{flashEyebrow}</p>
            <h3 className="mt-3 text-3xl font-black leading-tight">
              {flashTitle}
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">
              {flashDescription}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/shop")}
                className="app-btn-secondary border-white bg-white px-5 py-3 text-sm font-bold text-black"
              >
                {flashPrimaryLabel}
              </button>
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="app-btn-ghost border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white"
              >
                {flashSecondaryLabel}
              </button>
            </div>
          </div>

          <div id="top-categories" className="site-card p-5">
            <p className="site-kicker">{trustEyebrow}</p>
            <div className="mt-4 space-y-3">
              {trustBullets.map((line) => (
                <div
                  key={line}
                  className="site-card-muted px-4 py-3 text-sm font-medium text-black"
                >
                  {line}
                </div>
              ))}
            </div>
          </div>

          <div className="site-card p-5">
            <p className="site-kicker">{topCategoriesEyebrow}</p>
            <div className="mt-4 space-y-2">
              {featuredCategories.slice(0, 5).map((category) => (
                <button
                  key={category._id}
                  type="button"
                  onClick={() => navigate(`/shop?category=${category._id}`)}
                  className="site-card-muted flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white"
                >
                  <div>
                    <p className="text-sm font-semibold text-black">
                      {category.name}
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                      {category.type || "General"}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-black">
                    {Number(productCountByCategory.get(category._id) || 0)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {dealProducts.length > 0 ? (
          <div id="daily-deals" className="site-card p-4 sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="site-kicker">{dealsEyebrow}</p>
                <h3 className="mt-1 text-2xl font-black text-black">
                  {dealsTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => navigate("/shop")}
                className="app-btn-secondary px-4 py-2 text-sm"
              >
                {dealsButtonLabel}
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {dealProducts.map((product) => (
                <ProductMiniCard
                  key={product._id}
                  product={product}
                  onClick={() => navigate(`/product/${product._id}`)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {categoryFloors.map((floor) => (
          <div key={floor._id} className="site-card p-4 sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <p className="site-kicker">{categoryFloorEyebrow}</p>
                <h3 className="mt-1 text-2xl font-black text-black">
                  {floor.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/shop?category=${floor._id}`)}
                className="app-btn-secondary px-4 py-2 text-sm"
              >
                {categoryFloorButtonLabel}
              </button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <button
                type="button"
                onClick={() => navigate(`/shop?category=${floor._id}`)}
                className="site-card-dark overflow-hidden p-6 text-left"
              >
                <p className="site-kicker !text-white/58">
                  {floor.type || "Category"}
                </p>
                <h4 className="mt-3 text-3xl font-black leading-tight">
                  {floor.name}
                </h4>
                <p className="mt-3 text-sm leading-6 text-white/75">
                  {categoryFloorDescription}
                </p>
                <span className="app-btn-secondary mt-5 px-4 py-2 text-sm font-bold text-black">
                  {categoryFloorPanelButtonLabel}
                </span>
              </button>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {floor.items.map((product) => (
                  <ProductMiniCard
                    key={product._id}
                    product={product}
                    onClick={() => navigate(`/product/${product._id}`)}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}

        <div id="new-arrivals" className="site-card p-4 sm:p-6">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div>
              <p className="site-kicker">{recommendedEyebrow}</p>
              <h3 className="mt-1 text-2xl font-black text-black">
                {recommendedTitle}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => navigate("/shop")}
              className="app-btn-secondary px-4 py-2 text-sm"
            >
              {recommendedButtonLabel}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {newestProducts.map((product) => (
              <ProductMiniCard
                key={product._id}
                product={product}
                onClick={() => navigate(`/product/${product._id}`)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketplaceHomeFloors;
