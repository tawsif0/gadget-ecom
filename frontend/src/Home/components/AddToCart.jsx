/* eslint-disable no-unused-vars */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaTrash, FaArrowLeft, FaShoppingBag } from "react-icons/fa";
import { FiMinus, FiPlus, FiShield, FiTag, FiTruck } from "react-icons/fi";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useCart } from "../../context/CartContext";
import ConfirmModal from "../../components/ConfirmModal";
import {
  getOrderItemColorSwatch,
  getOrderItemVariantLines,
} from "../../utils/orderPresentation";
import { getSelectedVariantSignature } from "../../utils/productVariants";
import {
  resolveLiveCartLineTotal,
  resolveLiveCartLineUnitPrice,
} from "../../utils/cartLinePricing";

const baseUrl = import.meta.env.VITE_API_URL;
const COUPON_STORAGE_KEY = "appliedCoupon";

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

const getFullImageUrl = (imagePath) => {
  const resolvedPath = resolveImageValue(imagePath);
  if (!resolvedPath) return null;

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
    ? `${baseUrl}/uploads/products/${resolvedPath}`
    : `/uploads/products/${resolvedPath}`;
};

const FallbackImage = ({ className, alt }) => (
  <div className={`${className} bg-gray-100 flex items-center justify-center`}>
    <span className="text-xs text-gray-500">{alt || "No image"}</span>
  </div>
);

const ProductImage = ({ src, alt, className }) => {
  const [imgSrc, setImgSrc] = useState(getFullImageUrl(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(getFullImageUrl(src));
    setHasError(false);
  }, [src]);

  const handleError = () => {
    setHasError(true);
  };

  if (hasError || !imgSrc) {
    return <FallbackImage className={className} alt={alt} />;
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      crossOrigin={
        imgSrc?.startsWith("http://") || imgSrc?.startsWith("https://")
          ? "anonymous"
          : undefined
      }
    />
  );
};

const formatCurrency = (value) => `${Number(value || 0).toFixed(2)} Tk`;

