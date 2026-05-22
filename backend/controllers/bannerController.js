const Banner = require("../models/Banner.js");
const { uploadImageBuffer, deleteImage } = require("../config/cloudinary");
const { clearResponseCacheByPrefix } = require("../middlewares/responseCache");

const BANNER_IMAGE_OPTIONS = {
  folder: "ecommerce/banners",
  resource_type: "image",
  transformation: [{ quality: "auto:best", fetch_format: "auto" }],
};

const BANNER_THUMB_OPTIONS = {
  folder: "ecommerce/banners/thumbs",
  resource_type: "image",
  transformation: [{ quality: "auto:best", fetch_format: "auto" }],
};

const uploadBannerImage = async (file, options) => {
  if (!file?.buffer) return null;
  return uploadImageBuffer(file.buffer, options);
};

const deleteBannerAssets = async (publicIds = []) => {
  const unique = Array.from(new Set(publicIds.filter(Boolean)));
  if (unique.length === 0) return;
  await Promise.all(unique.map((id) => deleteImage(id)));
};

const invalidatePublicBannerCache = () => {
  clearResponseCacheByPrefix("/api/banners/public");
};

const normalizeImage = (img) => {
  if (!img) return img;
  if (
    img.startsWith("http://") ||
    img.startsWith("https://") ||
    img.startsWith("data:")
  )
    return img;
  return img.startsWith("/") ? img : `/${img}`;
};

