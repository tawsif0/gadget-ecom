const safeString = (value) => String(value || "").trim();

const normalizeAnalyticsSettings = (value = {}) => ({
  facebookPixelId: safeString(
    value?.facebookPixelId || value?.metaPixelId || value?.pixelId || "",
  ),
  ga4MeasurementId: safeString(
    value?.ga4MeasurementId || value?.googleAnalyticsId || "",
  ),
  googleAnalyticsId: safeString(
    value?.googleAnalyticsId || value?.ga4MeasurementId || "",
  ),
  gtmId: safeString(value?.gtmId || ""),
  customTrackingCode: safeString(value?.customTrackingCode || ""),
  enableDataLayer:
    value?.enableDataLayer === undefined
      ? true
      : Boolean(value.enableDataLayer),
  enableGoogleLogin: Boolean(value?.enableGoogleLogin),
  enableFacebookLogin: Boolean(value?.enableFacebookLogin),
});

module.exports = {
  normalizeAnalyticsSettings,
};
