/* eslint-disable no-unused-vars */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import {
  FiArrowRight,
  FiChevronDown,
  FiGrid,
  FiHeart,
  FiLogOut,
  FiMenu,
  FiPackage,
  FiSearch,
  FiShuffle,
  FiShoppingBag,
  FiUser,
  FiX,
} from "react-icons/fi";
import { toast } from "react-hot-toast";
import { useCart } from "../../context/CartContext";
import usePublicSettings from "../../hooks/usePublicSettings";
import { toPublicAssetUrl } from "../../utils/publicSettings";

const baseUrl = import.meta.env.VITE_API_URL;
const navItems = [
  { label: "Home", to: "/" },
  { label: "Shop", to: "/shop" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "FAQs", to: "/faqs" },
];
const CATEGORY_CACHE_KEY = "publicNavbarCategories";
const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000;

const readCachedCategories = () => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(CATEGORY_CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    const timestamp = Number(parsed?.timestamp || 0);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    if (!timestamp || Date.now() - timestamp > CATEGORY_CACHE_TTL_MS) {
      return [];
    }

    return items;
  } catch {
    return [];
  }
};

const writeCachedCategories = (items = []) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CATEGORY_CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        items: Array.isArray(items) ? items : [],
      }),
    );
  } catch {
    // Ignore cache write failures.
  }
};

const normalizeThemeColor = (value) =>
  /^#[0-9a-f]{6}$/i.test(String(value || "").trim())
    ? String(value).trim()
    : "#000000";

