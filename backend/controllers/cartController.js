// controllers/cartController.js
const Cart = require("../models/Cart.js");
const Product = require("../models/Product.js");
const { attachImageDataToProducts } = require("../utils/imageUtils");
const {
  buildSelectedVariantSummary,
  normalizeSelectedVariantsForProduct,
  normalizeSelectedVariantsPayload,
  resolveProductPricingForSelection,
} = require("../utils/productVariants");

const NON_BUYABLE_TYPES = new Set(["grouped"]);
const CART_PRODUCT_SELECT =
  "title price salePrice priceType showStockToPublic images brand category weight dimensions colors vendor marketplaceType stock allowBackorder variations variantDefinitions";

const asString = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const toPositiveInt = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
};

const normalizeVariationId = (value) => {
  const parsed = asString(value);
  return /^[0-9a-fA-F]{24}$/.test(parsed) ? parsed : "";
};

const parseSelectedVariants = (value) => {
  if (Array.isArray(value)) {
    return normalizeSelectedVariantsPayload(value);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return normalizeSelectedVariantsPayload(parsed);
    } catch {
      return [];
    }
  }

  return [];
};

const getSelectedVariantSignature = (selectedVariants = []) =>
  JSON.stringify(
    normalizeSelectedVariantsPayload(selectedVariants).map((variant) => ({
      name: variant.name,
      preset: variant.preset,
      value: variant.value,
      colorHex: variant.colorHex,
    })),
  );

const getEffectivePrice = (product) => {
  const hasSalePrice =
    String(product?.priceType || "single") === "best" &&
    product?.salePrice !== null &&
    product?.salePrice !== undefined &&
    String(product.salePrice).trim() !== "";
  if (hasSalePrice) {
    const salePrice = Number(product.salePrice);
    if (Number.isFinite(salePrice) && salePrice >= 0) return salePrice;
  }

  const basePrice = Number(product?.price);
  if (Number.isFinite(basePrice) && basePrice >= 0) return basePrice;

  return 0;
};

const getVariationForProduct = (product, variationId) => {
  if (!variationId || !Array.isArray(product?.variations)) return null;
  return (
    product.variations.find(
      (variation) =>
        String(variation?._id || "") === String(variationId) &&
        variation?.isActive !== false,
    ) || null
  );
};

const resolveLineSelector = (req) => {
  const body = req.body || {};
  const query = req.query || {};
  const selectedVariants = parseSelectedVariants(
    body.selectedVariants !== undefined ? body.selectedVariants : query.selectedVariants,
  );
  const selectedVariantSignature =
    asString(
      body.selectedVariantSignature !== undefined
        ? body.selectedVariantSignature
        : query.selectedVariantSignature,
    ) || getSelectedVariantSignature(selectedVariants);

  return {
    color: asString(body.color !== undefined ? body.color : query.color),
    dimensions: asString(
      body.dimensions !== undefined ? body.dimensions : query.dimensions,
    ),
    variationId: normalizeVariationId(
      body.variationId !== undefined ? body.variationId : query.variationId,
    ),
    selectedVariants,
    selectedVariantSignature,
  };
};

const isLineMatch = (
  item,
  { productId, color, dimensions, variationId, selectedVariantSignature = "" },
  strict,
) => {
  if (String(item.product) !== String(productId)) return false;
  if (!strict) return true;

  const itemSelectedVariantSignature = getSelectedVariantSignature(item.selectedVariants || []);

  return (
    asString(item.color) === asString(color) &&
    asString(item.dimensions) === asString(dimensions) &&
    String(item.variationId || "") === String(variationId || "") &&
    itemSelectedVariantSignature === String(selectedVariantSignature || "")
  );
};

const hydrateCartImages = async (cartObj) => {
  if (!cartObj?.items) return cartObj;
  const products = cartObj.items.map((item) => item.product).filter(Boolean);
  await attachImageDataToProducts(products);
  return cartObj;
};

const populateCart = async (cart) => {
  await cart.populate({
    path: "items.product",
    select: CART_PRODUCT_SELECT,
    populate: {
      path: "category",
      select: "name",
    },
  });
};

