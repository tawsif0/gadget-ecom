import React from "react";
import { Link } from "react-router-dom";
import StorefrontProductCard from "./StorefrontProductCard";

const buildLoopItems = (items, minCount = 10) => {
  const safe = Array.isArray(items) ? items.filter(Boolean) : [];
  if (safe.length === 0) return [];
  const repeats = Math.max(2, Math.ceil(minCount / safe.length));
  return Array.from({ length: repeats }).flatMap(() => safe);
};

const HeroProductMarquee = ({ products = [], title = "New Arrival" }) => {
  const looped = React.useMemo(() => buildLoopItems(products, 12), [products]);
  const trackRef = React.useRef(null);
  const [scrollDistance, setScrollDistance] = React.useState(1200);

  React.useEffect(() => {
    if (!looped.length) return undefined;
    const node = trackRef.current;
    if (!node || typeof window === "undefined") return undefined;

    const update = () => {
      const fullWidth = node.scrollWidth || 0;
      setScrollDistance(Math.max(900, Math.floor(fullWidth / 2)));
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [looped.length]);

  if (!looped.length) return null;

  return (
    <section className="bg-white py-10 sm:py-12">
      <div className="site-shell">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-slate-500">
              {title}
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Satisfaction Guaranteed | Premium Experience
            </h2>
          </div>
          <Link
            to="/shop"
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            View More
          </Link>
        </div>

        <div
          className="hero-marquee group relative overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/60 py-6"
          style={{
            "--hero-marquee-distance": `${scrollDistance}px`,
          }}
        >
          <div
            ref={trackRef}
            className="hero-marquee__track flex gap-4 px-4 sm:gap-6 sm:px-6"
          >
            {looped.map((product, index) => (
              <div
                key={`${String(product?._id || product?.id || "p")}-${index}`}
                className="w-[230px] shrink-0 sm:w-[260px]"
              >
                <StorefrontProductCard product={product} className="h-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroProductMarquee;