const hexToRgba = (value, alpha) => {
  const normalized = normalizeThemeColor(value);
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const normalizeLogoMode = (value) =>
  String(value || "")
    .trim()
    .toLowerCase() === "text"
    ? "text"
    : "image";

const normalizeOrderLookup = (value) =>
  String(value || "")
    .trim()
    .replace(/^order\s*#?\s*/i, "")
    .replace(/^#/, "")
    .trim();

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = usePublicSettings();
  const { cartCount } = useCart();
  const compareCount = useSelector((state) => state.compare.items?.length || 0);
  const wishlistCount = useSelector(
    (state) => state.wishlist.items?.length || 0,
  );
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuTab, setMobileMenuTab] = useState("menu");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef(null);
  const userMenuRef = useRef(null);
  const searchRef = useRef(null);
  const timeoutRef = useRef(null);

  const website = settings?.website || {};
  const accent = normalizeThemeColor(website?.themeColor);
  const accentSoft = hexToRgba(accent, 0.08);
  const accentBorder = hexToRgba(accent, 0.22);
  const accentShadow = hexToRgba(accent, 0.28);
  const accentDark = accent;
  const storeName = String(website?.storeName || "").trim();
  const brandName = storeName || "E-Commerce";
  const logoMode = normalizeLogoMode(website?.logoMode);
  const logo =
    logoMode === "image" ? toPublicAssetUrl(website?.logoUrl || "") : "";
  const logoText = String(website?.logoText || "").trim();
  const brandLogoText = logoText || brandName;
  const safeCompareCount = Number.isFinite(compareCount)
    ? compareCount
    : Number.parseInt(compareCount, 10) || 0;
  const safeCartCount = Number.isFinite(cartCount)
    ? cartCount
    : Number.parseInt(cartCount, 10) || 0;
  const safeWishlistCount = Number.isFinite(wishlistCount)
    ? wishlistCount
    : Number.parseInt(wishlistCount, 10) || 0;

  const visibleCategories = useMemo(
    () =>
      categories.filter(
        (category) => (category?.type || "").toLowerCase() !== "package",
      ),
    [categories],
  );

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const syncUser = () => {
      const token = localStorage.getItem("token");
      const userData = localStorage.getItem("user");
      setLoggedIn(Boolean(token));
      if (!userData) {
        setUserName("");
        return;
      }
      try {
        const user = JSON.parse(userData);
        setUserName(user.name || user.email?.split("@")[0] || "User");
      } catch (_error) {
        setUserName("User");
      }
    };

    syncUser();
    window.addEventListener("userLoggedIn", syncUser);
    window.addEventListener("userLoggedOut", syncUser);
    return () => {
      window.removeEventListener("userLoggedIn", syncUser);
      window.removeEventListener("userLoggedOut", syncUser);
    };
  }, []);

  useEffect(() => {
    const cachedCategories = readCachedCategories();
    if (cachedCategories.length > 0) {
      setCategories(cachedCategories);
      setLoading(false);
    }

    let active = true;

    const loadCategories = async () => {
      if (cachedCategories.length === 0 && active) {
        setLoading(true);
      }
      try {
        const response = await axios.get(`${baseUrl}/categories/public`);
        const nextCategories = response.data?.success
          ? response.data.categories || []
          : [];
        if (!active) return;
        setCategories(nextCategories);
        writeCachedCategories(nextCategories);
      } catch (_error) {
        if (!active && cachedCategories.length > 0) return;
        if (active && cachedCategories.length === 0) {
          setCategories([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    setShowSuggestions(false);
    setUserMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }

      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [mobileMenuOpen]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const loadSuggestions = async (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    try {
      const normalizedOrderQuery = normalizeOrderLookup(trimmed);
      const [productResponse, orderResponse] = await Promise.allSettled([
        axios.get(`${baseUrl}/products/public/suggestions`, {
          params: { query: trimmed, limit: 8 },
        }),
        normalizedOrderQuery.length >= 3
          ? axios.get(`${baseUrl}/orders/search`, {
              params: { query: normalizedOrderQuery },
            })
          : Promise.resolve({ data: { suggestions: [] } }),
      ]);

      const productPayload =
        productResponse.status === "fulfilled"
          ? productResponse.value.data
          : {};
      const orderPayload =
        orderResponse.status === "fulfilled" ? orderResponse.value.data : {};

      const products = Array.isArray(productPayload?.suggestions?.products)
        ? productPayload.suggestions.products.map((item) => ({
            ...item,
            resultType: "product",
          }))
        : [];
      const nextCategories = Array.isArray(
        productPayload?.suggestions?.categories,
      )
        ? productPayload.suggestions.categories.map((item) => ({
            ...item,
            resultType: "category",
          }))
        : [];
      const orders = Array.isArray(orderPayload?.suggestions)
        ? orderPayload.suggestions.map((item) => ({
            ...item,
            resultType: "order",
          }))
        : [];
      const prioritizeOrders = /^ord-/i.test(normalizedOrderQuery);
      setSuggestions(
        prioritizeOrders
          ? [...orders, ...products, ...nextCategories]
          : [...products, ...nextCategories, ...orders],
      );
    } catch (_error) {
      setSuggestions([]);
    }
  };

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setShowSuggestions(true);
    timeoutRef.current = setTimeout(() => loadSuggestions(value), 180);
  };

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    let navigatedToOrder = false;
    const normalizedOrderQuery = normalizeOrderLookup(trimmed);

    if (normalizedOrderQuery.length >= 3) {
      try {
        const response = await axios.get(`${baseUrl}/orders/search`, {
          params: { query: normalizedOrderQuery },
        });
        const orderSuggestions = Array.isArray(response.data?.suggestions)
          ? response.data.suggestions
          : [];
        const exactOrderMatch = orderSuggestions.find(
          (item) =>
            String(item?.orderNumber || "")
              .trim()
              .toLowerCase() === normalizedOrderQuery.toLowerCase(),
        );
        if (exactOrderMatch?.orderNumber) {
          navigate(
            `/track-order/${encodeURIComponent(exactOrderMatch.orderNumber)}`,
          );
          navigatedToOrder = true;
        }
      } catch (_error) {
        navigatedToOrder = false;
      }
    }

    if (!navigatedToOrder) {
      navigate(`/shop?search=${encodeURIComponent(trimmed)}`);
    }
    setQuery("");
    setShowSuggestions(false);
    setMobileSearchOpen(false);
    setMobileMenuOpen(false);
    scrollToTop();
  };

  const handleSuggestionClick = (item) => {
    navigate(
      item.resultType === "product"
        ? `/product/${item._id}`
        : item.resultType === "order"
          ? `/track-order/${encodeURIComponent(item.orderNumber)}`
          : `/shop?category=${item._id}`,
    );
    setQuery("");
    setShowSuggestions(false);
    setMobileSearchOpen(false);
    setMobileMenuOpen(false);
    scrollToTop();
  };

  const handleCategoryClick = (id) => {
    navigate(`/shop?category=${id}`);
    setCategoryOpen(false);
    setMobileMenuOpen(false);
    scrollToTop();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged out successfully");
    window.dispatchEvent(new CustomEvent("userLoggedOut"));
    navigate("/");
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
    scrollToTop();
  };

  const handleDashboardClick = () => {
    navigate("/dashboard");
    setUserMenuOpen(false);
    scrollToTop();
  };

  const handleCompareClick = () => {
    if (safeCompareCount < 2) {
      toast.error("Select at least 2 products to compare");
      return;
    }
    navigate("/compare");
    setCategoryOpen(false);
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    setShowSuggestions(false);
    scrollToTop();
  };

  const handleWishlistClick = () => {
    navigate("/wishlist");
    setCategoryOpen(false);
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    setShowSuggestions(false);
    scrollToTop();
  };

  const handleMobileRouteClick = () => {
    setCategoryOpen(false);
    setMobileMenuOpen(false);
    setMobileMenuTab("menu");
    setMobileSearchOpen(false);
    setShowSuggestions(false);
    scrollToTop();
  };

  const renderSearchBox = ({ mobile = false, className = "" } = {}) => (
    <div
      ref={searchRef}
      className={
        mobile
          ? `relative ${className}`.trim()
          : `relative min-w-0 ${className}`.trim()
      }
    >
      <form onSubmit={handleSearchSubmit} className="relative">
        <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={handleSearchChange}
          onFocus={() => query.trim() && setShowSuggestions(true)}
          placeholder="Search products, categories, or order ID..."
          autoComplete="off"
          className="h-12 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-24 text-sm text-slate-900 outline-none transition-all focus:border-slate-300 focus:bg-white focus:shadow-lg"
        />
      </form>

      {showSuggestions && query.trim() ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-11030 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          {suggestions.length > 0 ? (
            <div className="max-h-100 overflow-y-auto p-2">
              {suggestions.map((item) => (
                <button
                  key={`${item.resultType}-${item._id || item.orderNumber}`}
                  type="button"
                  onClick={() => handleSuggestionClick(item)}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ backgroundColor: accentSoft, color: accent }}
                  >
                    {item.resultType === "product" ? (
                      <FiShoppingBag className="h-5 w-5" />
                    ) : item.resultType === "order" ? (
                      <FiPackage className="h-5 w-5" />
                    ) : (
                      <FiGrid className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.resultType === "product"
                        ? item.title
                        : item.resultType === "order"
                          ? item.orderNumber
                          : item.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {item.resultType === "product"
                        ? item.brand || "Product"
                        : item.resultType === "order"
                          ? `${item.status || "Order"}${item.productName ? ` - ${item.productName}` : ""}`
                          : item.type || "Category"}
                    </p>
                  </div>
                  <FiArrowRight className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-slate-500">
              No results found
            </div>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <header
      className={`app-layer-header sticky top-0 bg-white transition-shadow duration-300 ${scrolled ? "shadow-lg" : "shadow-sm"}`}
    >
      <div className="site-shell">
        <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-2 py-3 sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:gap-3 lg:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => {
              setMobileMenuOpen((prev) => !prev);
              setMobileSearchOpen(false);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm sm:h-10 sm:w-10"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <FiX className="h-5 w-5" />
            ) : (
              <FiMenu className="h-5 w-5" />
            )}
          </button>
          <Link
            to="/"
            onClick={scrollToTop}
            className="flex min-w-0 items-center justify-left overflow-hidden px-1"
          >
            {logo ? (
              <img
                src={logo}
                alt={brandName}
                className="h-7 w-auto max-w-[clamp(5.5rem,28vw,8.5rem)] object-contain sm:h-8 sm:max-w-39"
              />
            ) : (
              <p className="truncate text-base font-bold tracking-tight sm:text-lg">
                {brandLogoText}
              </p>
            )}
          </Link>
          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen((prev) => !prev);
                setMobileMenuOpen(false);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm sm:h-10 sm:w-10"
              aria-label="Toggle search"
            >
              {mobileSearchOpen ? (
                <FiX className="h-5 w-5" />
              ) : (
                <FiSearch className="h-5 w-5" />
              )}
            </button>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={handleCompareClick}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm sm:h-10 sm:w-10"
                aria-label="Open compare"
              >
                <FiShuffle className="h-5 w-5" />
              </button>
              {safeCompareCount > 0 ? (
                <span className="pointer-events-none absolute -right-1 -top-1 z-10 inline-flex min-w-4.5 items-center justify-center rounded-full border-2 border-white bg-slate-950 px-1 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  {safeCompareCount > 99 ? "99+" : safeCompareCount}
                </span>
              ) : null}
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={handleWishlistClick}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm sm:h-10 sm:w-10"
                aria-label="Open wishlist"
              >
                <FiHeart className="h-5 w-5" />
              </button>
              {safeWishlistCount > 0 ? (
                <span className="pointer-events-none absolute -right-1 -top-1 z-10 inline-flex min-w-4.5 items-center justify-center rounded-full border-2 border-white bg-slate-950 px-1 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  {safeWishlistCount > 99 ? "99+" : safeWishlistCount}
                </span>
              ) : null}
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  navigate("/cart");
                  scrollToTop();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm sm:h-10 sm:w-10"
                aria-label="Open cart"
              >
                <FiShoppingBag className="h-5 w-5" />
              </button>
              {safeCartCount > 0 ? (
                <span
                  className="pointer-events-none absolute -right-1 -top-1 z-10 inline-flex min-w-4.5 items-center justify-center rounded-full border-2 border-white px-1 py-0.5 text-[10px] font-bold text-white shadow-sm"
                  style={{
                    background: `linear-gradient(135deg, ${accent}, ${accentDark})`,
                  }}
                >
                  {safeCartCount > 99 ? "99+" : safeCartCount}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-4 py-3 lg:flex lg:gap-6 lg:py-4">
          <Link
            to="/"
            onClick={scrollToTop}
            className="flex min-w-0 items-center"
          >
            {logo ? (
              <img
                src={logo}
                alt={brandName}
                className="h-10 w-auto max-w-37.5 object-contain sm:h-11 sm:max-w-42.5 lg:h-12 lg:max-w-45"
              />
            ) : (
              <p
                className="truncate text-xl font-bold tracking-tight"
                style={{ color: accent }}
              >
                {brandLogoText}
              </p>
            )}
          </Link>

          {renderSearchBox({
            className: "min-w-0 flex-1",
          })}

          <div className="ml-auto flex items-center gap-3">
            {loggedIn ? (
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {(userName || "U").charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden xl:block">
                    {userName || "Account"}
                  </span>
                  <FiChevronDown
                    className={`h-4 w-4 transition-transform ${userMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {userMenuOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      role="menu"
                      className="absolute right-0 top-[calc(100%+0.75rem)] z-11020 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                    >
                      <button
                        type="button"
                        onClick={handleDashboardClick}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                        role="menuitem"
                      >
                        <FiGrid className="h-4 w-4" />
                        Dashboard
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                        role="menuitem"
                      >
                        <FiLogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={scrollToTop}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm"
                >
                  <FiUser className="h-4 w-4" />
                  Login
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={handleCompareClick}
              className="relative inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm"
            >
              <FiShuffle className="h-4 w-4" />
              <span className="hidden xl:inline">Compare</span>
              {safeCompareCount > 0 ? (
                <span className="rounded-full bg-slate-950 px-2 py-1 text-xs font-bold text-white">
                  {safeCompareCount > 99 ? "99+" : safeCompareCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={handleWishlistClick}
              className="relative inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm"
            >
              <FiHeart className="h-4 w-4" />
              <span className="hidden xl:inline">Wishlist</span>
              {safeWishlistCount > 0 ? (
                <span className="rounded-full bg-slate-950 px-2 py-1 text-xs font-bold text-white">
                  {safeWishlistCount > 99 ? "99+" : safeWishlistCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => {
                navigate("/cart");
                scrollToTop();
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm"
            >
              <FiShoppingBag className="h-4 w-4" />
              <span className="hidden xl:inline">Cart</span>
              {safeCartCount > 0 ? (
                <span className="rounded-full bg-slate-950 px-2 py-1 text-xs font-bold text-white">
                  {safeCartCount > 99 ? "99+" : safeCartCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileSearchOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-slate-200 pb-4 pt-3 lg:hidden"
            >
              {renderSearchBox({ mobile: true })}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="hidden border-t border-slate-100 lg:block">
          <div className="site-shell flex items-center gap-6 py-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setCategoryOpen((prev) => !prev)}
                className="inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold text-white"
                style={{
                  backgroundColor: accent,
                }}
              >
                <FiGrid className="h-4 w-4" />
                All Categories
                <FiChevronDown
                  className={`h-4 w-4 transition-transform ${categoryOpen ? "rotate-180" : ""}`}
                />
              </button>

              {categoryOpen ? (
                <div className="absolute left-0 top-[calc(100%+0.85rem)] z-11010 w-160 max-w-[calc(100vw-4rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="grid grid-cols-[240px_minmax(0,1fr)]">
                    <div
                      className="border-r border-slate-100 px-6 py-8"
                      style={{ backgroundColor: accentSoft }}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                        Collections
                      </p>
                      <h3 className="mt-3 text-2xl font-bold text-slate-900">
                        Shop by
                        <br />
                        Category
                      </h3>
                      <Link
                        to="/shop"
                        onClick={scrollToTop}
                        className="mt-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm"
                      >
                        View all products
                        <FiArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                    <div className="flex max-h-100 flex-wrap content-start items-start gap-2.5 overflow-y-auto p-5">
                      {loading ? (
                        <div className="text-sm text-slate-500">
                          Loading categories...
                        </div>
                      ) : (
                        visibleCategories.slice(0, 16).map((category) => (
                          <button
                            key={category._id}
                            type="button"
                            onClick={() => handleCategoryClick(category._id)}
                            className="inline-flex w-fit max-w-full shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            <span className="max-w-35 truncate font-semibold text-slate-900">
                              {category.name}
                            </span>
                            <span className="whitespace-nowrap text-[10px] uppercase tracking-widest text-slate-400">
                              {category.type || "General"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <nav className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={scrollToTop}
                  className={({ isActive }) =>
                    `rounded-full px-5 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? "text-slate-900"
                        : "text-slate-600 hover:text-slate-900"
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                          backgroundColor: accentSoft,
                          boxShadow: `inset 0 0 0 1px ${accentBorder}`,
                        }
                      : undefined
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="app-layer-drawer-overlay fixed inset-0 bg-slate-950/30"
              aria-label="Close menu overlay"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.24 }}
              className="app-layer-drawer fixed inset-y-0 left-0 w-[88vw] max-w-sm border-r border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
                  <Link
                    to="/"
                    onClick={handleMobileRouteClick}
                    className="flex min-w-0 items-center overflow-hidden"
                  >
                    {logo ? (
                      <img
                        src={logo}
                        alt={brandName}
                        className="h-8 w-auto max-w-39 object-contain"
                      />
                    ) : (
                      <p
                        className="truncate text-lg font-bold tracking-tight"
                        style={{ color: accent }}
                      >
                        {brandLogoText}
                      </p>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => setMobileMenuTab("menu")}
                    className={`h-11 rounded-2xl text-sm font-semibold tracking-wide transition ${
                      mobileMenuTab === "menu"
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Menu
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileMenuTab("categories")}
                    className={`h-11 rounded-2xl text-sm font-semibold tracking-wide transition ${
                      mobileMenuTab === "categories"
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Categories
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-5">
                  {mobileMenuTab === "categories" ? (
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Categories
                        </h3>
                        <Link
                          to="/shop"
                          onClick={handleMobileRouteClick}
                          className="text-xs font-semibold text-slate-500 underline underline-offset-4"
                        >
                          View all
                        </Link>
                      </div>
                      <div className="space-y-2">
                        {visibleCategories.map((category) => (
                          <button
                            key={category._id}
                            type="button"
                            onClick={() => handleCategoryClick(category._id)}
                            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700"
                          >
                            <span className="truncate">{category.name}</span>
                            <span className="ml-3 shrink-0 rounded-full bg-white px-2 py-1 text-[10px] uppercase tracking-widest text-slate-500">
                              {category.type || "General"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {navItems.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={handleMobileRouteClick}
                          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm"
                        >
                          <span>{item.label}</span>
                          <FiArrowRight className="h-4 w-4 text-slate-400" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-200 px-4 py-4">
                  {loggedIn ? (
                    <div className="grid grid-cols-[minmax(0,1fr)_48px] gap-3">
                      <Link
                        to="/dashboard"
                        onClick={handleMobileRouteClick}
                        className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm"
                      >
                        Dashboard
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
                      >
                        <FiLogOut className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      <Link
                        to="/login"
                        onClick={handleMobileRouteClick}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-lg transition-transform duration-200 hover:-translate-y-0.5"
                        style={{
                          backgroundColor: accent,
                          boxShadow: `0 4px 12px ${accentShadow}`,
                        }}
                      >
                        <FiUser className="h-4 w-4" />
                        Login
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
