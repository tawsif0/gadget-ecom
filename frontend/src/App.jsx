import React, { Suspense, lazy, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  matchPath,
  useNavigationType,
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "./hooks/useAuth";
import usePublicSettings from "./hooks/usePublicSettings";
import { Toaster } from "react-hot-toast";
import { GLOBAL_TOAST_OPTIONS } from "./utils/globalToast";

import { applySeoMetadata } from "./utils/seoManager";
import {
  flushPendingTrackingEvents,
  trackPageView,
} from "./utils/analyticsTracker";
import { pushDataLayerEvent } from "./utils/marketingDataLayer";
import {
  clearNotifications,
  fetchNotifications,
  startNotificationStream,
  stopNotificationStream,
} from "./store/notificationsSlice";
import {
  loadAdminSettings,
  loadPublicSettings,
  selectAdminSettingsDraft,
  selectPublicSettingsState,
} from "./store/publicSettingsSlice";
import { loadWishlist } from "./store/wishlistSlice";
import {
  applyPublicSettingsDocument,
  formatDocumentTitle,
} from "./utils/publicSettings";
import {
  applyMarketingTemplate,
  getActiveMarketingEntry,
  getFallbackRobotsUrl,
  getFallbackSitemapUrl,
  resolveMarketingPageKey,
  resolveTrackingConfiguration,
} from "./utils/marketingProfiles";

const normalizeThemeColor = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }

  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw;
  }

  return "#000000";
};

const normalizeButtonTextColor = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }

  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw;
  }

  return "#ffffff";
};

const normalizeSecondaryButtonColor = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }

  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw;
  }

  return "#f3f4f6";
};

const normalizeSecondaryButtonTextColor = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }

  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw;
  }

  return "#000000";
};

const SuccessRedirect = () => {
  const location = useLocation();

  return (
    <Navigate
      to={{
        pathname: "/thank-you",
        search: location.search,
        hash: location.hash,
      }}
      replace
    />
  );
};

