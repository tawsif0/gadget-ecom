import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toPublicAssetUrl } from "../../utils/publicSettings";
import { stripHtml } from "../../utils/richText";
import { fetchHomeCatalog } from "../../utils/homeCatalog";

const resolveBrandLogoUrl = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:")
  ) {
    return normalized;
  }

  if (normalized.startsWith("/")) {
    return toPublicAssetUrl(normalized);
  }

  return toPublicAssetUrl(normalized);
};

const normalizeBrandRecord = (brand, fallbackDescription = "") => ({
  ...brand,
  name: String(brand?.name || "").trim(),
  description: stripHtml(brand?.description || fallbackDescription || ""),
  logoUrl: resolveBrandLogoUrl(brand?.logoUrl || brand?.logo),
});

const getBrandInitials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "BR";

const BrandLogoMarquee = () => {
  const navigate = useNavigate();
  const [brands, setBrands] = useState([]);
  const groupRef = useRef(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [activeBrand, setActiveBrand] = useState(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    let active = true;

    const fetchBrands = async () => {
      try {
        const catalog = await fetchHomeCatalog();

        if (!active) return;

        const merged = [];
        const seen = new Set();

        (catalog?.brands || []).forEach((brand) => {
          const normalized = normalizeBrandRecord(
            brand,
            "Shop brand collection",
          );
          if (!normalized.name) return;
          const key = normalized.name.toLowerCase();
          if (seen.has(key)) return;
          seen.add(key);
          merged.push(normalized);
        });

        setBrands(merged);
      } catch (_error) {
        if (active) {
          setBrands([]);
        }
      }
    };

    fetchBrands();

    return () => {
      active = false;
    };
  }, []);

  const logoBrands = useMemo(() => {
    const seen = new Set();
    const unique = brands
      .map((brand) => normalizeBrandRecord(brand, "Shop brand collection"))
      .filter((brand) => brand.name)
      .filter((brand) => {
        const key = brand.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    if (!unique.length) return [];

    const repeated = [...unique];
    while (repeated.length < 10) {
      repeated.push(...unique);
    }

    return repeated.slice(0, Math.max(10, unique.length));
  }, [brands]);

  useEffect(() => {
    if (!logoBrands.length) {
      setScrollDistance(0);
      return undefined;
    }

    const node = groupRef.current;
    if (!node) return undefined;

    const updateWidth = () => {
      const nextWidth = Math.ceil(node.getBoundingClientRect().width);
      setScrollDistance(nextWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);
    window.addEventListener("resize", updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [logoBrands]);

  useEffect(() => {
    if (!activeBrand) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setActiveBrand(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeBrand]);

  if (!logoBrands.length) return null;

  const duration = scrollDistance
    ? Math.max(18, Number((scrollDistance / 85).toFixed(2)))
    : Math.max(24, logoBrands.length * 3.5);

  const cancelScheduledClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleBrandNavigate = (brand) => {
    const name = String(brand?.name || "").trim();
    if (!name) return;
    navigate(`/shop?brand=${encodeURIComponent(name)}`);
    setActiveBrand(null);
  };

  const openBrandModal = (brand) => {
    cancelScheduledClose();
    setActiveBrand(brand);
  };

  const renderLogoGroup = (suffix) =>
    logoBrands.map((brand, index) => (
      <div
        key={`${suffix}-${brand._id || brand.name}-${index}`}
        onClick={() => handleBrandNavigate(brand)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleBrandNavigate(brand);
          }
        }}
        role="link"
        tabIndex={0}
        aria-label={`Shop ${brand.name}`}
        className="group relative flex h-52 w-60 shrink-0 flex-col items-center justify-center overflow-hidden rounded-[30px] border border-slate-200/80 bg-white px-6 py-6 text-center shadow-sm transition duration-300 hover:-translate-y-1.5 hover:border-slate-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 sm:h-56 sm:w-64"
      >
        <div
          className={`pointer-events-none absolute inset-0 opacity-100 transition duration-300 group-hover:opacity-80 ${
            index % 2 === 0
              ? "bg-linear-to-br from-white via-slate-50 to-slate-100"
              : "bg-linear-to-br from-slate-50 via-white to-slate-200/60"
          }`}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-slate-900/5 blur-2xl transition duration-300 group-hover:bg-slate-900/10"
          aria-hidden="true"
        />
        <div className="relative flex w-full flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-slate-200/70 bg-white/85 shadow-sm backdrop-blur sm:h-24 sm:w-24">
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <span className="text-lg font-extrabold tracking-[0.18em] text-slate-900 sm:text-xl">
                {getBrandInitials(brand.name)}
              </span>
            )}
          </div>

          <span className="mt-4 w-full truncate text-base font-bold text-slate-900 sm:text-lg">
            {brand.name}
          </span>

          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openBrandModal(brand);
            }}
            className="mt-3 inline-flex items-center justify-center rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
          >
            View details
          </button>
        </div>
      </div>
    ));

  return (
    <section
      id="top-brands"
      className="overflow-visible bg-white py-12 sm:py-14 lg:py-16"
    >
      <style>
        {`
          @keyframes brand-logo-marquee-scroll {
            from { transform: translate3d(0, 0, 0); }
            to { transform: translate3d(calc(-1 * var(--brand-scroll-distance, 0px)), 0, 0); }
          }
        `}
      </style>
      <div className="site-shell">
        <div className="mb-8 text-center md:mb-10 lg:mb-12">
          <div className="mb-3 inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900">
              <span className="h-2.5 w-2.5 rounded-full bg-white" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Trending Brands
            </span>
          </div>

          <h2 className="mb-3 text-2xl font-bold text-slate-900 sm:text-3xl md:mb-4 md:text-4xl lg:text-5xl">
            Trusted labels across the store
          </h2>

          <div className="mx-auto max-w-2xl">
            <p className="text-sm leading-relaxed text-slate-500 md:text-base lg:text-lg">
              Tap any logo to jump straight into matching products in the
              catalog.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="h-px w-16 bg-slate-200" />
              <span className="text-xs uppercase tracking-wide text-slate-400">
                Brand Spotlight
              </span>
              <div className="h-px w-16 bg-slate-200" />
            </div>
          </div>
        </div>

        <div className="relative py-5 sm:py-6">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-white via-white/90 to-transparent sm:w-24" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-white via-white/90 to-transparent sm:w-24" />
          <div className="overflow-hidden">
            <div
              className="flex w-max will-change-transform backface-hidden transform-[translate3d(0,0,0)] hover:[animation-play-state:paused]"
              style={{
                "--brand-scroll-distance": `${scrollDistance}px`,
                animation:
                  scrollDistance > 0
                    ? `brand-logo-marquee-scroll ${duration}s linear infinite`
                    : "none",
              }}
            >
              <div
                ref={groupRef}
                className="flex shrink-0 gap-4 px-4 py-3 sm:gap-5 sm:px-6 sm:py-4"
              >
                {renderLogoGroup("first")}
              </div>
              <div
                className="flex shrink-0 gap-4 px-4 py-3 sm:gap-5 sm:px-6 sm:py-4"
                aria-hidden="true"
              >
                {renderLogoGroup("second")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {activeBrand ? (
        <div
          className="fixed inset-0 app-layer-modal z-129000 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Brand details"
          onMouseEnter={cancelScheduledClose}
          onMouseLeave={() => undefined}
        >
          <div className="pointer-events-none absolute inset-0 bg-slate-950/20 backdrop-blur-[1px]" />
          <div
            className="pointer-events-auto relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setActiveBrand(null)}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
              aria-label="Close"
            >
              <span className="text-xl leading-none">×</span>
            </button>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {activeBrand.logoUrl ? (
                <img
                  src={activeBrand.logoUrl}
                  alt={activeBrand.name || "Brand logo"}
                  className="h-full w-full object-contain p-2"
                />
              ) : (
                <span className="text-xl font-bold text-slate-700">
                  {getBrandInitials(activeBrand.name)}
                </span>
              )}
            </div>
            <h3 className="mb-3 text-2xl font-bold text-slate-900">
              {activeBrand.name}
            </h3>
            <p className="text-justify text-sm leading-relaxed text-slate-700 sm:text-base">
              {activeBrand.description ||
                "No description available for this brand yet."}
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => handleBrandNavigate(activeBrand)}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Show in shop
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default BrandLogoMarquee;
