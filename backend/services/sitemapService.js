const fs = require("fs/promises");
const path = require("path");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Product = require("../models/Product");
const LandingPage = require("../models/LandingPage");

const safeString = (value) => String(value || "").trim();

const stripTrailingSlash = (value) => safeString(value).replace(/\/+$/, "");

const escapeXml = (value) =>
  safeString(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const resolveApiBaseUrl = (req) => {
  const configured = stripTrailingSlash(process.env.API_PUBLIC_URL || "");
  if (configured) return configured;

  if (req?.headers?.host) {
    const forwardedProto = safeString(
      req.headers["x-forwarded-proto"] || req.protocol || "https",
    );
    return `${forwardedProto}://${req.headers.host}`;
  }

  return "";
};

const resolveStorefrontBaseUrl = (settings = {}, req) => {
  const website = settings?.website || {};
  const configured = stripTrailingSlash(
    website.siteUrl || website.storeUrl || process.env.FRONTEND_URL || "",
  );
  if (configured) return configured;

  const originHeader = stripTrailingSlash(
    req?.headers?.origin || req?.headers?.referer || "",
  );
  if (originHeader) {
    try {
      return stripTrailingSlash(new URL(originHeader).origin);
    } catch (_error) {
      return originHeader;
    }
  }

  return "http://localhost:5173";
};

const buildRobotsTxt = ({ sitemapUrl = "" } = {}) => {
  const lines = ["User-agent: *", "Allow: /"];
  if (safeString(sitemapUrl)) {
    lines.push(`Sitemap: ${safeString(sitemapUrl)}`);
  }
  lines.push("");
  return lines.join("\n");
};

const buildSitemapXml = (
  entries = [],
) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${escapeXml(entry.lastmod)}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>`;

const buildStaticUrlEntries = (storefrontBaseUrl, timestamp) => {
  const staticPaths = [
    "/",
    "/shop",
    "/contact",
    "/compare",
    "/wishlist",
    "/cart",
    "/checkout",
    "/track-order",
    "/policy/delivery",
    "/policy/shipping",
    "/policy/return",
    "/policy/privacy",
    "/policy/terms",
    "/policy/cancellation",
  ];

  return staticPaths.map((pathName) => ({
    loc: `${storefrontBaseUrl}${pathName}`,
    lastmod: timestamp,
  }));
};

const buildDynamicUrlEntries = async (storefrontBaseUrl, timestamp) => {
  const [categories, brands, products, landingPages] = await Promise.all([
    Category.find({ isActive: true }).select("_id updatedAt").lean(),
    Brand.find({ isActive: true })
      .select("name updatedAt")
      .sort({ name: 1 })
      .lean(),
    Product.find({
      isActive: true,
      publicationStatus: "published",
      approvalStatus: { $in: ["approved", null] },
    })
      .select("_id updatedAt")
      .lean(),
    LandingPage.find({ isActive: true }).select("slug updatedAt").lean(),
  ]);

  const categoryEntries = categories.map((category) => ({
    loc: `${storefrontBaseUrl}/shop?category=${category._id}`,
    lastmod: new Date(category.updatedAt || timestamp).toISOString(),
  }));

  const brandEntries = brands
    .map((brand) => ({
      name: safeString(brand.name),
      updatedAt: brand.updatedAt,
    }))
    .filter((brand) => brand.name)
    .map((brand) => ({
      loc: `${storefrontBaseUrl}/shop?brand=${encodeURIComponent(brand.name)}`,
      lastmod: new Date(brand.updatedAt || timestamp).toISOString(),
    }));

  const productEntries = products.map((product) => ({
    loc: `${storefrontBaseUrl}/product/${product._id}`,
    lastmod: new Date(product.updatedAt || timestamp).toISOString(),
  }));

  const landingPageEntries = landingPages
    .map((page) => ({
      slug: safeString(page.slug),
      updatedAt: page.updatedAt,
    }))
    .filter((page) => page.slug)
    .map((page) => ({
      loc: `${storefrontBaseUrl}/lp/${page.slug}`,
      lastmod: new Date(page.updatedAt || timestamp).toISOString(),
    }));

  return [
    ...categoryEntries,
    ...brandEntries,
    ...productEntries,
    ...landingPageEntries,
  ];
};

const generateSitemapArtifacts = async (settings = {}, req) => {
  const timestamp = new Date().toISOString();
  const storefrontBaseUrl = resolveStorefrontBaseUrl(settings, req);
  const apiBaseUrl = resolveApiBaseUrl(req);
  const sitemapUrl = apiBaseUrl ? `${apiBaseUrl}/sitemap.xml` : "";
  const robotsUrl = `${storefrontBaseUrl}/robots.txt`;

  const urlEntries = [
    ...buildStaticUrlEntries(storefrontBaseUrl, timestamp),
    ...(await buildDynamicUrlEntries(storefrontBaseUrl, timestamp)),
  ];

  const uniqueEntries = Array.from(
    new Map(urlEntries.map((entry) => [entry.loc, entry])).values(),
  );

  return {
    storefrontBaseUrl,
    sitemapUrl,
    robotsUrl,
    xml: buildSitemapXml(uniqueEntries),
    robotsTxt: buildRobotsTxt({ sitemapUrl }),
    generatedAt: timestamp,
  };
};

const syncStorefrontRobotsFile = async ({ robotsTxt = "" } = {}) => {
  const nextContent = safeString(robotsTxt);
  if (!nextContent) return false;

  const robotsFilePath = path.resolve(
    __dirname,
    "..",
    "..",
    "frontend",
    "public",
    "robots.txt",
  );

  try {
    await fs.mkdir(path.dirname(robotsFilePath), { recursive: true });
    await fs.writeFile(robotsFilePath, `${nextContent}\n`, "utf8");
    return true;
  } catch (_error) {
    return false;
  }
};

module.exports = {
  buildRobotsTxt,
  generateSitemapArtifacts,
  resolveApiBaseUrl,
  resolveStorefrontBaseUrl,
  syncStorefrontRobotsFile,
};
