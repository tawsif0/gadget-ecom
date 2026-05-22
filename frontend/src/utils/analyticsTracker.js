import { pushDataLayerEvent } from "./marketingDataLayer";

const safeString = (value) => String(value || "").trim();
const PENDING_EVENTS_KEY = "__PENDING_MARKETING_EVENTS__";

const toCleanPayload = (value = {}) =>
  Object.fromEntries(
    Object.entries(value || {}).filter(
      ([, entryValue]) => entryValue !== undefined,
    ),
  );

const getActivePixelIds = () => {
  if (typeof window === "undefined") return [];

  return Array.from(
    new Set(
      (Array.isArray(window.__MARKETING_STATE__?.pixelIds)
        ? window.__MARKETING_STATE__.pixelIds
        : []
      )
        .map((pixelId) => safeString(pixelId))
        .filter(Boolean),
    ),
  );
};

const resolveCommercePayload = (payload = {}) => {
  const ecommerce = payload?.ecommerce;
  if (ecommerce && typeof ecommerce === "object" && !Array.isArray(ecommerce)) {
    return toCleanPayload(ecommerce);
  }

  return toCleanPayload(payload);
};

const toNumberOrUndefined = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveMetaItems = (payload = {}) => {
  const commercePayload = resolveCommercePayload(payload);
  const items = Array.isArray(commercePayload?.items)
    ? commercePayload.items
    : Array.isArray(payload?.items)
      ? payload.items
      : [];

  return items
    .map((item = {}) => {
      const id = safeString(
        item.item_id ||
          item.id ||
          item.productId ||
          item.product ||
          item.sku ||
          "",
      );
      const quantity = Math.max(1, toNumberOrUndefined(item.quantity) || 1);
      const price =
        toNumberOrUndefined(item.price) ??
        toNumberOrUndefined(item.item_price) ??
        0;

      return {
        id,
        name: safeString(item.item_name || item.name || item.title || ""),
        category: safeString(item.item_category || item.category || ""),
        brand: safeString(item.item_brand || item.brand || ""),
        variant: safeString(item.item_variant || item.variant || ""),
        quantity,
        price,
      };
    })
    .filter((item) => item.id || item.name);
};

const resolveMetaPayload = (payload = {}) => {
  const commercePayload = resolveCommercePayload(payload);
  const { items: _unusedItems, ...basePayload } = commercePayload;
  const items = resolveMetaItems(payload);

  if (!items.length) {
    return toCleanPayload(basePayload);
  }

  const totalQuantity = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0,
  );
  const firstItem = items[0] || {};
  const contentIds = items.map((item) => item.id).filter(Boolean);
  const contents = items.map((item) =>
    toCleanPayload({
      id: item.id || item.name,
      quantity: item.quantity,
      item_price: item.price,
    }),
  );
  const fallbackValue = items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
    0,
  );

  return toCleanPayload({
    ...basePayload,
    content_ids: contentIds.length ? contentIds : undefined,
    contents: contents.length ? contents : undefined,
    content_type: totalQuantity > 1 ? "product_group" : "product",
    content_name: safeString(basePayload.content_name) || firstItem.name || undefined,
    content_category:
      safeString(basePayload.content_category) || firstItem.category || undefined,
    brand: safeString(basePayload.brand) || firstItem.brand || undefined,
    value: toNumberOrUndefined(basePayload.value) ?? fallbackValue,
    currency: safeString(basePayload.currency) || undefined,
    num_items: totalQuantity || undefined,
  });
};

const getPendingTrackingEvents = () => {
  if (typeof window === "undefined") return [];
  if (!Array.isArray(window[PENDING_EVENTS_KEY])) {
    window[PENDING_EVENTS_KEY] = [];
  }
  return window[PENDING_EVENTS_KEY];
};

const queuePendingTrackingEvent = (channel, eventName, payload = {}) => {
  if (typeof window === "undefined") return;

  getPendingTrackingEvents().push({
    channel: safeString(channel),
    eventName: safeString(eventName),
    payload: toCleanPayload(payload),
  });
};

const sendGoogleAnalytics = (eventName, payload = {}) => {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return false;

  window.gtag("event", safeString(eventName), toCleanPayload(payload));
  return true;
};

