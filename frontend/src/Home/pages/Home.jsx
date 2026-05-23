/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import PagedProductDotsSlider from "../components/PagedProductDotsSlider";
import LuxeProductTile from "../components/LuxeProductTile";
import CategoryTypeShowcaseSection from "../components/CategoryTypeShowcaseSection";
import Banner from "./Banner";
import usePublicSettings from "../../hooks/usePublicSettings";
import { formatDocumentTitle } from "../../utils/publicSettings";
import { applySeoMetadata } from "../../utils/seoManager";
import { fetchHomeCatalog } from "../../utils/homeCatalog";
import {
  applyMarketingTemplate,
  getActiveMarketingEntry,
} from "../../utils/marketingProfiles";

const baseUrl = import.meta.env.VITE_API_URL;

const resolveSectionProducts = (section) => {
  if (!section || !Array.isArray(section.categories)) return [];
  return section.categories.flatMap((category) =>
    Array.isArray(category?.products) ? category.products : [],
  );
};

const getFullProductImageUrl = (imagePath) => {
  if (!imagePath) return "";

  const raw = String(imagePath).trim();
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

const getProductPrimaryImage = (product = {}) => {
  const candidates = [];
  if (product?.image) candidates.push(product.image);
  if (product?.imageUrl) candidates.push(product.imageUrl);
  if (Array.isArray(product?.images)) {
    product.images.forEach((img) => {
      if (img?.url) candidates.push(img.url);
      if (typeof img === "string") candidates.push(img);
    });
  }
  if (Array.isArray(product?.gallery)) {
    product.gallery.forEach((img) => {
      if (img?.url) candidates.push(img.url);
      if (typeof img === "string") candidates.push(img);
    });
  }

  const resolved =
    candidates.map((entry) => String(entry || "").trim()).find(Boolean) || "";
  return getFullProductImageUrl(resolved);
};

const DeferredSection = ({
  children,
  minHeightClassName = "min-h-[640px]",
  rootMargin = "320px 0px",
}) => {
  const containerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible || typeof window === "undefined") return undefined;

    const node = containerRef.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  return (
    <div ref={containerRef}>
      {isVisible ? (
        children
      ) : (
        <div aria-hidden="true" className={`${minHeightClassName} bg-white`} />
      )}
    </div>
  );
};

