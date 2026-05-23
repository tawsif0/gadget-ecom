import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { getProductCardPricingDisplay } from "../../utils/productPricing";

const baseUrl = import.meta.env.VITE_API_URL;

const normalizeText = (value) => String(value || "").trim();

const getFullProductImageUrl = (imagePath) => {
  if (!imagePath) return "";

  const raw = normalizeText(imagePath);
  if (!raw) return "";
  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:")
  ) {
    return raw;
  }
  if (raw.startsWith("/")) {
    return baseUrl ? `${baseUrl}${raw}` : raw;
  }
  return baseUrl ? `${baseUrl}/uploads/products/${raw}` : `/uploads/products/${raw}`;
};

const getProductPrimaryImage = (product = {}) => {
  const candidates = [];
  if (product?.image) candidates.push(product.image);
  if (product?.imageUrl) candidates.push(product.imageUrl);
  if (Array.isArray(product?.images)) {
    product.images.forEach((img) => {
      if (img?.url) candidates.push(img.url);
      if (typeof img === "string") candidates.push(img);
    });
  }
  if (Array.isArray(product?.gallery)) {
    product.gallery.forEach((img) => {
      if (img?.url) candidates.push(img.url);
      if (typeof img === "string") candidates.push(img);
    });
  }

  const resolved =
    candidates.map((entry) => normalizeText(entry)).find(Boolean) || "";
  return getFullProductImageUrl(resolved);
};

const formatCurrencyAmount = (amount, currency = "Tk ") => {
  if (amount === null || amount === undefined) return "—";
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return "—";
  const rounded = Number.isInteger(numeric)
    ? numeric.toFixed(0)
    : numeric.toFixed(2);
  return `${currency}${rounded}`;
};

const buildDiscountText = (pricing) => {
  if (!pricing?.hasDiscount) return "";
  const previous = Number(pricing.previousPrice || 0);
  const current = Number(pricing.currentPrice || 0);
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous <= 0)
    return "";
  const percent = Math.round(((previous - current) / previous) * 100);
  return percent > 0 ? `${percent}% OFF` : "";
};

const LuxeProductTile = ({ product }) => {
  const productId = normalizeText(product?._id || product?.id);
  const title = normalizeText(product?.name || product?.title) || "Product";
  const imageUrl = getProductPrimaryImage(product);
  const pricing = useMemo(() => getProductCardPricingDisplay(product), [product]);
  const discountText = buildDiscountText(pricing);

  const currencySymbol =
    normalizeText(import.meta.env.VITE_STORE_CURRENCY_SYMBOL) || "Tk ";
  const currentLabel = pricing.isTba
    ? "TBA"
    : formatCurrencyAmount(pricing.currentPrice, currencySymbol);
  const previousLabel =
    pricing.isTba || !pricing.hasDiscount
      ? ""
      : formatCurrencyAmount(pricing.previousPrice, currencySymbol);

  return (
    <div className="group flex h-full flex-col overflow-hidden bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0px_8px_30px_rgba(0,0,0,0.08)]">
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        {imageUrl ? (
          <img
            alt={title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            src={imageUrl}
            loading="lazy"
          />
        ) : null}
        {discountText ? (
          <span className="absolute left-2 top-2 bg-black px-2 py-1 text-[10px] font-bold text-white">
            {discountText}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 text-center">
        <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-black">
          {title}
        </h3>
        <div className="mt-auto">
          <p className="text-sm font-bold text-black">
            {currentLabel}{" "}
            {previousLabel ? (
              <span className="ml-2 font-normal text-slate-500 line-through">
                {previousLabel}
              </span>
            ) : null}
          </p>
          <Link
            to={productId ? `/product/${encodeURIComponent(productId)}` : "/shop"}
            className="mt-3 inline-flex w-full items-center justify-center border border-slate-200 py-2 text-[12px] font-bold uppercase tracking-wide text-black transition-all duration-300 hover:border-black hover:bg-black hover:text-white"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LuxeProductTile;

