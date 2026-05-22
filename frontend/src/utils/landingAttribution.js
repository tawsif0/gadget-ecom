const LANDING_ATTRIBUTION_KEY = "activeLandingAttribution";

export const getLandingAttribution = () => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(LANDING_ATTRIBUTION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const slug = String(parsed?.slug || "").trim().toLowerCase();
    const source = String(parsed?.source || "landing_page").trim().toLowerCase() || "landing_page";

    if (!slug) return null;

    return {
      slug,
      source,
      capturedAt: parsed?.capturedAt || null,
    };
  } catch {
    return null;
  }
};

export const setLandingAttribution = ({ slug, source = "landing_page" } = {}) => {
  if (typeof window === "undefined") return;

  const normalizedSlug = String(slug || "").trim().toLowerCase();
  if (!normalizedSlug) return;

  const payload = {
    slug: normalizedSlug,
    source: String(source || "landing_page").trim().toLowerCase() || "landing_page",
    capturedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(LANDING_ATTRIBUTION_KEY, JSON.stringify(payload));
};

export const clearLandingAttribution = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LANDING_ATTRIBUTION_KEY);
};

export { LANDING_ATTRIBUTION_KEY };
