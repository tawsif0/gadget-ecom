const express = require("express");
const auth = require("../middlewares/auth");
const { ensureMultiVendorMode } = require("../middlewares/marketplaceMode");
const {
  createConversation,
  getMyConversations,
  getAdminConversations,
  getConversation,
  replyToConversation,
  updateConversationStatus,
} = require("../controllers/vendorMessageController");

const router = express.Router();

router.use(auth);
router.use(ensureMultiVendorMode);

router.post("/", createConversation);
router.get("/", getMyConversations);
router.get("/admin", getAdminConversations);
router.get("/:id", getConversation);
router.post("/:id/reply", replyToConversation);
router.patch("/:id/status", updateConversationStatus);

module.exports = router;
