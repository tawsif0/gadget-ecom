const express = require("express");
const auth = require("../middlewares/auth");
const {
  getWishlist,
  checkWishlistItem,
  addWishlistItem,
  removeWishlistItem,
  clearWishlist,
} = require("../controllers/wishlistController");

const router = express.Router();

router.use(auth);

router.get("/", getWishlist);
router.get("/check/:productId", checkWishlistItem);
router.post("/", addWishlistItem);
router.delete("/:productId", removeWishlistItem);
router.delete("/", clearWishlist);

module.exports = router;

