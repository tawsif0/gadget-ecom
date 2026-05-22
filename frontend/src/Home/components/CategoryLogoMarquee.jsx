import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { stripHtml } from "../../utils/richText";

const baseUrl = import.meta.env.VITE_API_URL;

const normalizeCategoryRecord = (category) => ({
  ...category,
  _id: String(category?._id || "").trim(),
  name: String(category?.name || "").trim(),
  type: String(category?.type || "").trim(),
  description: stripHtml(category?.description || ""),
  image: String(category?.image || "").trim(),
});

const getCategoryInitials = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "CT";

const CategoryLogoMarquee = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const groupRef = useRef(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [activeCategory, setActiveCategory] = useState(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    let active = true;

    const fetchCategories = async () => {
      try {
        const response = await axios.get(`${baseUrl}/categories/public`, {
          timeout: 10000,
        });

        if (!active) return;

        const rows = Array.isArray(response?.data?.categories)
          ? response.data.categories
          : [];
        setCategories(rows.map(normalizeCategoryRecord).filter((c) => c._id));
      } catch (_error) {
        if (active) setCategories([]);
      }
    };

    fetchCategories();

    return () => {
      active = false;
    };
  }, []);

  const logoCategories = useMemo(() => {
    const seen = new Set();
    const unique = categories
      .map(normalizeCategoryRecord)
      .filter((category) => category._id && category.name)
      .filter((category) => {
        const key = category._id;
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
  }, [categories]);

  useEffect(() => {
    if (!logoCategories.length) {
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
  }, [logoCategories]);

  useEffect(() => {
    if (!activeCategory) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setActiveCategory(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeCategory]);

  if (!logoCategories.length) return null;

  const duration = scrollDistance
    ? Math.max(18, Number((scrollDistance / 85).toFixed(2)))
    : Math.max(24, logoCategories.length * 3.5);

  const cancelScheduledClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleCategoryNavigate = (category) => {
    const id = String(category?._id || "").trim();
    if (!id) return;
    navigate(`/shop?category=${encodeURIComponent(id)}`);
    setActiveCategory(null);
  };

  const openCategoryModal = (category) => {
    cancelScheduledClose();
    setActiveCategory(category);
  };

  const renderLogoGroup = (suffix) =>
    logoCategories.map((category, index) => (
      <div
        key={`${suffix}-${category._id}-${index}`}
        onClick={() => handleCategoryNavigate(category)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleCategoryNavigate(category);
          }
        }}
        role="link"
        tabIndex={0}
        aria-label={`Shop ${category.name}`}
        className={`group flex h-52 w-60 shrink-0 flex-col items-center justify-center rounded-[30px] px-6 py-6 text-center transition duration-300 hover:-translate-y-1.5 sm:h-56 sm:w-64 ${
          index % 2 === 0 ? "bg-slate-50" : "bg-slate-100/80"
        }`}
      >
        {category.image ? (
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:h-18 sm:w-18">
            <img
              src={category.image}
              alt={category.name}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-lg font-bold tracking-[0.18em] text-white shadow-sm sm:h-16 sm:w-16">
            {getCategoryInitials(category.name)}
          </div>
        )}
        <div className="mt-3 flex min-w-0 flex-col items-center">
          <span className="max-w-full truncate text-sm font-semibold text-slate-900 sm:text-base">
            {category.name}
          </span>
          {category.type ? (
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {category.type}
            </span>
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openCategoryModal(category);
            }}
            className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
          >
             View details
           </button>
         </div>
      </div>
    ));

  return (
    <section
      id="top-categories-marquee"
      className="overflow-visible bg-white py-12 sm:py-14 lg:py-16"
    >
      <style>
        {`
          @keyframes category-logo-marquee-scroll {
            from { transform: translate3d(0, 0, 0); }
            to { transform: translate3d(calc(-1 * var(--category-scroll-distance, 0px)), 0, 0); }
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
              Categories
            </span>
          </div>

          <h2 className="mb-3 text-2xl font-bold text-slate-900 sm:text-3xl md:mb-4 md:text-4xl lg:text-5xl">
            Browse by department
          </h2>

          <div className="mx-auto max-w-2xl">
            <p className="text-sm leading-relaxed text-slate-500 md:text-base lg:text-lg">
              Hover a category to preview details, then click to explore matching
              products.
            </p>
          </div>
        </div>

        <div className="relative py-5 sm:py-6">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-white via-white/90 to-transparent sm:w-24" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-white via-white/90 to-transparent sm:w-24" />
          <div className="overflow-hidden">
            <div
              className="flex w-max will-change-transform backface-hidden transform-[translate3d(0,0,0)] hover:[animation-play-state:paused]"
              style={{
                "--category-scroll-distance": `${scrollDistance}px`,
                animation:
                  scrollDistance > 0
                    ? `category-logo-marquee-scroll ${duration}s linear infinite`
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

      {activeCategory ? (
        <div
          className="fixed inset-0 app-layer-modal z-129000 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Category details"
          onMouseEnter={cancelScheduledClose}
          onMouseLeave={() => undefined}
        >
          <div className="pointer-events-none absolute inset-0 bg-slate-950/20 backdrop-blur-[1px]" />
          <div
            className="pointer-events-auto relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
              aria-label="Close"
            >
              <span className="text-xl leading-none">×</span>
            </button>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {activeCategory.image ? (
                <img
                  src={activeCategory.image}
                  alt={activeCategory.name || "Category"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-slate-700">
                  {getCategoryInitials(activeCategory.name)}
                </span>
              )}
            </div>
            <h3 className="mb-1 text-2xl font-bold text-slate-900">
              {activeCategory.name}
            </h3>
            {activeCategory.type ? (
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {activeCategory.type}
              </p>
            ) : (
              <div className="mb-4" />
            )}
            <p className="text-justify text-sm leading-relaxed text-slate-700 sm:text-base">
              {activeCategory.description ||
                "No description available for this category yet."}
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleCategoryNavigate(activeCategory)}
                className="inline-flex h-12 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
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

export default CategoryLogoMarquee;
