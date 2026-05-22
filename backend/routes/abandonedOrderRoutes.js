const express = require("express");
const auth = require("../middlewares/auth");
const {
  captureAbandonedOrder,
  getAbandonedOrders,
  updateAbandonedOrder,
  convertAbandonedOrder,
  deleteAbandonedOrder,
} = require("../controllers/abandonedOrderController");

const router = express.Router();

router.post("/capture", captureAbandonedOrder);

router.use(auth);

router.get("/", getAbandonedOrders);
router.patch("/:id", updateAbandonedOrder);
router.post("/:id/convert", convertAbandonedOrder);
router.delete("/:id", deleteAbandonedOrder);

module.exports = router;
