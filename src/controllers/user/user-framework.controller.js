const UserFramework = require("../../models/user-framework.model");
const FrameworkComparison = require("../../models/framework-comparison.model");
const {
  paginateWithSearch,
  formatFrameworkUploadedBy,
  formatFileSize,
  formatAIProcessingData,
} = require("../../helpers/helper");
const fs = require("fs");
const {
  createDocumentUpload,
  getDocumentType,
  deleteFile,
  removeFileExtension,
} = require("../../config/multer.config");
const aiService = require("../../services/ai/user-ai.service");
const {
  sendToUser,
} = require("../../websocket/framework-comparison.websocket");

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
        field: "file",
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
    const existingFramework = await UserFramework.findOne({
      originalFileName: file.originalname,
      uploadedBy: req.user._id,
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
      framework = new UserFramework({
        frameworkName: frameworkName || removeFileExtension(file.originalname),
        fileUrl: file.path,
        frameworkType: frameworkType,
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

      await framework.save();
      message = "Framework uploaded successfully";
    }

    // Populate uploadedBy field for response
    await framework.populate("uploadedBy", "name email role");

    res.status(201).json({
      success: true,
      message: message,
      data: {
        framework: {
          id: framework._id,
          frameworkName: framework.frameworkName,
          frameworkType: framework.frameworkType,
          fileSize: formatFileSize(framework.fileSize),
          originalFileName: framework.originalFileName,
          uploadedBy: formatFrameworkUploadedBy(framework),
          aiProcessing: formatAIProcessingData(framework.aiProcessing),
          createdAt: framework.createdAt,
          updatedAt: framework.updatedAt,
        },
      },
    });

    // Send WebSocket update for framework list refresh
    sendToUser(req.user._id.toString(), {
      type: "framework-list-refresh",
      message: "Framework list updated",
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
    const additionalFilters = {};

    if (frameworkType) {
      additionalFilters.frameworkType = frameworkType;
    }

    if (uploadedBy) {
      additionalFilters.uploadedBy = uploadedBy;
    }

    // Define allowed sort fields
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "frameworkName",
      "frameworkType",
      "fileSize",
      "originalFileName",
    ];

    // Use pagination helper with search
    const result = await paginateWithSearch(UserFramework, {
      page: req.query.page,
      limit: req.query.limit || 10,
      search: search,
      searchFields: [
        "frameworkName",
        "originalFileName",
        "originalUploadedBy.name",
        "originalUploadedBy.email",
      ],
      filter: additionalFilters,
      select: "", // Don't exclude any fields for frameworks
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      allowedSortFields: allowedSortFields,
      populate: "uploadedBy",
      transform: (doc) => ({
        id: doc._id,
        frameworkName: doc.frameworkName,
        frameworkType: doc.frameworkType,
        fileSize: formatFileSize(doc.fileSize),
        originalFileName: doc.originalFileName,
        uploadedBy: formatFrameworkUploadedBy(doc),
        aiProcessing: formatAIProcessingData(doc.aiProcessing),
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
    const framework = await UserFramework.findById(id).populate(
      "uploadedBy",
      "name email role"
    );

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    const responseData = {
      framework: {
        id: framework._id,
        frameworkName: framework.frameworkName,
        frameworkType: framework.frameworkType,
        fileSize: formatFileSize(framework.fileSize),
        originalFileName: framework.originalFileName,
        fileUrl: framework.fileUrl,
        uploadedBy: formatFrameworkUploadedBy(framework),
        aiProcessing: formatAIProcessingData(framework.aiProcessing, true),
        comparisonResults: framework.comparisonResults || [],
        comparisonCount: framework.comparisonResults?.length || 0,
        createdAt: framework.createdAt,
        updatedAt: framework.updatedAt,
      },
    };

    const controlsCount = framework.aiProcessing?.controlsCount || 0;
    const comparisonCount = framework.comparisonResults?.length || 0;

    let message = "Framework retrieved successfully";
    if (controlsCount > 0 && comparisonCount > 0) {
      message = `Framework retrieved successfully with ${controlsCount} extracted controls and ${comparisonCount} comparison results`;
    } else if (controlsCount > 0) {
      message = `Framework retrieved successfully with ${controlsCount} extracted controls`;
    } else if (comparisonCount > 0) {
      message = `Framework retrieved successfully with ${comparisonCount} comparison results`;
    }

    res.status(200).json({
      success: true,
      message: message,
      data: responseData,
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
    const { frameworkName } = req.body;

    const framework = await UserFramework.findById(id);

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

    await framework.save();
    await framework.populate("uploadedBy", "name email role");

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
          fileSize: formatFileSize(framework.fileSize),
          originalFileName: framework.originalFileName,
          uploadedBy: formatFrameworkUploadedBy(framework),
          createdAt: framework.createdAt,
          updatedAt: framework.updatedAt,
        },
      },
    });

    // Send WebSocket update for framework list refresh
    sendToUser(req.user._id.toString(), {
      type: "framework-list-refresh",
      message: "Framework list updated",
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

// Delete framework (permanent delete)
const deleteFramework = async (req, res) => {
  try {
    const { id } = req.params;

    const framework = await UserFramework.findById(id);

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    // Delete physical file from filesystem
    if (framework.fileUrl) {
      deleteFile(framework.fileUrl);
    }

    // Clean up related data - remove comparison results that reference this framework
    await UserFramework.updateMany(
      { "comparisonResults.expertFrameworkId": id },
      { $pull: { comparisonResults: { expertFrameworkId: id } } }
    );

    // Delete related framework comparisons
    await FrameworkComparison.deleteMany({
      $or: [{ userFrameworkId: id }, { expertFrameworkId: id }],
    });

    // Permanent delete from database
    await UserFramework.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Framework permanently deleted successfully",
    });

    // Send WebSocket update for framework list refresh
    sendToUser(req.user._id.toString(), {
      type: "framework-list-refresh",
      message: "Framework list updated",
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

    const framework = await UserFramework.findById(id);

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
    };

    // Define allowed sort fields
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "frameworkName",
      "frameworkType",
      "fileSize",
      "originalFileName",
    ];

    // Use pagination helper
    const result = await paginateWithSearch(UserFramework, {
      page: req.query.page,
      limit: req.query.limit || 10,
      search: req.query.search,
      searchFields: [
        "frameworkName",
        "originalFileName",
        "originalUploadedBy.name",
        "originalUploadedBy.email",
      ],
      filter: filter,
      select: "",
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
      allowedSortFields: allowedSortFields,
      populate: "uploadedBy",
      transform: (doc) => ({
        id: doc._id,
        frameworkName: doc.frameworkName,
        frameworkType: doc.frameworkType,
        fileSize: formatFileSize(doc.fileSize),
        originalFileName: doc.originalFileName,
        uploadedBy: formatFrameworkUploadedBy(doc),
        aiProcessing: formatAIProcessingData(doc.aiProcessing),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }),
    });

    // Determine appropriate message based on data availability
    let message = "User frameworks retrieved successfully";
    if (result.data.length === 0) {
      if (req.query.search) {
        message =
          "No framework match your search criteria. Try adjusting your filters.";
      } else {
        message =
          "You haven't uploaded any frameworks yet. Upload your first framework to get started.";
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
    console.error("Error getting user frameworks:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving user frameworks",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Upload framework to AI service
const uploadFrameworkToAIService = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    const framework = await UserFramework.findById(id);

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    if (!fs.existsSync(framework.fileUrl)) {
      return res.status(404).json({
        success: false,
        message: "Framework file not found on server",
      });
    }

    if (
      framework.aiProcessing.uuid &&
      framework.aiProcessing.status !== "failed"
    ) {
      return res.status(400).json({
        success: false,
        message: `Framework is already ${framework.aiProcessing.status} in AI service`,
      });
    }

    // Upload to AI service
    const aiResult = await aiService.uploadFramework(framework.fileUrl);

    if (!aiResult.success) {
      throw new Error("AI upload failed");
    }

    // Update framework with AI response
    framework.aiProcessing.uuid = aiResult.aiResponse.uuid;
    framework.aiProcessing.status = aiResult.aiResponse.status;
    framework.aiProcessing.control_extraction_status =
      aiResult.aiResponse.control_extraction_status;
    framework.aiProcessing.processedAt = new Date();
    framework.aiProcessing.errorMessage = null;
    await framework.save();

    // Start background monitoring - connects to AI service WebSocket
    aiService.startBackgroundMonitoring(
      aiResult.aiResponse.uuid,
      id,
      async (message) => {
        const fw = await UserFramework.findById(id);
        if (!fw) return;

        // Update framework based on AI message
        if (message.status === "completed") {
          const controls = Array.isArray(message.data) ? message.data : [];
          fw.aiProcessing.extractedControls = controls;
          fw.aiProcessing.controlsCount = controls.length;
          fw.aiProcessing.controlsExtractedAt = new Date();
          fw.aiProcessing.status = "completed";
          fw.aiProcessing.control_extraction_status = "completed";
          await fw.save();
        } else if (message.status === "error" || message.status === "failed") {
          fw.aiProcessing.status = "failed";
          fw.aiProcessing.control_extraction_status = "failed";
          fw.aiProcessing.errorMessage =
            message.message || "AI processing failed";
          await fw.save();
        }

        // Send AI message directly to frontend via WebSocket
        sendToUser(userId, {
          type: "ai-processing-update",
          frameworkId: id,
          aiMessage: message,
        });
      }
    );

    res.status(200).json({
      success: true,
      message:
        "Framework uploaded to AI service successfully. You will receive real-time updates.",
      data: {
        framework: {
          id: framework._id,
          frameworkName: framework.frameworkName,
          frameworkType: framework.frameworkType,
          aiProcessing: {
            uuid: aiResult.aiResponse.uuid,
            status: aiResult.aiResponse.status,
            control_extraction_status:
              aiResult.aiResponse.control_extraction_status,
            processedAt: framework.aiProcessing.processedAt,
          },
        },
      },
    });
  } catch (error) {
    if (req.params.id) {
      try {
        const framework = await UserFramework.findById(req.params.id);
        if (framework) {
          framework.aiProcessing.status = "failed";
          framework.aiProcessing.control_extraction_status = "failed";
          framework.aiProcessing.errorMessage = error.message;
          framework.aiProcessing.processedAt = new Date();
          await framework.save();
        }
      } catch (updateError) {
        console.error("Failed to update framework error status:", updateError);
      }
    }

    if (error.message.includes("AI service is not available")) {
      return res.status(503).json({
        success: false,
        message: "AI service is currently unavailable. Please try again later.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to upload framework to AI service",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Check AI processing status
const checkAIProcessingStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const framework = await UserFramework.findById(id);

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    if (!framework.aiProcessing.uuid) {
      return res.status(400).json({
        success: false,
        message: "Framework has not been uploaded to AI service yet",
      });
    }

    const statusResult = await aiService.checkProcessingStatus(
      framework.aiProcessing.uuid
    );

    res.status(200).json({
      success: true,
      message: "AI processing status retrieved successfully",
      data: {
        framework: {
          id: framework._id,
          frameworkName: framework.frameworkName,
          aiProcessing: formatAIProcessingData(framework.aiProcessing, true),
        },
        aiStatus: statusResult.status,
      },
    });
  } catch (error) {
    console.error("Error checking AI processing status:", error);

    if (error.message.includes("AI service is not available")) {
      return res.status(503).json({
        success: false,
        message: "AI service is currently unavailable. Please try again later.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to check AI processing status",
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
  uploadFrameworkToAIService,
  checkAIProcessingStatus,
};