const syncCartItemUnitPrices = async (cart) => {
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return false;
  }

  const productIds = [
    ...new Set(
      cart.items
        .map((item) => String(item?.product || "").trim())
        .filter((id) => /^[0-9a-fA-F]{24}$/.test(id)),
    ),
  ];

  if (productIds.length === 0) return false;

  const products = await Product.find({ _id: { $in: productIds } }).select(
    "price salePrice priceType isActive marketplaceType stock allowBackorder variations variantDefinitions",
  );

  const productMap = new Map(products.map((product) => [String(product._id), product]));
  let changed = false;

  cart.items.forEach((item) => {
    const productId = String(item?.product || "");
    const product = productMap.get(productId);
    if (!product || !product.isActive) return;

    const currentVariationId = normalizeVariationId(item?.variationId);
    const purchaseContext = getProductPurchaseContext(product, {
      variationId: currentVariationId,
      selectedVariants: item.selectedVariants || [],
    });
    if (purchaseContext.error) return;

    const nextPrice = Number(purchaseContext.price);
    if (!Number.isFinite(nextPrice) || nextPrice < 0) return;

    if (Number(item.unitPrice) !== nextPrice) {
      item.unitPrice = nextPrice;
      changed = true;
    }

    if (String(item.variationLabel || "") !== String(purchaseContext.variationLabel || "")) {
      item.variationLabel = purchaseContext.variationLabel || "";
      changed = true;
    }

    const nextSelectedVariantSignature = getSelectedVariantSignature(
      purchaseContext.selectedVariants || [],
    );
    const currentSelectedVariantSignature = getSelectedVariantSignature(
      item.selectedVariants || [],
    );
    if (currentSelectedVariantSignature !== nextSelectedVariantSignature) {
      item.selectedVariants = purchaseContext.selectedVariants || [];
      changed = true;
    }
  });

  return changed;
};

const getProductPurchaseContext = (
  product,
  { variationId: selectorVariationId = "", selectedVariants = [] } = {},
) => {
  const marketplaceType = String(product?.marketplaceType || "simple");
  const priceType = String(product?.priceType || "single");
  const allowBackorder = Boolean(product?.allowBackorder);

  if (NON_BUYABLE_TYPES.has(marketplaceType)) {
    return {
      error: "Grouped products cannot be purchased directly",
    };
  }

  if (priceType === "tba") {
    return {
      error: "This product is currently marked as TBA and cannot be purchased",
    };
  }

  if (marketplaceType === "variable") {
    const variation = getVariationForProduct(product, selectorVariationId);
    if (!variation) {
      return { error: "Please select a valid product variation" };
    }

    const normalizedSelectedVariantsResult = normalizeSelectedVariantsForProduct(
      product,
      selectedVariants,
    );
    if (normalizedSelectedVariantsResult.error) {
      return { error: normalizedSelectedVariantsResult.error };
    }

    const pricing = resolveProductPricingForSelection({
      basePrice:
        variation.salePrice !== null && variation.salePrice !== undefined
          ? Number(variation.salePrice)
          : Number(variation.price),
      baseComparePrice:
        variation.salePrice !== null && variation.salePrice !== undefined
          ? Number(variation.price)
          : null,
      selectedVariants: normalizedSelectedVariantsResult.selectedVariants,
    });
    const variantSummary = buildSelectedVariantSummary(
      normalizedSelectedVariantsResult.selectedVariants,
    );

    return {
      marketplaceType,
      allowBackorder,
      price: Number.isFinite(pricing.price) && pricing.price >= 0 ? pricing.price : 0,
      stock: Number(variation.stock) || 0,
      variation,
      variationId: String(variation._id),
      variationLabel: [asString(variation.label), variantSummary].filter(Boolean).join(" | "),
      selectedVariants: normalizedSelectedVariantsResult.selectedVariants,
    };
  }

  const normalizedSelectedVariantsResult = normalizeSelectedVariantsForProduct(
    product,
    selectedVariants,
  );
  if (normalizedSelectedVariantsResult.error) {
    return { error: normalizedSelectedVariantsResult.error };
  }

  const pricing = resolveProductPricingForSelection({
    basePrice: getEffectivePrice(product),
    baseComparePrice:
      String(product?.priceType || "single") === "best" ? Number(product?.price || 0) : null,
    selectedVariants: normalizedSelectedVariantsResult.selectedVariants,
  });

  return {
    marketplaceType,
    allowBackorder,
    price: pricing.price,
    stock: Number(product?.stock) || 0,
    variation: null,
    variationId: "",
    variationLabel: buildSelectedVariantSummary(normalizedSelectedVariantsResult.selectedVariants),
    selectedVariants: normalizedSelectedVariantsResult.selectedVariants,
  };
};

