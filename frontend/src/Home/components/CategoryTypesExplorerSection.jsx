import React from "react";
import { useNavigate } from "react-router-dom";

const getInitials = (name = "") =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CT";

const normalizeType = (value) => String(value || "").trim();

const buildUniqueTypes = (categories = []) => {
  const set = new Set();
  categories.forEach((category) => {
    const type = normalizeType(category?.type);
    if (type) set.add(type);
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

const CategoryCard = ({ category, onShop }) => {
  const name = String(category?.name || "Category").trim();
  const image = String(category?.image || "").trim();

  return (
    <button
      type="button"
      onClick={onShop}
      className="group relative flex h-48 w-full overflow-hidden rounded-3xl bg-slate-100 text-left transition hover:-translate-y-1 hover:shadow-xl"
    >
      {image ? (
        <img
          src={image}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-linear-to-br from-slate-900/5 via-white to-orange-500/10" />
      )}
      <div className="absolute inset-0 bg-black/0 transition duration-300 group-hover:bg-black/45" />

      <div className="relative z-10 flex h-full w-full flex-col justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 text-sm font-black text-slate-900 shadow-sm backdrop-blur-sm">
            {getInitials(name)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-extrabold text-slate-900 drop-shadow-sm">
              {name}
            </h3>
            {category?.type ? (
              <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {String(category.type).trim()}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-center">
          <span className="pointer-events-none translate-y-3 rounded-full border border-white/20 bg-white/10 px-6 py-2 text-xs font-extrabold uppercase tracking-[0.22em] text-white opacity-0 shadow-sm backdrop-blur-sm transition-all duration-300 group-hover:translate-y-0 group-hover:bg-white/15 group-hover:opacity-100">
            Shop
          </span>
        </div>
      </div>
    </button>
  );
};

const CategoryTypesExplorerSection = ({ categories = [] }) => {
  const navigate = useNavigate();
  const types = React.useMemo(() => buildUniqueTypes(categories), [categories]);
  const [activeType, setActiveType] = React.useState(types[0] || "");

  React.useEffect(() => {
    if (!types.length) return;
    if (activeType && types.includes(activeType)) return;
    setActiveType(types[0]);
  }, [types, activeType]);

  if (!types.length) return null;

  const visibleCategories = categories
    .filter((category) => normalizeType(category?.type) === activeType)
    .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));

  return (
    <section className="bg-white py-16 md:py-20">
      <div className="site-shell">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Category Names
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
              Choose a type, then shop a category instantly.
            </p>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          <div>
            <p className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.24em] text-slate-500">
              Types
            </p>
            <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {types.map((type) => {
                const isActive = type === activeType;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActiveType(type)}
                    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            {visibleCategories.length ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {visibleCategories.map((category) => {
                  const id = String(category?._id || "").trim();
                  const type = normalizeType(category?.type);
                  return (
                    <CategoryCard
                      key={id || `${type}-${category?.name}`}
                      category={category}
                      onShop={() => {
                        if (!id) return;
                        const href = `/shop?category=${encodeURIComponent(id)}${
                          type ? `&type=${encodeURIComponent(type)}` : ""
                        }`;
                        navigate(href);
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-600">
                No categories available for “{activeType}”.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategoryTypesExplorerSection;
