/* eslint-disable no-unused-vars */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiCheckCircle,
  FiChevronLeft,
  FiCreditCard,
  FiMail,
  FiMapPin,
  FiPhone,
  FiShield,
  FiTag,
  FiTruck,
} from "react-icons/fi";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../hooks/useAuth";
import SearchableSelect from "../../components/SearchableSelect";
import usePublicSettings from "../../hooks/usePublicSettings";
import {
  buildDataLayerItem,
  getDataLayerCurrency,
  pushDataLayerEvent,
} from "../../utils/marketingDataLayer";
import { trackInitiateCheckout } from "../../utils/analyticsTracker";
import { fetchPublicSettings } from "../../utils/publicSettings";
import {
  clearLandingAttribution,
  getLandingAttribution,
} from "../../utils/landingAttribution";
import {
  getOrderItemColorSwatch,
  getOrderItemVariantLines,
} from "../../utils/orderPresentation";
import { getSelectedVariantSignature } from "../../utils/productVariants";
import {
  resolveLiveCartLineTotal,
  resolveLiveCartLineUnitPrice,
} from "../../utils/cartLinePricing";
import { BANGLADESH_DISTRICT_OPTIONS } from "../../utils/bangladeshLocations";

const baseUrl = import.meta.env.VITE_API_URL;
const COUPON_STORAGE_KEY = "appliedCoupon";
const ABANDONED_CHECKOUT_SESSION_KEY = "checkoutAbandonedSessionKey";

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

const normalizePaymentMethodValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return String(value.type || value.name || value.method || "").trim();
  }
  return "";
};

const isCashOnDeliveryMethod = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "cod" || normalized === "cash on delivery";
};

const isGatewayPaymentMethod = (method) =>
  ["sslcommerz", "bkash", "nagad"].includes(
    String(method?.channelType || "")
      .trim()
      .toLowerCase(),
  );

const normalizeBangladeshPhone = (value) => {
  const sanitized = String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");
  if (sanitized.startsWith("+88")) return `0${sanitized.slice(3)}`;
  if (sanitized.startsWith("880")) return `0${sanitized.slice(3)}`;
  if (!sanitized.startsWith("0")) return `0${sanitized}`;
  return sanitized;
};

const isValidBangladeshPhone = (value) => /^01[3-9]\d{8}$/.test(value);

const getOrCreateCheckoutSessionKey = () => {
  if (typeof window === "undefined") return "";

  const existing = String(
    window.localStorage.getItem(ABANDONED_CHECKOUT_SESSION_KEY) || "",
  ).trim();
  if (existing) return existing;

  const nextKey = `chk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(ABANDONED_CHECKOUT_SESSION_KEY, nextKey);
  return nextKey;
};

const ProductImage = ({ src, alt, className }) => {
  const [imageSrc, setImageSrc] = useState(getFullImageUrl(src));

  useEffect(() => {
    setImageSrc(getFullImageUrl(src));
  }, [src]);

  if (!imageSrc) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gray-100 text-xs text-gray-400`}
      >
        No image
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => setImageSrc("")}
    />
  );
};

const formatCurrency = (value) => `${Number(value || 0).toFixed(2)} TK`;
const inputClassName =
  "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-black";
const sectionCardClass =
  "rounded-[28px] border border-black/5 bg-white p-5 shadow-sm md:p-6";

