// backend/scripts/seedProducts.js

/**
 * Seed script to create categories and products (with variants) for the e-commerce app.
 * Run with: npm run seed
 *
 * Notes:
 * - Uses the same dotenv behavior as `backend/server.js` so it seeds the same DB.
 * - Re-seeding is idempotent for categories and replaces previously-seeded products by title.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

// Load models (relative to backend directory)
const Category = require(path.join(__dirname, "..", "models", "Category"));
const Product = require(path.join(__dirname, "..", "models", "Product"));

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ecommerce_office";

const placeholderImage = (id) =>
  `https://res.cloudinary.com/${
    process.env.CLOUDINARY_CLOUD_NAME || "demo"
  }/image/upload/v1690000000/seed/product_${id}.jpg`;

const makeProduct = (title, basePrice, categoryId, description = "") => {
  const skuBase = String(title || "")
    .replace(/\s+/g, "_")
    .toUpperCase();

  const variants = [
    {
      label: "Standard",
      sku: `${skuBase}_STD`,
      price: basePrice,
      stock: 100,
      isActive: true,
      attributes: [],
    },
    {
      label: "Premium",
      sku: `${skuBase}_PRM`,
      price: Math.round(basePrice * 1.2),
      salePrice: Math.round(basePrice * 1.1),
      stock: 50,
      isActive: true,
      attributes: [],
    },
  ];

  return {
    title,
    description: description || `High-quality ${String(title || "").toLowerCase()}`,
    price: basePrice,
    productType: "Latest",
    marketplaceType: "simple",
    category: categoryId,
    images: [{ type: "image", url: placeholderImage(skuBase) }],
    variations: variants,
    isActive: true,
    publicationStatus: "published",
    approvalStatus: "approved",
  };
};

async function main() {
  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  console.log("✅ Connected to MongoDB");

  // ---------- Categories ----------
  const categoryNames = [
    "iphone",
    "charger",
    "backcover",
    "screen protector",
    "latest-accessories",
    "latest-gadgets",
    "latest-audio",
    "latest-wearables",
  ];

  const categoryMap = {};
  for (const name of categoryNames) {
    const cat = await Category.findOneAndUpdate(
      { name },
      { name, type: "Latest", isActive: true, updatedAt: Date.now() },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    categoryMap[name] = cat._id;
  }

  console.log(`✅ Ensured ${categoryNames.length} categories`);

  // ---------- Products ----------
  const sampleProducts = [
    { title: "iPhone 14 Pro Max", price: 1199, cat: "iphone" },
    { title: "iPhone 14", price: 999, cat: "iphone" },
    { title: "iPhone 13", price: 799, cat: "iphone" },
    { title: "20W Fast Charger", price: 29, cat: "charger" },
    { title: "Wireless Charger Pad", price: 49, cat: "charger" },
    { title: "Leather Backcover", price: 35, cat: "backcover" },
    { title: "Silicone Backcover", price: 19, cat: "backcover" },
    { title: "Tempered Glass Screen Protector", price: 15, cat: "screen protector" },
    { title: "Anti-Glare Screen Protector", price: 12, cat: "screen protector" },
    { title: "Bluetooth Earbuds X1", price: 99, cat: "latest-audio" },
    { title: "Smartwatch Series 5", price: 199, cat: "latest-wearables" },
    { title: "Portable Power Bank 10000mAh", price: 39, cat: "latest-accessories" },
    { title: "4K Action Camera", price: 149, cat: "latest-gadgets" },
    { title: "Noise-Canceling Headphones", price: 149, cat: "latest-audio" },
    { title: "Fitness Tracker Pro", price: 79, cat: "latest-wearables" },
    { title: "USB-C Hub 7-in-1", price: 49, cat: "latest-accessories" },
    { title: "Mini Drone with Camera", price: 129, cat: "latest-gadgets" },
    { title: "Wireless Gaming Mouse", price: 59, cat: "latest-accessories" },
    { title: "Mechanical Keyboard RGB", price: 119, cat: "latest-accessories" },
    { title: "Smart Light Bulb Pack (3)", price: 45, cat: "latest-gadgets" },
    { title: "VR Headset", price: 299, cat: "latest-gadgets" },
    { title: "Portable Bluetooth Speaker", price: 79, cat: "latest-audio" },
    { title: "Smart Home Hub", price: 129, cat: "latest-gadgets" },
    { title: "Fitness Smart Scale", price: 59, cat: "latest-wearables" },
    { title: "USB-C to Lightning Cable 2m", price: 19, cat: "charger" },
    { title: "Screen Protector Bundle (5 pcs)", price: 45, cat: "screen protector" },
    { title: "Carbon Fiber Backcover", price: 49, cat: "backcover" },
    { title: "MagSafe Charger", price: 39, cat: "charger" },
    { title: "Gaming Chair", price: 199, cat: "latest-accessories" },
    { title: "Wireless Earphone Pro", price: 129, cat: "latest-audio" },
    { title: "Smart Doorbell", price: 149, cat: "latest-gadgets" },
  ];

  const seedTitles = sampleProducts.map((p) => p.title);
  await Product.deleteMany({ title: { $in: seedTitles } });

  const productsData = sampleProducts.map((p) =>
    makeProduct(p.title, p.price, categoryMap[p.cat]),
  );

  const result = await Product.insertMany(productsData, { ordered: true });
  console.log(`✅ Inserted ${result.length} products`);

  await mongoose.disconnect();
  console.log("✅ Disconnected from MongoDB");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed script error:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});

