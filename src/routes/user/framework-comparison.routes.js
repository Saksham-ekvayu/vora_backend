const express = require("express");
const router = express.Router();

// Import middlewares
const { authenticateToken } = require("../../middlewares/auth.middleware");
const {
  canUserCreate,
} = require("../../middlewares/roleAccess.middleware");

// Import validations
const {
  startFrameworkComparisonValidation,
} = require("../../validations/framework-comparison.validation");

// Import controller
const {
  startFrameworkComparison,
} = require("../../controllers/user/framework-comparison.controller");

/**
 * @route   POST /api/users/framework-comparisons
 * @desc    Start framework comparison between user and expert frameworks
 * @access  Private (User only)
 * @body    { userFrameworkId: string, expertFrameworkId: string }
 */
router.post(
  "/",
  authenticateToken,
  canUserCreate, // Only users can create framework comparisons
  startFrameworkComparisonValidation,
  startFrameworkComparison
);

module.exports = router;