const hexToRgba = (value, alpha) => {
  const normalized = normalizeThemeColor(value);
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const normalizeFontFamily = (value) => {
  const raw = String(value || "").trim();
  const legacyDefault =
    '"Space Grotesk", "Sora", system-ui, -apple-system, sans-serif';
  if (
    !raw ||
    raw.toLowerCase() === "inherit" ||
    raw === legacyDefault ||
    raw.includes("Poppins") ||
    (raw.includes("Space Grotesk") &&
      raw.includes("Sora") &&
      raw.includes("system-ui"))
  ) {
    return '"Manrope", "Inter", system-ui, -apple-system, sans-serif';
  }
  return raw;
};

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Registration"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Home = lazy(() => import("./Home/pages/Home"));
const MarketplaceHomeFloors = lazy(
  () => import("./Home/pages/MarketplaceHomeFloors"),
);
const FAQ = lazy(() => import("./Home/pages/FAQ"));
const Contact = lazy(() => import("./Home/pages/Contact"));
const ProductDetails = lazy(() => import("./Home/subPages/ProductDetails"));
const ProductGrid = lazy(() => import("./Home/subPages/ProductGrid"));
const AddToCart = lazy(() => import("./Home/components/AddToCart"));
const CheckOut = lazy(() => import("./Home/components/CheckOut"));
const AboutUs = lazy(() => import("./Home/pages/AboutUs"));
const ThankYou = lazy(() => import("./Home/components/ThankYou"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const LandingPageView = lazy(() => import("./Home/pages/LandingPageView"));
const PolicyPage = lazy(() => import("./Home/pages/PolicyPage"));
const CompareProducts = lazy(() => import("./pages/CompareProducts"));
const MyWishlist = lazy(() => import("./pages/MyWishlist"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Navbar = lazy(() => import("./Home/components/Navbar"));
const Footer = lazy(() => import("./Home/components/Footer"));

function HomePage() {
  return <Home />;
}

function RouteLoadingFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" />
    </div>
  );
}

function HashScrollHandler() {
  const location = useLocation();

  useEffect(() => {
    const hash = String(location.hash || "")
      .replace(/^#/, "")
      .trim();
    if (!hash) return;

    const timer = window.setTimeout(() => {
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 120);

    return () => window.clearTimeout(timer);
  }, [location.hash, location.pathname, location.search]);

  return null;
}

function NavigationScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousLocationRef = useRef(location);

  const getShopScrollStorageKey = (targetLocation) =>
    `shop-scroll:${String(targetLocation?.pathname || "")}${String(targetLocation?.search || "")}`;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const historyState = window.history;
    if (!("scrollRestoration" in historyState)) return undefined;

    const previousValue = historyState.scrollRestoration;
    historyState.scrollRestoration = "manual";

    return () => {
      historyState.scrollRestoration = previousValue;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const previousLocation = previousLocationRef.current;
    if (
      previousLocation &&
      previousLocation.key !== location.key &&
      previousLocation.pathname === "/shop"
    ) {
      window.sessionStorage.setItem(
        getShopScrollStorageKey(previousLocation),
        String(window.scrollY || window.pageYOffset || 0),
      );
    }

    previousLocationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const frame = window.requestAnimationFrame(() => {
      const shouldRestoreShopScroll =
        location.pathname === "/shop" && navigationType === "POP";

      if (shouldRestoreShopScroll) {
        const savedScrollTop = Number(
          window.sessionStorage.getItem(getShopScrollStorageKey(location)),
        );

        if (Number.isFinite(savedScrollTop) && savedScrollTop > 0) {
          window.scrollTo({ top: savedScrollTop, left: 0, behavior: "auto" });
          return;
        }
      }

      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location, navigationType]);

  return null;
}

function DashboardTabRedirect({ tab }) {
  try {
    if (tab) localStorage.setItem("dashboardActiveTab", tab);
  } catch {
    // ignore storage errors
  }

  return <Navigate to="/dashboard" replace />;
}

// Layout component for public pages (with Navbar and Footer)
function PublicLayout() {
  return (
    <>
      <Suspense fallback={null}>
        <Navbar />
      </Suspense>
      <HashScrollHandler />
      <main>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            {/* Redirect all root paths to home */}
            <Route path="/" element={<HomePage />} />
            <Route path="/home" element={<MarketplaceHomeFloors />} />
            <Route path="/index" element={<Navigate to="/" replace />} />
            <Route path="/index.html" element={<Navigate to="/" replace />} />

            {/* Shop / product listing */}
            <Route path="/shop" element={<ProductGrid />} />
            <Route path="/products" element={<Navigate to="/shop" replace />} />
            <Route path="/compare" element={<CompareProducts />} />
            <Route path="/wishlist" element={<MyWishlist />} />

            {/* Single product */}
            <Route path="/product/:id" element={<ProductDetails />} />

            {/* About Us */}
            <Route path="/about" element={<AboutUs />} />
            <Route
              path="/about-us"
              element={<Navigate to="/about" replace />}
            />
            <Route path="/blog" element={<AboutUs />} />

            {/* Static pages */}
            <Route path="/contact" element={<Contact />} />
            <Route
              path="/contact-us"
              element={<Navigate to="/contact" replace />}
            />
            <Route path="/faqs" element={<FAQ />} />
            <Route path="/faq" element={<Navigate to="/faqs" replace />} />
            <Route
              path="/store/:slug"
              element={<Navigate to="/shop" replace />}
            />
            <Route path="/lp/:slug" element={<LandingPageView />} />
            <Route path="/policy/:policyType" element={<PolicyPage />} />
            {/* Cart / checkout */}
            <Route path="/cart" element={<AddToCart />} />
            <Route path="/added-to-cart" element={<AddToCart />} />
            <Route path="/checkout" element={<CheckOut />} />
            <Route path="/thank-you" element={<ThankYou />} />
            <Route path="/success" element={<SuccessRedirect />} />
            <Route path="/track-order" element={<OrderTracking />} />
            <Route
              path="/track-order/:orderNumber"
              element={<OrderTracking />}
            />
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}

function PageViewTracker({ enabled = true }) {
  const location = useLocation();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    const frame = window.requestAnimationFrame(() => {
      const searchParams = new URLSearchParams(location.search || "");
      const productMatch = matchPath("/product/:id", location.pathname);

      trackPageView({
        page_key: resolveMarketingPageKey(location.pathname),
        page_path: `${location.pathname}${location.search || ""}`,
        page_title: typeof document !== "undefined" ? document.title : "",
        page_location:
          typeof window !== "undefined" ? window.location.href : "",
        catalog_category_id: searchParams.get("category") || undefined,
        catalog_category_type: searchParams.get("type") || undefined,
        catalog_brand: searchParams.get("brand") || undefined,
        catalog_collection: searchParams.get("collection") || undefined,
        catalog_search_term: searchParams.get("search") || undefined,
        catalog_sort_by: searchParams.get("sort") || undefined,
        product_id: String(productMatch?.params?.id || "").trim() || undefined,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [enabled, location.pathname, location.search]);

  return null;
}

const toTitleLabel = (value) =>
  String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const resolveStaticPageTitle = (pathname) => {
  const routeTitleMap = [
    ["/", "Home"],
    ["/home", "Home"],
    ["/shop", "Shop"],
    ["/compare", "Compare"],
    ["/wishlist", "Wishlist"],
    ["/about", "About"],
    ["/contact", "Contact"],
    ["/faqs", "FAQs"],
    ["/cart", "Cart"],
    ["/added-to-cart", "Cart"],
    ["/checkout", "Checkout"],
    ["/thank-you", "Thank You"],
    ["/track-order", "Track Order"],
    ["/login", "Login"],
    ["/register", "Register"],
    ["/forgot-password", "Forgot Password"],
    ["/dashboard", "Dashboard"],
  ];

  const directMatch = routeTitleMap.find(([path]) => path === pathname);
  if (directMatch) return directMatch[1];

  const productMatch = matchPath("/product/:id", pathname);
  if (productMatch) return "Product";

  const orderMatch = matchPath("/track-order/:orderNumber", pathname);
  if (orderMatch) {
    return `Track Order ${decodeURIComponent(orderMatch.params.orderNumber || "").trim()}`;
  }

  const resetMatch = matchPath("/reset-password/:token", pathname);
  if (resetMatch) return "Reset Password";

  const landingMatch = matchPath("/lp/:slug", pathname);
  if (landingMatch) return "Landing Page";

  const policyMatch = matchPath("/policy/:policyType", pathname);
  if (policyMatch) {
    const policyType = String(policyMatch.params.policyType || "").trim().toLowerCase();
    if (policyType === "shipment") return "Shipping Policy";
    return `${toTitleLabel(decodeURIComponent(policyMatch.params.policyType || ""))} Policy`;
  }

  if (pathname.startsWith("/dashboard")) return "Dashboard";

  const segments = String(pathname || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length > 0) {
    return toTitleLabel(
      decodeURIComponent(segments[segments.length - 1] || ""),
    );
  }

  return "Home";
};

const sanitizeInlineScript = (rawCode) =>
  String(rawCode || "")
    .replace(/<script[^>]*>/gi, "")
    .replace(/<\/script>/gi, "")
    .trim();

const syncExternalScript = (id, src, options = {}) => {
  if (typeof document === "undefined") return;

  const normalizedSrc = String(src || "").trim();
  const existing = document.getElementById(id);
  if (!normalizedSrc) {
    existing?.remove();
    return;
  }

  if (existing instanceof HTMLScriptElement && existing.src === normalizedSrc) {
    existing.async = options.async !== undefined ? options.async : true;
    existing.defer = Boolean(options.defer);
    return;
  }

  existing?.remove();

  const script = document.createElement("script");
  script.id = id;
  script.src = normalizedSrc;
  script.async = options.async !== undefined ? options.async : true;
  script.defer = Boolean(options.defer);
  document.head.appendChild(script);
};

const syncInlineScript = (id, scriptBody) => {
  if (typeof document === "undefined") return;

  const code = String(scriptBody || "").trim();
  const existing = document.getElementById(id);

  if (!code) {
    existing?.remove();
    return;
  }

  const currentCode =
    existing instanceof HTMLScriptElement
      ? String(existing.text || existing.textContent || "").trim()
      : "";

  if (currentCode === code) {
    return;
  }

  existing?.remove();

  const script = document.createElement("script");
  script.id = id;
  script.text = code;
  document.head.appendChild(script);
};

const normalizeTrackingIds = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

const FACEBOOK_PIXEL_BOOTSTRAP = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');`;

const syncFacebookPixels = (pixelIds = []) => {
  if (typeof window === "undefined") return;

  const nextPixelIds = normalizeTrackingIds(pixelIds);

  if (nextPixelIds.length === 0) {
    syncInlineScript("fb-pixel-inline", "");
    window.__MARKETING_INITIALIZED_PIXEL_IDS__ = Array.isArray(
      window.__MARKETING_INITIALIZED_PIXEL_IDS__,
    )
      ? window.__MARKETING_INITIALIZED_PIXEL_IDS__
      : [];
    return;
  }

  syncInlineScript("fb-pixel-inline", FACEBOOK_PIXEL_BOOTSTRAP);

  if (typeof window.fbq !== "function") {
    return;
  }

  const initializedPixelIds = new Set(
    normalizeTrackingIds(window.__MARKETING_INITIALIZED_PIXEL_IDS__),
  );

  nextPixelIds.forEach((pixelId) => {
    if (initializedPixelIds.has(pixelId)) return;
    window.fbq("init", pixelId);
    initializedPixelIds.add(pixelId);
  });

  window.__MARKETING_INITIALIZED_PIXEL_IDS__ = Array.from(initializedPixelIds);
};

function MarketingScriptsManager({ settings, settingsReady }) {
  const location = useLocation();
  const [productContextKey, setProductContextKey] = React.useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handler = () => setProductContextKey((value) => value + 1);
    window.addEventListener("marketing:product-context", handler);
    return () => window.removeEventListener("marketing:product-context", handler);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !settingsReady) {
      window.__MARKETING_STATE__ = {
        ready: false,
        dataLayerEnabled: false,
        pixelIds: [],
        gaIds: [],
        gtmIds: [],
        pathname: location.pathname,
      };
      return undefined;
    }

    const productMatch = matchPath("/product/:id", location.pathname);
    const runtimeProductId =
      typeof window !== "undefined"
        ? String(window.__CURRENT_PRODUCT_ID__ || "").trim()
        : "";
    const productId =
      runtimeProductId || String(productMatch?.params?.id || "").trim();
    const tracking = resolveTrackingConfiguration(settings, {
      pathname: location.pathname,
      productId,
    });
    const gaIds = Array.from(
      new Set(
        [
          ...(tracking.ga4Ids || []),
          ...(tracking.googleAnalyticsIds || []),
        ].filter(Boolean),
      ),
    );
    const gtmIds = Array.isArray(tracking.gtmIds) ? tracking.gtmIds : [];
    const pixelIds = normalizeTrackingIds(tracking.pixelIds);
    const customTrackingCode = (tracking.customTrackingCodes || [])
      .map((entry) => sanitizeInlineScript(entry))
      .filter(Boolean)
      .join("\n");

    if (typeof window !== "undefined") {
      window.__MARKETING_STATE__ = {
        ready: true,
        dataLayerEnabled: tracking.dataLayerEnabled !== false,
        pixelIds,
        gaIds,
        gtmIds,
        pathname: location.pathname,
      };
    }

    if (gaIds.length > 0) {
      syncExternalScript(
        "ga-script-src",
        `https://www.googletagmanager.com/gtag/js?id=${gaIds[0]}`,
      );
      syncInlineScript(
        "ga-script-inline",
        `window.dataLayer = window.dataLayer || []; window.gtag = window.gtag || function(){dataLayer.push(arguments);}; gtag('js', new Date()); ${gaIds
          .map(
            (gaId) => `gtag('config', '${gaId}', { send_page_view: false });`,
          )
          .join(" ")}`,
      );
    } else {
      syncExternalScript("ga-script-src", "");
      syncInlineScript("ga-script-inline", "");
    }

    if (gtmIds.length > 0) {
      syncInlineScript(
        "gtm-script-inline",
        gtmIds
          .map(
            (gtmId) =>
              `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
          )
          .join(" "),
      );
    } else {
      syncInlineScript("gtm-script-inline", "");
    }

    syncFacebookPixels(pixelIds);

    syncInlineScript("custom-tracking-inline", customTrackingCode);
    flushPendingTrackingEvents();

    pushDataLayerEvent("tracking_context", {
      page_key: resolveMarketingPageKey(location.pathname),
      page_path: `${location.pathname}${location.search || ""}`,
      page_location: typeof window !== "undefined" ? window.location.href : "",
      pixel_ids: pixelIds,
      ga_ids: gaIds,
      gtm_ids: gtmIds,
      sitemap_url:
        settings?.seoAnalytics?.sitemap?.publicSitemapUrl ||
        getFallbackSitemapUrl(),
      robots_url:
        settings?.seoAnalytics?.sitemap?.publicRobotsUrl ||
        getFallbackRobotsUrl(settings?.website?.siteUrl),
    });
  }, [
    location.pathname,
    location.search,
    settings,
    settingsReady,
    productContextKey,
  ]);

  return null;
}

function PageTitleManager({ settings }) {
  const location = useLocation();

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (
      location.pathname === "/" ||
      location.pathname === "/home" ||
      location.pathname === "/shop" ||
      matchPath("/product/:id", location.pathname) ||
      matchPath("/lp/:slug", location.pathname)
    ) {
      return;
    }

    const website = settings?.website || {};
    const seo = settings?.seo || {};
    const hasExplicitEntries = Boolean(
      settings?.seoAnalytics?.hasExplicitEntries,
    );
    const seoEntry = getActiveMarketingEntry(settings, {
      type: "seo",
      pathname: location.pathname,
    });
    const storeNameTrimmed = String(website.storeName || "").trim();
    const storeName = storeNameTrimmed || "E-Commerce";
    const routeTitle = resolveStaticPageTitle(location.pathname);
    const nextTitle = formatDocumentTitle(
      settings,
      applyMarketingTemplate(seoEntry?.metaTitle, {
        storeName,
        pageName: routeTitle,
      }) ||
        (!hasExplicitEntries ? seo.metaTitle : "") ||
        routeTitle,
    );

    applySeoMetadata({
      title: nextTitle,
      description: String(
        applyMarketingTemplate(seoEntry?.metaDescription, {
          storeName,
          pageName: routeTitle,
        }) ||
          (!hasExplicitEntries ? seo.metaDescription : "") ||
          website.tagline ||
          "",
      ).trim(),
      keywords: String(
        applyMarketingTemplate(seoEntry?.metaKeywords, {
          storeName,
          pageName: routeTitle,
        }) ||
          (!hasExplicitEntries ? seo.metaKeywords : "") ||
          "",
      ).trim(),
      image: String(
        applyMarketingTemplate(seoEntry?.openGraphImage, {
          storeName,
          pageName: routeTitle,
        }) ||
          (!hasExplicitEntries ? seo.openGraphImage : "") ||
          website.headerIconUrl ||
          website.logoUrl ||
          "",
      ).trim(),
      url: typeof window !== "undefined" ? window.location.href : "",
      siteName: storeName,
      type: "website",
    });
  }, [location.key, location.pathname, location.search, settings]);

  return null;
}

function App() {
  const dispatch = useDispatch();
  const { user, token, isLoading } = useAuth();
  const { settings, loaded: publicSettingsLoaded } = usePublicSettings();
  const adminDraft = useSelector(selectAdminSettingsDraft);
  const { adminStatus, saveStatus } = useSelector(selectPublicSettingsState);

  useEffect(() => {
    dispatch(loadWishlist());
  }, [dispatch]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleSettingsUpdated = () => {
      dispatch(loadPublicSettings({ force: true }));
    };
    const handleSettingsStorage = (event) => {
      if (event.key === "publicSettingsUpdatedAt") {
        dispatch(loadPublicSettings({ force: true }));
      }
    };
    const handleWishlistSync = () => {
      dispatch(loadWishlist());
    };

    window.addEventListener("publicSettingsUpdated", handleSettingsUpdated);
    window.addEventListener("storage", handleSettingsStorage);
    window.addEventListener("userLoggedIn", handleWishlistSync);
    window.addEventListener("userLoggedOut", handleWishlistSync);
    window.addEventListener("wishlistUpdated", handleWishlistSync);
    return () => {
      window.removeEventListener(
        "publicSettingsUpdated",
        handleSettingsUpdated,
      );
      window.removeEventListener("storage", handleSettingsStorage);
      window.removeEventListener("userLoggedIn", handleWishlistSync);
      window.removeEventListener("userLoggedOut", handleWishlistSync);
      window.removeEventListener("wishlistUpdated", handleWishlistSync);
    };
  }, [dispatch]);

  useEffect(() => {
    if (!user || !token) {
      dispatch(stopNotificationStream());
      dispatch(clearNotifications());
      return undefined;
    }

    dispatch(fetchNotifications());
    dispatch(startNotificationStream());

    return () => {
      dispatch(stopNotificationStream());
    };
  }, [dispatch, token, user]);

  useEffect(() => {
    if (!user || !token) return;

    const userType = String(user?.userType || "").trim().toLowerCase();
    if (userType !== "admin") return;

    dispatch(loadAdminSettings()).catch(() => undefined);
  }, [dispatch, token, user]);

  useEffect(() => {
    const shouldUseAdminWebsite =
      adminStatus === "succeeded" ||
      saveStatus === "loading" ||
      saveStatus === "succeeded";
    const website = shouldUseAdminWebsite
      ? adminDraft?.website || settings?.website || {}
      : settings?.website || {};
    const themeColor = normalizeThemeColor(website?.themeColor);
    const buttonTextColor = normalizeButtonTextColor(website?.buttonTextColor);
    const secondaryButtonColor = normalizeSecondaryButtonColor(
      website?.secondaryButtonColor,
    );
    const secondaryButtonTextColor = normalizeSecondaryButtonTextColor(
      website?.secondaryButtonTextColor,
    );
    const fontFamily = normalizeFontFamily(website?.fontFamily);
    const themeShadow = hexToRgba(themeColor, 0.24);

    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(
        "--brand-theme-color",
        themeColor,
      );
      document.documentElement.style.setProperty(
        "--brand-button-text-color",
        buttonTextColor,
      );
      document.documentElement.style.setProperty(
        "--brand-secondary-button-color",
        secondaryButtonColor,
      );
      document.documentElement.style.setProperty(
        "--brand-secondary-button-text-color",
        secondaryButtonTextColor,
      );
      document.documentElement.style.setProperty(
        "--brand-theme-shadow",
        themeShadow,
      );
      document.documentElement.style.setProperty(
        "--brand-font-family",
        fontFamily,
      );
    }

    applyPublicSettingsDocument(settings);
  }, [adminDraft?.website, adminStatus, saveStatus, settings]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <Router>
      <NavigationScrollManager />
      <MarketingScriptsManager
        settings={settings}
        settingsReady={publicSettingsLoaded}
      />
      <PageTitleManager settings={settings} />
      <PageViewTracker enabled={publicSettingsLoaded} />
      <Toaster
        position="top-center"
        gutter={10}
        containerStyle={{ zIndex: 130000 }}
        toastOptions={GLOBAL_TOAST_OPTIONS}
      />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* Auth routes - redirect if already logged in */}
          <Route
            path="/login"
            element={user ? <Navigate to="/dashboard" replace /> : <Login />}
          />
          <Route
            path="/register"
            element={user ? <Navigate to="/dashboard" replace /> : <Register />}
          />
          <Route
            path="/forgot-password"
            element={
              user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />
            }
          />
          <Route
            path="/reset-password/:token"
            element={
              user ? <Navigate to="/dashboard" replace /> : <ResetPassword />
            }
          />

          {/* Dashboard (protected) */}
          <Route
            path="/dashboard/*"
            element={user ? <Dashboard /> : <Navigate to="/login" replace />}
          />

          {/* Public site routes */}
          <Route path="/*" element={<PublicLayout />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
