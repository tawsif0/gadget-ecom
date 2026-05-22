const mongoose = require("mongoose");

const variationAttributeSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    value: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
  },
  { _id: false },
);

const variationSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    sku: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Variation price cannot be negative"],
    },
    salePrice: {
      type: Number,
      default: null,
      min: [0, "Variation sale price cannot be negative"],
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, "Variation stock cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    attributes: {
      type: [variationAttributeSchema],
      default: [],
    },
  },
  { _id: true },
);

const productVariantOptionSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    value: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
    colorHex: {
      type: String,
      trim: true,
      default: "",
      maxlength: 20,
    },
    priceMode: {
      type: String,
      enum: ["default", "direct", "compare"],
      default: "default",
    },
    price: {
      type: Number,
      default: null,
      min: [0, "Variant option price cannot be negative"],
    },
    comparePrice: {
      type: Number,
      default: null,
      min: [0, "Variant option compare price cannot be negative"],
    },
  },
  { _id: false },
);

const productVariantDefinitionSchema = new mongoose.Schema(
  {
    preset: {
      type: String,
      enum: ["size", "color", "custom"],
      default: "custom",
    },
    name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    options: {
      type: [productVariantOptionSchema],
      default: [],
    },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema({
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
    required: false,
    index: true,
  },
  approvalStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "approved",
    index: true,
  },
  rejectionReason: {
    type: String,
    default: "",
    trim: true,
    maxlength: 300,
  },
  title: {
    type: String,
    required: [
      function requiredTitle() {
        return String(this.publicationStatus || "published") !== "draft";
      },
      "Product title is required",
    ],
    trim: true,
    minlength: [3, "Product title must be at least 3 characters"],
    maxlength: [200, "Product title cannot exceed 200 characters"],
  },
  description: {
    type: String,
    required: [
      function requiredDescription() {
        return String(this.publicationStatus || "published") !== "draft";
      },
      "Product description is required",
    ],
    trim: true,
  },
  price: {
    type: Number,
    required: [
      function requiredPrice() {
        return String(this.publicationStatus || "published") !== "draft";
      },
      "Product price is required",
    ],
    min: [0, "Price must be at least 0"],
  },
  salePrice: {
    type: Number,
    default: null,
    min: [0, "Sale price must be at least 0"],
  },
  priceType: {
    type: String,
    enum: ["single", "best", "tba"],
    default: "single",
  },
  costing: {
    type: Number,
    default: 0,
    min: [0, "Costing cannot be negative"],
  },
  sku: {
    type: String,
    trim: true,
    default: "",
    maxlength: 80,
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, "Stock cannot be negative"],
  },
  lowStockThreshold: {
    type: Number,
    default: 5,
    min: [0, "Low stock threshold cannot be negative"],
  },
  allowBackorder: {
    type: Boolean,
    default: false,
  },
  showStockToPublic: {
    type: Boolean,
    default: false,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: [
      function requiredCategory() {
        return String(this.publicationStatus || "published") !== "draft";
      },
      "Product category is required",
    ],
  },
  commissionType: {
    type: String,
    enum: ["inherit", "percentage", "fixed", "hybrid"],
    default: "inherit",
  },
  commissionValue: {
    type: Number,
    default: 0,
    min: [0, "Commission value cannot be negative"],
  },
  commissionFixed: {
    type: Number,
    default: 0,
    min: [0, "Fixed commission cannot be negative"],
  },
  isRecurring: {
    type: Boolean,
    default: false,
  },
  recurringInterval: {
    type: String,
    enum: ["weekly", "monthly", "quarterly", "yearly"],
    default: "monthly",
  },
  recurringIntervalCount: {
    type: Number,
    default: 1,
    min: [1, "Recurring interval count must be at least 1"],
    max: [24, "Recurring interval count cannot exceed 24"],
  },
  recurringTotalCycles: {
    type: Number,
    default: 0,
    min: [0, "Recurring cycle count cannot be negative"],
  },
  recurringTrialDays: {
    type: Number,
    default: 0,
    min: [0, "Recurring trial days cannot be negative"],
  },
  // ADDED: Product type field
  productType: {
    type: String,
    enum: [
      "General",
      "Popular",
      "Hot deals",
      "Best Selling",
      "Latest",
    ],
    default: "General",
  },
  marketplaceType: {
    type: String,
    enum: [
      "simple",
      "variable",
      "digital",
      "service",
      "grouped",
    ],
    default: "simple",
  },
  brand: {
    type: String,
    trim: true,
    default: "",
  },
  weight: {
    type: Number,
    default: 0,
    min: [0, "Weight cannot be negative"],
  },
  dimensions: {
    type: String,
    trim: true,
    default: "",
  },
  colors: [
    {
      type: String,
      trim: true,
    },
  ],
  features: [
    {
      type: String,
      trim: true,
    },
  ],
  specifications: [
    {
      key: String,
      value: String,
    },
  ],
  variations: {
    type: [variationSchema],
    default: [],
  },
  variantDefinitions: {
    type: [productVariantDefinitionSchema],
    default: [],
  },
  groupedProducts: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    default: [],
  },
  downloadUrl: {
    type: String,
    trim: true,
    default: "",
  },
  serviceDurationDays: {
    type: Number,
    default: 0,
    min: [0, "Service duration cannot be negative"],
  },
  deliveryMinDays: {
    type: Number,
    default: 2,
    min: [0, "Minimum delivery days cannot be negative"],
  },
  deliveryMaxDays: {
    type: Number,
    default: 5,
    min: [0, "Maximum delivery days cannot be negative"],
  },
  ratingAverage: {
    type: Number,
    default: 0,
    min: [0, "Rating average cannot be negative"],
    max: [5, "Rating average cannot exceed 5"],
  },
  ratingCount: {
    type: Number,
    default: 0,
    min: [0, "Rating count cannot be negative"],
  },
  // Supports data URIs, legacy paths, or ProductImage IDs
  images: [
    {
      type: mongoose.Schema.Types.Mixed,
    },
  ],
  videos: [
    {
      url: {
        type: String,
        trim: true,
        default: "",
      },
      publicId: {
        type: String,
        trim: true,
        default: "",
      },
      mimeType: {
        type: String,
        trim: true,
        default: "",
      },
    },
  ],
  video: {
    type: String,
    trim: true,
    default: "",
  },
  videoPublicId: {
    type: String,
    trim: true,
    default: "",
  },
  videoMimeType: {
    type: String,
    trim: true,
    default: "",
  },
  youtubeVideoUrl: {
    type: String,
    trim: true,
    default: "",
  },
  youtubeVideoUrls: [
    {
      type: String,
      trim: true,
      default: "",
    },
  ],
  isActive: {
    type: Boolean,
    default: true,
  },
  publicationStatus: {
    type: String,
    enum: ["draft", "published"],
    default: "published",
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

productSchema.pre("validate", function (next) {
  if (String(this.publicationStatus || "published") === "draft") {
    return next();
  }

  if (
    this.priceType === "best" &&
    (this.salePrice === null || this.salePrice === undefined)
  ) {
    this.invalidate("salePrice", "New price is required for best price type");
  }

  if (
    this.priceType === "best" &&
    this.salePrice !== null &&
    this.salePrice !== undefined &&
    this.salePrice >= this.price
  ) {
    this.invalidate("salePrice", "New price must be lower than previous price");
  }

  if (
    this.priceType === "single" &&
    this.salePrice !== null &&
    this.salePrice !== undefined
  ) {
    this.invalidate("salePrice", "Sale price is not allowed for single price type");
  }

  if (
    this.priceType === "tba" &&
    (Number(this.price || 0) > 0 || this.salePrice !== null)
  ) {
    this.invalidate("price", "TBA price type cannot have numeric prices");
  }

  if (
    this.salePrice !== null &&
    this.salePrice !== undefined &&
    this.salePrice > this.price
  ) {
    this.invalidate("salePrice", "Sale price cannot be greater than regular price");
  }

  if (this.deliveryMinDays > this.deliveryMaxDays) {
    this.invalidate(
      "deliveryMaxDays",
      "Maximum delivery days must be greater than or equal to minimum delivery days",
    );
  }

  if (this.marketplaceType === "variable" && (!this.variations || !this.variations.length)) {
    this.invalidate("variations", "At least one variation is required for variable products");
  }

  if (
    this.marketplaceType === "digital" &&
    !String(this.downloadUrl || "").trim()
  ) {
    this.invalidate("downloadUrl", "Download URL is required for digital products");
  }

  if (this.isRecurring) {
    if (this.priceType === "tba") {
      this.invalidate("priceType", "Recurring products cannot use TBA price type");
    }

    if (!["simple", "digital", "service"].includes(this.marketplaceType)) {
      this.invalidate(
        "marketplaceType",
        "Recurring products are allowed only for simple, digital, or service types",
      );
    }
  }

  next();
});

productSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

productSchema.pre("findOneAndUpdate", function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

productSchema.index({ isActive: 1, publicationStatus: 1, approvalStatus: 1, createdAt: -1 });
productSchema.index({
  isActive: 1,
  publicationStatus: 1,
  productType: 1,
  approvalStatus: 1,
  createdAt: -1,
});
productSchema.index({ vendor: 1, createdAt: -1 });
productSchema.index({ category: 1, isActive: 1, publicationStatus: 1, createdAt: -1 });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
