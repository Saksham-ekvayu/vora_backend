const UserDocument = require("../../models/user-document.model");
const {
  paginateWithSearch,
  formatDocumentUploadedBy,
} = require("../../helpers/helper");
const fs = require("fs");
const {
  createDocumentUpload,
  getDocumentType,
  deleteFile,
  removeFileExtension,
} = require("../../config/multer.config");

// Create upload instance with specific directory for user documents
const upload = createDocumentUpload("src/uploads/user-documents");

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
    const existingDocument = await UserDocument.findOne({
      originalFileName: file.originalname,
      uploadedBy: req.user._id,
    });

    let document;
    let message;

    if (existingDocument) {
      // Update existing document
      existingDocument.documentName =
        documentName || removeFileExtension(file.originalname);
      existingDocument.fileUrl = file.path;
      existingDocument.documentType = documentType;
      existingDocument.fileSize = file.size;
      existingDocument.updatedAt = new Date();

      await existingDocument.save();
      document = existingDocument;
      message = "Document updated successfully";
    } else {
      // Create new document record
      document = new UserDocument({
        documentName: documentName || removeFileExtension(file.originalname),
        fileUrl: file.path,
        documentType: documentType,
        uploadedBy: req.user._id,
        originalUploadedBy: {
          userId: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
        },
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
          uploadedBy: formatDocumentUploadedBy(document),
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
    const { search, documentType, uploadedBy } = req.query;

    // Build additional filters
    const additionalFilters = {};

    if (documentType) {
      additionalFilters.documentType = documentType;
    }

    if (uploadedBy) {
      additionalFilters.uploadedBy = uploadedBy;
    }

    // Define allowed sort fields
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "documentName",
      "documentType",
      "fileSize",
      "originalFileName",
    ];

    // Use pagination helper with search
    const result = await paginateWithSearch(UserDocument, {
      page: req.query.page,
      limit: req.query.limit || 10,
      search: search,
      searchFields: [
        "documentName",
        "originalFileName",
        "originalUploadedBy.name",
        "originalUploadedBy.email",
      ],
      filter: additionalFilters,
      select: "", // Don't exclude any fields for documents
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      allowedSortFields: allowedSortFields,
      populate: "uploadedBy",
      transform: (doc) => ({
        id: doc._id,
        documentName: doc.documentName,
        documentType: doc.documentType,
        fileSize: doc.getFormattedFileSize(),
        originalFileName: doc.originalFileName,
        uploadedBy: formatDocumentUploadedBy(doc),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }),
    });

    // Determine appropriate message based on data availability
    let message = "User documents retrieved successfully";
    if (result.data.length === 0) {
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
        documents: result.data,
        pagination: result.pagination,
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

    // Fetch directly from database
    const document = await UserDocument.findById(id).populate(
      "uploadedBy",
      "name email role"
    );

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
          fileSize: document.getFormattedFileSize
            ? document.getFormattedFileSize()
            : "N/A",
          originalFileName: document.originalFileName,
          fileUrl: document.fileUrl,
          uploadedBy: formatDocumentUploadedBy(document),
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
    const { documentName } = req.body;

    const document = await UserDocument.findById(id);

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

      // If no documentName provided in body, use filename without extension
      if (documentName === undefined) {
        document.documentName = removeFileExtension(file.originalname);
      }
    }

    // Update other fields
    if (documentName !== undefined) {
      document.documentName = documentName;
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
          uploadedBy: formatDocumentUploadedBy(document),
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

// Delete document (permanent delete)
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await UserDocument.findById(id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Delete physical file from filesystem
    if (document.fileUrl) {
      deleteFile(document.fileUrl);
    }

    // Permanent delete from database
    await UserDocument.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Document permanently deleted successfully",
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

    const document = await UserDocument.findById(id);

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

    // Build filter for user's documents
    const filter = {
      uploadedBy: userId,
    };

    // Define allowed sort fields
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "documentName",
      "documentType",
      "fileSize",
      "originalFileName",
    ];

    // Use pagination helper
    const result = await paginateWithSearch(UserDocument, {
      page: req.query.page,
      limit: req.query.limit || 10,
      search: req.query.search,
      searchFields: [
        "documentName",
        "originalFileName",
        "originalUploadedBy.name",
        "originalUploadedBy.email",
      ],
      filter: filter,
      select: "", // Don't exclude any fields for documents
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      allowedSortFields: allowedSortFields,
      populate: "uploadedBy",
      transform: (doc) => ({
        id: doc._id,
        documentName: doc.documentName,
        documentType: doc.documentType,
        fileSize: doc.getFormattedFileSize(),
        originalFileName: doc.originalFileName,
        uploadedBy: formatDocumentUploadedBy(doc),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }),
    });

    // Determine appropriate message based on data availability
    let message = "User documents retrieved successfully";
    if (result.data.length === 0) {
      if (req.query.search) {
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
        documents: result.data,
        pagination: result.pagination,
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
