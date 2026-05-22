import React from "react";
import { Link, useLocation } from "react-router-dom";
import { FiArrowLeft, FiHome, FiSearch } from "react-icons/fi";

const NotFound = () => {
  const location = useLocation();

  return (
    <section className="min-h-[70vh] bg-white px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[32px] border border-black/5 bg-[radial-gradient(circle_at_top_left,rgba(81,132,240,0.16),transparent_42%),linear-gradient(160deg,#ffffff_0%,#f7f9ff_48%,#f3f4f6_100%)] shadow-[0_25px_70px_rgba(15,23,42,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1.15fr,0.85fr]">
            <div className="p-8 sm:p-10 lg:p-14">
              <span className="inline-flex items-center rounded-full border border-black/10 bg-white/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-gray-500 backdrop-blur">
                404 Error
              </span>
              <h1 className="mt-6 max-w-2xl text-4xl font-black tracking-tight text-black sm:text-5xl">
                This page is not available right now.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-600 sm:text-base">
                The link may be broken, the page may have moved, or the address
                might not exist on this storefront anymore.
              </p>
              <div className="mt-8 rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                  Requested Path
                </p>
                <p className="mt-2 break-all text-sm font-semibold text-black sm:text-base">
                  {location.pathname}
                  {location.search || ""}
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/"
                  className="app-btn-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold shadow-lg"
                >
                  <FiHome className="h-4 w-4" />
                  Go Back Home
                </Link>
                <Link
                  to="/shop"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-6 py-3.5 text-sm font-semibold text-gray-700 transition hover:border-black hover:text-black"
                >
                  <FiSearch className="h-4 w-4" />
                  Browse Products
                </Link>
              </div>
            </div>

            <div className="border-t border-black/5 bg-[#111827] p-8 text-white sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
              <div className="flex h-full flex-col justify-between gap-8">
                <div>
                  <div className="inline-flex h-18 w-18 items-center justify-center rounded-[28px] border border-white/10 bg-white/5 text-5xl font-black text-white/90">
                    4
                    <span className="text-[2.75rem] text-[#93c5fd]">0</span>4
                  </div>
                  <h2 className="mt-8 text-2xl font-bold tracking-tight">
                    Keep the shopping flow moving
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-7 text-white/70">
                    Head back home to open the latest campaign banners, jump into
                    the shop, or search for the product again from the catalog.
                  </p>
                </div>

                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-white/80"
                >
                  <FiArrowLeft className="h-4 w-4" />
                  Return to the storefront
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NotFound;
