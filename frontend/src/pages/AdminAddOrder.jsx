import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import {
  FiCheck,
  FiCreditCard,
  FiPackage,
  FiSearch,
  FiShoppingBag,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import SearchableSelect from "../components/SearchableSelect";
import { fetchPublicSettings } from "../utils/publicSettings";
import { BANGLADESH_DISTRICT_OPTIONS } from "../utils/bangladeshLocations";
import {
  getEffectiveProductPricing,
  getReadableVariantOptionLabel,
  normalizeProductVariantDefinitions,
  normalizeSelectedVariantsPayload,
} from "../utils/productVariants";

const baseUrl = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const roundMoney = (value) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const formatMoney = (value) =>
  `${roundMoney(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Tk`;

const qty = (value) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
};

const buildLineId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getFullImageUrl = (imagePath) => {
  const value = Array.isArray(imagePath) ? imagePath[0] : imagePath;
  if (!value) return "";
  if (
    String(value).startsWith("http://") ||
    String(value).startsWith("https://") ||
    String(value).startsWith("data:")
  ) {
    return value;
  }
  if (String(value).startsWith("/")) {
    return baseUrl ? `${baseUrl}${value}` : value;
  }
  return baseUrl
    ? `${baseUrl}/uploads/products/${value}`
    : `/uploads/products/${value}`;
};

const parseCustomerName = (value = "") => {
  const nameParts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: nameParts[0] || "",
    lastName: nameParts.slice(1).join(" "),
  };
};

const getBasePricingFromFields = (priceValue, salePriceValue = null) => {
  const regularPrice = Number(priceValue);
  const salePrice =
    salePriceValue === null ||
    salePriceValue === undefined ||
    salePriceValue === ""
      ? null
      : Number(salePriceValue);

  if (
    Number.isFinite(regularPrice) &&
    Number.isFinite(salePrice) &&
    regularPrice > salePrice &&
    salePrice >= 0
  ) {
    return {
      basePrice: roundMoney(salePrice),
      baseComparePrice: roundMoney(regularPrice),
      isTba: false,
    };
  }

  return {
    basePrice: roundMoney(Number.isFinite(regularPrice) ? regularPrice : 0),
    baseComparePrice: null,
    isTba: false,
  };
};

const getProductBasePricing = (product = {}) => {
  const priceType = String(product?.priceType || "single")
    .trim()
    .toLowerCase();
  if (priceType === "tba") {
    return { basePrice: 0, baseComparePrice: null, isTba: true };
  }

  return getBasePricingFromFields(
    product?.price,
    priceType === "best" ? product?.salePrice : null,
  );
};

const getActiveVariations = (product = {}) =>
  (Array.isArray(product?.variations) ? product.variations : [])
    .filter((entry) => entry?.isActive !== false)
    .map((entry) => ({ ...entry, _id: String(entry?._id || "") }))
    .filter((entry) => entry._id);

const getVariationBasePricing = (variation = {}) =>
  getBasePricingFromFields(variation?.price, variation?.salePrice);

const getVariationOptionValue = (definition = {}, option = {}) => {
  if (String(definition?.preset || "").toLowerCase() === "color") {
    return String(
      option?.colorHex || option?.value || option?.label || "",
    ).trim();
  }
  return String(option?.value || option?.label || "").trim();
};

const buildSelectedVariantFromOption = (definition = {}, option = {}) => ({
  name: definition.name,
  preset: definition.preset,
  label: option.label || option.value,
  value: option.value || option.label,
  colorHex:
    String(definition?.preset || "").toLowerCase() === "color"
      ? String(option?.colorHex || option?.value || option?.label || "").trim()
      : "",
  priceMode: option.priceMode || "default",
  price: option.price,
  comparePrice: option.comparePrice,
});

