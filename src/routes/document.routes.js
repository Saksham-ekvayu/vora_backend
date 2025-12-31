const express = require("express");
const router = express.Router();

// Import middlewares
const { authenticateToken } = require("../middlewares/auth.middleware");
const {
  canCreateDocument,
  canUpdateDocument,
  canDeleteDocument,
  canViewDocument,
} = require("../middlewares/roleAccess.middleware");

// Import validations
const {
  documentUploadValidation,
  updateDocumentValidation,
  getDocumentByIdValidation,
  deleteDocumentValidation,
  getDocumentsQueryValidation,
} = require("../validations/document.validation");

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
} = require("../controllers/document.controller");

// Routes

/**
 * @route   POST /api/documents
 * @desc    Create a new document (upload file)
 * @access  Private (Expert only)
 * @body    { documentName?: string } (multipart/form-data with file)
 */
router.post(
  "/",
  authenticateToken,
  canCreateDocument, // Only experts can create documents
  upload.single("document"), // Handle file upload with field name "document"
  documentUploadValidation, // Validate using the same pattern as auth/user
  createDocument
);

/**
 * @route   GET /api/documents
 * @desc    Get all documents with pagination, filtering, and search
 * @access  Private (All authenticated users can view)
 * @query   { page?, limit?, sort?, search?, documentType?, uploadedBy? }
 */
router.get(
  "/",
  authenticateToken,
  canViewDocument, // All authenticated users can view documents
  getDocumentsQueryValidation,
  getAllDocuments
);

/**
 * @route   GET /api/documents/my-documents
 * @desc    Get current user's documents
 * @access  Private (All authenticated users)
 * @query   { page?, limit?, sort? }
 */
router.get(
  "/my-documents",
  authenticateToken,
  canViewDocument, // All authenticated users can view their own documents
  getUserDocuments
);

/**
 * @route   GET /api/documents/:id
 * @desc    Get document by ID
 * @access  Private (All authenticated users can view)
 */
router.get(
  "/:id",
  authenticateToken,
  canViewDocument, // All authenticated users can view documents
  getDocumentByIdValidation,
  getDocumentById
);

/**
 * @route   GET /api/documents/:id/download
 * @desc    Download document file
 * @access  Private (All authenticated users can download)
 */
router.get(
  "/:id/download",
  authenticateToken,
  canViewDocument, // All authenticated users can download documents
  getDocumentByIdValidation,
  downloadDocument
);

/**
 * @route   PUT /api/documents/:id
 * @desc    Update document details (not the file)
 * @access  Private (Expert only)
 * @body    { documentName?, isActive? }
 */
router.put(
  "/:id",
  authenticateToken,
  canUpdateDocument, // Only experts can update documents
  getDocumentByIdValidation,
  updateDocumentValidation,
  updateDocument
);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete document (soft delete)
 * @access  Private (Expert only)
 */
router.delete(
  "/:id",
  authenticateToken,
  canDeleteDocument, // Only experts can delete documents
  deleteDocumentValidation,
  deleteDocument
);

module.exports = router;
