/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { stripHtml } from "../../utils/richText";

const baseUrl = import.meta.env.VITE_API_URL || "";

const normalizeLink = (link) => {
  const normalized = String(link || "").trim();
  if (!normalized || normalized === "#") return "";
  return normalized;
};

const isExternalLink = (link) =>
  /^https?:\/\//i.test(link) ||
  String(link || "").startsWith("mailto:") ||
  String(link || "").startsWith("tel:");

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
    ? `${baseUrl}/uploads/banners/${imagePath}`
    : `/uploads/banners/${imagePath}`;
};

const FallbackImage = ({ className, alt }) => (
  <div className={`${className} relative overflow-hidden bg-white`}>
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
          <svg
            className="w-6 h-6 text-white/70"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p className="text-white/80 text-sm font-medium">{alt || "Featured"}</p>
      </div>
    </div>
  </div>
);

const HeroImage = ({ src, fullSrc, alt, className, onClick }) => {
  const [imgSrc, setImgSrc] = useState(getFullImageUrl(src || fullSrc));
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initial = getFullImageUrl(src || fullSrc);
    setImgSrc(initial);
    setHasError(false);
    setIsLoading(true);

    if (fullSrc && src !== fullSrc) {
      const fullUrl = getFullImageUrl(fullSrc);
      if (fullUrl && fullUrl !== initial) {
        const preload = new Image();
        preload.onload = () => {
          setImgSrc(fullUrl);
          setIsLoading(false);
        };
        preload.src = fullUrl;
      }
    }
  }, [src, fullSrc]);

  if (hasError || !imgSrc) {
    return (
      <div onClick={onClick} className="cursor-pointer">
        <FallbackImage className={className} alt={alt} />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {isLoading && (
        <div
          className={`${className} absolute inset-0 bg-linear-to-br from-gray-900 to-gray-800 flex items-center justify-center`}
        >
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
        </div>
      )}
      <img
        src={imgSrc}
        alt={alt}
        className={`${className} cursor-pointer transition-all duration-700`}
        onClick={onClick}
        onError={() => setHasError(true)}
        onLoad={() => setIsLoading(false)}
        crossOrigin={
          imgSrc?.startsWith("http://") || imgSrc?.startsWith("https://")
            ? "anonymous"
            : undefined
        }
        loading="eager"
      />
    </div>
  );
};