const buildVariantOptionLabel = (definition = {}, option = {}) => {
  const readableLabel = getReadableVariantOptionLabel({
    preset: definition?.preset,
    label: option?.label,
    value: option?.value,
    colorHex: option?.colorHex,
  });
  const priceMode = String(option?.priceMode || "default")
    .trim()
    .toLowerCase();
  const optionPrice = Number(option?.price);
  const optionComparePrice = Number(option?.comparePrice);

  if (priceMode === "compare" && Number.isFinite(optionPrice)) {
    if (
      Number.isFinite(optionComparePrice) &&
      optionComparePrice > optionPrice
    ) {
      return `${readableLabel} - +${formatMoney(optionPrice)} (was +${formatMoney(
        optionComparePrice,
      )})`;
    }
    return `${readableLabel} - +${formatMoney(optionPrice)}`;
  }

  if (priceMode === "direct" && Number.isFinite(optionPrice)) {
    return `${readableLabel} - +${formatMoney(optionPrice)}`;
  }

  return `${readableLabel} - No extra charge`;
};

const getOrderItemResolvedPricing = (item = {}) => {
  const product = item?.product || {};
  const activeVariations = getActiveVariations(product);
  const selectedVariation =
    activeVariations.find(
      (entry) => String(entry._id) === String(item?.variationId || ""),
    ) || null;
  const basePricing = selectedVariation
    ? getVariationBasePricing(selectedVariation)
    : getProductBasePricing(product);

  const pricing = basePricing.isTba
    ? {
        currentPrice: null,
        previousPrice: null,
        hasDiscount: false,
        isTba: true,
      }
    : {
        ...getEffectiveProductPricing({
          basePrice: basePricing.basePrice,
          baseComparePrice: basePricing.baseComparePrice,
          selectedVariants: normalizeSelectedVariantsPayload(
            item?.selectedVariants || [],
          ),
        }),
        isTba: false,
      };

  const previousPrice =
    pricing.previousPrice !== null &&
    Number(pricing.previousPrice || 0) > Number(pricing.currentPrice || 0)
      ? pricing.previousPrice
      : null;

  return {
    activeVariation: selectedVariation,
    currentPrice: pricing.currentPrice,
    previousPrice,
    hasDiscount: previousPrice !== null,
    isTba: Boolean(pricing.isTba),
  };
};

const buildInitialItem = (product = {}) => ({
  lineId: buildLineId(),
  productId: String(product?._id || product?.id || "").trim(),
  product,
  quantity: 1,
  variationId: "",
  selectedVariants: [],
});

const inputClassName =
  "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-black";

const selectClassName =
  "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-black";

const sectionClassName =
  "rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)] sm:p-6";

const createInitialCustomerState = () => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  alternativePhone: "",
  address: "",
  city: "",
  subCity: "",
  district: "",
  postalCode: "",
  country: "Bangladesh",
});

const createInitialOrderMetaState = () => ({
  adminNotes: "",
});

