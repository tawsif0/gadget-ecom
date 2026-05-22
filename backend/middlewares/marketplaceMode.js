const DEFAULT_MARKETPLACE_MODE = "single";

const ensureMultiVendorMode = async (req, res, next) => {
  try {
    req.marketplaceMode = DEFAULT_MARKETPLACE_MODE;
    return res.status(403).json({
      success: false,
      message: "Multi-vendor features are disabled in single-store mode",
    });
  } catch (error) {
    console.error("Marketplace mode guard error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while verifying marketplace mode",
    });
  }
};

module.exports = {
  ensureMultiVendorMode,
};
