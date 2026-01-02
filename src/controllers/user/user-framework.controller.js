const Framework = require("../../models/user-framework.model");
const { paginateWithSearch } = require("../../helpers/helper");
const fs = require("fs");
const {
  createDocumentUpload,
  getDocumentType,
  deleteFile,
  removeFileExtension,
} = require("../../config/multer.config");
// const cacheService = require("../../services/cache.service");
// const { invalidateCache } = require("../../middlewares/cache.middleware");

// Create upload instance with specific directory for user frameworks
const upload = createDocumentUpload("src/uploads/user-frameworks");

// Create a new framework
const createFramework = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Please select a file to upload.",
        field: "framework",
      });
    }

    const { frameworkName } = req.body;
    const file = req.file;

    // Get framework type from file extension
    const frameworkType = getDocumentType(file.originalname);
    if (!frameworkType) {
      // Delete uploaded file if type is invalid
      deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: "Invalid file type detected.",
      });
    }

    // Check if framework with same original filename already exists
    const existingFramework = await Framework.findOne({
      originalFileName: file.originalname,
      uploadedBy: req.user._id,
      isActive: true,
    });

    let framework;
    let message;

    if (existingFramework) {
      // Update existing framework
      existingFramework.frameworkName =
        frameworkName || removeFileExtension(file.originalname);
      existingFramework.fileUrl = file.path;
      existingFramework.frameworkType = frameworkType;
      existingFramework.fileSize = file.size;
      existingFramework.updatedAt = new Date();

      await existingFramework.save();
      framework = existingFramework;
      message = "Framework updated successfully";
    } else {
      // Create new framework record
      framework = new Framework({
        frameworkName: frameworkName || removeFileExtension(file.originalname),
        fileUrl: file.path,
        frameworkType: frameworkType,
        uploadedBy: req.user._id,
        fileSize: file.size,
        originalFileName: file.originalname,
      });

      await framework.save();
      message = "Framework uploaded successfully";
    }

    // Populate uploadedBy field for response
    await framework.populate("uploadedBy", "name email role");

    // Cache the framework (commented out)
    // await cacheService.cacheFramework(framework);

    // Invalidate framework list caches (commented out)
    // await invalidateCache.frameworks(req.user._id);

    res.status(201).json({
      success: true,
      message: message,
      data: {
        framework: {
          id: framework._id,
          frameworkName: framework.frameworkName,
          frameworkType: framework.frameworkType,
          fileSize: framework.getFormattedFileSize(),
          originalFileName: framework.originalFileName,
          uploadedBy: {
            id: framework.uploadedBy._id,
            name: framework.uploadedBy.name,
            email: framework.uploadedBy.email,
            role: framework.uploadedBy.role,
          },
          createdAt: framework.createdAt,
          updatedAt: framework.updatedAt,
        },
      },
    });
  } catch (error) {
    // Delete uploaded file if framework creation fails
    if (req.file) {
      deleteFile(req.file.path);
    }

    console.error("Error creating framework:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating framework",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all frameworks with pagination, filtering, and search
const getAllFrameworks = async (req, res) => {
  try {
    const { search, frameworkType, uploadedBy } = req.query;

    // Build additional filters
    const additionalFilters = { isActive: true };

    if (frameworkType) {
      additionalFilters.frameworkType = frameworkType;
    }

    if (uploadedBy) {
      additionalFilters.uploadedBy = uploadedBy;
    }

    // Build sort object
    let sortObj = { createdAt: -1 }; // Default sort

    if (req.query.sort) {
      const sort = req.query.sort;
      if (sort.startsWith("-")) {
        sortObj = { [sort.substring(1)]: -1 };
      } else {
        sortObj = { [sort]: 1 };
      }
    }

    // Use pagination helper with search
    const result = await paginateWithSearch(Framework, {
      page: req.query.page,
      limit: req.query.limit || 10,
      search: search,
      searchFields: ["frameworkName", "originalFileName"],
      filter: additionalFilters,
      select: "", // Don't exclude any fields for frameworks
      sort: sortObj,
      populate: "uploadedBy",
      transform: (doc) => ({
        id: doc._id,
        frameworkName: doc.frameworkName,
        frameworkType: doc.frameworkType,
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
      }),
    });

    // Determine appropriate message based on data availability
    let message = "Frameworks retrieved successfully";
    if (result.data.length === 0) {
      if (search || frameworkType || uploadedBy) {
        message =
          "No frameworks match your search criteria. Try adjusting your filters.";
      } else {
        message =
          "No frameworks available yet. Upload your first framework to get started.";
      }
    }

    res.status(200).json({
      success: true,
      message: message,
      data: {
        frameworks: result.data,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error("Error getting frameworks:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving frameworks",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get framework by ID
const getFrameworkById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to get from cache first (commented out)
    // let framework = await cacheService.getFrameworkById(id);

    // Fetch directly from database
    const framework = await Framework.findOne({
      _id: id,
      isActive: true,
    }).populate("uploadedBy", "name email role");

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Framework retrieved successfully",
      data: {
        framework: {
          id: framework._id,
          frameworkName: framework.frameworkName,
          frameworkType: framework.frameworkType,
          fileSize: framework.getFormattedFileSize
            ? framework.getFormattedFileSize()
            : "N/A",
          originalFileName: framework.originalFileName,
          fileUrl: framework.fileUrl,
          uploadedBy: {
            id: framework.uploadedBy._id,
            name: framework.uploadedBy.name,
            email: framework.uploadedBy.email,
            role: framework.uploadedBy.role,
          },
          createdAt: framework.createdAt,
          updatedAt: framework.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Error getting framework by ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving framework",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update framework
const updateFramework = async (req, res) => {
  try {
    const { id } = req.params;
    const { frameworkName, isActive } = req.body;

    const framework = await Framework.findOne({
      _id: id,
      isActive: true,
    });

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    // Handle file update if new file is uploaded
    if (req.file) {
      const file = req.file;

      // Get framework type from file extension
      const frameworkType = getDocumentType(file.originalname);
      if (!frameworkType) {
        // Delete uploaded file if type is invalid
        deleteFile(file.path);
        return res.status(400).json({
          success: false,
          message: "Invalid file type detected.",
        });
      }

      // Delete old file if it exists
      if (framework.fileUrl && fs.existsSync(framework.fileUrl)) {
        deleteFile(framework.fileUrl);
      }

      // Update file-related fields
      framework.fileUrl = file.path;
      framework.frameworkType = frameworkType;
      framework.fileSize = file.size;
      framework.originalFileName = file.originalname;

      // If no frameworkName provided in body, use filename without extension
      if (frameworkName === undefined) {
        framework.frameworkName = removeFileExtension(file.originalname);
      }
    }

    // Update other fields
    if (frameworkName !== undefined) {
      framework.frameworkName = frameworkName;
    }
    if (isActive !== undefined) {
      framework.isActive = isActive;
    }

    await framework.save();
    await framework.populate("uploadedBy", "name email role");

    // Update cache (commented out)
    // await cacheService.cacheFramework(framework);

    // Invalidate related caches (commented out)
    // await invalidateCache.frameworks(req.user._id);

    res.status(200).json({
      success: true,
      message: req.file
        ? "Framework and file updated successfully"
        : "Framework updated successfully",
      data: {
        framework: {
          id: framework._id,
          frameworkName: framework.frameworkName,
          frameworkType: framework.frameworkType,
          fileSize: framework.getFormattedFileSize(),
          originalFileName: framework.originalFileName,
          uploadedBy: {
            id: framework.uploadedBy._id,
            name: framework.uploadedBy.name,
            email: framework.uploadedBy.email,
            role: framework.uploadedBy.role,
          },
          isActive: framework.isActive,
          createdAt: framework.createdAt,
          updatedAt: framework.updatedAt,
        },
      },
    });
  } catch (error) {
    // Delete uploaded file if update fails
    if (req.file) {
      deleteFile(req.file.path);
    }

    console.error("Error updating framework:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating framework",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete framework (soft delete)
const deleteFramework = async (req, res) => {
  try {
    const { id } = req.params;

    const framework = await Framework.findOne({ _id: id, isActive: true });

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    // Soft delete - set isActive to false
    framework.isActive = false;
    await framework.save();

    // Invalidate caches (commented out)
    // await invalidateCache.framework(id);
    // await invalidateCache.frameworks(framework.uploadedBy);

    res.status(200).json({
      success: true,
      message: "Framework deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting framework:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting framework",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Download framework
const downloadFramework = async (req, res) => {
  try {
    const { id } = req.params;

    const framework = await Framework.findOne({ _id: id, isActive: true });

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    // Check if file exists
    if (!fs.existsSync(framework.fileUrl)) {
      return res.status(404).json({
        success: false,
        message: "File not found on server",
      });
    }

    // Set appropriate headers for download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${framework.originalFileName}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");

    // Send file
    res.download(framework.fileUrl, framework.originalFileName, (err) => {
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
    console.error("Error downloading framework:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while downloading framework",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get user's frameworks
const getUserFrameworks = async (req, res) => {
  try {
    const userId = req.user._id;

    // Build filter for user's frameworks
    const filter = {
      uploadedBy: userId,
      isActive: true,
    };

    // Build sort object
    let sortObj = { createdAt: -1 }; // Default sort

    if (req.query.sort) {
      const sort = req.query.sort;
      if (sort.startsWith("-")) {
        sortObj = { [sort.substring(1)]: -1 };
      } else {
        sortObj = { [sort]: 1 };
      }
    }

    // Use pagination helper
    const result = await paginateWithSearch(Framework, {
      page: req.query.page,
      limit: req.query.limit || 10,
      filter: filter,
      select: "", // Don't exclude any fields for frameworks
      sort: sortObj,
      populate: "uploadedBy",
      transform: (doc) => ({
        id: doc._id,
        frameworkName: doc.frameworkName,
        frameworkType: doc.frameworkType,
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
      }),
    });

    // Determine appropriate message based on data availability
    let message = "User frameworks retrieved successfully";
    if (result.data.length === 0) {
      message =
        "You haven't uploaded any frameworks yet. Upload your first framework to get started.";
    }

    res.status(200).json({
      success: true,
      message: message,
      data: {
        frameworks: result.data,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    console.error("Error getting user frameworks:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving user frameworks",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  upload,
  createFramework,
  getAllFrameworks,
  getFrameworkById,
  updateFramework,
  deleteFramework,
  downloadFramework,
  getUserFrameworks,
};
