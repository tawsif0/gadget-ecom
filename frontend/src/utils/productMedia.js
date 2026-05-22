export const MAX_PRODUCT_VIDEO_SIZE_BYTES = 9 * 1024 * 1024;
export const MAX_PRODUCT_VIDEO_UPLOADS = 3;

export const PRODUCT_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
];

export const isAllowedProductVideoType = (file) =>
  PRODUCT_VIDEO_MIME_TYPES.includes(String(file?.type || "").toLowerCase());

const normalizeUrl = (value) => String(value || "").trim();

export const normalizeProductVideoEntries = (product = {}) => {
  const legacyEntry =
    product?.video
      ? [
          {
            url: String(product.video || "").trim(),
            publicId: String(product.videoPublicId || "").trim(),
            mimeType: String(product.videoMimeType || "").trim(),
          },
        ]
      : [];

  const entries = Array.isArray(product?.videos) ? product.videos : legacyEntry;

  return entries
    .map((entry) => {
      if (typeof entry === "string") {
        return { url: normalizeUrl(entry), publicId: "", mimeType: "" };
      }

      return {
        url: normalizeUrl(entry?.url || entry?.src || entry?.video || ""),
        publicId: normalizeUrl(entry?.publicId || ""),
        mimeType: normalizeUrl(entry?.mimeType || ""),
      };
    })
    .filter((entry) => Boolean(entry.url));
};

export const normalizeProductYouTubeUrls = (product = {}) => {
  const values = Array.isArray(product?.youtubeVideoUrls)
    ? product.youtubeVideoUrls
    : product?.youtubeVideoUrl
      ? [product.youtubeVideoUrl]
      : [];

  return [...new Set(values.map((value) => normalizeHttpsUrl(value)).filter(Boolean))];
};

export const normalizeHttpsUrl = (value) => {
  const raw = normalizeUrl(value);
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/^http:\/\//i, "https://");
  }

  return `https://${raw.replace(/^\/+/, "")}`;
};

export const extractYouTubeVideoId = (value) => {
  const raw = normalizeUrl(value);
  if (!raw) return "";

  const normalized = normalizeHttpsUrl(raw);

  try {
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") {
      return url.pathname.replace(/\//g, "").trim();
    }

    if (host.endsWith("youtube.com")) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v") || "";
      }

      const pathParts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(pathParts[0])) {
        return pathParts[1] || "";
      }
    }
  } catch {
    return "";
  }

  return "";
};

export const getYouTubeThumbnailUrl = (value) => {
  const videoId = extractYouTubeVideoId(value);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";
};

export const getYouTubeEmbedUrl = (value, { autoplay = false } = {}) => {
  const videoId = extractYouTubeVideoId(value);
  if (!videoId) return "";

  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
    fs: "0",
    disablekb: "1",
    autoplay: autoplay ? "1" : "0",
  });

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
};
