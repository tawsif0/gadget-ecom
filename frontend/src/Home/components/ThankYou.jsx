/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FaCheckCircle,
  FaTruck,
  FaCreditCard,
  FaCalendarAlt,
  FaReceipt,
  FaUser,
  FaBuilding,
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaBoxOpen,
} from "react-icons/fa";
import {
  FiChevronRight,
  FiPackage,
  FiClock,
  FiDollarSign,
  FiCopy,
  FiTruck,
} from "react-icons/fi";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useCart } from "../../context/CartContext";
import usePublicSettings from "../../hooks/usePublicSettings";
import {
  buildDataLayerItem,
  getDataLayerCurrency,
} from "../../utils/marketingDataLayer";
import { trackPurchase } from "../../utils/analyticsTracker";
import {
  formatOrderEstimatedDeliveryLabel,
  getOrderItemColorSwatch,
  getOrderItemLineTotal,
  getOrderItemUnitPrice,
  getOrderItemVariantLines,
  formatShippingSourceLabel,
  formatPaymentMethodLabel,
  formatPaymentStatusLabel,
  shouldShowPaymentStatus,
} from "../../utils/orderPresentation";

const baseUrl = import.meta.env.VITE_API_URL;
const ORDER_PROGRESS_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

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

// Helper function to get full image URL
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

  if (resolvedPath && !resolvedPath.startsWith("/")) {
    return baseUrl
      ? `${baseUrl}/uploads/products/${resolvedPath}`
      : `/uploads/products/${resolvedPath}`;
  }

  return null;
};

const formatCurrency = (value) => `${Number(value || 0).toFixed(2)} Tk`;

