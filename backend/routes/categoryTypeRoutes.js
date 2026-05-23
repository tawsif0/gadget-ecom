const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");
const {
  getCategoryTypes,
  createCategoryType,
  updateCategoryType,
  deleteCategoryType,
} = require("../controllers/categoryTypeController");

router.get("/", auth, getCategoryTypes);
router.post("/", auth, createCategoryType);
router.put("/:id", auth, updateCategoryType);
router.delete("/:id", auth, deleteCategoryType);

module.exports = router;

