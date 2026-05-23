import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

const baseUrl = import.meta.env.VITE_API_URL;

const normalizeText = (value) => String(value || "").trim();

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

const getFullCategoryImageUrl = (value) => {
  const resolvedPath = normalizeText(resolveImageValue(value));
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
    ? `${baseUrl}/uploads/categories/${resolvedPath}`
    : `/uploads/categories/${resolvedPath}`;
};

const groupByType = (categories = []) => {
  const buckets = new Map();
  categories.forEach((category) => {
    const type = normalizeText(category?.type);
    if (!type) return;
    if (!buckets.has(type)) buckets.set(type, []);
    buckets.get(type).push(category);
  });
  return Array.from(buckets.entries())
    .map(([type, items]) => ({
      type,
      items: items
        .slice()
        .sort((a, b) => normalizeText(a?.name).localeCompare(normalizeText(b?.name))),
    }))
    .sort((a, b) => a.type.localeCompare(b.type));
};

const CategoryTypeShowcaseSection = ({ categories = [] }) => {
  const navigate = useNavigate();

  const grouped = useMemo(() => groupByType(categories), [categories]);
  if (!grouped.length) return null;

  return (
    <section className="bg-slate-50 py-16 md:py-20">
      <div className="site-shell space-y-14 md:space-y-20">
        {grouped.map((group) => {
          const items = (group.items || []).slice(0, 3);
          if (!items.length) return null;

          return (
            <div key={group.type}>
              <h2 className="mb-6 ml-1 text-2xl font-semibold tracking-tight text-black md:mb-8 md:text-3xl">
                For {group.type}
              </h2>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
                {items.map((category) => {
                  const id = normalizeText(category?._id || category?.id);
                  const name = normalizeText(category?.name) || "Category";
                  const image = getFullCategoryImageUrl(category?.image);
                  const type = normalizeText(category?.type);

                  return (
                    <button
                      key={id || `${group.type}-${name}`}
                      type="button"
                      onClick={() => {
                        if (!id) return;
                        const href = `/shop?category=${encodeURIComponent(id)}${
                          type ? `&type=${encodeURIComponent(type)}` : ""
                        }`;
                        navigate(href);
                      }}
                      className="group text-left"
                    >
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
                        {image ? (
                          <img
                            alt={name}
                            src={image}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                            loading="lazy"
                          />
                        ) : (
                          <div className="absolute inset-0 bg-linear-to-br from-slate-100 via-white to-slate-200" />
                        )}

                        <div className="absolute inset-0 bg-black/0 transition-all duration-500 group-hover:bg-black/30" />

                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span className="translate-y-8 bg-white px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-black opacity-0 shadow-lg transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 group-hover:bg-[var(--brand-theme-color)] group-hover:text-[var(--brand-button-text-color)]">
                            Shop
                          </span>
                        </div>
                      </div>

                      <div className="pt-4">
                        <p className="text-sm font-bold text-black">
                          {name} <span className="ml-1">→</span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default CategoryTypeShowcaseSection;
