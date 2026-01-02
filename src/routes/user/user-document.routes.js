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

// Import cache middlewares (commented out)
// const {
//   documentListCache,
//   userDocumentsCache,
//   documentByIdCache,
// } = require("../../middlewares/cache.middleware");

// Import validations
const {
  documentUploadValidation,
  updateDocumentValidation,
  getDocumentByIdValidation,
  deleteDocumentValidation,
  getDocumentsQueryValidation,
} = require("../../validations/user-document.validation");

// Import controller
const {
  upload,
  createDocument,
  getAllDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  downloadDocument,
  getUserDocuments,
} = require("../../controllers/user/user-document.controller");

// Routes

/**
 * @route   POST /api/documents
 * @desc    Create a new document (upload file)
 * @access  Private (User only)
 * @body    { documentName?: string } (multipart/form-data with file)
 */
router.post(
  "/",
  authenticateToken,
  canUserCreate, // Only users can create documents
  upload.single("document"), // Handle file upload with field name "document"
  documentUploadValidation, // Validate using the same pattern as auth/user
  createDocument
);

/**
 * @route   GET /api/documents
 * @desc    Get all documents with pagination, filtering, and search
 * @access  Private (User only)
 * @query   { page?, limit?, sort?, search?, documentType?, uploadedBy? }
 */
router.get(
  "/",
  authenticateToken,
  canView, // Only users can view documents
  // documentListCache, // Cache middleware (commented out)
  getDocumentsQueryValidation,
  getAllDocuments
);

/**
 * @route   GET /api/documents/my-documents
 * @desc    Get current user's documents
 * @access  Private (User only)
 * @query   { page?, limit?, sort? }
 */
router.get(
  "/my-documents",
  authenticateToken,
  canView, // Only users can view their own documents
  // userDocumentsCache, // Cache middleware (commented out)
  getUserDocuments
);

/**
 * @route   GET /api/documents/:id
 * @desc    Get document by ID
 * @access  Private (User only)
 */
router.get(
  "/:id",
  authenticateToken,
  canView, // Only users can view documents
  // documentByIdCache, // Cache middleware (commented out)
  getDocumentByIdValidation,
  getDocumentById
);

/**
 * @route   GET /api/documents/:id/download
 * @desc    Download document file
 * @access  Private (User only)
 */
router.get(
  "/:id/download",
  authenticateToken,
  canView, // Only users can download documents
  getDocumentByIdValidation,
  downloadDocument
);

/**
 * @route   PUT /api/documents/:id
 * @desc    Update document details and optionally replace file
 * @access  Private (User only)
 * @body    { documentName?, isActive? } (multipart/form-data with optional file)
 */
router.put(
  "/:id",
  authenticateToken,
  canUpdate, // Only users can update documents
  upload.single("document"), // Handle optional file upload
  getDocumentByIdValidation,
  updateDocumentValidation,
  updateDocument
);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete document (soft delete)
 * @access  Private (User only)
 */
router.delete(
  "/:id",
  authenticateToken,
  canDelete, // Only users can delete documents
  deleteDocumentValidation,
  deleteDocument
);

module.exports = router;
