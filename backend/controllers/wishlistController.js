const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");
const { attachImageDataToProducts } = require("../utils/imageUtils");

const isObjectId = (value) => /^[0-9a-fA-F]{24}$/.test(String(value || "").trim());
const WISHLIST_PRODUCT_SELECT =
  "title price salePrice priceType showStockToPublic images vendor category brand marketplaceType stock allowBackorder isActive approvalStatus ratingAverage ratingCount variantDefinitions variations";

const getUserId = (req) => req.user.id || req.user._id;

const toWishlistResponse = async (wishlistDoc) => {
  const plain = wishlistDoc?.toObject ? wishlistDoc.toObject() : wishlistDoc || {};
  const items = Array.isArray(plain.items) ? plain.items : [];
  const products = items.map((item) => item.product).filter(Boolean);
  await attachImageDataToProducts(products);
  return {
    _id: plain._id,
    user: plain.user,
    items,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

exports.getWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    let wishlist = await Wishlist.findOne({ user: userId }).populate({
      path: "items.product",
      select: WISHLIST_PRODUCT_SELECT,
      populate: [
        { path: "vendor", select: "storeName slug logo status" },
        { path: "category", select: "name" },
      ],
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: userId,
        items: [],
      });
    }

    const sanitizedItems = (wishlist.items || []).filter((item) => {
      const product = item?.product;
      if (!product) return false;
      if (!product.isActive) return false;
      if (!["approved", undefined, null].includes(product.approvalStatus)) return false;
      return true;
    });

    if (sanitizedItems.length !== (wishlist.items || []).length) {
      wishlist.items = sanitizedItems;
      await wishlist.save();
      await wishlist.populate({
        path: "items.product",
        select: WISHLIST_PRODUCT_SELECT,
        populate: [
          { path: "vendor", select: "storeName slug logo status" },
          { path: "category", select: "name" },
        ],
      });
    }

    const formatted = await toWishlistResponse(wishlist);

    res.json({
      success: true,
      wishlist: formatted,
      count: formatted.items.length,
    });
  } catch (error) {
    console.error("Get wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching wishlist",
    });
  }
};

exports.checkWishlistItem = async (req, res) => {
  try {
    const productId = String(req.params.productId || "").trim();
    if (!isObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const userId = getUserId(req);
    const wishlist = await Wishlist.findOne({ user: userId }).select("items.product").lean();

    const exists = Boolean(
      wishlist?.items?.some((item) => String(item.product || "") === productId),
    );

    res.json({
      success: true,
      isWishlisted: exists,
    });
  } catch (error) {
    console.error("Check wishlist item error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while checking wishlist",
    });
  }
};

exports.addWishlistItem = async (req, res) => {
  try {
    const rawProductId =
      req.body?.productId !== undefined ? req.body.productId : req.params.productId;
    const productId = String(rawProductId || "").trim();

    if (!isObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Valid product ID is required",
      });
    }

    const product = await Product.findById(productId)
      .select("isActive approvalStatus")
      .lean();

    if (
      !product ||
      !product.isActive ||
      !["approved", undefined, null].includes(product.approvalStatus)
    ) {
      return res.status(404).json({
        success: false,
        message: "Product is not available",
      });
    }

    const userId = getUserId(req);
    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: userId,
        items: [],
      });
    }

    const exists = wishlist.items.some(
      (entry) => String(entry.product || "") === String(productId),
    );
    if (exists) {
      return res.json({
        success: true,
        message: "Product is already in wishlist",
        isWishlisted: true,
      });
    }

    wishlist.items.unshift({
      product: productId,
      addedAt: new Date(),
    });
    wishlist.items = wishlist.items.slice(0, 300);
    await wishlist.save();

    res.status(201).json({
      success: true,
      message: "Product added to wishlist",
      isWishlisted: true,
    });
  } catch (error) {
    console.error("Add wishlist item error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while adding to wishlist",
    });
  }
};

exports.removeWishlistItem = async (req, res) => {
  try {
    const productId = String(req.params.productId || "").trim();
    if (!isObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const userId = getUserId(req);
    const wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: "Wishlist not found",
      });
    }

    const before = wishlist.items.length;
    wishlist.items = wishlist.items.filter(
      (entry) => String(entry.product || "") !== String(productId),
    );

    if (before === wishlist.items.length) {
      return res.status(404).json({
        success: false,
        message: "Product not found in wishlist",
      });
    }

    await wishlist.save();

    res.json({
      success: true,
      message: "Product removed from wishlist",
      isWishlisted: false,
    });
  } catch (error) {
    console.error("Remove wishlist item error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while removing wishlist item",
    });
  }
};

exports.clearWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    const wishlist = await Wishlist.findOne({ user: userId });

    if (!wishlist) {
      return res.json({
        success: true,
        message: "Wishlist is already empty",
      });
    }

    wishlist.items = [];
    await wishlist.save();

    res.json({
      success: true,
      message: "Wishlist cleared successfully",
    });
  } catch (error) {
    console.error("Clear wishlist error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while clearing wishlist",
    });
  }
};
