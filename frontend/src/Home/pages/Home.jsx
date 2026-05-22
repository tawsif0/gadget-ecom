import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaFire, FaShoppingBag } from "react-icons/fa";
import { FaBolt, FaLayerGroup, FaRocket } from "react-icons/fa6";
import Banner from "./Banner";
import BrandLogoMarquee from "../components/BrandLogoMarquee";
import CategoryLogoMarquee from "../components/CategoryLogoMarquee";
import ProductShowcaseSection from "../components/ProductShowcaseSection";
import usePublicSettings from "../../hooks/usePublicSettings";
import { formatDocumentTitle } from "../../utils/publicSettings";
import { applySeoMetadata } from "../../utils/seoManager";
import { fetchHomeCatalog } from "../../utils/homeCatalog";
import {
  applyMarketingTemplate,
  getActiveMarketingEntry,
} from "../../utils/marketingProfiles";

const resolveSectionProducts = (section) => {
  if (!section || !Array.isArray(section.categories)) {
    return [];
  }

  return section.categories.flatMap((category) =>
    Array.isArray(category?.products) ? category.products : [],
  );
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
        <div
          aria-hidden="true"
          className={`${minHeightClassName} bg-white`}
        />
      )}
    </div>
  );
};

const Home = () => {
  const { settings } = usePublicSettings();
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    if (!settings) return;

    const website = settings?.website || {};
    const seo = settings?.seo || {};
    const pageSeo = settings?.seoAnalytics?.pages?.home || {};
    const hasExplicitEntries = Boolean(settings?.seoAnalytics?.hasExplicitEntries);
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

  const sectionProducts = useMemo(
    () => ({
      Popular: resolveSectionProducts(catalog?.sections?.Popular),
      "Hot deals": resolveSectionProducts(catalog?.sections?.["Hot deals"]),
      General: resolveSectionProducts(catalog?.sections?.General),
      "Best Selling": resolveSectionProducts(catalog?.sections?.["Best Selling"]),
      Latest: resolveSectionProducts(catalog?.sections?.Latest),
    }),
    [catalog],
  );

  return (
    <>
      <Banner />
      <DeferredSection minHeightClassName="min-h-[240px]">
        {settings?.storefront?.showCategoryMarquee !== false ? (
          <CategoryLogoMarquee />
        ) : null}
      </DeferredSection>
      <DeferredSection minHeightClassName="min-h-[820px]">
        <ProductShowcaseSection
          sectionId="top-categories"
          productType="Popular"
          products={sectionProducts.Popular}
          variant="popular"
          eyebrow="Trending Now"
          title="Popular Products"
          description="Curated technology with a darker premium presentation, built from your live store data."
          icon={FaFire}
          badgeText="Limited"
          viewAllNoun="Popular Products"
        />
      </DeferredSection>
      <DeferredSection minHeightClassName="min-h-[820px]">
        <ProductShowcaseSection
          productType="Hot deals"
          products={sectionProducts["Hot deals"]}
          variant="hot-deals"
          eyebrow="Limited Time Offers"
          title="Hot Deals"
          description="Exceptional value on the products your shoppers are most likely to grab quickly."
          icon={FaBolt}
          badgeText="Hot Deal"
          viewAllNoun="Hot Deals"
        />
      </DeferredSection>
      <DeferredSection minHeightClassName="min-h-[240px]">
        {settings?.storefront?.showBrandMarquee !== false ? (
          <BrandLogoMarquee />
        ) : null}
      </DeferredSection>
      <DeferredSection minHeightClassName="min-h-[820px]">
        <ProductShowcaseSection
          productType="General"
          products={sectionProducts.General}
          variant="featured"
          eyebrow="Featured Collections"
          title="Featured Products"
          description="Editorial-style catalogue highlights for the products you want to feel premium and carefully chosen."
          icon={FaShoppingBag}
          badgeText="Curated"
          viewAllNoun="Products"
        />
      </DeferredSection>
      <DeferredSection minHeightClassName="min-h-[820px]">
        <ProductShowcaseSection
          productType="Best Selling"
          products={sectionProducts["Best Selling"]}
          variant="best-selling"
          eyebrow="Hot Sellers"
          title="Best Selling Products"
          description="A stronger gallery for the products already proving themselves with customers."
          icon={FaLayerGroup}
          badgeText="Best Seller"
          viewAllNoun="Best Sellers"
        />
      </DeferredSection>
      <DeferredSection minHeightClassName="min-h-[820px]">
        <ProductShowcaseSection
          productType="Latest"
          products={sectionProducts.Latest}
          variant="latest"
          eyebrow="New Arrivals"
          title="Latest Products"
          description="Fresh inventory presented with a lighter launch-style section that feels new the moment it loads."
          icon={FaRocket}
          badgeText="New"
          viewAllNoun="Latest Products"
        />
      </DeferredSection>
    </>
  );
};

export default Home;