// Image component with fallback (same as in CheckOut)
const ProductImage = ({ src, alt, className }) => {
  const [imgSrc, setImgSrc] = useState(getFullImageUrl(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(getFullImageUrl(src));
    setHasError(false);
  }, [src]);

  const handleError = () => {
    setHasError(true);
    if (src && src.startsWith("/uploads/products/")) {
      const altUrl = `${baseUrl}${src}`;
      if (altUrl !== imgSrc) {
        setImgSrc(altUrl);
        setHasError(false);
      }
    }
  };

  if (hasError || !imgSrc) {
    return (
      <div
        className={`${className} bg-gray-100 flex items-center justify-center`}
      >
        <svg
          className="w-6 h-6 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
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

const ThankYou = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { loaded: settingsLoaded } = usePublicSettings();
  const { clearCart } = useCart();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const purchaseTrackedRef = useRef(false);
  const successCleanupRef = useRef(false);

  const { orderId: stateOrderId } = location.state || {};
  const searchParams = new URLSearchParams(location.search || "");
  const queryOrderId = String(searchParams.get("orderId") || "").trim();
  const paymentResult = String(searchParams.get("payment") || "")
    .trim()
    .toLowerCase();
  const paymentProvider = String(searchParams.get("provider") || "").trim();
  const orderId = queryOrderId || stateOrderId || "";

  // Get authentication headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchOrderDetails = async () => {
    if (!orderId) {
      toast.error("No order information found", {
        autoClose: 3000,
      });
      navigate("/");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      try {
        const response = await axios.get(`${baseUrl}/orders/${orderId}`, {
          headers: token ? getAuthHeaders() : {},
        });

        if (response.data.success) {
          setOrder(response.data.order);
        } else {
          throw new Error("Failed to load order");
        }
      } catch (authError) {
        if (
          authError.response?.status === 401 ||
          authError.response?.status === 403
        ) {
          const guestOrders = JSON.parse(
            localStorage.getItem("guestOrders") || "[]",
          );
          const guestOrder = guestOrders.find((order) => order._id === orderId);

          if (guestOrder) {
            setOrder(guestOrder);
          } else {
            throw new Error("Order not found");
          }
        } else {
          throw authError;
        }
      }
    } catch (error) {
      console.error("Error fetching order:", error);
      toast.error("Could not load order details", {
        autoClose: 3000,
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (location.state?.order && !queryOrderId) {
      setOrder(location.state.order);
      setLoading(false);
      return;
    }

    if (orderId) {
      const token = localStorage.getItem("token");

      if (!token) {
        const guestOrders = JSON.parse(
          localStorage.getItem("guestOrders") || "[]",
        );
        const guestOrder = guestOrders.find((order) => order._id === orderId);

        if (guestOrder) {
          setOrder(guestOrder);
          setLoading(false);
          return;
        }

        const lastOrder = localStorage.getItem("lastOrder");
        if (lastOrder) {
          const parsedLastOrder = JSON.parse(lastOrder);
          if (parsedLastOrder._id === orderId) {
            setOrder(parsedLastOrder);
            setLoading(false);
            return;
          }
        }
      }

      fetchOrderDetails();
    } else {
      const lastOrder = localStorage.getItem("lastOrder");
      if (lastOrder) {
        setOrder(JSON.parse(lastOrder));
        setLoading(false);
      } else {
        toast.error("No order information found", {
          autoClose: 3000,
        });
        navigate("/");
      }
    }
  }, [location.state, location.search, orderId, queryOrderId]);

  useEffect(() => {
    if (
      successCleanupRef.current ||
      paymentResult !== "success" ||
      !orderId ||
      !order
    ) {
      return;
    }

    successCleanupRef.current = true;
    clearCart();

    try {
      const guestOrders = JSON.parse(localStorage.getItem("guestOrders") || "[]");
      const filteredOrders = guestOrders.filter(
        (guestOrder) => String(guestOrder?._id || "") !== orderId,
      );
      localStorage.setItem("guestOrders", JSON.stringify(filteredOrders));

      const lastOrder = localStorage.getItem("lastOrder");
      if (lastOrder) {
        const parsedLastOrder = JSON.parse(lastOrder);
        if (String(parsedLastOrder?._id || "") === orderId) {
          localStorage.removeItem("lastOrder");
        }
      }
    } catch (error) {
      console.error("Failed to clear checkout cache after success:", error);
    }
  }, [clearCart, order, orderId, paymentResult]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Format time
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
      confirmed: "bg-cyan-50 text-cyan-700 border-cyan-200",
      processing: "bg-blue-50 text-blue-700 border-blue-200",
      shipped: "bg-purple-50 text-purple-700 border-purple-200",
      delivered: "bg-green-50 text-green-700 border-green-200",
      cancelled: "bg-red-50 text-red-700 border-red-200",
      returned: "bg-orange-50 text-orange-700 border-orange-200",
    };
    return colors[status] || "bg-gray-50 text-gray-700 border-gray-200";
  };
  const copyOrderNumber = () => {
    if (order?.orderNumber) {
      navigator.clipboard.writeText(order.orderNumber);
      toast.success("Order number copied!");
    }
  };
  const orderItems = Array.isArray(order?.items) ? order.items : [];
  const showPaymentStatus = shouldShowPaymentStatus(order);
  const estimatedDeliveryLabel = formatOrderEstimatedDeliveryLabel(order);
  const shippingSourceLabel = formatShippingSourceLabel(order);
  const paymentBanner =
    paymentResult === "success"
      ? {
          tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
          title: `${formatPaymentMethodLabel(paymentProvider || order?.paymentMethod || "payment")} payment confirmed`,
          message:
            "The payment was verified automatically and the order is now linked with order management as paid.",
        }
      : paymentResult === "failed"
        ? {
            tone: "border-rose-200 bg-rose-50 text-rose-800",
            title: `${formatPaymentMethodLabel(paymentProvider || order?.paymentMethod || "payment")} payment failed`,
            message:
              "Your order is saved, but the payment could not be verified. Please contact support or place a new order if needed.",
          }
        : paymentResult === "cancel"
          ? {
              tone: "border-amber-200 bg-amber-50 text-amber-800",
              title: `${formatPaymentMethodLabel(paymentProvider || order?.paymentMethod || "payment")} payment cancelled`,
              message:
                "Your order is saved in pending payment state because the payment was cancelled before completion.",
            }
          : null;

  useEffect(() => {
    if (
      !settingsLoaded ||
      !order?.orderNumber ||
      purchaseTrackedRef.current ||
      typeof window === "undefined"
    ) {
      return undefined;
    }

    const items = orderItems
      .map((item) => {
        const product = typeof item.product === "object" ? item.product : null;
        const price = Number(item.price || product?.price || 0);

        return buildDataLayerItem({
          productId: item.productId || product?._id || item.product,
          title: item.title || product?.title || "Product",
          price,
          quantity: Number(item.quantity || 1),
          category: product?.category?.name || product?.category || "",
          brand: product?.brand || "",
          variationLabel: item.variationLabel || "",
        });
      })
      .filter(Boolean);

    const frame = window.requestAnimationFrame(() => {
      trackPurchase({
        ecommerce: {
          transaction_id: String(order.orderNumber || order._id || "").trim(),
          value: Number(order.total || 0),
          currency: getDataLayerCurrency(),
          shipping: Number(order.shippingFee || 0),
          coupon: order.couponCode || undefined,
          payment_type:
            order.paymentMethod || order.paymentDetails?.method || undefined,
          items,
        },
      });

      purchaseTrackedRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [order, orderItems, settingsLoaded]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#f5f5f5] px-4 py-12">
        <div className="w-full max-w-xl rounded-[28px] border border-black/5 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-gray-50 animate-pulse">
            <FaBoxOpen className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="mt-5 text-xl font-semibold text-gray-900">
            Loading order details
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Preparing your confirmation summary and delivery status.
          </p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen w-full bg-[#f5f5f5] py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[28px] border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm md:p-12">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
              <FaBoxOpen className="h-10 w-10 text-gray-400" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold text-gray-900">
              Order not found
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
              We could not find order details for this session. Open your orders
              page to continue tracking.
            </p>
            <button
              onClick={() => navigate("/orders")}
              className="mt-6 inline-flex items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-900"
            >
              View My Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f5f5f5] py-8 md:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-black group"
          >
            <span>Back to Home</span>
            <FiChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        <div className="mb-6 overflow-hidden rounded-[30px] border border-black/5 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col">
            <div className="p-6 md:p-8 lg:p-10">
              <span className="inline-flex items-center rounded-full bg-green-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
                Order Confirmed
              </span>
              <div className="mt-5 flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-green-50">
                  <FaCheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-black md:text-4xl">
                    Thank you. Your order has been placed successfully.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 md:text-base">
                    Keep your order number handy for tracking. The order
                    summary, payment details, shipping source, and shipping
                    destination are all listed below.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-[#fafafa] px-4 py-2 text-sm font-medium text-black">
                      <span>Order #{order.orderNumber}</span>
                      <button
                        onClick={copyOrderNumber}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:text-black"
                        title="Copy order number"
                      >
                        <FiCopy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span
                      className={`rounded-full px-4 py-2 text-sm font-medium border ${getStatusColor(order.orderStatus)}`}
                    >
                      {(order.orderStatus || "pending")
                        .charAt(0)
                        .toUpperCase() +
                        (order.orderStatus || "pending").slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {paymentBanner ? (
          <div
            className={`mb-6 rounded-3xl border px-5 py-4 text-sm shadow-sm md:px-6 ${paymentBanner.tone}`}
          >
            <p className="font-semibold">{paymentBanner.title}</p>
            <p className="mt-1 leading-6">{paymentBanner.message}</p>
          </div>
        ) : null}

        <div className="mb-6 rounded-[28px] border border-black/5 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                Order Status
              </p>
              <h2 className="mt-1 text-xl font-semibold text-black">
                Track progress from placement to delivery
              </h2>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
              Delivery window: {estimatedDeliveryLabel}
            </span>
          </div>

          <div className="relative mt-8">
            <div className="absolute left-8 right-8 top-5 hidden h-1 rounded-full bg-gray-200 md:block">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{
                  width: (() => {
                    if (order.orderStatus === "cancelled") return "0%";
                    if (order.orderStatus === "returned") return "100%";
                    const currentIndex = ORDER_PROGRESS_STATUSES.indexOf(
                      order.orderStatus,
                    );
                    if (currentIndex <= 0) return "0%";
                    const maxIndex = Math.max(
                      1,
                      ORDER_PROGRESS_STATUSES.length - 1,
                    );
                    return `${(currentIndex / maxIndex) * 100}%`;
                  })(),
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {[
                { status: "pending", label: "Placed", Icon: FaCheckCircle },
                {
                  status: "confirmed",
                  label: "Confirmed",
                  Icon: FaCheckCircle,
                },
                { status: "processing", label: "Processing", Icon: FiClock },
                { status: "shipped", label: "Shipped", Icon: FaTruck },
                { status: "delivered", label: "Delivered", Icon: FiPackage },
              ].map((step, index) => {
                const currentIndex = ORDER_PROGRESS_STATUSES.indexOf(
                  order.orderStatus,
                );
                const isActive =
                  order.orderStatus === "cancelled"
                    ? false
                    : order.orderStatus === "returned"
                      ? true
                      : index <= currentIndex;
                const IconComponent = step.Icon;

                return (
                  <div key={step.status} className="text-center">
                    <div
                      className={`relative z-10 mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full shadow-sm ${
                        isActive ? "bg-green-500" : "bg-gray-200"
                      }`}
                    >
                      <IconComponent
                        className={`h-4 w-4 ${isActive ? "text-white" : "text-gray-400"}`}
                      />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-black">
                      {step.label}
                    </span>
                    <p className="mt-1 text-xs text-gray-500">
                      {step.status === "pending"
                        ? formatDate(order.createdAt)
                        : "Pending update"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-3 border-b border-gray-100 pb-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
                    <FaReceipt className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Order Summary
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-black">
                      {orderItems.length} item
                      {orderItems.length === 1 ? "" : "s"} in this order
                    </h2>
                  </div>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
                  Order #{order.orderNumber}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {orderItems.map((item, index) => {
                  const displayColor = getOrderItemColorSwatch(item);
                  const variantLines = getOrderItemVariantLines(item);
                  const product =
                    item?.product && typeof item.product === "object"
                      ? item.product
                      : null;
                  const title = item.title || product?.title || "Product";
                  const image = resolveImageValue(
                    item.image || product?.images?.[0] || product?.image || "",
                  );
                  const quantity = Number(item.quantity || 1);
                  const unitPrice = getOrderItemUnitPrice(item);
                  const itemTotal = getOrderItemLineTotal(item);

                  return (
                    <div
                      key={index}
                      className="flex gap-4 rounded-2xl border border-gray-100 bg-[#fafafa] p-4"
                    >
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-gray-100">
                        {image ? (
                          <ProductImage
                            src={image}
                            alt={title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <FiPackage className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">
                              {title}
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                              <span className="rounded-full bg-white px-2.5 py-1">
                                Qty: {quantity}
                              </span>
                              {variantLines.map((line) => (
                                <span
                                  key={`${title}-${line}`}
                                  className="rounded-full bg-white px-2.5 py-1"
                                >
                                  {line}
                                </span>
                              ))}
                              {displayColor ? (
                                <span className="inline-flex items-center rounded-full bg-white p-1">
                                  <span
                                    className="inline-block h-3 w-3 shrink-0 rounded-full border border-gray-300"
                                    style={{
                                      backgroundColor: displayColor,
                                      boxShadow:
                                        "inset 0 0 0 1px rgba(15,23,42,0.12)",
                                    }}
                                  />
                                </span>
                              ) : null}
                              {item.dimensions ? (
                                <span className="rounded-full bg-white px-2.5 py-1">
                                  Size: {item.dimensions}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="text-left md:text-right">
                            <p className="text-xs uppercase tracking-[0.16em] text-gray-400">
                              Line total
                            </p>
                            <p className="mt-1 text-lg font-bold text-black">
                              {formatCurrency(itemTotal)}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {formatCurrency(unitPrice)} each
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 space-y-3 border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3 text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-black">
                    {formatCurrency(order.subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3 text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <div className="text-right">
                    <p className="font-medium text-black">
                      {order.shippingFee > 0
                        ? formatCurrency(order.shippingFee)
                        : "FREE"}
                    </p>
                    <p className="text-[11px] leading-4 text-gray-500">
                      {shippingSourceLabel}
                    </p>
                  </div>
                </div>
                {order.discount > 0 ? (
                  <div className="flex items-center justify-between rounded-2xl bg-green-50 px-4 py-3 text-sm">
                    <span className="text-green-700">Discount</span>
                    <span className="font-medium text-green-700">
                      -{formatCurrency(order.discount)}
                    </span>
                  </div>
                ) : null}
                {order.couponCode ? (
                  <div className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3 text-sm">
                    <span className="text-gray-600">Coupon</span>
                    <span className="font-medium text-black">
                      {order.couponCode}
                    </span>
                  </div>
                ) : null}
                {order.tax > 0 ? (
                  <div className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3 text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium text-black">
                      {formatCurrency(order.tax)}
                    </span>
                  </div>
                ) : null}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-black">
                      Total
                    </span>
                    <span className="text-2xl font-bold text-black">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
                  <FaMapMarkerAlt className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Fulfillment Details
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-black">
                    Shipping and payment information
                  </h2>
                </div>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-black">
                    <FaUser className="h-4 w-4 text-gray-500" />
                    Shipping Address
                  </h3>
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    <p className="font-medium text-black">
                      {order.shippingAddress?.firstName}{" "}
                      {order.shippingAddress?.lastName}
                    </p>
                    {order.shippingAddress?.company ? (
                      <p className="flex items-center gap-2">
                        <FaBuilding className="h-3 w-3" />
                        {order.shippingAddress.company}
                      </p>
                    ) : null}
                    <p className="flex items-start gap-2">
                      <FaMapMarkerAlt className="mt-1 h-3 w-3 shrink-0" />
                      <span>
                        {order.shippingAddress?.address}
                        {order.shippingAddress?.apartment
                          ? `, ${order.shippingAddress.apartment}`
                          : ""}
                      </span>
                    </p>
                    <p>
                      {order.shippingAddress?.city},{" "}
                      {order.shippingAddress?.district}
                    </p>
                    <p>
                      {order.shippingAddress?.postalCode},{" "}
                      {order.shippingAddress?.country}
                    </p>
                    <p className="flex items-center gap-2 text-gray-500">
                      <FaTruck className="h-3 w-3" />
                      {shippingSourceLabel}
                    </p>
                    {order.shippingAddress?.phone ? (
                      <p className="flex items-center gap-2">
                        <FaPhone className="h-3 w-3" />
                        {order.shippingAddress.phone}
                      </p>
                    ) : null}
                    {order.shippingAddress?.email ? (
                      <p className="flex items-center gap-2">
                        <FaEnvelope className="h-3 w-3" />
                        {order.shippingAddress.email}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-[#fafafa] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-black">
                    <FaCreditCard className="h-4 w-4 text-gray-500" />
                    Payment Details
                  </h3>
                  <div className="mt-4 space-y-3 text-sm text-gray-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>Method</span>
                      <span className="font-medium text-black">
                        {formatPaymentMethodLabel(order.paymentMethod)}
                      </span>
                    </div>
                    {showPaymentStatus ? (
                      <div className="flex items-center justify-between gap-3">
                        <span>Status</span>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            order.paymentStatus === "completed"
                              ? "bg-green-100 text-green-700"
                              : order.paymentStatus === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {formatPaymentStatusLabel(order.paymentStatus)}
                        </span>
                      </div>
                    ) : null}
                    {!showPaymentStatus ? (
                      <div className="rounded-2xl border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-700">
                        Please keep the payable amount ready for delivery
                        confirmation.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="storefront-sticky-offset space-y-6 lg:sticky lg:self-start">
            <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm md:p-6">
              <h3 className="text-lg font-semibold text-black">
                Order Actions
              </h3>
              <div className="mt-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
                    <FaReceipt className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Order Number</p>
                    <p className="font-semibold text-black">
                      {order.orderNumber}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
                    <FaCalendarAlt className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Order Date and Time</p>
                    <p className="font-semibold text-black">
                      {formatDate(order.createdAt)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTime(order.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
                    <FiDollarSign className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Amount</p>
                    <p className="text-xl font-bold text-black">
                      {formatCurrency(order.total)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
                    <FaTruck className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Estimated Delivery</p>
                    <p className="font-semibold text-black">
                      {estimatedDeliveryLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  onClick={() => navigate(`/track-order/${order.orderNumber}`)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-900"
                >
                  <FiTruck className="h-4 w-4" />
                  Track This Order
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="inline-flex w-full items-center justify-center rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-black hover:text-black"
                >
                  Continue Shopping
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-black/5 bg-white p-5 shadow-sm md:p-6">
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">
                Need Help
              </h4>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                Use the tracking page for live shipment updates. If payment or
                delivery looks incorrect, review your account orders and contact
                support from there.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;