const AddToCart = () => {
  const navigate = useNavigate();
  const {
    cartItems,
    cartCount,
    isLoading,
    updateCartItem,
    removeCartItem,
    getCartSubtotal,
  } = useCart();

  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const subtotal = getCartSubtotal();
  const totalUnits = cartItems.reduce(
    (sum, item) => sum + Number(item.quantity || 1),
    0,
  );
  const discount = Math.min(
    Number(appliedCoupon?.discount || 0),
    Number(subtotal || 0),
  );
  const total = Math.max(subtotal - discount, 0);

  const clearAppliedCoupon = useCallback((showToast = false) => {
    setAppliedCoupon(null);
    setCouponCode("");
    localStorage.removeItem(COUPON_STORAGE_KEY);

    if (showToast) {
      toast.success("Coupon removed");
    }
  }, []);

  useEffect(() => {
    const savedCoupon = localStorage.getItem(COUPON_STORAGE_KEY);
    if (!savedCoupon) return;

    try {
      const parsedCoupon = JSON.parse(savedCoupon);
      if (parsedCoupon?.code) {
        setAppliedCoupon(parsedCoupon);
      }
    } catch (error) {
      localStorage.removeItem(COUPON_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (cartItems.length === 0 && appliedCoupon) {
      clearAppliedCoupon(false);
    }
  }, [appliedCoupon, cartItems.length, clearAppliedCoupon]);

  const handleUpdateCartItem = async (
    productId,
    newQuantity,
    color = "",
    dimensions = "",
    variationId = "",
    selectedVariantSignature = "",
  ) => {
    const lineKey = `${productId}-${variationId || ""}-${color || ""}-${dimensions || ""}-${selectedVariantSignature || ""}`;
    setUpdatingItemId(lineKey);
    try {
      await updateCartItem(
        productId,
        newQuantity,
        color,
        dimensions,
        variationId,
        selectedVariantSignature,
      );
    } catch (error) {
      console.error("Error updating cart item:", error);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleRemoveCartItem = (
    productId,
    color = "",
    dimensions = "",
    variationId = "",
    selectedVariantSignature = "",
    title = "",
  ) => {
    setRemoveConfirm({
      productId,
      color,
      dimensions,
      variationId,
      selectedVariantSignature,
      title,
    });
  };

  const confirmRemoveCartItem = async () => {
    if (!removeConfirm) return;

    setIsRemoving(true);
    try {
      await removeCartItem(
        removeConfirm.productId,
        removeConfirm.color,
        removeConfirm.dimensions,
        removeConfirm.variationId,
        removeConfirm.selectedVariantSignature,
      );
    } catch (error) {
      console.error("Error removing cart item:", error);
    } finally {
      setIsRemoving(false);
      setRemoveConfirm(null);
    }
  };

  const applyCoupon = useCallback(async (inputCode = couponCode, silent = false) => {
    const normalizedCode = String(inputCode || "").trim().toUpperCase();

    if (!normalizedCode) {
      if (!silent) toast.error("Please enter a coupon code");
      return false;
    }

    if (subtotal <= 0) {
      if (!silent) toast.error("Cart subtotal must be greater than zero");
      return false;
    }

    setIsApplyingCoupon(true);
    try {
      const couponItems = cartItems
        .map((item) => {
          const product = typeof item.product === "object" ? item.product : null;
          const productId = item.productId || product?._id || item.product;
          if (!productId) return null;

          return {
            productId,
            quantity: Number(item.quantity || 1),
            price: resolveLiveCartLineUnitPrice(item),
          };
        })
        .filter(Boolean);

      const response = await axios.post(`${baseUrl}/coupons/apply`, {
        code: normalizedCode,
        subtotal,
        items: couponItems,
      });

      const discountValue = Number(response.data?.discount || 0);
      const couponData = {
        code: response.data?.code || normalizedCode,
        offerType: String(response.data?.offerType || "discount").toLowerCase(),
        freeShipping: Boolean(response.data?.freeShipping),
        discount: discountValue,
        finalAmount: Number(response.data?.finalAmount || subtotal - discountValue),
      };

      setAppliedCoupon(couponData);
      setCouponCode("");
      localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(couponData));

      if (!silent) {
        toast.success("Coupon applied successfully");
      }

      return true;
    } catch (error) {
      if (!silent) {
        toast.error(error.response?.data?.message || "Failed to apply coupon");
      }
      return false;
    } finally {
      setIsApplyingCoupon(false);
    }
  }, [cartItems, couponCode, subtotal]);

  useEffect(() => {
    if (!appliedCoupon?.code || subtotal <= 0) return;

    let isCancelled = false;

    const refreshCoupon = async () => {
      const isValid = await applyCoupon(appliedCoupon.code, true);
      if (!isValid && !isCancelled) {
        clearAppliedCoupon(false);
      }
    };

    refreshCoupon();

    return () => {
      isCancelled = true;
    };
  }, [appliedCoupon?.code, applyCoupon, clearAppliedCoupon, subtotal]);

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    navigate("/checkout");
  };

  const getItemData = (item) => {
    const product = typeof item.product === "object" ? item.product : null;
    const selectedVariants = Array.isArray(item.selectedVariants) ? item.selectedVariants : [];
    const unitPrice = resolveLiveCartLineUnitPrice(item);
    return {
      productId: item.productId || product?._id || item.product,
      title: item.title || product?.title || "Product",
      price: unitPrice,
      image: resolveImageValue(
        item.image || product?.images?.[0] || product?.image || "",
      ),
      quantity: Number(item.quantity || 1),
      color: item.color || "",
      dimensions: item.dimensions || "",
      variationId: String(item.variationId || "").trim(),
      variationLabel: String(item.variationLabel || "").trim(),
      selectedVariants,
      selectedVariantSignature:
        String(item.selectedVariantSignature || "").trim() ||
        getSelectedVariantSignature(selectedVariants),
    };
  };

  if (isLoading && cartItems.length === 0) {
    return (
      <section className="min-h-screen bg-[#f5f5f5] py-10">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-gray-200 bg-white shadow-sm mb-4">
            <FaShoppingBag className="w-6 h-6 text-gray-400 animate-pulse" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Loading cart...</h3>
          <p className="mt-2 text-sm text-gray-500">
            Preparing your marketplace basket.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[#f5f5f5] py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate("/shop")}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-black mb-6 transition-colors group"
        >
          <FaArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Shopping</span>
        </button>
     
        {cartItems.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <FaShoppingBag className="h-6 w-6 text-gray-500" />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-black">
              Your cart is empty
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
              Add products from the shop to compare pricing, apply coupons, and
              continue to checkout.
            </p>
            <button
              onClick={() => navigate("/shop")}
              className="mt-6 inline-flex items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-900"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
            <div className="space-y-4">
              <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-3 border-b border-gray-100 pb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
                      Basket Items
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-black">
                      {cartCount} products ready for checkout
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Update quantity, remove items, or continue shopping before placing the order.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                      {totalUnits} total units
                    </span>
                
                  </div>
                </div>

                <div className="divide-y divide-gray-100">
                  {cartItems.map((item) => {
                    const itemData = getItemData(item);
                    const variantLines = getOrderItemVariantLines(itemData);
                    const colorSwatch = getOrderItemColorSwatch(itemData);
                    const key = `${itemData.productId}-${itemData.variationId || ""}-${itemData.color || ""}-${itemData.dimensions || ""}-${itemData.selectedVariantSignature || ""}`;
                    const legacyFallbackChips =
                      variantLines.length === 0
                        ? [
                            itemData.variationLabel
                              ? `Variant: ${itemData.variationLabel}`
                              : "",
                            itemData.dimensions
                              ? `Size: ${itemData.dimensions}`
                              : "",
                          ].filter(Boolean)
                        : [];
                    return (
                      <div
                        key={key}
                        className="grid gap-4 py-5 md:grid-cols-[112px_minmax(0,1fr)_auto]"
                      >
                        <ProductImage
                          src={itemData.image}
                          alt={itemData.title}
                          className="h-28 w-28 rounded-2xl border border-gray-200 object-cover bg-gray-100"
                        />

                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold leading-6 text-gray-900">
                                {itemData.title}
                              </h3>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                {variantLines.length > 0
                                  ? variantLines.map((line) => (
                                      <span
                                        key={`${key}-${line}`}
                                        className="rounded-full bg-gray-100 px-2.5 py-1"
                                      >
                                        {line}
                                      </span>
                                    ))
                                  : legacyFallbackChips.map((line) => (
                                      <span
                                        key={`${key}-legacy-${line}`}
                                        className="rounded-full bg-gray-100 px-2.5 py-1"
                                      >
                                        {line}
                                      </span>
                                    ))}
                                {colorSwatch ? (
                                  <span className="inline-flex items-center rounded-full bg-gray-100 p-1">
                                    <span
                                      className="inline-block h-3 w-3 shrink-0 rounded-full border border-gray-300"
                                      style={{
                                        backgroundColor: colorSwatch,
                                        boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.12)",
                                      }}
                                    />
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                handleRemoveCartItem(
                                  itemData.productId,
                                  itemData.color,
                                  itemData.dimensions,
                                  itemData.variationId,
                                  itemData.selectedVariantSignature,
                                  itemData.title,
                                )
                              }
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-100 text-red-500 transition hover:bg-red-50 hover:text-red-600"
                              title="Remove item"
                            >
                              <FaTrash />
                            </button>
                          </div>

                          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="inline-flex items-center overflow-hidden rounded-full border border-gray-200 bg-white">
                                <button
                                  onClick={() =>
                                    handleUpdateCartItem(
                                      itemData.productId,
                                      Math.max(1, itemData.quantity - 1),
                                      itemData.color,
                                      itemData.dimensions,
                                      itemData.variationId,
                                      itemData.selectedVariantSignature,
                                    )
                                  }
                                  className="px-4 py-2.5 text-gray-700 transition hover:bg-gray-50"
                                  disabled={updatingItemId === key}
                                >
                                  <FiMinus />
                                </button>
                                <span className="min-w-[3rem] px-3 py-2.5 text-center text-sm font-semibold text-black">
                                  {itemData.quantity}
                                </span>
                                <button
                                  onClick={() =>
                                    handleUpdateCartItem(
                                      itemData.productId,
                                      itemData.quantity + 1,
                                      itemData.color,
                                      itemData.dimensions,
                                      itemData.variationId,
                                      itemData.selectedVariantSignature,
                                    )
                                  }
                                  className="px-4 py-2.5 text-gray-700 transition hover:bg-gray-50"
                                  disabled={updatingItemId === key}
                                >
                                  <FiPlus />
                                </button>
                              </div>
                              <button
                                onClick={() => navigate(`/product/${itemData.productId}`)}
                                className="inline-flex items-center rounded-full border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-700 transition hover:border-black hover:text-black"
                              >
                                View
                              </button>
                            </div>

                            <div className="text-left sm:text-right">
                              <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400">
                                Unit Price
                              </p>
                              <p className="mt-1 text-sm font-medium text-gray-600">
                                {formatCurrency(itemData.price)}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-row items-end justify-between gap-3 border-t border-gray-100 pt-4 md:min-w-[110px] md:flex-col md:items-end md:justify-between md:border-l md:border-t-0 md:pl-4 md:pt-0">
                          <div className="text-left md:text-right">
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400">
                              Line Total
                            </p>
                            <p className="mt-1 text-lg font-bold text-black">
                              {formatCurrency(resolveLiveCartLineTotal(item))}
                            </p>
                          </div>
                          {updatingItemId === key ? (
                            <span className="text-xs font-medium text-gray-500">
                              Updating...
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="storefront-sticky-offset space-y-4 lg:sticky lg:self-start">
              <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm md:p-6">
                <h3 className="text-xl font-semibold text-gray-900">Order Summary</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Final shipping is calculated at checkout.
                </p>

                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3">
                    <span className="text-gray-600">Products</span>
                    <span className="font-semibold text-black">{cartCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3">
                    <span className="text-gray-600">Units</span>
                    <span className="font-semibold text-black">{totalUnits}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold text-black">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Coupon
                    </p>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={couponCode}
                        onChange={(event) => setCouponCode(event.target.value)}
                        placeholder="Enter coupon code"
                        className="min-w-0 flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-black"
                      />
                      <button
                        onClick={() => applyCoupon()}
                        disabled={isApplyingCoupon}
                        className="rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isApplyingCoupon ? "Applying..." : "Apply"}
                      </button>
                    </div>

                    {appliedCoupon?.code ? (
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-green-50 px-3 py-2.5 text-xs">
                        <span className="font-medium text-green-700">
                          Applied: {appliedCoupon.code}
                          {appliedCoupon?.freeShipping ? " with free delivery" : ""}
                        </span>
                        <button
                          onClick={() => clearAppliedCoupon(true)}
                          className="font-semibold text-red-500 transition hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {discount > 0 ? (
                    <div className="flex items-center justify-between rounded-2xl bg-green-50 px-4 py-3">
                      <span className="text-green-700">Discount</span>
                      <span className="font-semibold text-green-700">
                        -{formatCurrency(discount)}
                      </span>
                    </div>
                  ) : null}

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-black">Total</span>
                      <span className="text-2xl font-bold text-black">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  className="mt-6 w-full rounded-full bg-black px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-900"
                >
                  Proceed to Checkout
                </button>
                <button
                  onClick={() => navigate("/shop")}
                  className="mt-3 w-full rounded-full border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-black hover:text-black"
                >
                  Continue Shopping
                </button>
              </div>
          
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!removeConfirm}
        title="Remove item"
        message={`Are you sure you want to remove "${removeConfirm?.title || "this item"}" from your cart?`}
        confirmLabel={isRemoving ? "Removing..." : "Remove"}
        cancelLabel="Cancel"
        onConfirm={confirmRemoveCartItem}
        onCancel={() => setRemoveConfirm(null)}
        isLoading={isRemoving}
        isDanger
      />
    </section>
  );
};

export default AddToCart;
