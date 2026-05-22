const express = require("express");
const auth = require("../middlewares/auth");
const {
  createTicket,
  getTickets,
  getTicketById,
  replyTicket,
  updateTicketStatus,
} = require("../controllers/supportTicketController");

const router = express.Router();

router.post("/", auth, createTicket);
router.get("/", auth, getTickets);
router.get("/:id", auth, getTicketById);
router.post("/:id/reply", auth, replyTicket);
router.patch("/:id/status", auth, updateTicketStatus);

module.exports = router;
