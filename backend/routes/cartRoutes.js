// routes/cartRoutes.js
const express = require("express");
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require("../controllers/cartController.js");
const auth = require("../middlewares/auth.js");

const router = express.Router();

// All cart routes require authentication
router.use(auth);

router.get("/", getCart);
router.post("/", addToCart);
router.put("/:productId", updateCartItem);
router.delete("/:productId", removeCartItem);
router.delete("/", clearCart);

module.exports = router;
