const express = require("express");
const router = express.Router();

// Import middlewares
const { authenticateToken } = require("../../middlewares/auth.middleware");
const {
  canExpertCreate,
  canExpertUpdate,
  canExpertDelete,
  canExpertView,
} = require("../../middlewares/roleAccess.middleware");

// Import validations
const {
  expertFrameworkUploadValidation,
  updateExpertFrameworkValidation,
  getExpertFrameworkByIdValidation,
  deleteExpertFrameworkValidation,
  getExpertFrameworksQueryValidation,
} = require("../../validations/expert-framework.validation");

// Import controller
const {
  upload,
  createFramework,
  getAllFrameworks,
  getFrameworkById,
  updateFramework,
  deleteFramework,
  downloadFramework,
  getExpertFrameworks,
  uploadFrameworkToAIService,
  getFrameworkControls,
} = require("../../controllers/expert/expert-framework.controller");

// Routes

/**
 * @route   POST /api/expert/frameworks
 * @desc    Create a new framework (upload file)
 * @access  Private (Expert only)
 * @body    { frameworkName?: string } (multipart/form-data with file)
 */
router.post(
  "/",
  authenticateToken,
  canExpertCreate, // Only experts can create frameworks
  upload.single("file"), // Handle file upload with field name "file"
  expertFrameworkUploadValidation, // Validate using the same pattern as auth/user
  createFramework
);

/**
 * @route   GET /api/expert/frameworks
 * @desc    Get all frameworks with pagination, filtering, and search
 * @access  Private (Expert only)
 * @query   { page?, limit?, sort?, search?, frameworkType?, uploadedBy? }
 */
router.get(
  "/",
  authenticateToken,
  canExpertView, // Only experts can view frameworks
  getExpertFrameworksQueryValidation,
  getAllFrameworks
);

/**
 * @route   GET /api/expert/frameworks/my-frameworks
 * @desc    Get current expert's frameworks
 * @access  Private (Expert only)
 * @query   { page?, limit?, sort? }
 */
router.get(
  "/my-frameworks",
  authenticateToken,
  canExpertView, // Only experts can view their own frameworks
  getExpertFrameworks
);

/**
 * @route   GET /api/expert/frameworks/:id
 * @desc    Get framework by ID
 * @access  Private (Expert only)
 */
router.get(
  "/:id",
  authenticateToken,
  canExpertView, // Only experts can view frameworks
  getExpertFrameworkByIdValidation,
  getFrameworkById
);

/**
 * @route   GET /api/expert/frameworks/:id/download
 * @desc    Download framework file
 * @access  Private (Expert only)
 */
router.get(
  "/:id/download",
  authenticateToken,
  canExpertView, // Only experts can download frameworks
  getExpertFrameworkByIdValidation,
  downloadFramework
);

/**
 * @route   PUT /api/expert/frameworks/:id
 * @desc    Update framework details and optionally replace file
 * @access  Private (Expert only)
 * @body    { frameworkName?, isActive? } (multipart/form-data with optional file)
 */
router.put(
  "/:id",
  authenticateToken,
  canExpertUpdate, // Only experts can update frameworks
  upload.single("framework"), // Handle optional file upload
  getExpertFrameworkByIdValidation,
  updateExpertFrameworkValidation,
  updateFramework
);

/**
 * @route   DELETE /api/expert/frameworks/:id
 * @desc    Delete framework (soft delete)
 * @access  Private (Expert only)
 */
router.delete(
  "/:id",
  authenticateToken,
  canExpertDelete, // Only experts can delete frameworks
  deleteExpertFrameworkValidation,
  deleteFramework
);

/**
 * @route   POST /api/expert/frameworks/:id/upload-to-ai
 * @desc    Upload framework to AI service for processing
 * @access  Private (Expert only)
 */
router.post(
  "/:id/upload-to-ai",
  authenticateToken,
  canExpertCreate, // Only experts can upload to AI service
  getExpertFrameworkByIdValidation, // Validate id in params
  uploadFrameworkToAIService
);

/**
 * @route   GET /api/expert/frameworks/:id/controls
 * @desc    Get extracted controls from AI service for a framework
 * @access  Private (Expert only)
 */
router.get(
  "/:id/controls",
  authenticateToken,
  canExpertView, // Only experts can view controls
  getExpertFrameworkByIdValidation,
  getFrameworkControls
);

module.exports = router;
