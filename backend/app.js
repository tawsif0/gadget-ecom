const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const authRoutes = require("./routes/authRoutes");
const authController = require("./controllers/authController");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const errorHandler = require("./middlewares/errorHandler");
const {
  singleStoreResponseSanitizer,
} = require("./middlewares/singleStoreResponseSanitizer");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const couponRoutes = require("./routes/couponRoutes");
const bannerRoutes = require("./routes/bannerRoutes");
const shippingRoutes = require("./routes/shippingRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const accountRoutes = require("./routes/accountRoutes");
const landingPageRoutes = require("./routes/landingPageRoutes");
const abandonedOrderRoutes = require("./routes/abandonedOrderRoutes");
const reportRoutes = require("./routes/reportRoutes");
const brandRoutes = require("./routes/brandRoutes");
const contactRoutes = require("./routes/contactRoutes");
const path = require("path");

const app = express();
const isProduction = process.env.NODE_ENV === "production";
app.disable("x-powered-by");

const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

const normalizeOrigin = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const isAllowedLocalDevOrigin = (origin) => {
  if (!origin || isProduction) return false;

  try {
    const parsed = new URL(origin);
    return LOCAL_DEV_HOSTS.has(parsed.hostname);
  } catch (_error) {
    return false;
  }
};

const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://ecommerce.arbeittechnology.com",
  ]
    .map(normalizeOrigin)
    .filter(Boolean),
);

const resolveCorsOrigin = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return null;
  }

  if (
    allowedOrigins.has(normalizedOrigin) ||
    isAllowedLocalDevOrigin(normalizedOrigin)
  ) {
    return normalizedOrigin;
  }

  return null;
};

const GATEWAY_CALLBACK_PATH_PATTERN =
  /^\/api\/orders\/payments\/[^/]+\/callback$/i;

const baseCorsOptions = {
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
};

const corsOptionsDelegate = (req, callback) => {
  if (GATEWAY_CALLBACK_PATH_PATTERN.test(String(req.path || "").trim())) {
    callback(null, {
      ...baseCorsOptions,
      origin: true,
    });
    return;
  }

  callback(null, {
    ...baseCorsOptions,
    origin(origin, next) {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return next(null, true);

      const resolvedOrigin = resolveCorsOrigin(origin);

      if (resolvedOrigin) {
        next(null, true);
      } else {
        console.log(`CORS blocked for origin: ${origin}`);
        next(new Error("Not allowed by CORS"));
      }
    },
  });
};

// Security middleware
app.use(helmet());
app.use(cors(corsOptionsDelegate)); // Use configured CORS options
if (!isProduction) {
  app.use(morgan("dev"));
}
app.use(compression({ threshold: 1024 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(singleStoreResponseSanitizer);

// Serve uploaded files
app.use(
  "/uploads/products",
  express.static(path.join(__dirname, "uploads/products"), {
    maxAge: isProduction ? "7d" : 0,
  }),
  (req, res, next) => {
    const requestOrigin = resolveCorsOrigin(req.headers.origin);
    if (requestOrigin) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    next();
  },
);

// Also serve under /api/uploads for API consistency
app.use(
  "/api/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: isProduction ? "7d" : 0,
  }),
  (req, res, next) => {
    const requestOrigin = resolveCorsOrigin(req.headers.origin);
    if (requestOrigin) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    next();
  },
);

// Add this static file serving for banner uploads (add with other static file serving)
app.use(
  "/uploads/banners",
  express.static(path.join(__dirname, "uploads/banners"), {
    maxAge: isProduction ? "7d" : 0,
  }),
  (req, res, next) => {
    const requestOrigin = resolveCorsOrigin(req.headers.origin);
    if (requestOrigin) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
    next();
  },
);

// Routes
app.get("/sitemap.xml", authController.getPublicSitemapXml);
app.get("/robots.txt", authController.getPublicRobotsTxt);
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/accounts", accountRoutes);
app.use("/api/landing-pages", landingPageRoutes);
app.use("/api/abandoned-orders", abandonedOrderRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/contact-submissions", contactRoutes);
// Simple welcome route for direct backend access
app.get("/", (req, res) => {
  res.status(200).send("Welcome to backend");
});
// Error handling middleware
app.use(errorHandler);

module.exports = app;
