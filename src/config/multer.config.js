const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * Flexible Multer Configuration
 *
 * This module provides reusable multer configurations that accept upload directories
 * at usage time instead of being fixed in the configuration.
 *
 * Usage Examples:
 *
 * 1. Document Upload:
 *    const upload = createDocumentUpload("src/uploads/user-documents");
 *    router.post('/upload', upload.single('document'), handler);
 *
 * 2. Image Upload:
 *    const imageUpload = createImageUpload("src/uploads/profile-images");
 *    router.post('/upload-image', imageUpload.single('image'), handler);
 *
 * 3. Multiple Upload Directories:
 *    const userDocs = createDocumentUpload("src/uploads/user-documents");
 *    const expertDocs = createDocumentUpload("src/uploads/expert-frameworks");
 */

// Helper function to get document type from file extension
const getDocumentType = (filename) => {
  const extension = path.extname(filename).toLowerCase();
  switch (extension) {
    case ".pdf":
      return "pdf";
    case ".doc":
      return "doc";
    case ".docx":
      return "docx";
    case ".xls":
      return "xls";
    case ".xlsx":
      return "xlsx";
    default:
      return null;
  }
};

// Helper function to delete file from filesystem
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Error deleting file:", error);
  }
};

// Helper function to remove file extension from filename
const removeFileExtension = (filename) => {
  return path.parse(filename).name;
};

// Document upload configuration
const createDocumentUpload = (uploadDir = "src/uploads/documents") => {
  // Configure multer storage
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      // Use original filename (this will replace existing files with same name)
      cb(null, file.originalname);
    },
  });

  // File filter to allow only specific file types
  const fileFilter = (req, file, cb) => {
    const allowedTypes = [
      "application/pdf", // PDF
      "application/msword", // DOC
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // DOCX
      "application/vnd.ms-excel", // XLS
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // XLSX
    ];

    const allowedExtensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (
      allowedTypes.includes(file.mimetype) &&
      allowedExtensions.includes(fileExtension)
    ) {
      cb(null, true);
    } else {
      // Create a proper error response that matches validation pattern
      const error = new Error(
        "Invalid file type. Only PDF, DOC, DOCX, XLS, and XLSX files are allowed."
      );
      error.code = "INVALID_FILE_TYPE";
      cb(error, false);
    }
  };

  // Configure multer upload
  return multer({
    storage: storage,
    limits: {
      fileSize: 30 * 1024 * 1024, // 30MB limit
    },
    fileFilter: fileFilter,
  });
};

// Image upload configuration (for future use)
const createImageUpload = (uploadDir = "src/uploads/images") => {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      // Generate unique filename with timestamp
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
      );
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error(
        "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."
      );
      error.code = "INVALID_FILE_TYPE";
      cb(error, false);
    }
  };

  return multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit for images
    },
    fileFilter: fileFilter,
  });
};

// Default document upload instance
const documentUpload = createDocumentUpload();

module.exports = {
  createDocumentUpload,
  createImageUpload,
  documentUpload,
  getDocumentType,
  deleteFile,
  removeFileExtension,
};
