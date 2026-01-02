const express = require("express");
const router = express.Router();

// Import middlewares
const { authenticateToken } = require("../../middlewares/auth.middleware");
const {
  canUserCreate,
  canUpdate,
  canDelete,
  canView,
} = require("../../middlewares/roleAccess.middleware");

// Import cache middlewares
const {
  frameworkListCache,
  userFrameworksCache,
  frameworkByIdCache,
} = require("../../middlewares/cache.middleware");

// Import validations
const {
  frameworkUploadValidation,
  updateFrameworkValidation,
  getFrameworkByIdValidation,
  deleteFrameworkValidation,
  getFrameworksQueryValidation,
} = require("../../validations/framework.validation");

// Import controller
const {
  upload,
  createFramework,
  getAllFrameworks,
  getFrameworkById,
  updateFramework,
  deleteFramework,
  downloadFramework,
  getUserFrameworks,
} = require("../../controllers/user/framework.controller");

// Routes

/**
 * @route   POST /api/frameworks
 * @desc    Create a new framework (upload file)
 * @access  Private (User only)
 * @body    { frameworkName?: string } (multipart/form-data with file)
 */
router.post(
  "/",
  authenticateToken,
  canUserCreate, // Only users can create frameworks
  upload.single("framework"), // Handle file upload with field name "framework"
  frameworkUploadValidation, // Validate using the same pattern as auth/user
  createFramework
);

/**
 * @route   GET /api/frameworks
 * @desc    Get all frameworks with pagination, filtering, and search
 * @access  Private (User only)
 * @query   { page?, limit?, sort?, search?, frameworkType?, uploadedBy? }
 */
router.get(
  "/",
  authenticateToken,
  canView, // Only users can view frameworks
  frameworkListCache, // Cache middleware
  getFrameworksQueryValidation,
  getAllFrameworks
);

/**
 * @route   GET /api/frameworks/my-frameworks
 * @desc    Get current user's frameworks
 * @access  Private (User only)
 * @query   { page?, limit?, sort? }
 */
router.get(
  "/my-frameworks",
  authenticateToken,
  canView, // Only users can view their own frameworks
  userFrameworksCache, // Cache middleware
  getUserFrameworks
);

/**
 * @route   GET /api/frameworks/:id
 * @desc    Get framework by ID
 * @access  Private (User only)
 */
router.get(
  "/:id",
  authenticateToken,
  canView, // Only users can view frameworks
  frameworkByIdCache, // Cache middleware
  getFrameworkByIdValidation,
  getFrameworkById
);

/**
 * @route   GET /api/frameworks/:id/download
 * @desc    Download framework file
 * @access  Private (User only)
 */
router.get(
  "/:id/download",
  authenticateToken,
  canView, // Only users can download frameworks
  getFrameworkByIdValidation,
  downloadFramework
);

/**
 * @route   PUT /api/frameworks/:id
 * @desc    Update framework details and optionally replace file
 * @access  Private (User only)
 * @body    { frameworkName?, isActive? } (multipart/form-data with optional file)
 */
router.put(
  "/:id",
  authenticateToken,
  canUpdate, // Only users can update frameworks
  upload.single("framework"), // Handle optional file upload
  getFrameworkByIdValidation,
  updateFrameworkValidation,
  updateFramework
);

/**
 * @route   DELETE /api/frameworks/:id
 * @desc    Delete framework (soft delete)
 * @access  Private (User only)
 */
router.delete(
  "/:id",
  authenticateToken,
  canDelete, // Only users can delete frameworks
  deleteFrameworkValidation,
  deleteFramework
);

module.exports = router;