const AdminAddOrder = () => {
  const [customer, setCustomer] = useState(createInitialCustomerState);
  const [customerLookup, setCustomerLookup] = useState("");
  const [customerLookupLocked, setCustomerLookupLocked] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerResults, setCustomerResults] = useState([]);
  const [customerUserId, setCustomerUserId] = useState("");
  const [insights, setInsights] = useState(null);

  const [productQuery, setProductQuery] = useState("");
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productResults, setProductResults] = useState([]);

  const [items, setItems] = useState([]);
  const [locationOptions, setLocationOptions] = useState({
    cities: [],
    subCities: [],
  });
  const [orderMeta, setOrderMeta] = useState(createInitialOrderMetaState);
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingMeta, setShippingMeta] = useState(null);
  const [shippingError, setShippingError] = useState("");
  const [isEstimatingShipping, setIsEstimatingShipping] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const districtOptions = useMemo(
    () =>
      BANGLADESH_DISTRICT_OPTIONS.map((district) => ({
        value: district,
        label: district,
      })),
    [],
  );

  const hasDeliveryDetails = useMemo(
    () => Boolean(String(customer.address || "").trim()),
    [customer],
  );

  const orderSummary = useMemo(() => {
    const subtotal = roundMoney(
      items.reduce((sum, item) => {
        const pricing = getOrderItemResolvedPricing(item);
        return (
          sum + Number(pricing.currentPrice || 0) * Number(item.quantity || 1)
        );
      }, 0),
    );

    return {
      subtotal,
      shippingFee: roundMoney(shippingFee),
      total: roundMoney(subtotal + Number(shippingFee || 0)),
      quantity: items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      ),
    };
  }, [items, shippingFee]);

  useEffect(() => {
    const loadPageData = async () => {
      try {
        const settings = await fetchPublicSettings().catch(() => null);
        setLocationOptions({
          cities: Array.isArray(settings?.locations?.cityOptions)
            ? settings.locations.cityOptions
            : [],
          subCities: Array.isArray(settings?.locations?.subCityOptions)
            ? settings.locations.subCityOptions
            : [],
        });
      } catch (error) {
        toast.error(
          error.response?.data?.error || "Failed to load add-order data",
        );
      }
    };

    loadPageData();
  }, []);

  useEffect(() => {
    if (!hasDeliveryDetails) {
      setShippingFee(0);
      setShippingMeta(null);
      setShippingError("");
      setIsEstimatingShipping(false);
      return undefined;
    }

    if (!items.length) {
      setShippingFee(0);
      setShippingMeta(null);
      setShippingError("");
      return undefined;
    }

    const district = String(customer.district || "").trim();
    const city = String(customer.city || "").trim();
    const address = String(customer.address || "").trim();

    if (!address || !city || !district) {
      setShippingFee(0);
      setShippingMeta(null);
      setShippingError(
        "Add address, city, and district to calculate delivery charge.",
      );
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setIsEstimatingShipping(true);
        setShippingError("");
        const response = await axios.post(`${baseUrl}/shipping/estimate`, {
          items: items.map((item) => ({
            productId: item.productId,
            quantity: qty(item.quantity),
          })),
          city,
          district,
          country: String(customer.country || "Bangladesh").trim(),
        });

        if (!active) return;

        if (!response.data?.success) {
          throw new Error(
            response.data?.message || "Failed to estimate delivery charge",
          );
        }

        setShippingFee(roundMoney(response.data.shippingFee || 0));
        setShippingMeta(response.data.shippingMeta || null);
        setShippingError("");
      } catch (error) {
        if (!active) return;
        setShippingFee(0);
        setShippingMeta(null);
        setShippingError(
          error.response?.data?.message ||
            error.message ||
            "Failed to estimate delivery charge",
        );
      } finally {
        if (active) {
          setIsEstimatingShipping(false);
        }
      }
    }, 280);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [customer.address, customer.city, customer.country, customer.district, hasDeliveryDetails, items]);

  useEffect(() => {
    const query = String(customerLookup || "").trim();
    if (customerLookupLocked || query.length < 2) {
      setCustomerResults([]);
      setCustomerSearchLoading(false);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setCustomerSearchLoading(true);
        const payload = query.includes("@")
          ? { email: query }
          : { phone: query };
        const response = await axios.post(
          `${baseUrl}/orders/admin/customer-insights`,
          payload,
          { headers: getAuthHeaders() },
        );

        if (!active) return;
        const nextInsights = response.data?.insights || null;
        setInsights(nextInsights);
        setCustomerResults(
          Array.isArray(nextInsights?.matchedCustomers)
            ? nextInsights.matchedCustomers
            : [],
        );
      } catch {
        if (!active) return;
        setCustomerResults([]);
      } finally {
        if (active) setCustomerSearchLoading(false);
      }
    }, 280);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [customerLookup, customerLookupLocked]);

  useEffect(() => {
    const query = String(productQuery || "").trim();
    if (query.length < 2) {
      setProductResults([]);
      setProductSearchLoading(false);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setProductSearchLoading(true);
        const response = await axios.get(`${baseUrl}/products/public/search`, {
          params: { query },
        });
        if (!active) return;
        setProductResults(
          Array.isArray(response.data?.products) ? response.data.products : [],
        );
      } catch {
        if (!active) return;
        setProductResults([]);
      } finally {
        if (active) setProductSearchLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [productQuery]);

  const handleSelectCustomerMatch = (match = {}) => {
    const autofill = match?.autofill || {};
    const fallbackName = String(
      match?.name ||
        `${autofill.firstName || ""} ${autofill.lastName || ""}`.trim(),
    ).trim();
    const nameParts = parseCustomerName(fallbackName);

    setCustomer((prev) => ({
      ...prev,
      firstName: String(
        autofill.firstName || nameParts.firstName || prev.firstName,
      ).trim(),
      lastName: String(
        autofill.lastName || nameParts.lastName || prev.lastName,
      ).trim(),
      email: String(autofill.email || match?.email || prev.email).trim(),
      phone: String(autofill.phone || match?.phone || prev.phone).trim(),
      alternativePhone: String(
        autofill.alternativePhone || prev.alternativePhone,
      ).trim(),
      address: String(autofill.address || prev.address).trim(),
      city: String(autofill.city || prev.city).trim(),
      subCity: String(autofill.subCity || prev.subCity).trim(),
      district: String(autofill.district || prev.district).trim(),
      postalCode: String(autofill.postalCode || prev.postalCode).trim(),
      country: String(autofill.country || prev.country || "Bangladesh").trim(),
    }));
    setCustomerUserId(String(match?._id || "").trim());
    setCustomerLookupLocked(true);
    setCustomerLookup(
      String(match?.email || match?.phone || fallbackName).trim(),
    );
    setCustomerResults([]);
    toast.success("Customer details filled from search");
  };

  const handleAddProduct = (product = {}) => {
    if (!product?._id) return;

    if (
      String(product?.priceType || "")
        .trim()
        .toLowerCase() === "tba"
    ) {
      toast.error("TBA products cannot be added");
      return;
    }

    if (
      String(product?.marketplaceType || "")
        .trim()
        .toLowerCase() === "grouped"
    ) {
      toast.error(
        "Grouped products must be ordered from the product details flow",
      );
      return;
    }

    setItems((prev) => [...prev, buildInitialItem(product)]);
    setProductQuery("");
    setProductResults([]);
    toast.success("Product added to order");
  };

  const updateOrderItem = (lineId, updater) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.lineId !== lineId) return item;
        return typeof updater === "function"
          ? updater(item)
          : { ...item, ...updater };
      }),
    );
  };

  const removeOrderItem = (lineId) => {
    setItems((prev) => prev.filter((item) => item.lineId !== lineId));
  };

  const handleVariationChange = (lineId, variationId) => {
    updateOrderItem(lineId, (item) => ({ ...item, variationId }));
  };

  const handleVariantOptionChange = (lineId, definition, nextValue) => {
    updateOrderItem(lineId, (item) => {
      const existingSelections = normalizeSelectedVariantsPayload(
        item.selectedVariants || [],
      );
      const trimmedValue = String(nextValue || "").trim();
      const nextSelections = existingSelections.filter(
        (variant) =>
          String(variant?.name || "")
            .trim()
            .toLowerCase() !==
          String(definition?.name || "")
            .trim()
            .toLowerCase(),
      );

      if (!trimmedValue) {
        return { ...item, selectedVariants: nextSelections };
      }

      const matchedOption = (definition?.options || []).find(
        (option) =>
          getVariationOptionValue(definition, option) === trimmedValue,
      );

      if (!matchedOption) {
        return { ...item, selectedVariants: nextSelections };
      }

      nextSelections.push(
        buildSelectedVariantFromOption(definition, matchedOption),
      );
      return { ...item, selectedVariants: nextSelections };
    });
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!items.length) {
      toast.error("Add at least one product");
      return;
    }

    if (
      hasDeliveryDetails &&
      (!String(customer.address || "").trim() ||
        !String(customer.city || "").trim() ||
        !String(customer.district || "").trim())
    ) {
      toast.error(
        "Address, city, and district are required when creating a delivery order",
      );
      return;
    }

    if (hasDeliveryDetails && shippingError) {
      toast.error(shippingError);
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customerUserId: customerUserId || undefined,
        shippingAddress: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          alternativePhone: customer.alternativePhone,
          address: customer.address,
          city: customer.city,
          subCity: customer.subCity,
          district: customer.district || customer.subCity,
          postalCode: customer.postalCode,
          country: customer.country,
        },
        items: items.map((item) => ({
          productId: item.productId,
          quantity: qty(item.quantity),
          variationId: item.variationId || undefined,
          selectedVariants: normalizeSelectedVariantsPayload(
            item.selectedVariants || [],
          ),
        })),
        adminNotes: orderMeta.adminNotes,
        paymentMethod: "Cash on Delivery",
        paymentDetails: {
          paymentMode: "cash",
          mode: "cash",
          methodName: "Cash on Delivery",
          method: "Cash on Delivery",
          transactionId: "",
          sentTo: "",
          accountNo: "",
          meta: {},
        },
        shippingMeta: shippingMeta || undefined,
      };

      const response = await axios.post(
        `${baseUrl}/orders/admin/manual`,
        payload,
        {
          headers: getAuthHeaders(),
        },
      );

      toast.success(response.data?.message || "Order created");
      setItems([]);
      setProductResults([]);
      setProductQuery("");
      setCustomer(createInitialCustomerState());
      setCustomerLookup("");
      setCustomerLookupLocked(false);
      setCustomerResults([]);
      setCustomerUserId("");
      setInsights(null);
      setOrderMeta(createInitialOrderMetaState());
      setShippingFee(0);
      setShippingMeta(null);
      setShippingError("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-6">
        <section className={sectionClassName}>
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-black">
                <FiPackage className="h-5 w-5" />
                Product Search
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Type product name, brand, or category. Click a result to add it,
                then set quantity and variants below.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 font-semibold">
                {items.length} selected item{items.length === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 font-semibold">
                Total {formatMoney(orderSummary.total)}
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                placeholder="Search products by title, brand, category, or type"
                className={`${inputClassName} pl-11`}
              />
            </div>

            {productSearchLoading ? (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                Searching products...
              </div>
            ) : null}

            {productResults.length > 0 ? (
              <div className="mt-3 max-h-80 overflow-auto rounded-3xl border border-gray-200 bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
                <div className="space-y-2">
                  {productResults.map((product, index) => {
                    const previewPricing = getOrderItemResolvedPricing({
                      product,
                      variationId: "",
                      selectedVariants: [],
                    });
                    const imageUrl = getFullImageUrl(
                      product?.images?.[0] || product?.image,
                    );

                    return (
                      <button
                        key={`${product?._id || index}`}
                        type="button"
                        onClick={() => handleAddProduct(product)}
                        className="flex w-full items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition hover:border-black hover:bg-white"
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={product?.title || "Product"}
                              className="h-full w-full object-contain"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                            {product?.category?.name ||
                              product?.productType ||
                              "Product"}
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold text-black">
                            {product?.title || "Product"}
                          </p>
                          <p className="mt-1 text-sm font-bold text-black">
                            {previewPricing.isTba
                              ? "TBA"
                              : formatMoney(previewPricing.currentPrice)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            {items.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center text-sm text-gray-500">
                Start typing to pick products for this manual order.
              </div>
            ) : (
              items.map((item) => {
                const product = item.product || {};
                const activeVariations = getActiveVariations(product);
                const variantDefinitions =
                  normalizeProductVariantDefinitions(product);
                const pricing = getOrderItemResolvedPricing(item);
                const selectedVariants = normalizeSelectedVariantsPayload(
                  item.selectedVariants || [],
                );

                return (
                  <div
                    key={item.lineId}
                    className="rounded-[28px] border border-gray-200 bg-gray-50 p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 flex-1 gap-4">
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-3">
                          {getFullImageUrl(
                            product?.images?.[0] || product?.image,
                          ) ? (
                            <img
                              src={getFullImageUrl(
                                product?.images?.[0] || product?.image,
                              )}
                              alt={product?.title || "Product"}
                              className="h-full w-full object-contain"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">
                            {product?.category?.name ||
                              product?.productType ||
                              "Product"}
                          </p>
                          <h3 className="mt-2 text-lg font-bold text-black">
                            {product?.title || "Product"}
                          </h3>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {pricing.hasDiscount ? (
                              <span className="text-sm text-gray-400 line-through">
                                {formatMoney(pricing.previousPrice)}
                              </span>
                            ) : null}
                            <span className="text-xl font-black text-black">
                              {pricing.isTba
                                ? "TBA"
                                : formatMoney(pricing.currentPrice)}
                            </span>
                            {pricing.activeVariation?.label ? (
                              <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                                {pricing.activeVariation.label}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center rounded-2xl border border-gray-200 bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              updateOrderItem(item.lineId, {
                                quantity: Math.max(
                                  1,
                                  Number(item.quantity || 1) - 1,
                                ),
                              })
                            }
                            className="h-11 w-11 text-lg text-gray-600 transition hover:text-black"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(event) =>
                              updateOrderItem(item.lineId, {
                                quantity: qty(event.target.value),
                              })
                            }
                            className="h-11 w-14 border-x border-gray-200 text-center text-sm font-semibold outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateOrderItem(item.lineId, {
                                quantity: Number(item.quantity || 1) + 1,
                              })
                            }
                            className="h-11 w-11 text-lg text-gray-600 transition hover:text-black"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeOrderItem(item.lineId)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-red-200 bg-white text-red-500 transition hover:bg-red-50"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                      {activeVariations.length > 0 ? (
                        <div className="xl:col-span-2">
                          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
                            Variation
                          </label>
                          <SearchableSelect
                            value={item.variationId}
                            onChange={(value) =>
                              handleVariationChange(item.lineId, value)
                            }
                            options={[
                              { value: "", label: "Select variation" },
                              ...activeVariations.map((variation) => {
                                const variationPricing =
                                  getVariationBasePricing(variation);
                                return {
                                  value: variation._id,
                                  label: `${variation.label} - ${formatMoney(variationPricing.basePrice)}${variationPricing.baseComparePrice ? ` (was ${formatMoney(variationPricing.baseComparePrice)})` : ""}`,
                                };
                              }),
                            ]}
                            placeholder="Select variation"
                            searchable={false}
                            className="min-w-0"
                            buttonClassName={selectClassName}
                            menuClassName="rounded-xl"
                          />
                        </div>
                      ) : null}

                      {variantDefinitions.map((definition) => {
                        const currentSelection =
                          selectedVariants.find(
                            (variant) =>
                              String(variant?.name || "")
                                .trim()
                                .toLowerCase() ===
                              String(definition?.name || "")
                                .trim()
                                .toLowerCase(),
                          ) || null;
                        const currentValue = currentSelection
                          ? getVariationOptionValue(
                              definition,
                              currentSelection,
                            )
                          : "";

                        return (
                          <div key={`${item.lineId}-${definition.name}`}>
                            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
                              {definition.name}
                            </label>
                            <SearchableSelect
                              value={currentValue}
                              onChange={(value) =>
                                handleVariantOptionChange(
                                  item.lineId,
                                  definition,
                                  value,
                                )
                              }
                              options={[
                                {
                                  value: "",
                                  label: `${definition.name} - No selection`,
                                },
                                ...definition.options.map((option) => ({
                                  value: getVariationOptionValue(
                                    definition,
                                    option,
                                  ),
                                  label: buildVariantOptionLabel(definition, option),
                                })),
                              ]}
                              placeholder={`${definition.name}`}
                              searchable={false}
                              className="min-w-0"
                              buttonClassName={selectClassName}
                              menuClassName="rounded-xl"
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                      <div className="text-sm text-gray-600">
                        <span className="font-semibold text-black">
                          Unit Price:
                        </span>{" "}
                        {pricing.isTba
                          ? "TBA"
                          : formatMoney(pricing.currentPrice)}
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="font-semibold text-black">
                          Line Total:
                        </span>{" "}
                        {pricing.isTba
                          ? "TBA"
                          : formatMoney(
                              Number(pricing.currentPrice || 0) *
                                Number(item.quantity || 1),
                            )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="mb-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-black">
              <FiUser className="h-5 w-5" />
              Customer Search & Details
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Type email or phone number to find an existing customer and
              auto-fill the form.
            </p>
          </div>

          <div className="relative">
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={customerLookup}
                onChange={(event) => {
                  setCustomerLookupLocked(false);
                  setCustomerLookup(event.target.value);
                }}
                placeholder="Search customer by email or phone"
                className={`${inputClassName} pl-11`}
              />
            </div>

            {customerSearchLoading ? (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                Searching customers...
              </div>
            ) : null}

            {customerResults.length > 0 ? (
              <div className="mt-3 max-h-72 overflow-auto rounded-3xl border border-gray-200 bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
                <div className="space-y-2">
                  {customerResults.map((entry, index) => (
                    <button
                      key={`${entry._id || entry.email || entry.phone || index}`}
                      type="button"
                      onClick={() => handleSelectCustomerMatch(entry)}
                      className="flex w-full items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition hover:border-black hover:bg-white"
                    >
                      <div>
                        <p className="font-semibold text-black">
                          {entry.name || "Customer"}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {[entry.email, entry.phone]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      </div>
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500">
                        <FiCheck className="h-4 w-4" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {insights ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                  Risk
                </p>
                <p className="mt-2 text-sm font-bold uppercase text-black">
                  {insights.riskLevel || "new"}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                  Success Rate
                </p>
                <p className="mt-2 text-sm font-bold text-black">
                  {Number(insights.successRate || 0).toFixed(2)}%
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                  Orders
                </p>
                <p className="mt-2 text-sm font-bold text-black">
                  {insights.totalOrders || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                  Delivered
                </p>
                <p className="mt-2 text-sm font-bold text-black">
                  {insights.deliveredOrders || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                  Returned
                </p>
                <p className="mt-2 text-sm font-bold text-black">
                  {insights.returnedOrders || 0}
                </p>
              </div>
              {insights.blacklistReason ? (
                <div className="md:col-span-2 xl:col-span-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {insights.blacklistReason}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={customer.firstName}
              onChange={(event) =>
                setCustomer((prev) => ({
                  ...prev,
                  firstName: event.target.value,
                }))
              }
              placeholder="First name"
              className={inputClassName}
              required
            />
            <input
              value={customer.lastName}
              onChange={(event) =>
                setCustomer((prev) => ({
                  ...prev,
                  lastName: event.target.value,
                }))
              }
              placeholder="Last name"
              className={inputClassName}
              required
            />
            <input
              type="email"
              value={customer.email}
              onChange={(event) =>
                setCustomer((prev) => ({ ...prev, email: event.target.value }))
              }
              placeholder="Email"
              className={inputClassName}
              required
            />
            <input
              value={customer.phone}
              onChange={(event) =>
                setCustomer((prev) => ({ ...prev, phone: event.target.value }))
              }
              placeholder="Phone"
              className={inputClassName}
              required
            />
            <input
              value={customer.alternativePhone}
              onChange={(event) =>
                setCustomer((prev) => ({
                  ...prev,
                  alternativePhone: event.target.value,
                }))
              }
              placeholder="Alternative phone"
              className={inputClassName}
            />
            <input
              value={customer.postalCode}
              onChange={(event) =>
                setCustomer((prev) => ({
                  ...prev,
                  postalCode: event.target.value,
                }))
              }
              placeholder="Postal code"
              className={inputClassName}
            />
          </div>

          <div className="mt-3">
            <textarea
              value={customer.address}
              onChange={(event) =>
                setCustomer((prev) => ({
                  ...prev,
                  address: event.target.value,
                }))
              }
              placeholder="Address"
              rows={3}
              className={`${inputClassName} resize-none`}
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={customer.city}
              onChange={(event) =>
                setCustomer((prev) => ({ ...prev, city: event.target.value }))
              }
              placeholder="City"
              list="admin-order-city-options"
              className={inputClassName}
            />
            <input
              value={customer.subCity}
              onChange={(event) =>
                setCustomer((prev) => ({
                  ...prev,
                  subCity: event.target.value,
                }))
              }
              placeholder="Sub city"
              list="admin-order-subcity-options"
              className={inputClassName}
            />
            <SearchableSelect
              value={customer.district}
              onChange={(value) =>
                setCustomer((prev) => ({
                  ...prev,
                  district: value,
                }))
              }
              options={
                customer.district &&
                !BANGLADESH_DISTRICT_OPTIONS.includes(customer.district)
                  ? [
                      { value: customer.district, label: customer.district },
                      ...districtOptions,
                    ]
                  : districtOptions
              }
              placeholder="Select district"
              clearable
              className="w-full"
              buttonClassName="min-h-[52px] rounded-[20px] border-black/8 px-4 py-3 text-sm text-gray-900 hover:border-black"
              menuClassName="rounded-[20px]"
            />
            <input
              value={customer.country}
              onChange={(event) =>
                setCustomer((prev) => ({
                  ...prev,
                  country: event.target.value,
                }))
              }
              placeholder="Country"
              className={inputClassName}
            />
          </div>

          <datalist id="admin-order-city-options">
            {locationOptions.cities.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
          <datalist id="admin-order-subcity-options">
            {locationOptions.subCities.map((subCity) => (
              <option key={subCity} value={subCity} />
            ))}
          </datalist>
        </section>

        <section className={sectionClassName}>
          <div className="mb-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-black">
              <FiCreditCard className="h-5 w-5" />
              COD & Save
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Walk-in orders can be saved without a delivery address. If you add
              an address, delivery fee will be calculated and the order stays
              ready for courier handling.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
              Cash on Delivery only. No online payment option is available for
              custom orders.
            </div>
            <input
              value="Custom Order"
              readOnly
              className={`${inputClassName} bg-gray-50 text-gray-500`}
            />
          </div>

          <div className="mt-4">
            <textarea
              value={orderMeta.adminNotes}
              onChange={(event) =>
                setOrderMeta((prev) => ({
                  ...prev,
                  adminNotes: event.target.value,
                }))
              }
              rows={3}
              placeholder="Admin note"
              className={`${inputClassName} resize-none`}
            />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
                Items
              </p>
              <p className="mt-2 text-2xl font-black text-black">
                {orderSummary.quantity}
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
                Subtotal
              </p>
              <p className="mt-2 text-2xl font-black text-black">
                {formatMoney(orderSummary.subtotal)}
              </p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400">
                Delivery
              </p>
              <p className="mt-2 text-2xl font-black text-black">
                {formatMoney(orderSummary.shippingFee)}
              </p>
            </div>
            <div className="rounded-3xl border border-black bg-black px-4 py-4 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/65">
                Total
              </p>
              <p className="mt-2 text-2xl font-black">
                {formatMoney(orderSummary.total)}
              </p>
            </div>
          </div>

          {hasDeliveryDetails ? (
            <div
              className={`mt-4 rounded-3xl border px-4 py-4 text-sm ${
                shippingError
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-gray-200 bg-gray-50 text-gray-700"
              }`}
            >
              {isEstimatingShipping
                ? "Calculating delivery charge..."
                : shippingError
                  ? shippingError
                  : shippingMeta?.sourceLabel
                    ? `${shippingMeta.sourceLabel}. Delivery charge added to the order total.`
                    : "Delivery charge added to the order total."}
            </div>
          ) : (
            <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
              No delivery address entered. This order will be saved as an in-shop completed sale.
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-500">
              Custom orders are saved directly into order management after
              pricing is finalized here.
            </div>
            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-black px-7 text-sm font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiShoppingBag className="h-4 w-4" />
              {submitting ? "Creating Order..." : "Save Order"}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default AdminAddOrder;