const Home = () => {
  const { settings } = usePublicSettings();
  const website = settings?.website || {};
  const [catalog, setCatalog] = useState(null);
  const [categories, setCategories] = useState([]);
  const [allProducts, setAllProducts] = useState([]);

  useEffect(() => {
    if (!settings) return;

    const website = settings?.website || {};
    const seo = settings?.seo || {};
    const pageSeo = settings?.seoAnalytics?.pages?.home || {};
    const hasExplicitEntries = Boolean(
      settings?.seoAnalytics?.hasExplicitEntries,
    );
    const seoEntry = getActiveMarketingEntry(settings, {
      type: "seo",
      pathname: "/",
    });
    const storeName =
      String(website.storeName || "E-Commerce").trim() || "E-Commerce";

    applySeoMetadata({
      title: formatDocumentTitle(
        settings,
        applyMarketingTemplate(seoEntry?.metaTitle, {
          storeName,
          pageName: "Home",
        }) ||
          (!hasExplicitEntries ? pageSeo.metaTitle : "") ||
          (!hasExplicitEntries ? seo.metaTitle : "") ||
          "Home",
      ),
      description: String(
        applyMarketingTemplate(seoEntry?.metaDescription, {
          storeName,
          pageName: "Home",
        }) ||
          (!hasExplicitEntries ? pageSeo.metaDescription : "") ||
          (!hasExplicitEntries ? seo.metaDescription : "") ||
          website.tagline ||
          "",
      ).trim(),
      keywords: String(
        applyMarketingTemplate(seoEntry?.metaKeywords, {
          storeName,
          pageName: "Home",
        }) ||
          (!hasExplicitEntries ? pageSeo.metaKeywords : "") ||
          (!hasExplicitEntries ? seo.metaKeywords : "") ||
          "",
      ).trim(),
      image: String(
        applyMarketingTemplate(seoEntry?.openGraphImage, {
          storeName,
          pageName: "Home",
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
  }, [settings]);

  useEffect(() => {
    let active = true;

    fetchHomeCatalog().then((nextCatalog) => {
      if (active) {
        setCatalog(nextCatalog);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      try {
        const response = await axios.get(`${baseUrl}/categories/public`, {
          timeout: 8000,
          params: { ts: Date.now() },
        });
        const next = response.data?.success
          ? response.data.categories || []
          : [];
        if (active) {
          setCategories(
            next.filter(
              (category) => (category?.type || "").toLowerCase() !== "package",
            ),
          );
        }
      } catch {
        if (active) setCategories([]);
      }
    };

    loadCategories();
    const handleCategoryUpdated = () => loadCategories();
    window.addEventListener("categoryUpdated", handleCategoryUpdated);

    return () => {
      active = false;
      window.removeEventListener("categoryUpdated", handleCategoryUpdated);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      try {
        const response = await axios.get(`${baseUrl}/products/public`, {
          timeout: 10000,
        });
        const next = response.data?.success ? response.data.products || [] : [];
        if (active) setAllProducts(Array.isArray(next) ? next : []);
      } catch {
        if (active) setAllProducts([]);
      }
    };

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  const sectionProducts = useMemo(
    () => ({
      Latest: resolveSectionProducts(catalog?.sections?.Latest),
    }),
    [catalog],
  );

  const validLatestProducts = useMemo(
    () =>
      (sectionProducts.Latest || []).filter((product) =>
        Boolean(String(product?._id || product?.id || "").trim()),
      ),
    [sectionProducts.Latest],
  );

  const newArrivals = useMemo(
    () => validLatestProducts.slice(0, 10),
    [validLatestProducts],
  );

  const latestCatalogCategory = useMemo(() => {
    const categoriesPayload = catalog?.sections?.Latest?.categories;
    if (!Array.isArray(categoriesPayload)) return null;
    return (
      categoriesPayload.find(
        (entry) =>
          entry &&
          (entry?.category || entry?.categoryId || entry?.categoryName) &&
          Array.isArray(entry?.products) &&
          entry.products.length > 0,
      ) || null
    );
  }, [catalog]);

  const latestCategoryId = useMemo(() => {
    const resolved =
      latestCatalogCategory?.categoryId ||
      latestCatalogCategory?.category?._id ||
      latestCatalogCategory?.category;
    return String(resolved || "").trim();
  }, [latestCatalogCategory]);

  const firstTypedCategoryForSlider = useMemo(() => {
    const typed = categories.filter((category) =>
      String(category?.type || "").trim(),
    );
    if (!typed.length) return null;

    const normalizeType = (value) => String(value || "").trim().toLowerCase();
    const types = Array.from(new Set(typed.map((c) => normalizeType(c?.type)).filter(Boolean)));
    if (!types.length) return null;

    // Prefer showing "Latest" categories on the landing page when available.
    const preferredType =
      types.find((type) => type === "latest") || types.sort()[0];

    const candidates = typed.filter(
      (category) => normalizeType(category?.type) === preferredType,
    );
    const firstCategory = candidates
      .slice()
      .sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || "")),
      )[0];

    return firstCategory || null;
  }, [categories]);

  const sliderCategoryId = String(
    firstTypedCategoryForSlider?._id || "",
  ).trim();
  const sliderCategoryName = String(
    firstTypedCategoryForSlider?.name || "",
  ).trim();
  const sliderCategoryType = String(
    firstTypedCategoryForSlider?.type || "",
  ).trim();

  const sliderProducts = useMemo(() => {
    if (!sliderCategoryId || !Array.isArray(allProducts) || !allProducts.length)
      return [];
    const getProductCategoryId = (product) => {
      if (!product?.category) return "";
      if (typeof product.category === "string")
        return String(product.category).trim();
      return String(product.category?._id || "").trim();
    };
    const filtered = allProducts.filter(
      (product) => getProductCategoryId(product) === sliderCategoryId,
    );
    const sorted = [...filtered].sort((a, b) => {
      const aDate = Date.parse(a?.createdAt || a?.updatedAt || "") || 0;
      const bDate = Date.parse(b?.createdAt || b?.updatedAt || "") || 0;
      return bDate - aDate;
    });
    return sorted;
  }, [allProducts, sliderCategoryId]);

  const customSectionCategories = useMemo(() => {
    const hiddenTypes = new Set(["latest", "general", "package"]);
    return (categories || []).filter((category) => {
      const type = String(category?.type || "").trim().toLowerCase();
      if (!type) return false;
      return !hiddenTypes.has(type);
    });
  }, [categories]);

  return (
    <>
      <div className="">
        <Banner
          variant="apple"
          logoUrl={String(
            website?.logoUrl || website?.headerIconUrl || "",
          ).trim()}
          brandName={String(
            website?.storeName || website?.brandName || "Apple Accessories",
          ).trim()}
        />

        {/* New Arrival */}
        {newArrivals.length ? (
          <section className="bg-slate-50 py-16 md:py-20">
            <div className="site-shell">
              <div className="mb-12 text-center">
                <h2 className="text-3xl font-semibold tracking-tight text-black md:text-4xl">
                  New Arrival
                </h2>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Satisfaction Guaranteed | Premium Experience
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6 lg:grid-cols-5">
                {newArrivals.map((product) => (
                  <LuxeProductTile
                    key={String(product?._id || product?.id || Math.random())}
                    product={product}
                  />
                ))}
              </div>

              {validLatestProducts.length >= 16 ? (
                <div className="mt-12 flex justify-center">
                  <Link
                    to="/shop?collection=new-arrivals"
                    className="inline-flex items-center justify-center bg-black px-10 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white transition hover:bg-black/80"
                  >
                    View More
                  </Link>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Custom Category Grid */}
        <DeferredSection minHeightClassName="min-h-[520px]">
          <CategoryTypeShowcaseSection categories={customSectionCategories} />
        </DeferredSection>

        {/* First Type Category Slider */}
        <DeferredSection minHeightClassName="min-h-[640px]">
          <PagedProductDotsSlider
            title={sliderCategoryName || "Category Picks"}
            subtitle="Exclusive Pricing | Premium Experience"
            products={sliderProducts.slice(0, 16)}
            viewMoreHref={
              sliderProducts.length >= 16
                ? sliderCategoryId
                  ? `/shop?category=${encodeURIComponent(sliderCategoryId)}${
                      sliderCategoryType
                        ? `&type=${encodeURIComponent(sliderCategoryType)}`
                        : ""
                    }`
                  : "/shop"
                : ""
            }
            pageSize={8}
          />
        </DeferredSection>
      </div>
    </>
  );
};

export default Home;