const sendFacebookPixel = (eventName, payload = {}) => {
  if (typeof window === "undefined") return;
  if (typeof window.fbq !== "function") return false;

  const activePixelIds = getActivePixelIds();
  if (!activePixelIds.length) return false;

  const normalizedEventName = safeString(eventName);
  const normalizedPayload = toCleanPayload(payload);

  try {
    activePixelIds.forEach((pixelId) => {
      window.fbq("trackSingle", pixelId, normalizedEventName, normalizedPayload);
    });
    return true;
  } catch {
    return false;
  }
};

const trackGoogleAnalytics = (eventName, payload = {}) => {
  const normalizedName = safeString(eventName);
  const normalizedPayload = toCleanPayload(payload);

  if (sendGoogleAnalytics(normalizedName, normalizedPayload)) {
    return;
  }

  queuePendingTrackingEvent("ga", normalizedName, normalizedPayload);
};

const trackFacebookPixel = (eventName, payload = {}) => {
  const normalizedName = safeString(eventName);
  const normalizedPayload = toCleanPayload(payload);
  const activePixelIds = getActivePixelIds();

  if (!activePixelIds.length) {
    return;
  }

  if (sendFacebookPixel(normalizedName, normalizedPayload)) {
    return;
  }

  queuePendingTrackingEvent("pixel", normalizedName, normalizedPayload);
};

export const flushPendingTrackingEvents = () => {
  if (typeof window === "undefined") return;

  const pendingEvents = getPendingTrackingEvents();
  if (!pendingEvents.length) return;

  const remainingEvents = [];

  pendingEvents.forEach((entry) => {
    const channel = safeString(entry?.channel);
    const eventName = safeString(entry?.eventName);
    const payload = toCleanPayload(entry?.payload);

    const sent =
      channel === "pixel"
        ? sendFacebookPixel(eventName, payload)
        : channel === "ga"
          ? sendGoogleAnalytics(eventName, payload)
          : true;

    if (!sent) {
      remainingEvents.push({
        channel,
        eventName,
        payload,
      });
    }
  });

  window[PENDING_EVENTS_KEY] = remainingEvents;
};

export const trackAnalyticsEvent = ({
  dataLayerEventName = "",
  pixelEventName = "",
  ga4EventName = "",
  dataLayerPayload = {},
  pixelPayload = dataLayerPayload,
  ga4Payload = dataLayerPayload,
} = {}) => {
  const normalizedDataLayerName = safeString(dataLayerEventName);
  const normalizedPixelName = safeString(pixelEventName);
  const normalizedGa4Name = safeString(ga4EventName);

  if (normalizedDataLayerName) {
    pushDataLayerEvent(
      normalizedDataLayerName,
      toCleanPayload(dataLayerPayload),
    );
  }

  if (normalizedPixelName) {
    trackFacebookPixel(normalizedPixelName, resolveMetaPayload(pixelPayload));
  }

  if (normalizedGa4Name) {
    trackGoogleAnalytics(normalizedGa4Name, resolveCommercePayload(ga4Payload));
  }
};

export const trackPageView = (payload = {}) =>
  trackAnalyticsEvent({
    dataLayerEventName: "page_view",
    pixelEventName: "PageView",
    ga4EventName: "page_view",
    dataLayerPayload: payload,
    pixelPayload: payload,
    ga4Payload: payload,
  });

export const trackViewContent = (payload = {}) =>
  trackAnalyticsEvent({
    dataLayerEventName: "view_item",
    pixelEventName: "ViewContent",
    ga4EventName: "view_item",
    dataLayerPayload: payload,
    pixelPayload: payload,
    ga4Payload: payload,
  });

export const trackAddToCart = (payload = {}) =>
  trackAnalyticsEvent({
    dataLayerEventName: "add_to_cart",
    pixelEventName: "AddToCart",
    ga4EventName: "add_to_cart",
    dataLayerPayload: payload,
    pixelPayload: payload,
    ga4Payload: payload,
  });

export const trackInitiateCheckout = (payload = {}) =>
  trackAnalyticsEvent({
    dataLayerEventName: "initiate_checkout",
    pixelEventName: "InitiateCheckout",
    ga4EventName: "initiate_checkout",
    dataLayerPayload: payload,
    pixelPayload: payload,
    ga4Payload: payload,
  });

export const trackPurchase = (payload = {}) =>
  trackAnalyticsEvent({
    dataLayerEventName: "purchase",
    pixelEventName: "Purchase",
    ga4EventName: "purchase",
    dataLayerPayload: payload,
    pixelPayload: payload,
    ga4Payload: payload,
  });
