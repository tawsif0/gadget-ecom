const baseUrl = import.meta.env.VITE_API_URL || "";

const normalizeText = (value) => String(value || "").trim();

const toAbsoluteUrl = (value) => {
  const raw = normalizeText(value);
  if (!raw) return "";

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }

  if (raw.startsWith("/")) {
    return baseUrl ? `${baseUrl}${raw}` : raw;
  }

  return baseUrl ? `${baseUrl}/${raw.replace(/^\/+/, "")}` : raw;
};

const upsertMetaTag = (selector, attributes, value) => {
  if (typeof document === "undefined") return;

  const normalizedValue = normalizeText(value);
  const existing = document.head.querySelector(selector);

  if (!normalizedValue) {
    existing?.remove();
    return;
  }

  const tag = existing || document.createElement("meta");
  Object.entries(attributes).forEach(([key, nextValue]) => {
    if (nextValue !== undefined && nextValue !== null) {
      tag.setAttribute(key, String(nextValue));
    }
  });
  tag.setAttribute("content", normalizedValue);
  tag.setAttribute("data-seo-managed", "true");

  if (!existing) {
    document.head.appendChild(tag);
  }
};

const upsertCanonicalLink = (value) => {
  if (typeof document === "undefined") return;

  const normalizedValue = normalizeText(value);
  const existing = document.head.querySelector(
    "link[data-seo-canonical='true']",
  );

  if (!normalizedValue) {
    existing?.remove();
    return;
  }

  const tag = existing || document.createElement("link");
  tag.setAttribute("rel", "canonical");
  tag.setAttribute("href", normalizedValue);
  tag.setAttribute("data-seo-canonical", "true");

  if (!existing) {
    document.head.appendChild(tag);
  }
};

export const applySeoMetadata = ({
  title,
  description,
  keywords,
  image,
  url,
  siteName,
  type = "website",
  locale = "en_US",
  noIndex = false,
} = {}) => {
  if (typeof document === "undefined") return;

  const resolvedTitle =
    normalizeText(title) || normalizeText(siteName) || "E-Commerce";
  const resolvedDescription = normalizeText(description);
  const resolvedKeywords = Array.isArray(keywords)
    ? keywords
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
        .join(", ")
    : normalizeText(keywords);
  const resolvedImage = toAbsoluteUrl(image);
  const resolvedUrl = normalizeText(url) || window.location.href;

  document.title = resolvedTitle;

  upsertMetaTag(
    'meta[name="description"]',
    { name: "description" },
    resolvedDescription,
  );
  upsertMetaTag(
    'meta[name="keywords"]',
    { name: "keywords" },
    resolvedKeywords,
  );
  upsertMetaTag(
    'meta[property="og:title"]',
    { property: "og:title" },
    resolvedTitle,
  );
  upsertMetaTag(
    'meta[property="og:description"]',
    { property: "og:description" },
    resolvedDescription || resolvedTitle,
  );
  upsertMetaTag('meta[property="og:type"]', { property: "og:type" }, type);
  upsertMetaTag(
    'meta[property="og:site_name"]',
    { property: "og:site_name" },
    siteName,
  );
  upsertMetaTag('meta[property="og:url"]', { property: "og:url" }, resolvedUrl);
  upsertMetaTag(
    'meta[property="og:image"]',
    { property: "og:image" },
    resolvedImage,
  );
  upsertMetaTag(
    'meta[name="twitter:card"]',
    { name: "twitter:card" },
    resolvedImage ? "summary_large_image" : "summary",
  );
  upsertMetaTag(
    'meta[name="twitter:title"]',
    { name: "twitter:title" },
    resolvedTitle,
  );
  upsertMetaTag(
    'meta[name="twitter:description"]',
    { name: "twitter:description" },
    resolvedDescription || resolvedTitle,
  );
  upsertMetaTag(
    'meta[name="twitter:image"]',
    { name: "twitter:image" },
    resolvedImage,
  );
  upsertMetaTag(
    'meta[name="robots"]',
    { name: "robots" },
    noIndex ? "noindex,nofollow" : "index,follow",
  );
  upsertMetaTag('meta[name="language"]', { name: "language" }, locale);

  upsertCanonicalLink(resolvedUrl);
};

export const resolveSeoImageUrl = (value) => toAbsoluteUrl(value);
