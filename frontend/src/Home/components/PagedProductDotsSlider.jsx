import React from "react";
import { Link } from "react-router-dom";
import StorefrontProductCard from "./StorefrontProductCard";

const chunkItems = (items, size) => {
  const next = [];
  for (let index = 0; index < items.length; index += size) {
    next.push(items.slice(index, index + size));
  }
  return next;
};

const PagedProductDotsSlider = ({
  title,
  subtitle,
  products = [],
  viewMoreHref = "/shop",
  pageSize = 8,
}) => {
  const pages = React.useMemo(
    () => chunkItems(products, Math.max(1, pageSize)),
    [products, pageSize],
  );
  const [activePage, setActivePage] = React.useState(0);

  React.useEffect(() => {
    if (!pages.length) return;
    if (activePage >= pages.length) setActivePage(0);
  }, [pages.length, activePage]);

  const current = pages[activePage] || [];

  return (
    <section className="bg-slate-50 py-16 md:py-20">
      <div className="site-shell">
        <div className="mb-10 flex flex-col gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        {current.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
            {current.map((product) => (
              <StorefrontProductCard
                key={String(product?._id || product?.id || Math.random())}
                product={product}
                className="h-full"
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-600">
            No products available right now.
          </div>
        )}

        {pages.length > 1 ? (
          <div className="mt-10 flex items-center justify-center gap-3">
            {pages.map((_, index) => {
              const isActive = index === activePage;
              return (
                <button
                  key={`page-dot-${index}`}
                  type="button"
                  onClick={() => setActivePage(index)}
                  aria-label={`Go to page ${index + 1}`}
                  className={`h-2.5 rounded-full transition ${
                    isActive
                      ? "w-8 bg-black"
                      : "w-2.5 bg-black/20 hover:bg-black/35"
                  }`}
                />
              );
            })}
          </div>
        ) : null}

        {viewMoreHref ? (
          <div className="mt-10 flex justify-center">
            <Link
              to={viewMoreHref}
              className="app-btn-primary w-fit rounded-full px-7 py-3 text-sm font-semibold"
            >
              View more
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default PagedProductDotsSlider;