const validateStock = ({
  requestedQuantity,
  availableStock,
  allowBackorder,
  productTitle = "Product",
}) => {
  if (allowBackorder) return { ok: true };

  if (!Number.isFinite(availableStock) || availableStock < 0) {
    return { ok: true };
  }

  if (requestedQuantity > availableStock) {
    return {
      ok: false,
      message: `${productTitle} has only ${availableStock} item(s) in stock`,
    };
  }

  return { ok: true };
};

// Get user's cart
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).select("items createdAt updatedAt");

    if (!cart) {
      return res.json({
        success: true,
        message: "Cart retrieved successfully",
        cart: {
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    const updated = await syncCartItemUnitPrices(cart);
    if (updated) {
      await cart.save();
    }

    await populateCart(cart);
    const formattedCart = cart.toObject();
    await hydrateCartImages(formattedCart);

    res.json({
      success: true,
      message: "Cart retrieved successfully",
      cart: formattedCart,
    });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching cart",
      error: error.message,
    });
  }
};

// Add item to cart
exports.addToCart = async (req, res) => {
  try {
    const {
      productId,
      quantity = 1,
      color = "",
      dimensions = "",
      variationId: inputVariationId = "",
      selectedVariants: inputSelectedVariants = [],
    } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const product = await Product.findById(productId).select(
      "title price salePrice priceType isActive marketplaceType stock allowBackorder variations variantDefinitions",
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    const parsedQuantity = toPositiveInt(quantity, 1);
    const selectorVariationId = normalizeVariationId(inputVariationId);
    const purchaseContext = getProductPurchaseContext(product, {
      variationId: selectorVariationId,
      selectedVariants: inputSelectedVariants,
    });

    if (purchaseContext.error) {
      return res.status(400).json({
        success: false,
        message: purchaseContext.error,
      });
    }

    const lineSelector = {
      productId,
      color: asString(color),
      dimensions: asString(dimensions),
      variationId: purchaseContext.variationId || "",
      selectedVariantSignature: getSelectedVariantSignature(
        purchaseContext.selectedVariants || [],
      ),
    };

    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = new Cart({
        user: req.user.id,
        items: [],
      });
    }

    const existingItemIndex = cart.items.findIndex((item) =>
      isLineMatch(item, lineSelector, true),
    );

    const currentQuantity =
      existingItemIndex !== -1 ? Number(cart.items[existingItemIndex].quantity) || 0 : 0;
    const targetQuantity = currentQuantity + parsedQuantity;

    const stockValidation = validateStock({
      requestedQuantity: targetQuantity,
      availableStock: purchaseContext.stock,
      allowBackorder: purchaseContext.allowBackorder,
      productTitle: product.title || "Product",
    });

    if (!stockValidation.ok) {
      return res.status(400).json({
        success: false,
        message: stockValidation.message,
      });
    }

    if (existingItemIndex !== -1) {
      cart.items[existingItemIndex].quantity = targetQuantity;
      cart.items[existingItemIndex].unitPrice = purchaseContext.price;
      cart.items[existingItemIndex].variationId =
        purchaseContext.variationId || null;
      cart.items[existingItemIndex].variationLabel =
        purchaseContext.variationLabel || "";
      cart.items[existingItemIndex].selectedVariants =
        purchaseContext.selectedVariants || [];
    } else {
      cart.items.push({
        product: productId,
        quantity: parsedQuantity,
        unitPrice: purchaseContext.price,
        variationId: purchaseContext.variationId || null,
        variationLabel: purchaseContext.variationLabel || "",
        selectedVariants: purchaseContext.selectedVariants || [],
        color: lineSelector.color,
        dimensions: lineSelector.dimensions,
      });
    }

    await cart.save();
    await populateCart(cart);

    const formattedCart = cart.toObject();
    await hydrateCartImages(formattedCart);

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      cart: formattedCart,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding to cart",
      error: error.message,
    });
  }
};

