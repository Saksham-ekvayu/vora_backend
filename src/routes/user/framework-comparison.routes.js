const express = require("express");
const router = express.Router();

// Import middlewares
const { authenticateToken } = require("../../middlewares/auth.middleware");
const {
  canUserCreate,
  canView,
} = require("../../middlewares/roleAccess.middleware");

// Import validations
const {
  startFrameworkComparisonValidation,
  getFrameworkComparisonByIdValidation,
  getFrameworkComparisonHistoryValidation,
} = require("../../validations/framework-comparison.validation");

// Import controller
const {
  startFrameworkComparison,
  getFrameworkComparisonStatus,
  getFrameworkComparisonHistory,
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

/**
 * @route   GET /api/users/framework-comparisons
 * @desc    Get user's framework comparison history with pagination and filtering
 * @access  Private (User only)
 * @query   { page?, limit?, status? }
 */
router.get(
  "/",
  authenticateToken,
  canView, // Only users can view their framework comparisons
  getFrameworkComparisonHistoryValidation,
  getFrameworkComparisonHistory
);

/**
 * @route   GET /api/users/framework-comparisons/:frameworkComparisonId
 * @desc    Get specific framework comparison status and results
 * @access  Private (User only)
 */
router.get(
  "/:frameworkComparisonId",
  authenticateToken,
  canView, // Only users can view their framework comparisons
  getFrameworkComparisonByIdValidation,
  getFrameworkComparisonStatus
);

module.exports = router;
