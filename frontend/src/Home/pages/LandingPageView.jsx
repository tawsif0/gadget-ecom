import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { FiArrowRight } from "react-icons/fi";
import { toast } from "react-hot-toast";
import usePublicSettings from "../../hooks/usePublicSettings";
import { setLandingAttribution } from "../../utils/landingAttribution";
import { pushDataLayerEvent } from "../../utils/marketingDataLayer";
import { formatDocumentTitle } from "../../utils/publicSettings";
import { applySeoMetadata } from "../../utils/seoManager";
import {
  applyMarketingTemplate,
  getActiveMarketingEntry,
} from "../../utils/marketingProfiles";

const baseUrl = import.meta.env.VITE_API_URL;

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

const getFullImageUrl = (imagePath) => {
  const resolvedPath = resolveImageValue(imagePath);
  if (!resolvedPath) return "";

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

const getProductPriceLabel = (product) => {
  const priceType = String(product?.priceType || "single").toLowerCase();
  const price = Number(product?.price || 0);
  const salePrice = Number(product?.salePrice || 0);

  if (priceType === "tba") return "TBA";
  if (priceType === "best" && salePrice > 0 && salePrice < price) {
    return `${salePrice.toFixed(2)} Tk`;
  }
  return `${price.toFixed(2)} Tk`;
};

const LandingPageView = () => {
  const { slug } = useParams();
  const { settings, loaded: settingsLoaded } = usePublicSettings();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(null);

  const products = useMemo(
    () => (Array.isArray(page?.products) ? page.products : []),
    [page],
  );

  useEffect(() => {
    const normalizedSlug = String(slug || "")
      .trim()
      .toLowerCase();
    if (!normalizedSlug) return;

    let cancelled = false;

    const loadPage = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${baseUrl}/landing-pages/public/${normalizedSlug}`,
        );
        if (cancelled) return;

        const landingPage = response.data?.landingPage || null;
        setPage(landingPage);

        if (landingPage?.slug) {
          setLandingAttribution({
            slug: landingPage.slug,
            source: "landing_page",
          });

          axios
            .post(`${baseUrl}/landing-pages/public/${landingPage.slug}/view`)
            .catch(() => null);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error.response?.data?.message || "Landing page not found",
          );
          setPage(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!page) return;

    const website = settings?.website || {};
    const seo = settings?.seo || {};
    const hasExplicitEntries = Boolean(settings?.seoAnalytics?.hasExplicitEntries);
    const storeName =
      String(website.storeName || "E-Commerce").trim() || "E-Commerce";
    const heroTitle = String(
      page.headline || page.title || "Landing Page",
    ).trim();
    const seoEntry = getActiveMarketingEntry(settings, {
      type: "seo",
      pathname: `/lp/${page.slug || slug || ""}`,
    });
    const replacements = {
      storeName,
      pageName: heroTitle,
      landingPageName: heroTitle,
      landingPageDescription:
        String(page.description || page.subheadline || "").trim(),
    };

    applySeoMetadata({
      title: formatDocumentTitle(
        settings,
        applyMarketingTemplate(seoEntry?.metaTitle, replacements) || heroTitle,
      ),
      description: String(
        applyMarketingTemplate(seoEntry?.metaDescription, replacements) ||
          page.description ||
          page.subheadline ||
          (!hasExplicitEntries ? seo.metaDescription : "") ||
          "",
      ).trim(),
      keywords: String(
        applyMarketingTemplate(seoEntry?.metaKeywords, replacements) ||
          (!hasExplicitEntries ? seo.metaKeywords : "") ||
          "",
      ).trim(),
      image:
        getFullImageUrl(page.bannerImage) ||
        String(
          applyMarketingTemplate(seoEntry?.openGraphImage, replacements) ||
            (!hasExplicitEntries ? seo.openGraphImage : "") ||
            website.headerIconUrl ||
            website.logoUrl ||
            "",
        ).trim(),
      url: typeof window !== "undefined" ? window.location.href : "",
      siteName: storeName,
    });

    if (!settingsLoaded || typeof window === "undefined") {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      pushDataLayerEvent("landing_page_view", {
        ecommerce: {
          landing_page: String(page.slug || "").trim(),
          item_list_name: String(page.title || "").trim(),
          items: products.map((product, index) => ({
            item_id: String(product?._id || "").trim(),
            item_name: String(product?.title || "Product").trim(),
            index,
          })),
        },
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [page, products, settings, settingsLoaded]);

  if (loading) {
    return (
      <section className="min-h-screen bg-white py-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-600">Loading landing page...</p>
        </div>
      </section>
    );
  }

  if (!page) {
    return (
      <section className="min-h-screen bg-white py-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-black mb-2">
            Landing Page Not Found
          </h1>
          <p className="text-gray-600">
            This landing page link is not active right now.
          </p>
        </div>
      </section>
    );
  }

  const heroBackground = getFullImageUrl(page.bannerImage);

  return (
    <section className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <div className="rounded-2xl border border-gray-200 overflow-hidden bg-linear-to-br from-gray-50 to-white">
          {heroBackground ? (
            <div
              className="h-56 md:h-72 bg-cover bg-center"
              style={{ backgroundImage: `url(${heroBackground})` }}
            />
          ) : null}
          <div className="p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500 mb-2">
              Landing Page
            </p>
            <h1 className="text-2xl md:text-4xl font-bold text-black">
              {page.headline || page.title}
            </h1>
            {page.subheadline ? (
              <p className="text-gray-600 mt-3 max-w-3xl">{page.subheadline}</p>
            ) : null}
            {page.description ? (
              <p className="text-gray-700 mt-4 max-w-3xl">{page.description}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold text-black">
            Products ({products.length})
          </h2>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-sm font-medium text-black hover:underline"
          >
            View full shop
            <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-600">
            No products have been assigned to this landing page.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => {
              const imageUrl = getFullImageUrl(product?.images?.[0]);
              const priceLabel = getProductPriceLabel(product);
              const isTba =
                String(product?.priceType || "").toLowerCase() === "tba";

              return (
                <div
                  key={product._id}
                  className="border border-gray-200 rounded-xl overflow-hidden bg-white flex flex-col"
                >
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="p-3 flex flex-col gap-2 grow">
                    <h3 className="text-sm font-semibold text-black line-clamp-2">
                      {product.title}
                    </h3>
                    <p className="text-lg font-bold text-black">{priceLabel}</p>

                    <Link
                      to={`/product/${product._id}`}
                      onClick={() =>
                        setLandingAttribution({
                          slug: page.slug,
                          source: "landing_page",
                        })
                      }
                      className={`mt-auto inline-flex h-9 items-center justify-center rounded-lg text-sm font-medium ${
                        isTba
                          ? "bg-gray-200 text-gray-500 pointer-events-none"
                          : "bg-black text-white"
                      }`}
                    >
                      {isTba ? "TBA" : "View Product"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default LandingPageView;