// Update cart item quantity
exports.updateCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const parsedQuantity = toPositiveInt(quantity, 0);
    if (!parsedQuantity) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be at least 1",
      });
    }

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const selector = resolveLineSelector(req);
    const strictSelector =
      Boolean(selector.color) ||
      Boolean(selector.dimensions) ||
      Boolean(selector.variationId) ||
      Boolean(selector.selectedVariantSignature);

    const itemIndex = cart.items.findIndex((item) =>
      isLineMatch(
        item,
        {
          productId,
          color: selector.color,
          dimensions: selector.dimensions,
          variationId: selector.variationId,
          selectedVariantSignature: selector.selectedVariantSignature,
        },
        strictSelector,
      ),
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    const lineItem = cart.items[itemIndex];
    const product = await Product.findById(productId).select(
      "title price salePrice priceType isActive marketplaceType stock allowBackorder variations variantDefinitions",
    );

    if (!product || !product.isActive) {
      return res.status(400).json({
        success: false,
        message: "Product is not available",
      });
    }

    const variationIdForValidation =
      selector.variationId || String(lineItem.variationId || "");
    const purchaseContext = getProductPurchaseContext(
      product,
      {
        variationId: normalizeVariationId(variationIdForValidation),
        selectedVariants:
          selector.selectedVariants?.length > 0
            ? selector.selectedVariants
            : lineItem.selectedVariants || [],
      },
    );

    if (purchaseContext.error) {
      return res.status(400).json({
        success: false,
        message: purchaseContext.error,
      });
    }

    const stockValidation = validateStock({
      requestedQuantity: parsedQuantity,
      availableStock: purchaseContext.stock,
      allowBackorder: purchaseContext.allowBackorder,
      productTitle: product.title || "Product",
    });

    if (!stockValidation.ok) {
      return res.status(400).json({
        success: false,
        message: stockValidation.message,
      });
    }

    lineItem.quantity = parsedQuantity;
    lineItem.unitPrice = purchaseContext.price;
    lineItem.variationId = purchaseContext.variationId || null;
    lineItem.variationLabel = purchaseContext.variationLabel || "";
    lineItem.selectedVariants = purchaseContext.selectedVariants || [];
    lineItem.color = selector.color || lineItem.color || "";
    lineItem.dimensions = selector.dimensions || lineItem.dimensions || "";
    cart.updatedAt = Date.now();

    await cart.save();
    await populateCart(cart);

    const formattedCart = cart.toObject();
    await hydrateCartImages(formattedCart);

    res.json({
      success: true,
      message: "Cart updated successfully",
      cart: formattedCart,
    });
  } catch (error) {
    console.error("Update cart error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating cart",
      error: error.message,
    });
  }
};

// Remove item from cart
exports.removeCartItem = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const selector = resolveLineSelector(req);
    const strictSelector =
      Boolean(selector.color) ||
      Boolean(selector.dimensions) ||
      Boolean(selector.variationId) ||
      Boolean(selector.selectedVariantSignature);

    const itemIndex = cart.items.findIndex((item) =>
      isLineMatch(
        item,
        {
          productId,
          color: selector.color,
          dimensions: selector.dimensions,
          variationId: selector.variationId,
          selectedVariantSignature: selector.selectedVariantSignature,
        },
        strictSelector,
      ),
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    cart.items.splice(itemIndex, 1);
    cart.updatedAt = Date.now();
    await cart.save();

    await populateCart(cart);
    const formattedCart = cart.toObject();
    await hydrateCartImages(formattedCart);

    res.json({
      success: true,
      message: "Item removed from cart successfully",
      cart: formattedCart,
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while removing from cart",
      error: error.message,
    });
  }
};

// Clear entire cart
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.items = [];
    cart.updatedAt = Date.now();
    await cart.save();

    res.json({
      success: true,
      message: "Cart cleared successfully",
      cart: {
        items: [],
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
      },
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while clearing cart",
      error: error.message,
    });
  }
};
