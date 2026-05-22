const express = require("express");
const auth = require("../middlewares/auth");
const {
  getAccountEntries,
  createAccountEntry,
  updateAccountEntry,
  deleteAccountEntry,
  getAccountsSummary,
} = require("../controllers/accountController");

const router = express.Router();

router.use(auth);

router.get("/summary", getAccountsSummary);
router.get("/entries", getAccountEntries);
router.post("/entries", createAccountEntry);
router.patch("/entries/:id", updateAccountEntry);
router.delete("/entries/:id", deleteAccountEntry);

module.exports = router;
