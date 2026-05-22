const express = require("express");
const auth = require("../middlewares/auth");
const {
  createContactSubmission,
  getContactSubmissions,
  updateContactSubmission,
} = require("../controllers/contactController");

const router = express.Router();

router.post("/", createContactSubmission);
router.get("/", auth, getContactSubmissions);
router.patch("/:id", auth, updateContactSubmission);

module.exports = router;
