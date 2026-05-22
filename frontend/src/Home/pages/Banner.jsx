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

  const fetchBanners = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/banners/public?type=hero&page=home`);
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
    currentBanner?.buttonLink || currentBanner?.link || (bannerButtonLabel ? "/shop" : ""),
  );
  const shouldShowBannerButton = Boolean(
    bannerButtonLabel || String(currentBanner?.buttonLink || currentBanner?.link || "").trim(),
  );
  const resolvedBannerButtonLabel = bannerButtonLabel || "Learn More";

  return (
    <section className="storefront-hero-height relative w-full overflow-hidden bg-black">
      {/* Background Image */}
      <div className="absolute inset-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, scale: 1.12, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.96, x: -18 }}
            transition={{ duration: 1.05, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute inset-0"
          >
            <motion.div
              key={`hero-pan-${activeIndex}`}
              initial={{ scale: 1.08 }}
              animate={{
                scale: [1.08, 1.03, 1.1],
                x: [0, -10, 8],
                y: [0, -6, 0],
              }}
              transition={{
                duration: Math.max(7, slideDurationMs / 1000 + 2),
                ease: "easeInOut",
                repeat: Infinity,
                repeatType: "mirror",
              }}
              className="absolute inset-0"
            >
              <HeroImage
                src={currentBanner.thumb || currentBanner.image}
                fullSrc={currentBanner.image}
                alt={currentBanner.title || "Banner"}
                className="w-full h-full object-cover"
                fetchPriority="high"
                onClick={() => handleBannerClick(currentBanner)}
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {/* Overlays */}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-black/10" />
        <div className="absolute inset-0 bg-linear-to-r from-black/40 via-transparent to-black/40" />
      </div>

      {/* Content */}
      <div className="relative h-full flex items-center">
        <div className="site-shell w-full px-12 py-4 sm:px-16 sm:py-0 md:px-20 lg:px-24 xl:px-28">
          <AnimatePresence mode="wait">
            <motion.div
              key={`content-${activeIndex}`}
              initial={{ opacity: 0, y: 42 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -26 }}
              transition={{ duration: 0.7, delay: 0.18 }}
              className="w-full max-w-[min(28rem,calc(100%-1rem))] sm:max-w-[min(34rem,calc(100%-1rem))] lg:max-w-[min(42rem,calc(100%-1rem))] xl:max-w-[min(46rem,calc(100%-1rem))]"
            >
              {currentBanner.subtitle && (
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="inline-block px-3 py-1 mb-3 text-xs font-medium text-white/90 bg-white/10 backdrop-blur-sm rounded-full border border-white/20"
                >
                  {currentBanner.subtitle}
                </motion.span>
              )}

              {currentBanner.title && (
                <motion.h1
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-xl sm:text-2xl lg:text-4xl xl:text-5xl font-bold text-white mb-2 sm:mb-3 leading-snug sm:leading-tight tracking-tight"
                >
                  {currentBanner.title}
                </motion.h1>
              )}

              {currentBanner.description && (
                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-xs sm:text-sm lg:text-lg text-white/80 mb-4 sm:mb-5 max-w-lg sm:max-w-xl leading-relaxed line-clamp-2 sm:line-clamp-3"
                >
                  {stripHtml(currentBanner.description)}
                </motion.p>
              )}

              {shouldShowBannerButton && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-wrap gap-3"
                >
                  <motion.a
                    href={bannerButtonLink || "/shop"}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openLink(bannerButtonLink || "/shop");
                    }}
                    className="group relative z-20 inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 sm:px-5 sm:py-2.5 sm:text-sm hover:brightness-105 hover:shadow-lg"
                    style={{
                      backgroundColor: "var(--brand-theme-color)",
                      color: "var(--brand-button-text-color)",
                    }}
                  >
                    <span className="relative z-10 flex items-center">
                      {resolvedBannerButtonLabel}
                      <svg
                        className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2 transform group-hover:translate-x-1 transition-transform"
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
                    </span>
                  </motion.a>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            disabled={isTransitioning}
            className="absolute left-3 top-1/2 -translate-y-1/2 group z-10 sm:left-5 lg:left-8 xl:left-10"
            aria-label="Previous"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 backdrop-blur-md transition-all duration-300 group-hover:scale-105 group-hover:border-white/20 group-hover:bg-white/10 sm:h-10 sm:w-10 lg:h-12 lg:w-12">
              <svg
                className="h-4 w-4 text-white/80 transition-colors group-hover:text-white sm:h-5 sm:w-5"
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
            </div>
          </button>

          <button
            onClick={handleNext}
            disabled={isTransitioning}
            className="absolute right-3 top-1/2 -translate-y-1/2 group z-10 sm:right-5 lg:right-8 xl:right-10"
            aria-label="Next"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 backdrop-blur-md transition-all duration-300 group-hover:scale-105 group-hover:border-white/20 group-hover:bg-white/10 sm:h-10 sm:w-10 lg:h-12 lg:w-12">
              <svg
                className="h-4 w-4 text-white/80 transition-colors group-hover:text-white sm:h-5 sm:w-5"
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
            </div>
          </button>
        </>
      )}

      {/* Improved Dots Navigation with Clear Progress Indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-10">
          <div className="flex items-center gap-2 sm:gap-3 px-4 py-2 bg-black/20 backdrop-blur-md rounded-full border border-white/10">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                disabled={isTransitioning}
                className="group relative p-1"
                aria-label={`Go to slide ${index + 1}`}
              >
                <motion.div
                  className={`relative overflow-hidden rounded-full transition-all duration-500 ${
                    index === activeIndex
                      ? "w-6 sm:w-8 h-2 sm:h-2.5"
                      : "w-2 sm:w-2.5 h-2 sm:h-2.5 group-hover:scale-125"
                  }`}
                >
                  {/* Base ash/white background */}
                  <div
                    className={`absolute inset-0 rounded-full transition-all duration-300 ${
                      index === activeIndex
                        ? "bg-gray-700" // Ash color for active dot base
                        : "bg-gray-600/60 group-hover:bg-gray-500" // Darker ash for inactive
                    }`}
                  />

                  {/* Progress fill with white color */}
                  {index === activeIndex && autoPlay && (
                    <motion.div
                      key={`progress-${progressKey}`}
                      className="absolute inset-0 bg-white rounded-full origin-left"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: slideDurationMs / 1000, ease: "linear" }}
                    />
                  )}

                  {/* Border for better visibility */}
                  <div
                    className={`absolute inset-0 rounded-full border ${
                      index === activeIndex
                        ? "border-gray-400"
                        : "border-gray-700/50"
                    }`}
                  />
                </motion.div>

                {/* Tooltip for better UX */}
                {index !== activeIndex && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-black/80 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
                    Slide {index + 1}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default Banner;
