const express = require("express");
const auth = require("../middlewares/auth");
const {
  getReportSummary,
  getModuleReport,
} = require("../controllers/reportController");

const router = express.Router();

router.use(auth);

router.get("/summary", getReportSummary);
router.get("/module", getModuleReport);

module.exports = router;
