const express = require("express");
const auth = require("../middlewares/auth");
const {
  createPurchase,
  getPurchases,
  addPurchasePayment,
} = require("../controllers/purchaseController");

const router = express.Router();

router.use(auth);

router.post("/", createPurchase);
router.get("/", getPurchases);
router.patch("/:id/payment", addPurchasePayment);

module.exports = router;
