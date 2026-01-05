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
  startComparisonValidation,
  getComparisonByIdValidation,
  getComparisonHistoryValidation,
} = require("../../validations/comparison.validation");

// Import controller
const {
  startComparison,
  getComparisonStatus,
  getComparisonHistory,
} = require("../../controllers/user/comparison.controller");

/**
 * @route   POST /api/users/comparisons
 * @desc    Start framework comparison between user and expert frameworks
 * @access  Private (User only)
 * @body    { userFrameworkId: string, expertFrameworkId: string }
 */
router.post(
  "/",
  authenticateToken,
  canUserCreate, // Only users can create comparisons
  startComparisonValidation,
  startComparison
);

/**
 * @route   GET /api/users/comparisons
 * @desc    Get user's comparison history with pagination and filtering
 * @access  Private (User only)
 * @query   { page?, limit?, status? }
 */
router.get(
  "/",
  authenticateToken,
  canView, // Only users can view their comparisons
  getComparisonHistoryValidation,
  getComparisonHistory
);

/**
 * @route   GET /api/users/comparisons/:comparisonId
 * @desc    Get specific comparison status and results
 * @access  Private (User only)
 */
router.get(
  "/:comparisonId",
  authenticateToken,
  canView, // Only users can view their comparisons
  getComparisonByIdValidation,
  getComparisonStatus
);

module.exports = router;
