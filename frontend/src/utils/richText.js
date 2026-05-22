export const normalizeRichTextValue = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized === "<p><br></p>") return "";
  return normalized;
};

export const stripHtml = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export const hasHtmlContent = (value) => /<\/?[a-z][\s\S]*>/i.test(String(value || ""));