const splitRecipientName = (value) => {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

const CheckOut = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartItems, clearCart, getCartSubtotal } = useCart();
  const { isLoggedIn, user } = useAuth();
  const { loaded: settingsLoaded } = usePublicSettings();

  const [loading, setLoading] = useState(false);
  const [isEstimatingShipping, setIsEstimatingShipping] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingEstimate, setShippingEstimate] = useState(null);
  const [locationOptions, setLocationOptions] = useState({
    cities: [],
    subCities: [],
  });
  const initiateCheckoutTrackedRef = useRef(false);
  const hasPlacedOrderRef = useRef(false);
  const hasCapturedAbandonedRef = useRef(false);
  const handledGatewayReturnRef = useRef(false);
  const checkoutSnapshotRef = useRef({
    cartItems: [],
    formData: {},
    subtotal: 0,
    total: 0,
  });
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: user?.email || "",
    phone: user?.phone || user?.originalPhone || "",
    alternativePhone: "",
    address: "",
    city: "",
    subCity: "",
    district: "",
    postalCode: "",
    country: "Bangladesh",
    notes: "",
    agreeTerms: false,
  });
  const [selectedAddressId, setSelectedAddressId] = useState("");

  const subtotal = getCartSubtotal();
  const totalUnits = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0),
    [cartItems],
  );
  const savedAddresses = useMemo(
    () => (Array.isArray(user?.addressBook) ? user.addressBook : []),
    [user?.addressBook],
  );
  const selectedPaymentMethod = useMemo(
    () =>
      paymentMethods.find(
        (method) =>
          String(method?._id || "") === String(selectedPaymentMethodId || ""),
      ) || null,
    [paymentMethods, selectedPaymentMethodId],
  );
  const paymentMethodValue = normalizePaymentMethodValue(selectedPaymentMethod);
  const paymentMethodChannel = String(
    selectedPaymentMethod?.channelType || "manual",
  ).toLowerCase();
  const selectedPaymentIsGateway = isGatewayPaymentMethod(
    selectedPaymentMethod,
  );
  const hasSelectedDistrict = Boolean(String(formData.district || "").trim());
  const requiresTransactionProof = !selectedPaymentMethod
    ? false
    : selectedPaymentMethod?.requiresTransactionProof === undefined
      ? true
      : Boolean(selectedPaymentMethod?.requiresTransactionProof);
  const selectedPaymentAccount = String(
    selectedPaymentMethod?.accountNo || "",
  ).trim();
  const shippingMeta = shippingEstimate?.shippingMeta || null;

  const discount = Math.min(
    Number(appliedCoupon?.discount || 0),
    Number(subtotal || 0),
  );
  const isFreeShippingCoupon = Boolean(appliedCoupon?.freeShipping);
  const effectiveShippingFee = isFreeShippingCoupon ? 0 : shippingFee;
  const total = Math.max(subtotal + effectiveShippingFee - discount, 0);
  const shippingFeeStatusLabel = isFreeShippingCoupon
    ? "FREE"
    : shippingEstimate
      ? formatCurrency(shippingFee)
      : hasSelectedDistrict
        ? isEstimatingShipping
          ? "Calculating..."
          : "Pending"
        : "Select district";
  const shippingSourceLabel = isFreeShippingCoupon
    ? shippingMeta?.sourceLabel ||
      (hasSelectedDistrict
        ? isEstimatingShipping
          ? "Calculating shipping from zone..."
          : "Shipping calculated from zone"
        : "Select district to calculate shipping")
    : shippingMeta?.sourceLabel ||
      (hasSelectedDistrict
        ? isEstimatingShipping
          ? "Calculating shipping from zone..."
          : "Shipping calculated from zone"
        : "Select district to calculate shipping");
  const paymentActionLabel = selectedPaymentIsGateway
    ? "Proceed to Payment"
    : "Place Order";

  const getItemData = (item) => {
    const product = typeof item.product === "object" ? item.product : null;
    const selectedVariants = Array.isArray(item.selectedVariants)
      ? item.selectedVariants
      : [];
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

  const getDataLayerItems = useCallback(
    () =>
      cartItems
        .map((item) => {
          const itemData = getItemData(item);
          if (!itemData.productId) return null;
          return buildDataLayerItem({
            productId: itemData.productId,
            title: itemData.title,
            price: itemData.price,
            quantity: itemData.quantity,
            variationLabel: itemData.variationLabel,
          });
        })
        .filter(Boolean),
    [cartItems],
  );

  const buildAbandonedPayload = useCallback(() => {
    const snapshot = checkoutSnapshotRef.current || {};
    const snapshotCartItems = Array.isArray(snapshot.cartItems)
      ? snapshot.cartItems
      : [];
    const snapshotFormData = snapshot.formData || {};
    const snapshotSubtotal = Number(snapshot.subtotal || 0);
    const snapshotTotal = Number(snapshot.total || 0);
    const attribution = getLandingAttribution();
    const safePhone = normalizeBangladeshPhone(snapshotFormData.phone);

    return {
      sessionKey: getOrCreateCheckoutSessionKey(),
      source: attribution?.source || "checkout",
      landingPageSlug: attribution?.slug || "",
      customer: {
        name: `${String(snapshotFormData.firstName || "").trim()} ${String(snapshotFormData.lastName || "").trim()}`.trim(),
        email: String(snapshotFormData.email || "").trim(),
        phone: String(safePhone || "").trim(),
        alternativePhone: String(
          snapshotFormData.alternativePhone || "",
        ).trim(),
        address: String(snapshotFormData.address || "").trim(),
        city: String(snapshotFormData.city || "").trim(),
        subCity: String(snapshotFormData.subCity || "").trim(),
        district: String(snapshotFormData.district || "").trim(),
        notes: String(snapshotFormData.notes || "").trim(),
      },
      items: snapshotCartItems.map((item) => {
        const itemData = getItemData(item);
        return {
          productId: itemData.productId,
          quantity: itemData.quantity,
          price: Number(itemData.price || 0),
          title: itemData.title,
          image: itemData.image,
          variationId: itemData.variationId || "",
          variationLabel: itemData.variationLabel || "",
          selectedVariants: itemData.selectedVariants || [],
        };
      }),
      subtotal: snapshotSubtotal,
      total: snapshotTotal,
    };
  }, []);

  const captureAbandonedCheckout = useCallback(
    async ({ useBeacon = false } = {}) => {
      if (hasPlacedOrderRef.current || hasCapturedAbandonedRef.current) return;
      if (
        !Array.isArray(checkoutSnapshotRef.current?.cartItems) ||
        !checkoutSnapshotRef.current.cartItems.length
      )
        return;

      const payload = buildAbandonedPayload();
      if (
        !payload.sessionKey ||
        !Array.isArray(payload.items) ||
        !payload.items.length
      )
        return;

      hasCapturedAbandonedRef.current = true;

      try {
        if (
          useBeacon &&
          typeof navigator !== "undefined" &&
          typeof navigator.sendBeacon === "function"
        ) {
          const blob = new Blob([JSON.stringify(payload)], {
            type: "application/json",
          });
          navigator.sendBeacon(`${baseUrl}/abandoned-orders/capture`, blob);
          return;
        }

        await axios.post(`${baseUrl}/abandoned-orders/capture`, payload, {
          meta: {
            skipGlobalButtonLoading: true,
            skipGlobalLoadingToast: true,
          },
        });
      } catch (_error) {
        hasCapturedAbandonedRef.current = false;
      }
    },
    [buildAbandonedPayload],
  );

  const getShippingItemsPayload = useCallback(
    () =>
      cartItems
        .map((item) => {
          const product =
            typeof item.product === "object" ? item.product : null;
          const productId = item.productId || product?._id || item.product;
          if (!productId) return null;

          return {
            productId,
            quantity: Number(item.quantity || 1),
            price: resolveLiveCartLineUnitPrice(item),
          };
        })
        .filter(Boolean),
    [cartItems],
  );

  const clearAppliedCoupon = useCallback((showToast = false) => {
    setAppliedCoupon(null);
    setCouponCode("");
    localStorage.removeItem(COUPON_STORAGE_KEY);

    if (showToast) {
      toast.success("Coupon removed");
    }
  }, []);

  const applyCoupon = useCallback(
    async (inputCode = couponCode, silent = false) => {
      const normalizedCode = String(inputCode || "")
        .trim()
        .toUpperCase();

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
            const product =
              typeof item.product === "object" ? item.product : null;
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
          offerType: String(
            response.data?.offerType || "discount",
          ).toLowerCase(),
          freeShipping: Boolean(response.data?.freeShipping),
          discount: discountValue,
          finalAmount: Number(
            response.data?.finalAmount || subtotal - discountValue,
          ),
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
          toast.error(
            error.response?.data?.message || "Failed to apply coupon",
          );
        }
        return false;
      } finally {
        setIsApplyingCoupon(false);
      }
    },
    [cartItems, couponCode, subtotal],
  );

  const estimateShipping = useCallback(
    async (addressData = formData, silent = true) => {
      if (cartItems.length === 0) {
        setShippingFee(0);
        setShippingEstimate(null);
        return { success: true, shippingFee: 0, shippingMeta: {} };
      }

      setIsEstimatingShipping(true);
      try {
        const response = await axios.post(`${baseUrl}/shipping/estimate`, {
          items: getShippingItemsPayload(),
          city: String(addressData?.city || "").trim(),
          district: String(addressData?.district || "").trim(),
          country: String(addressData?.country || "Bangladesh").trim(),
        });

        if (!response.data?.success) {
          throw new Error(response.data?.message || "Shipping estimate failed");
        }

        const fee = Number(response.data.shippingFee || 0);
        setShippingFee(fee);
        setShippingEstimate(response.data);

        return {
          success: true,
          shippingFee: fee,
          shippingMeta: {
            ...(response.data.shippingMeta || {}),
            breakdown:
              response.data.shippingMeta?.breakdown ||
              response.data.breakdown ||
              [],
            estimatedMinDays:
              response.data.shippingMeta?.estimatedMinDays ||
              response.data.estimatedMinDays ||
              0,
            estimatedMaxDays:
              response.data.shippingMeta?.estimatedMaxDays ||
              response.data.estimatedMaxDays ||
              0,
            destination: response.data.destination || {},
          },
        };
      } catch (error) {
        setShippingFee(0);
        setShippingEstimate(null);
        if (!silent) {
          toast.error(
            error.response?.data?.message || "Failed to estimate shipping fee",
          );
        }
        return { success: false, shippingFee: 0, shippingMeta: {} };
      } finally {
        setIsEstimatingShipping(false);
      }
    },
    [cartItems.length, formData, getShippingItemsPayload],
  );

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  useEffect(() => {
    if (handledGatewayReturnRef.current) return;

    const searchParams = new URLSearchParams(location.search || "");
    const paymentResult = String(searchParams.get("payment") || "")
      .trim()
      .toLowerCase();
    const returnedOrderId = String(searchParams.get("orderId") || "").trim();

    if (!returnedOrderId || !["failed", "cancel"].includes(paymentResult)) {
      return;
    }

    handledGatewayReturnRef.current = true;

    try {
      const guestOrders = JSON.parse(
        localStorage.getItem("guestOrders") || "[]",
      );
      const filteredOrders = guestOrders.filter(
        (guestOrder) => String(guestOrder?._id || "") !== returnedOrderId,
      );
      localStorage.setItem("guestOrders", JSON.stringify(filteredOrders));

      const lastOrder = localStorage.getItem("lastOrder");
      if (lastOrder) {
        const parsedLastOrder = JSON.parse(lastOrder);
        if (String(parsedLastOrder?._id || "") === returnedOrderId) {
          localStorage.removeItem("lastOrder");
        }
      }
    } catch (error) {
      console.error("Failed to clear failed gateway order cache:", error);
    }

    toast.error(
      paymentResult === "cancel"
        ? "Payment was cancelled. Please try again."
        : "Payment failed. Please try again from checkout.",
    );
  }, [location.search]);

  useEffect(() => {
    if (!requiresTransactionProof && transactionId) {
      setTransactionId("");
    }
  }, [requiresTransactionProof, transactionId]);

  useEffect(() => {
    let mounted = true;
    const loadLocationOptions = async () => {
      try {
        const settings = await fetchPublicSettings();
        if (!mounted) return;

        const cityOptions = Array.isArray(settings?.locations?.cityOptions)
          ? settings.locations.cityOptions
          : [];
        const subCityOptions = Array.isArray(
          settings?.locations?.subCityOptions,
        )
          ? settings.locations.subCityOptions
          : [];

        setLocationOptions({
          cities: cityOptions,
          subCities: subCityOptions,
        });
      } catch (_error) {
        if (!mounted) return;
        setLocationOptions({
          cities: [],
          subCities: [],
        });
      }
    };

    loadLocationOptions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!cartItems.length) {
      hasCapturedAbandonedRef.current = false;
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(ABANDONED_CHECKOUT_SESSION_KEY);
      }
      return;
    }

    getOrCreateCheckoutSessionKey();
  }, [cartItems.length]);

  useEffect(() => {
    checkoutSnapshotRef.current = {
      cartItems,
      formData,
      subtotal,
      total,
    };
  }, [cartItems, formData, subtotal, total]);

  const applySavedAddress = useCallback((address) => {
    if (!address) return;
    const nameParts = splitRecipientName(address.recipientName);

    setSelectedAddressId(String(address._id || ""));
    setFormData((current) => ({
      ...current,
      firstName: nameParts.firstName || current.firstName,
      lastName: nameParts.lastName,
      phone: String(address.phone || current.phone || ""),
      alternativePhone: String(address.alternativePhone || ""),
      address: String(address.address || ""),
      city: String(address.city || ""),
      subCity: String(address.subCity || ""),
      district: String(address.district || ""),
      postalCode: String(address.postalCode || ""),
      country: String(address.country || "Bangladesh"),
      notes: String(address.deliveryNotes || current.notes || ""),
    }));
  }, []);

  useEffect(() => {
    if (!isLoggedIn || !savedAddresses.length) return;
    if (selectedAddressId) return;
    if (
      formData.address ||
      formData.city ||
      formData.district ||
      formData.postalCode
    )
      return;

    const defaultAddress =
      savedAddresses.find((address) => address?.isDefault) || savedAddresses[0];

    if (defaultAddress) {
      applySavedAddress(defaultAddress);
    }
  }, [
    applySavedAddress,
    formData.address,
    formData.city,
    formData.district,
    formData.postalCode,
    isLoggedIn,
    savedAddresses,
    selectedAddressId,
  ]);

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

  useEffect(() => {
    if (cartItems.length === 0 && appliedCoupon) {
      clearAppliedCoupon(false);
    }
  }, [appliedCoupon, cartItems.length, clearAppliedCoupon]);

  useEffect(() => {
    if (cartItems.length === 0) {
      setShippingFee(0);
      setShippingEstimate(null);
      return;
    }

    if (!String(formData.district || "").trim()) {
      setShippingFee(0);
      setShippingEstimate(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      estimateShipping(formData, true);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [cartItems, estimateShipping, formData]);

  useEffect(() => {
    if (!settingsLoaded) {
      initiateCheckoutTrackedRef.current = false;
      return undefined;
    }

    if (cartItems.length === 0) {
      initiateCheckoutTrackedRef.current = false;
      return undefined;
    }

    if (initiateCheckoutTrackedRef.current) return;

    const items = getDataLayerItems();
    if (!items.length || typeof window === "undefined") return undefined;

    const frame = window.requestAnimationFrame(() => {
      trackInitiateCheckout({
        ecommerce: {
          currency: getDataLayerCurrency(),
          value: Number(total || 0),
          coupon: appliedCoupon?.code || undefined,
          items,
        },
      });

      initiateCheckoutTrackedRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    appliedCoupon?.code,
    cartItems.length,
    getDataLayerItems,
    settingsLoaded,
    total,
  ]);

  useEffect(() => {
    const beforeUnloadHandler = () => {
      captureAbandonedCheckout({ useBeacon: true });
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    };
  }, [captureAbandonedCheckout]);

  useEffect(
    () => () => {
      captureAbandonedCheckout();
    },
    [captureAbandonedCheckout],
  );

  const fetchPaymentMethods = async () => {
    try {
      const response = await axios.get(`${baseUrl}/auth/payment-methods`);
      const methods = (
        Array.isArray(response.data) ? response.data : []
      ).filter((method) =>
        ["manual", "cod", "sslcommerz", "bkash", "nagad"].includes(
          String(method?.channelType || "manual")
            .trim()
            .toLowerCase(),
        ),
      );
      setPaymentMethods(methods);
      setSelectedPaymentMethodId((currentId) => {
        const hasCurrentMethod = methods.some(
          (method) => String(method?._id || "") === String(currentId || ""),
        );

        if (hasCurrentMethod) {
          return String(currentId || "");
        }

        return String(methods[0]?._id || "");
      });
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      setPaymentMethods([]);
      setSelectedPaymentMethodId("");
      toast.error("Failed to load payment methods");
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const districtOptions = useMemo(
    () =>
      BANGLADESH_DISTRICT_OPTIONS.map((district) => ({
        value: district,
        label: district,
      })),
    [],
  );

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    const resolvedMethod = selectedPaymentMethod || paymentMethods[0] || null;
    const resolvedPaymentMethodValue =
      paymentMethodValue || normalizePaymentMethodValue(resolvedMethod);
    const resolvedRequiresProof =
      resolvedMethod?.requiresTransactionProof === undefined
        ? true
        : Boolean(resolvedMethod?.requiresTransactionProof);
    const resolvedChannelType = String(
      resolvedMethod?.channelType || "manual",
    ).toLowerCase();
    const resolvedAccountNo = String(
      resolvedMethod?.accountNo || resolvedMethod?.accountNumber || "",
    ).trim();
    const normalizedPhone = normalizeBangladeshPhone(formData.phone);

    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.address ||
      !formData.city ||
      !formData.district ||
      !formData.postalCode ||
      !formData.phone ||
      !formData.email
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!isValidBangladeshPhone(normalizedPhone)) {
      toast.error("Please enter a valid Bangladesh phone number (01XXXXXXXXX)");
      return;
    }

    if (!resolvedPaymentMethodValue) {
      toast.error("Please select a payment method");
      return;
    }

    if (resolvedRequiresProof && !transactionId.trim()) {
      toast.error("Transaction ID is required");
      return;
    }

    if (!formData.agreeTerms) {
      toast.error("Please accept terms and conditions");
      return;
    }

    try {
      setLoading(true);

      if (appliedCoupon?.code) {
        const isCouponValid = await applyCoupon(appliedCoupon.code, true);
        if (!isCouponValid) {
          clearAppliedCoupon(false);
          toast.error("Applied coupon is no longer valid");
          return;
        }
      }

      const shippingResult = await estimateShipping(formData, false);

      if (!shippingResult.success) {
        return;
      }

      const estimatedShippingFee = Number(shippingResult.shippingFee || 0);
      const finalShippingFee = isFreeShippingCoupon ? 0 : estimatedShippingFee;
      const finalTotal = Math.max(subtotal + finalShippingFee - discount, 0);
      const attribution = getLandingAttribution();

      const payload = {
        shippingAddress: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: normalizedPhone,
          alternativePhone: String(formData.alternativePhone || "").trim(),
          address: formData.address,
          city: formData.city,
          subCity: String(formData.subCity || "").trim(),
          district: formData.district,
          postalCode: formData.postalCode,
          country: "Bangladesh",
          notes: formData.notes,
        },
        items: cartItems.map((item) => {
          const itemData = getItemData(item);
          return {
            product: itemData.productId,
            productId: itemData.productId,
            quantity: itemData.quantity,
            price: itemData.price,
            variationId: itemData.variationId || "",
            variationLabel: itemData.variationLabel || "",
            selectedVariants: itemData.selectedVariants || [],
            color: itemData.color,
            dimensions: itemData.dimensions,
            title: itemData.title,
          };
        }),
        subtotal,
        shippingFee: finalShippingFee,
        shippingMeta: shippingResult.shippingMeta,
        discount,
        total: finalTotal,
        couponCode: appliedCoupon?.code || "",
        source: attribution?.source || "shop",
        landingPageSlug: attribution?.slug || "",
        paymentMethodId: resolvedMethod?._id || "",
        paymentMethod: resolvedPaymentMethodValue,
        paymentDetails: {
          method: resolvedPaymentMethodValue,
          accountNo: resolvedAccountNo,
          transactionId: resolvedRequiresProof ? transactionId.trim() : "",
          sentTo: resolvedAccountNo,
          meta: {
            channelType: resolvedChannelType,
          },
        },
      };

      const endpoint = isLoggedIn ? "/orders" : "/orders/guest-checkout";
      const token = localStorage.getItem("token");

      const response = await axios.post(`${baseUrl}${endpoint}`, payload, {
        headers:
          isLoggedIn && token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || "Order failed");
      }

      const order = response.data.order;
      const paymentRedirectUrl = String(
        response.data?.paymentRedirectUrl || "",
      ).trim();
      hasPlacedOrderRef.current = true;

      if (!isLoggedIn && order) {
        const previous = JSON.parse(
          localStorage.getItem("guestOrders") || "[]",
        );
        localStorage.setItem(
          "guestOrders",
          JSON.stringify([order, ...previous]),
        );
        localStorage.setItem("lastOrder", JSON.stringify(order));
      }

      if (paymentRedirectUrl) {
        toast.success("Redirecting to payment gateway...");
        window.location.href = paymentRedirectUrl;
        return;
      }

      await clearCart();
      localStorage.removeItem(COUPON_STORAGE_KEY);
      localStorage.removeItem(ABANDONED_CHECKOUT_SESSION_KEY);
      setAppliedCoupon(null);
      clearLandingAttribution();

      toast.success("Order placed successfully");
      navigate("/thank-you", { state: { orderId: order?._id, order } });
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error(error.response?.data?.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  if (cartItems.length === 0) {
    return (
      <section className="min-h-screen bg-[#f5f5f5] py-10">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
            <FiCreditCard className="h-7 w-7 text-gray-400" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold text-black">
            No products available for checkout
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
            Add products to your cart first, then return here to complete the
            order.
          </p>
          <button
            onClick={() => navigate("/shop")}
            className="mt-6 inline-flex items-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-900"
          >
            Go to Shop
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-[#f5f5f5] py-8 md:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate("/cart")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-black"
        >
          <FiChevronLeft />
          Back to cart
        </button>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
          <form onSubmit={handleSubmitOrder} className="space-y-6">
            <div className={sectionCardClass}>
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
                  <FiMail className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Contact Details
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-black">
                    Customer information
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="First name*"
                  className={inputClassName}
                />
                <input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="Last name*"
                  className={inputClassName}
                />
                <div className="relative">
                  <FiMail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Email*"
                    className={`${inputClassName} pl-11`}
                  />
                </div>
                <div className="relative">
                  <FiPhone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Phone*"
                    className={`${inputClassName} pl-11`}
                  />
                </div>
                <input
                  name="alternativePhone"
                  value={formData.alternativePhone}
                  onChange={handleInputChange}
                  placeholder="Alternative phone (optional)"
                  className={`md:col-span-2 ${inputClassName}`}
                />
              </div>
            </div>

            <div className={sectionCardClass}>
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
                  <FiMapPin className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Delivery Address
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-black">
                    Shipping destination
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Shipping estimate updates automatically as you change
                    location.
                  </p>
                </div>
              </div>

              {isLoggedIn && savedAddresses.length > 0 ? (
                <div className="mb-5 rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex flex-col gap-2 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-black">
                        Saved address book
                      </p>
                      <p className="text-xs text-gray-500">
                        Pick a saved address to fill this checkout instantly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.setItem(
                          "dashboardActiveTab",
                          "my-addresses",
                        );
                        navigate("/dashboard");
                      }}
                      className="inline-flex rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-black transition hover:border-black"
                    >
                      Manage Addresses
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {savedAddresses.map((address) => {
                      const isSelected =
                        String(selectedAddressId || "") ===
                        String(address?._id || "");

                      return (
                        <button
                          key={address._id}
                          type="button"
                          onClick={() => applySavedAddress(address)}
                          className={`rounded-[22px] border p-4 text-left transition ${
                            isSelected
                              ? "border-black bg-white shadow-sm"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-black px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                              {address.label || "Address"}
                            </span>
                            {address.isDefault ? (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                Default
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 text-sm font-semibold text-black">
                            {address.recipientName}
                          </p>
                          <p className="mt-1 text-xs text-gray-600">
                            {address.phone}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-gray-500">
                            {[
                              address.address,
                              address.subCity,
                              address.city,
                              address.district,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <input
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Address*"
                className={inputClassName}
              />

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                <input
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="City*"
                  list="checkout-city-options"
                  className={inputClassName}
                />
                <input
                  name="subCity"
                  value={formData.subCity}
                  onChange={handleInputChange}
                  placeholder="Sub-city (optional)"
                  list="checkout-subcity-options"
                  className={inputClassName}
                />
                <SearchableSelect
                  value={formData.district}
                  onChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      district: value,
                    }))
                  }
                  options={
                    formData.district &&
                    !BANGLADESH_DISTRICT_OPTIONS.includes(formData.district)
                      ? [
                          {
                            value: formData.district,
                            label: formData.district,
                          },
                          ...districtOptions,
                        ]
                      : districtOptions
                  }
                  placeholder="Select district*"
                  className="w-full"
                  buttonClassName="min-h-[52px] rounded-[20px] border-black/8 px-4 py-3 text-sm text-gray-900 hover:border-black"
                  menuClassName="rounded-[20px]"
                />
                <input
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleInputChange}
                  placeholder="Postal code*"
                  className={inputClassName}
                />
              </div>

              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={4}
                placeholder="Order notes (optional)"
                className={`mt-4 ${inputClassName}`}
              />
            </div>

            <datalist id="checkout-city-options">
              {locationOptions.cities.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
            <datalist id="checkout-subcity-options">
              {locationOptions.subCities.map((subCity) => (
                <option key={subCity} value={subCity} />
              ))}
            </datalist>

            <div className={sectionCardClass}>
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100">
                  <FiCreditCard className="h-5 w-5 text-black" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Payment
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-black">
                    Select payment method
                  </h2>
                </div>
              </div>

              <div className="space-y-3">
                {paymentMethods.map((method) => {
                  const methodValue = normalizePaymentMethodValue(method);
                  const methodIsCod = isCashOnDeliveryMethod(methodValue);
                  const methodIsGateway = isGatewayPaymentMethod(method);
                  const accountValue = String(
                    method?.accountNo || method?.accountNumber || "",
                  ).trim();
                  const methodRequiresProof =
                    method?.requiresTransactionProof === undefined
                      ? true
                      : Boolean(method?.requiresTransactionProof);

                  return (
                    <label
                      key={method._id}
                      className={`block cursor-pointer rounded-3xl border p-4 transition ${
                        selectedPaymentMethodId === String(method?._id || "")
                          ? "border-black bg-[#f7f7f7] shadow-sm"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={
                          selectedPaymentMethodId === String(method?._id || "")
                        }
                        onChange={() => {
                          setSelectedPaymentMethodId(String(method?._id || ""));
                          const nextMethod =
                            normalizePaymentMethodValue(method);
                          pushDataLayerEvent("add_payment_info", {
                            ecommerce: {
                              currency: getDataLayerCurrency(),
                              value: Number(total || 0),
                              payment_type: nextMethod || undefined,
                              items: getDataLayerItems(),
                            },
                          });
                        }}
                        className="sr-only"
                      />
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-gray-300">
                            {selectedPaymentMethodId ===
                            String(method?._id || "") ? (
                              <span className="h-2.5 w-2.5 rounded-full bg-black" />
                            ) : null}
                          </span>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-black">
                                {methodValue}
                              </span>
                              {methodIsCod ? (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                                  COD
                                </span>
                              ) : null}
                              {methodIsGateway ? (
                                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                                  Gateway
                                </span>
                              ) : null}
                              {methodRequiresProof ? (
                                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                                  Transaction ID
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs leading-5 text-gray-500">
                              {methodIsCod
                                ? "Pay when your order is delivered."
                                : methodIsGateway
                                  ? `Continue to ${methodValue || "secure"} checkout after placing the order.`
                                  : accountValue
                                    ? `Send payment to: ${accountValue}`
                                    : "Manual payment instructions will appear below."}
                            </p>
                            <p className="text-xs leading-5 text-gray-500">
                              Shipping is calculated from the selected district
                              and locked when the order is placed.
                            </p>
                            {method?.instructions ? (
                              <p className="text-xs leading-5 text-gray-500">
                                {method.instructions}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                          <FiCreditCard className="h-4 w-4 text-black" />
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {paymentMethods.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No payment method is available right now.
                </div>
              ) : null}

              {selectedPaymentMethod ? (
                requiresTransactionProof ? (
                  <div className="mt-4 space-y-2">
                    <input
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="Transaction ID*"
                      className={inputClassName}
                    />
                    <p className="text-xs leading-5 text-gray-500">
                      Add the wallet or bank transaction reference so admin can
                      verify this payment quickly.
                    </p>
                  </div>
                ) : selectedPaymentIsGateway ? (
                  <p className="mt-4 rounded-[22px] border border-sky-100 bg-sky-50 p-4 text-xs leading-5 text-sky-700">
                    You will be redirected to the payment gateway after placing
                    the order. Once payment is confirmed, admin can track it
                    from order management.
                  </p>
                ) : null
              ) : null}
            </div>

            <div className={sectionCardClass}>
              <div className="rounded-[22px] border border-gray-200 bg-gray-50 px-4 py-3.5">
                <label className="flex items-start gap-3 text-sm leading-6 text-gray-700">
                  <input
                    type="checkbox"
                    name="agreeTerms"
                    checked={formData.agreeTerms}
                    onChange={handleInputChange}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-black"
                  />
                  <span>
                    I agree to the{" "}
                    <Link
                      to="/policy/terms"
                      className="font-semibold text-black underline underline-offset-4 decoration-2 decoration-gray-400 transition hover:decoration-black"
                    >
                      Terms & Conditions
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="/policy/privacy"
                      className="font-semibold text-black underline underline-offset-4 decoration-2 decoration-gray-400 transition hover:decoration-black"
                    >
                      Privacy Policy
                    </Link>{" "}
                    and confirm that the shipping address is correct.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || paymentMethods.length === 0}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Processing...
                  </>
                ) : (
                  paymentActionLabel
                )}
              </button>
            </div>
          </form>

          <div className="storefront-sticky-offset space-y-4 lg:sticky lg:self-start">
            <div className={sectionCardClass}>
              <h3 className="text-xl font-semibold text-gray-900">
                Order Summary
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Review live pricing before submission.
              </p>

              <div className="mt-5 space-y-3 max-h-108 overflow-auto pr-1">
                {cartItems.map((item) => {
                  const itemData = getItemData(item);
                  const variantLines = getOrderItemVariantLines(itemData);
                  const colorSwatch = getOrderItemColorSwatch(itemData);
                  return (
                    <div
                      key={`${itemData.productId}-${itemData.variationId || ""}-${itemData.color || ""}-${itemData.dimensions || ""}-${itemData.selectedVariantSignature || ""}`}
                      className="flex gap-3 rounded-2xl border border-gray-100 bg-[#fafafa] p-3"
                    >
                      <ProductImage
                        src={itemData.image}
                        alt={itemData.title}
                        className="h-16 w-16 rounded-xl object-cover bg-gray-100"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-gray-900">
                          {itemData.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                          <span>Qty: {itemData.quantity}</span>
                          {variantLines.length > 0 ? (
                            variantLines.map((line) => (
                              <span key={`${itemData.productId}-${line}`}>
                                {line}
                              </span>
                            ))
                          ) : itemData.variationLabel ? (
                            <span>Variant: {itemData.variationLabel}</span>
                          ) : null}
                          {colorSwatch ? (
                            <span className="inline-flex items-center rounded-full bg-gray-100 p-1">
                              <span
                                className="inline-block h-3 w-3 shrink-0 rounded-full border border-gray-300"
                                style={{
                                  backgroundColor: colorSwatch,
                                  boxShadow:
                                    "inset 0 0 0 1px rgba(15,23,42,0.12)",
                                }}
                              />
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(resolveLiveCartLineTotal(item))}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-black">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3">
                  <span className="text-gray-600">Shipping</span>
                  <div className="text-right">
                    <p className="font-medium text-black">
                      {shippingFeeStatusLabel}
                    </p>
                    <p className="text-[11px] leading-4 text-gray-500">
                      {shippingSourceLabel}
                    </p>
                  </div>
                </div>
                {isFreeShippingCoupon ? (
                  <div className="flex items-center justify-between rounded-2xl bg-green-50 px-4 py-3">
                    <span className="text-green-700">Free delivery offer</span>
                    <span className="font-medium text-green-700">Applied</span>
                  </div>
                ) : null}
                {shippingMeta?.estimatedMaxDays > 0 ? (
                  <div className="flex items-center justify-between rounded-2xl bg-[#fafafa] px-4 py-3">
                    <span className="text-gray-600">Estimated delivery</span>
                    <span className="font-medium text-black">
                      {shippingMeta.estimatedMinDays > 0
                        ? `${shippingMeta.estimatedMinDays}-${shippingMeta.estimatedMaxDays} days`
                        : `${shippingMeta.estimatedMaxDays} days`}
                    </span>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                    Coupon
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value)}
                      placeholder="Coupon code"
                      className="min-w-0 flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-black"
                    />
                    <button
                      type="button"
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
                        {appliedCoupon?.freeShipping
                          ? " with free delivery"
                          : ""}
                      </span>
                      <button
                        type="button"
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
                    <span className="font-medium text-green-700">
                      -{formatCurrency(discount)}
                    </span>
                  </div>
                ) : null}

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-black">
                      Total
                    </span>
                    <span className="text-2xl font-bold text-black">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CheckOut;
