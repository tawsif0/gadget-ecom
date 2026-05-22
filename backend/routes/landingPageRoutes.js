const express = require("express");
const auth = require("../middlewares/auth");
const {
  createLandingPage,
  getLandingPages,
  getLandingPageById,
  updateLandingPage,
  deleteLandingPage,
  getPublicLandingPage,
  trackLandingPageView,
  getLandingPageStats,
} = require("../controllers/landingPageController");

const router = express.Router();

router.get("/public/:slug", getPublicLandingPage);
router.post("/public/:slug/view", trackLandingPageView);

router.use(auth);

router.post("/", createLandingPage);
router.get("/", getLandingPages);
router.get("/:id", getLandingPageById);
router.patch("/:id", updateLandingPage);
router.delete("/:id", deleteLandingPage);
router.get("/:id/stats", getLandingPageStats);

module.exports = router;