const Banner = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [progressKey, setProgressKey] = useState(Date.now()); // Key to reset animation
  const slideDurationMs = 5000;
  const navigate = useNavigate();

  const openLink = useCallback(
    (link) => {
      const target = normalizeLink(link);
      if (!target) return;

      if (isExternalLink(target)) {
        window.location.href = target;
      } else {
        navigate(target);
      }
    },
    [navigate],
  );

  const getBannerAt = useCallback(
    (offset = 0) => {
      if (!banners.length) return null;
      const index = (activeIndex + offset) % banners.length;
      return banners[(index + banners.length) % banners.length];
    },
    [activeIndex, banners],
  );

  const fetchBanners = useCallback(async () => {
    try {
      setLoading(true);
      setLoading(true);
      const response = await fetch(`${baseUrl}/banners/public`);
      const data = await response.json();

      let bannersData = [];
      if (data.success) bannersData = data.banners || [];
      else if (Array.isArray(data)) bannersData = data;
      else if (data?.data && Array.isArray(data.data)) bannersData = data.data;

      const activeBanners = bannersData.filter((b) => b?.isActive !== false);
      setBanners(activeBanners);
      if (activeBanners.length > 0) setActiveIndex(0);
    } catch (err) {
      console.error("Error fetching banners:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
    const handleUpdate = () => fetchBanners();
    window.addEventListener("bannerCreated", handleUpdate);
    window.addEventListener("bannerUpdated", handleUpdate);
    return () => {
      window.removeEventListener("bannerCreated", handleUpdate);
      window.removeEventListener("bannerUpdated", handleUpdate);
    };
  }, [fetchBanners]);

  // Infinite loop navigation functions
  const handlePrev = useCallback(() => {
    if (isTransitioning || banners.length <= 1) return;

    setIsTransitioning(true);
    setAutoPlay(false);
    setProgressKey(Date.now());

    // Calculate next index with infinite loop
    const nextIndex = activeIndex === 0 ? banners.length - 1 : activeIndex - 1;
    setActiveIndex(nextIndex);

    setTimeout(() => {
      setIsTransitioning(false);
      // Restart autoplay after a delay
      setTimeout(() => setAutoPlay(true), 1000);
    }, 600);
  }, [isTransitioning, banners.length, activeIndex]);

  const handleNext = useCallback(() => {
    if (isTransitioning || banners.length <= 1) return;

    setIsTransitioning(true);
    setProgressKey(Date.now());

    // Calculate next index with infinite loop
    const nextIndex = activeIndex === banners.length - 1 ? 0 : activeIndex + 1;
    setActiveIndex(nextIndex);

    setTimeout(() => {
      setIsTransitioning(false);
    }, 600);
  }, [isTransitioning, banners.length, activeIndex]);

  // Autoplay tied to progress duration
  useEffect(() => {
    if (!autoPlay || banners.length <= 1) return;
    if (isTransitioning) return;

    const timeout = setTimeout(() => {
      handleNext();
    }, slideDurationMs);

    return () => clearTimeout(timeout);
  }, [autoPlay, banners.length, isTransitioning, activeIndex, handleNext]);

  const handleDotClick = useCallback(
    (index) => {
      if (isTransitioning || index === activeIndex) return;
      setIsTransitioning(true);
      setActiveIndex(index);
      setAutoPlay(false);
      setProgressKey(Date.now());
      setTimeout(() => {
        setIsTransitioning(false);
        // Restart autoplay after a delay
        setTimeout(() => setAutoPlay(true), 1000);
      }, 600);
    },
    [isTransitioning, activeIndex],
  );

  const handleBannerClick = useCallback(
    (banner) => {
      openLink(banner?.link);
    },
    [openLink],
  );

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handlePrev, handleNext]);

  // Restart autoplay when user stops interacting
  useEffect(() => {
    if (!autoPlay) {
      const timeout = setTimeout(() => {
        setAutoPlay(true);
      }, 8000); // Resume autoplay after 8 seconds of inactivity
      return () => clearTimeout(timeout);
    }
  }, [autoPlay, activeIndex]);

  useEffect(() => {
    if (autoPlay) {
      setProgressKey(Date.now());
    }
  }, [autoPlay, activeIndex]);

  if (loading) {
    return (
      <section className="storefront-hero-height relative w-full bg-white overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="relative">
              <div className="w-14 h-14 border-2 border-white/10 border-t-black rounded-full animate-spin" />
              <div
                className="absolute inset-2 border-2 border-white/5 border-b-black rounded-full animate-spin animate-reverse"
                style={{
                  animationDirection: "reverse",
                  animationDuration: "1.5s",
                }}
              />
            </div>
            <p className="mt-4 text-black text-sm font-light tracking-wide">
              Loading...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (banners.length === 0) {
    return (
      <section className="storefront-hero-height relative w-full bg-linear-to-br from-white via-gray-100 to-gray-50 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent" />
        <div className="relative h-full flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-black/5 backdrop-blur border border-black/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl md:text-2xl font-semibold text-black mb-2">
              No Featured Content
            </h2>
            <p className="text-black text-sm">Check back soon for updates</p>
          </div>
        </div>
      </section>
    );
  }

  const currentBanner = banners[activeIndex];
  const bannerButtonLabel = String(currentBanner?.buttonLabel || "").trim();
  const bannerButtonLink = normalizeLink(
    currentBanner?.buttonLink ||
      currentBanner?.link ||
      (bannerButtonLabel ? "/shop" : ""),
  );
  const shouldShowBannerButton = Boolean(
    bannerButtonLabel ||
    String(currentBanner?.buttonLink || currentBanner?.link || "").trim(),
  );
  const resolvedBannerButtonLabel = bannerButtonLabel || "Learn More";

  const renderBannerContent = (banner, { compact = false } = {}) => {
    if (!banner) return null;

    const label = String(banner?.buttonLabel || "").trim();
    const link = normalizeLink(
      banner?.buttonLink || banner?.link || (label ? "/shop" : ""),
    );
    const shouldShowButton = Boolean(
      label || String(banner?.buttonLink || banner?.link || "").trim(),
    );
    const resolvedLabel = label || "Learn More";

    return (
      <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-black shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
        <div className="absolute inset-0">
          <HeroImage
            src={banner.thumb || banner.image}
            fullSrc={banner.image}
            alt={banner.title || "Banner"}
            className="h-full w-full object-cover"
            onClick={() => handleBannerClick(banner)}
          />
        </div>
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-black/10" />
        <div className="relative z-10 flex h-full items-end p-5 sm:p-6 lg:p-8">
          <div className={compact ? "max-w-[18rem]" : "max-w-[34rem]"}>
            {banner.subtitle ? (
              <span className="mb-2 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur-sm">
                {banner.subtitle}
              </span>
            ) : null}
            {banner.title ? (
              <h2
                className={`font-bold text-white ${compact ? "text-lg leading-snug" : "text-2xl leading-tight sm:text-3xl lg:text-5xl"}`}
              >
                {banner.title}
              </h2>
            ) : null}
            {banner.description ? (
              <p
                className={`mt-2 text-white/82 ${compact ? "text-xs" : "text-sm sm:text-base"} line-clamp-3`}
              >
                {stripHtml(banner.description)}
              </p>
            ) : null}
            {shouldShowButton ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openLink(link || "/shop");
                }}
                className="mt-4 inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold text-white transition hover:brightness-105"
                style={{
                  backgroundColor: "var(--brand-theme-color)",
                  color: "var(--brand-button-text-color)",
                }}
              >
                {resolvedLabel}
                <svg
                  className="ml-2 h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="w-full bg-white py-3 md:py-5">
      <div className="site-shell">
        {banners.length === 1 ? (
          <div className="h-[320px] overflow-hidden rounded-[28px] md:h-[460px]">
            {renderBannerContent(currentBanner)}
          </div>
        ) : banners.length === 2 ? (
          <div className="relative overflow-hidden rounded-[28px]">
            <div className="h-[320px] md:h-[460px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, scale: 1.03 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ duration: 0.7 }}
                  className="h-full w-full"
                >
                  {renderBannerContent(currentBanner)}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[2.35fr_1fr]">
              <div className="h-[320px] overflow-hidden rounded-[28px] md:h-[460px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`hero-${activeIndex}`}
                    initial={{ opacity: 0, x: 24, scale: 1.03 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20, scale: 0.99 }}
                    transition={{ duration: 0.8 }}
                    className="h-full w-full"
                  >
                    {renderBannerContent(currentBanner)}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                <div className="hidden md:block">
                  <div className="h-[222px] overflow-hidden rounded-[28px]">
                    {renderBannerContent(getBannerAt(1), { compact: true })}
                  </div>
                </div>
                <div className="hidden md:block">
                  <div className="h-[222px] overflow-hidden rounded-[28px]">
                    {renderBannerContent(getBannerAt(2), { compact: true })}
                  </div>
                </div>
              </div>
            </div>

          </>
        )}

        {banners.length > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              onClick={handlePrev}
              disabled={isTransitioning}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Previous banner"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              {banners.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleDotClick(index)}
                  disabled={isTransitioning}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    index === activeIndex
                      ? "w-8 bg-black"
                      : "w-2.5 bg-slate-300 hover:bg-slate-400"
                  }`}
                  aria-label={`Go to banner ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={isTransitioning}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Next banner"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default Banner;
