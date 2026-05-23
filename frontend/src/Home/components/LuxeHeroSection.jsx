import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import usePublicSettings from "../../hooks/usePublicSettings";
import { applyMarketingTemplate } from "../../utils/marketingProfiles";

const normalizeText = (value) => String(value || "").trim();

const LuxeHeroSection = ({ fallbackImageUrl = "" }) => {
  const { settings } = usePublicSettings();
  const website = settings?.website || {};
  const storefront = settings?.storefront || {};

  const storeName =
    normalizeText(website?.storeName || website?.brandName) || "E-Commerce";

  const title = useMemo(() => {
    const raw = normalizeText(storefront?.heroFallbackTitle);
    const resolved =
      applyMarketingTemplate(raw, { storeName, pageName: "Home" }) || raw;
    return resolved || "Keep Your iPhone Safe";
  }, [storeName, storefront?.heroFallbackTitle]);

  const description = useMemo(() => {
    const raw = normalizeText(storefront?.heroFallbackDescription);
    const resolved =
      applyMarketingTemplate(raw, { storeName, pageName: "Home" }) || raw;
    return resolved || normalizeText(website?.tagline) || "Premium protection for your daily carry.";
  }, [storeName, storefront?.heroFallbackDescription, website?.tagline]);

  const primaryLabel =
    normalizeText(storefront?.heroPrimaryLabel) || "Shop now";
  const secondaryLabel =
    normalizeText(storefront?.heroSecondaryLabel) || "Browse all products";

  const heroImageUrl = normalizeText(fallbackImageUrl);

  return (
    <section className="relative w-full overflow-hidden bg-white px-5 py-16 md:px-12 md:py-24">
      <style>
        {`
          @keyframes luxeFadeInUp {
            from { opacity: 0; transform: translate3d(0, 18px, 0); }
            to { opacity: 1; transform: translate3d(0, 0, 0); }
          }
          .luxe-hero-animate { animation: luxeFadeInUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
          .luxe-hero-delay-1 { animation-delay: 0.18s; }
          .luxe-hero-delay-2 { animation-delay: 0.36s; }
          .luxe-hero-delay-3 { animation-delay: 0.54s; }
        `}
      </style>

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <div className="max-w-2xl">
          <div className="luxe-hero-animate text-4xl leading-none text-black">
            {""}
          </div>
          <h1 className="luxe-hero-animate luxe-hero-delay-1 mt-4 text-4xl font-semibold tracking-tight text-black md:text-6xl">
            {title}
          </h1>
          <p className="luxe-hero-animate luxe-hero-delay-2 mt-3 text-base text-slate-600 md:text-lg">
            {description}
          </p>

          <div className="luxe-hero-animate luxe-hero-delay-3 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/shop"
              className="inline-flex items-center justify-center rounded-full bg-black px-8 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:bg-black/85"
            >
              {primaryLabel}
            </Link>
            <Link
              to="/shop"
              className="inline-flex items-center justify-center border-b border-black pb-1 text-sm font-semibold text-black transition hover:opacity-70"
            >
              {secondaryLabel}
            </Link>
          </div>
        </div>

        {heroImageUrl ? (
          <div className="luxe-hero-animate luxe-hero-delay-3 mt-12 w-full max-w-4xl px-2">
            <img
              src={heroImageUrl}
              alt={storeName}
              className="h-auto w-full select-none object-contain transition-transform duration-700 hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default LuxeHeroSection;