exports.createBanner = async (req, res) => {
  let uploadedPublicIds = [];
  try {
    const { title, description, buttonLabel, buttonLink } = req.body;

    // IMPORTANT: Create proper image URL
    let image = "";
    let thumb = "";
    let imagePublicId = "";
    let thumbPublicId = "";
    if (req.files?.image?.[0]) {
      const uploaded = await uploadBannerImage(
        req.files.image[0],
        BANNER_IMAGE_OPTIONS,
      );
      if (uploaded?.secure_url) {
        image = uploaded.secure_url;
        imagePublicId = uploaded.public_id;
        uploadedPublicIds.push(uploaded.public_id);
      }
    }
    if (req.files?.thumb?.[0]) {
      const uploaded = await uploadBannerImage(
        req.files.thumb[0],
        BANNER_THUMB_OPTIONS,
      );
      if (uploaded?.secure_url) {
        thumb = uploaded.secure_url;
        thumbPublicId = uploaded.public_id;
        uploadedPublicIds.push(uploaded.public_id);
      }
    }
    if (!thumb && image) {
      thumb = image;
      thumbPublicId = imagePublicId;
    }

    // All fields are optional, so we can create banner with empty data
    const banner = await Banner.create({
      title: title || "",
      description: description || "",
      buttonLabel: buttonLabel || "",
      buttonLink: buttonLink || "",
      image,
      imagePublicId,
      thumb,
      thumbPublicId,
      isActive: true,
    });
    invalidatePublicBannerCache();

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      banner,
    });
  } catch (error) {
    if (uploadedPublicIds.length > 0) {
      await deleteBannerAssets(uploadedPublicIds);
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 }).lean();

    // IMPORTANT: Ensure image URLs are properly formatted
    const bannersWithUrls = banners.map((bannerObj) => {
      if (bannerObj.image) bannerObj.image = normalizeImage(bannerObj.image);
      if (bannerObj.thumb) bannerObj.thumb = normalizeImage(bannerObj.thumb);
      return bannerObj;
    });

    res.json({
      success: true,
      count: banners.length,
      banners: bannersWithUrls,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getActiveBanners = async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({
      createdAt: -1,
    }).lean();

    // Ensure image URLs are properly formatted
    const bannersWithUrls = banners.map((bannerObj) => {
      if (bannerObj.image) bannerObj.image = normalizeImage(bannerObj.image);
      if (bannerObj.thumb) bannerObj.thumb = normalizeImage(bannerObj.thumb);
      return bannerObj;
    });

    res.json({
      success: true,
      count: banners.length,
      banners: bannersWithUrls,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id).lean();

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    if (req.baseUrl.includes("public") && !banner.isActive) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    // Ensure image URL is properly formatted
    const bannerObj = banner;
    if (bannerObj.image) bannerObj.image = normalizeImage(bannerObj.image);
    if (bannerObj.thumb) bannerObj.thumb = normalizeImage(bannerObj.thumb);

    res.json({
      success: true,
      banner: bannerObj,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid banner ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.updateBanner = async (req, res) => {
  let uploadedPublicIds = [];
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    let image = banner.image || "";
    let thumb = banner.thumb || "";
    let imagePublicId = banner.imagePublicId || "";
    let thumbPublicId = banner.thumbPublicId || "";

    const toDelete = [];

    if (req.files?.image?.[0]) {
      const uploaded = await uploadBannerImage(
        req.files.image[0],
        BANNER_IMAGE_OPTIONS,
      );
      if (uploaded?.secure_url) {
        image = uploaded.secure_url;
        imagePublicId = uploaded.public_id;
        uploadedPublicIds.push(uploaded.public_id);
        if (
          banner.imagePublicId &&
          banner.imagePublicId !== uploaded.public_id
        ) {
          toDelete.push(banner.imagePublicId);
        }
      }
    }

    if (req.files?.thumb?.[0]) {
      const uploaded = await uploadBannerImage(
        req.files.thumb[0],
        BANNER_THUMB_OPTIONS,
      );
      if (uploaded?.secure_url) {
        thumb = uploaded.secure_url;
        thumbPublicId = uploaded.public_id;
        uploadedPublicIds.push(uploaded.public_id);
        if (
          banner.thumbPublicId &&
          banner.thumbPublicId !== uploaded.public_id
        ) {
          toDelete.push(banner.thumbPublicId);
        }
      }
    }

    if (!req.files?.thumb?.[0] && req.files?.image?.[0] && image) {
      thumb = image;
      thumbPublicId = imagePublicId;
    }

    // If image is being removed (sent as empty string)
    if (req.body.image === "") {
      if (banner.imagePublicId) toDelete.push(banner.imagePublicId);
      image = "";
      imagePublicId = "";
      if (!req.files?.thumb?.[0]) {
        if (banner.thumbPublicId) toDelete.push(banner.thumbPublicId);
        thumb = "";
        thumbPublicId = "";
      }
    }

    if (toDelete.length > 0) {
      await deleteBannerAssets(toDelete);
    }

    req.body.image = image;
    req.body.thumb = thumb;
    req.body.imagePublicId = imagePublicId;
    req.body.thumbPublicId = thumbPublicId;

    // Handle empty fields - convert undefined to empty string
    if (req.body.title === undefined) req.body.title = banner.title;
    if (req.body.description === undefined)
      req.body.description = banner.description;
    if (req.body.buttonLabel === undefined)
      req.body.buttonLabel = banner.buttonLabel || "";
    if (req.body.buttonLink === undefined)
      req.body.buttonLink = banner.buttonLink || "";

    const updatedBanner = await Banner.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    invalidatePublicBannerCache();

    // Ensure image URL is properly formatted
    const bannerObj = updatedBanner.toObject();
    if (bannerObj.image) bannerObj.image = normalizeImage(bannerObj.image);
    if (bannerObj.thumb) bannerObj.thumb = normalizeImage(bannerObj.thumb);

    res.json({
      success: true,
      message: "Banner updated successfully",
      banner: bannerObj,
    });
  } catch (error) {
    if (uploadedPublicIds.length > 0) {
      await deleteBannerAssets(uploadedPublicIds);
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid banner ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    await deleteBannerAssets([banner.imagePublicId, banner.thumbPublicId]);
    await banner.deleteOne();
    invalidatePublicBannerCache();

    res.json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid banner ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

exports.toggleBannerActive = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    banner.isActive = !banner.isActive;
    banner.updatedAt = Date.now();
    await banner.save();
    invalidatePublicBannerCache();

    // Ensure image URL is properly formatted
    const bannerObj = banner.toObject();
    if (bannerObj.image) bannerObj.image = normalizeImage(bannerObj.image);
    if (bannerObj.thumb) bannerObj.thumb = normalizeImage(bannerObj.thumb);

    res.json({
      success: true,
      message: `Banner ${
        banner.isActive ? "activated" : "deactivated"
      } successfully`,
      banner: bannerObj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
