const Document = require("../models/document.model");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "src/uploads/documents";
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
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30MB limit
  },
  fileFilter: fileFilter,
});

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

// Create a new document
const createDocument = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Please select a file to upload.",
        field: "document",
      });
    }

    const { documentName } = req.body;
    const file = req.file;

    // Get document type from file extension
    const documentType = getDocumentType(file.originalname);
    if (!documentType) {
      // Delete uploaded file if type is invalid
      deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: "Invalid file type detected.",
      });
    }

    // Check if document with same original filename already exists
    const existingDocument = await Document.findOne({
      originalFileName: file.originalname,
      uploadedBy: req.user._id,
      isActive: true,
    });

    let document;
    let message;

    if (existingDocument) {
      // Update existing document
      existingDocument.documentName = documentName || file.originalname;
      existingDocument.fileUrl = file.path;
      existingDocument.documentType = documentType;
      existingDocument.fileSize = file.size;
      existingDocument.updatedAt = new Date();

      await existingDocument.save();
      document = existingDocument;
      message = "Document updated successfully";
    } else {
      // Create new document record
      document = new Document({
        documentName: documentName || file.originalname,
        fileUrl: file.path,
        documentType: documentType,
        uploadedBy: req.user._id,
        fileSize: file.size,
        originalFileName: file.originalname,
      });

      await document.save();
      message = "Document uploaded successfully";
    }

    // Populate uploadedBy field for response
    await document.populate("uploadedBy", "name email role");

    res.status(201).json({
      success: true,
      message: message,
      data: {
        document: {
          id: document._id,
          documentName: document.documentName,
          documentType: document.documentType,
          fileSize: document.getFormattedFileSize(),
          originalFileName: document.originalFileName,
          uploadedBy: {
            id: document.uploadedBy._id,
            name: document.uploadedBy.name,
            email: document.uploadedBy.email,
            role: document.uploadedBy.role,
          },
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
      },
    });
  } catch (error) {
    // Delete uploaded file if document creation fails
    if (req.file) {
      deleteFile(req.file.path);
    }

    console.error("Error creating document:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating document",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all documents with pagination, filtering, and search
const getAllDocuments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "-createdAt",
      search,
      documentType,
      uploadedBy,
    } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (documentType) {
      filter.documentType = documentType;
    }

    if (uploadedBy) {
      filter.uploadedBy = uploadedBy;
    }

    if (search) {
      filter.$or = [
        { documentName: { $regex: search, $options: "i" } },
        { originalFileName: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get documents with pagination
    const documents = await Document.find(filter)
      .populate("uploadedBy", "name email role")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalDocuments = await Document.countDocuments(filter);
    const totalPages = Math.ceil(totalDocuments / parseInt(limit));

    // Format response data
    const formattedDocuments = documents.map((doc) => ({
      id: doc._id,
      documentName: doc.documentName,
      documentType: doc.documentType,
      fileSize: doc.getFormattedFileSize(),
      originalFileName: doc.originalFileName,
      uploadedBy: {
        id: doc.uploadedBy._id,
        name: doc.uploadedBy.name,
        email: doc.uploadedBy.email,
        role: doc.uploadedBy.role,
      },
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    // Determine appropriate message based on data availability
    let message = "Documents retrieved successfully";
    if (formattedDocuments.length === 0) {
      if (search || documentType || uploadedBy) {
        message =
          "No documents match your search criteria. Try adjusting your filters.";
      } else {
        message =
          "No documents available yet. Upload your first document to get started.";
      }
    }

    res.status(200).json({
      success: true,
      message: message,
      data: {
        documents: formattedDocuments,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalDocuments,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error getting documents:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving documents",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get document by ID
const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findOne({
      _id: id,
      isActive: true,
    }).populate("uploadedBy", "name email role");

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Document retrieved successfully",
      data: {
        document: {
          id: document._id,
          documentName: document.documentName,
          documentType: document.documentType,
          fileSize: document.getFormattedFileSize(),
          originalFileName: document.originalFileName,
          fileUrl: document.fileUrl,
          uploadedBy: {
            id: document.uploadedBy._id,
            name: document.uploadedBy.name,
            email: document.uploadedBy.email,
            role: document.uploadedBy.role,
          },
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Error getting document by ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving document",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update document
const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentName, isActive } = req.body;

    const document = await Document.findOne({
      _id: id,
      isActive: true,
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Handle file update if new file is uploaded
    if (req.file) {
      const file = req.file;

      // Get document type from file extension
      const documentType = getDocumentType(file.originalname);
      if (!documentType) {
        // Delete uploaded file if type is invalid
        deleteFile(file.path);
        return res.status(400).json({
          success: false,
          message: "Invalid file type detected.",
        });
      }

      // Delete old file if it exists
      if (document.fileUrl && fs.existsSync(document.fileUrl)) {
        deleteFile(document.fileUrl);
      }

      // Update file-related fields
      document.fileUrl = file.path;
      document.documentType = documentType;
      document.fileSize = file.size;
      document.originalFileName = file.originalname;
    }

    // Update other fields
    if (documentName !== undefined) {
      document.documentName = documentName;
    }
    if (isActive !== undefined) {
      document.isActive = isActive;
    }

    await document.save();
    await document.populate("uploadedBy", "name email role");

    res.status(200).json({
      success: true,
      message: req.file
        ? "Document and file updated successfully"
        : "Document updated successfully",
      data: {
        document: {
          id: document._id,
          documentName: document.documentName,
          documentType: document.documentType,
          fileSize: document.getFormattedFileSize(),
          originalFileName: document.originalFileName,
          uploadedBy: {
            id: document.uploadedBy._id,
            name: document.uploadedBy.name,
            email: document.uploadedBy.email,
            role: document.uploadedBy.role,
          },
          isActive: document.isActive,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
        },
      },
    });
  } catch (error) {
    // Delete uploaded file if update fails
    if (req.file) {
      deleteFile(req.file.path);
    }

    console.error("Error updating document:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating document",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete document (soft delete)
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findOne({ _id: id, isActive: true });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Soft delete - set isActive to false
    document.isActive = false;
    await document.save();

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting document",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Download document
const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await Document.findOne({ _id: id, isActive: true });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Check if file exists
    if (!fs.existsSync(document.fileUrl)) {
      return res.status(404).json({
        success: false,
        message: "File not found on server",
      });
    }

    // Set appropriate headers for download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.originalFileName}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");

    // Send file
    res.download(document.fileUrl, document.originalFileName, (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: "Error downloading file",
          });
        }
      }
    });
  } catch (error) {
    console.error("Error downloading document:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while downloading document",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get user's documents
const getUserDocuments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, sort = "-createdAt" } = req.query;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get user's documents
    const documents = await Document.find({
      uploadedBy: userId,
      isActive: true,
    })
      .populate("uploadedBy", "name email role")
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalDocuments = await Document.countDocuments({
      uploadedBy: userId,
      isActive: true,
    });
    const totalPages = Math.ceil(totalDocuments / parseInt(limit));

    // Format response data
    const formattedDocuments = documents.map((doc) => ({
      id: doc._id,
      documentName: doc.documentName,
      documentType: doc.documentType,
      fileSize: doc.getFormattedFileSize(),
      originalFileName: doc.originalFileName,
      uploadedBy: {
        id: doc.uploadedBy._id,
        name: doc.uploadedBy.name,
        email: doc.uploadedBy.email,
        role: doc.uploadedBy.role,
      },
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    // Determine appropriate message based on data availability
    let message = "User documents retrieved successfully";
    if (formattedDocuments.length === 0) {
      message =
        "You haven't uploaded any documents yet. Upload your first document to get started.";
    }

    res.status(200).json({
      success: true,
      message: message,
      data: {
        documents: formattedDocuments,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalDocuments,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error getting user documents:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving user documents",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  upload,
  createDocument,
  getAllDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  downloadDocument,
  getUserDocuments,
};
