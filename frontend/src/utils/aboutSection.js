import {
  FiClock,
  FiHeart,
  FiMessageCircle,
  FiPackage,
  FiRefreshCw,
  FiShield,
  FiStar,
  FiTruck,
} from "react-icons/fi";

const normalizeString = (value) => String(value || "").trim();

const normalizeColorValue = (value, fallback) => {
  const normalized = normalizeString(value);
  return normalized || fallback;
};

const resolveLegacyBackgroundColor = (value, fallback) => {
  const normalized = normalizeString(value).toLowerCase();

  if (normalized.includes("blue")) return "#2563eb";
  if (normalized.includes("green")) return "#16a34a";
  if (normalized.includes("purple")) return "#7c3aed";
  if (normalized.includes("amber") || normalized.includes("yellow")) return "#d97706";
  if (normalized.includes("rose") || normalized.includes("red")) return "#dc2626";
  if (normalized.includes("slate") || normalized.includes("gray")) return "#111827";

  return fallback;
};

export const ABOUT_CARD_ICON_OPTIONS = [
  { value: "truck", label: "Truck" },
  { value: "shield", label: "Shield" },
  { value: "refresh", label: "Refresh" },
  { value: "package", label: "Package" },
  { value: "message", label: "Message" },
  { value: "clock", label: "Clock" },
  { value: "heart", label: "Heart" },
  { value: "star", label: "Star" },
];

export const ABOUT_CARD_ICON_MAP = {
  truck: FiTruck,
  shield: FiShield,
  refresh: FiRefreshCw,
  package: FiPackage,
  message: FiMessageCircle,
  clock: FiClock,
  heart: FiHeart,
  star: FiStar,
};

export const DEFAULT_ABOUT_STORY_TITLE = "Our Story";
export const DEFAULT_ABOUT_STORY_CONTENT =
  "<p>E-Commerce was shaped to close the gap between a basic online catalog and a serious ecommerce operation with stronger discovery, cleaner checkout, and tighter inventory-aware storefront control.</p><p>The platform brings products, banners, categories, support, compare flows, wishlist behavior, and branded landing content into one polished office ecommerce system.</p><p>Our mission is simple: give shoppers a smoother buying journey while giving operators stronger control over stock, pricing, orders, and storefront presentation.</p>";

export const DEFAULT_ABOUT_CARDS = [
  {
    icon: "truck",
    iconColor: "#ffffff",
    backgroundColor: "#2563eb",
    title: "Fast Shipping",
    description: "<p>Quick delivery windows and a smoother order handoff.</p>",
  },
  {
    icon: "shield",
    iconColor: "#ffffff",
    backgroundColor: "#16a34a",
    title: "Secure Payment",
    description: "<p>Protected checkout flow with clearer payment handling.</p>",
  },
  {
    icon: "refresh",
    iconColor: "#ffffff",
    backgroundColor: "#7c3aed",
    title: "Easy Returns",
    description: "<p>Clear policies and a more reliable post-purchase flow.</p>",
  },
  {
    icon: "package",
    iconColor: "#ffffff",
    backgroundColor: "#d97706",
    title: "Quality Products",
    description:
      "<p>Catalog, stock, and order controls built for dependable selling.</p>",
  },
];

export const createEmptyAboutCard = () => ({
  icon: "package",
  iconColor: "#ffffff",
  backgroundColor: "#111827",
  title: "",
  description: "",
});

export const normalizeAboutCard = (card = {}, fallback = {}) => {
  const rawIcon = normalizeString(card?.icon || card?.iconKey);
  const icon = ABOUT_CARD_ICON_MAP[rawIcon] ? rawIcon : fallback.icon || "package";
  const title = normalizeString(card?.title || fallback.title);
  const description = normalizeString(card?.description || fallback.description);
  const iconColor = normalizeColorValue(
    card?.iconColor,
    fallback.iconColor || "#ffffff",
  );
  const backgroundColor = normalizeColorValue(
    card?.backgroundColor,
    resolveLegacyBackgroundColor(
      card?.color,
      fallback.backgroundColor || "#111827",
    ),
  );

  if (!title && !description) {
    return null;
  }

  return {
    icon,
    iconColor,
    backgroundColor,
    title: title || normalizeString(fallback.title),
    description: description || normalizeString(fallback.description),
  };
};

export const normalizeAboutCards = (cards = []) =>
  (Array.isArray(cards) ? cards : [])
    .slice(0, 4)
    .map((card, index) => normalizeAboutCard(card, DEFAULT_ABOUT_CARDS[index] || {}))
    .filter(Boolean);

export const getAboutCardIconComponent = (iconKey) =>
  ABOUT_CARD_ICON_MAP[normalizeString(iconKey)] || FiPackage;
