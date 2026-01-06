const UserFramework = require("../../models/user-framework.model");
const { paginateWithSearch } = require("../../helpers/helper");
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
// const cacheService = require("../../services/cache.service");
// const { invalidateCache } = require("../../middlewares/cache.middleware");

// Create upload instance with specific directory for user frameworks
const upload = createDocumentUpload("src/uploads/user-frameworks");

// Helper functions
const getFormattedFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatAIProcessingData = (aiProcessing, includeControls = false) => {
  if (!aiProcessing?.uuid) return null;

  const baseData = {
    uuid: aiProcessing.uuid,
    status: aiProcessing.status,
    control_extraction_status: aiProcessing.control_extraction_status,
    processedAt: aiProcessing.processedAt,
    controlsExtractedAt: aiProcessing.controlsExtractedAt || null,
    errorMessage: aiProcessing.errorMessage || null,
    controlsCount: aiProcessing.controlsCount || 0,
  };

  // Include controls data if requested
  if (includeControls && aiProcessing.extractedControls?.length > 0) {
    baseData.extractedControls = aiProcessing.extractedControls;
  }

  return baseData;
};

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
      framework = new UserFramework({
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

    res.status(201).json({
      success: true,
      message: message,
      data: {
        framework: {
          id: framework._id,
          frameworkName: framework.frameworkName,
          frameworkType: framework.frameworkType,
          fileSize: getFormattedFileSize(framework.fileSize),
          originalFileName: framework.originalFileName,
          uploadedBy: {
            id: framework.uploadedBy._id,
            name: framework.uploadedBy.name,
            email: framework.uploadedBy.email,
            role: framework.uploadedBy.role,
          },
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
    const result = await paginateWithSearch(UserFramework, {
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
        fileSize: getFormattedFileSize(doc.fileSize),
        originalFileName: doc.originalFileName,
        uploadedBy: {
          id: doc.uploadedBy._id,
          name: doc.uploadedBy.name,
          email: doc.uploadedBy.email,
          role: doc.uploadedBy.role,
        },
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
    const framework = await UserFramework.findOne({
      _id: id,
      isActive: true,
    }).populate("uploadedBy", "name email role");

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
        fileSize: getFormattedFileSize(framework.fileSize),
        originalFileName: framework.originalFileName,
        fileUrl: framework.fileUrl,
        uploadedBy: {
          id: framework.uploadedBy._id,
          name: framework.uploadedBy.name,
          email: framework.uploadedBy.email,
          role: framework.uploadedBy.role,
        },
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
    const { frameworkName, isActive } = req.body;

    const framework = await UserFramework.findOne({
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
          fileSize: getFormattedFileSize(framework.fileSize),
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

// Delete framework (soft delete)
const deleteFramework = async (req, res) => {
  try {
    const { id } = req.params;

    const framework = await UserFramework.findOne({ _id: id, isActive: true });

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

    const framework = await UserFramework.findOne({ _id: id, isActive: true });

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
    const result = await paginateWithSearch(UserFramework, {
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
        fileSize: getFormattedFileSize(doc.fileSize),
        originalFileName: doc.originalFileName,
        uploadedBy: {
          id: doc.uploadedBy._id,
          name: doc.uploadedBy.name,
          email: doc.uploadedBy.email,
          role: doc.uploadedBy.role,
        },
        aiProcessing: formatAIProcessingData(doc.aiProcessing),
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

// Upload framework to AI service
const uploadFrameworkToAIService = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    const framework = await UserFramework.findOne({
      _id: id,
      isActive: true,
    }).populate("uploadedBy", "name email role");

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

    // Send initial WebSocket update - upload started
    sendToUser(userId, {
      type: "framework-ai-processing",
      frameworkId: id,
      status: "uploading",
      message: "Uploading framework to AI service...",
      control_extraction_status: "pending",
    });

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

    // Send WebSocket update - upload completed, processing started
    sendToUser(userId, {
      type: "framework-ai-processing",
      frameworkId: id,
      status: aiResult.aiResponse.status,
      control_extraction_status: aiResult.aiResponse.control_extraction_status,
      message: "Framework uploaded successfully. AI processing started...",
      uuid: aiResult.aiResponse.uuid,
      processedAt: framework.aiProcessing.processedAt,
    });

    // Start background monitoring with WebSocket updates
    try {
      aiService.startBackgroundMonitoring(
        aiResult.aiResponse.uuid,
        id,
        async (message) => {
          const fw = await UserFramework.findById(id);
          if (!fw) return;

          let wsMessage = {
            type: "framework-ai-processing",
            frameworkId: id,
            uuid: fw.aiProcessing.uuid,
          };

          // Handle completion - check for various completion indicators
          if (message.status === "completed" || message.status === "done") {
            // Extract controls from various possible message formats
            let controls = [];
            if (message.data && Array.isArray(message.data)) {
              controls = message.data;
            } else if (message.controls && Array.isArray(message.controls)) {
              controls = message.controls;
            } else if (
              message.extracted_controls &&
              Array.isArray(message.extracted_controls)
            ) {
              controls = message.extracted_controls;
            } else if (message.results && Array.isArray(message.results)) {
              controls = message.results;
            }

            // If no controls in the message, try to fetch them from AI service
            if (controls.length === 0) {
              try {
                const statusResult = await aiService.checkProcessingStatus(
                  fw.aiProcessing.uuid
                );
                if (statusResult.status && statusResult.status.data) {
                  controls = Array.isArray(statusResult.status.data)
                    ? statusResult.status.data
                    : [];
                }
              } catch (statusError) {
                console.error(
                  "❌ Failed to fetch controls from AI service:",
                  statusError
                );
              }
            }

            fw.aiProcessing.extractedControls = controls;
            fw.aiProcessing.controlsCount = controls.length;
            fw.aiProcessing.controlsExtractedAt = new Date();
            fw.aiProcessing.status = "completed";
            fw.aiProcessing.control_extraction_status = "completed";
            await fw.save();

            wsMessage = {
              ...wsMessage,
              status: "completed",
              control_extraction_status: "completed",
              message: `AI processing completed! ${controls.length} controls extracted.`,
              controlsCount: controls.length,
              extractedControls: controls,
              controlsExtractedAt: fw.aiProcessing.controlsExtractedAt,
            };

            // Also send framework details update message
            sendToUser(userId, {
              type: "framework-details-update",
              frameworkId: id,
              framework: {
                id: fw._id,
                frameworkName: fw.frameworkName,
                frameworkType: fw.frameworkType,
                aiProcessing: {
                  status: "completed",
                  control_extraction_status: "completed",
                  controlsCount: controls.length,
                  extractedControls: controls,
                  controlsExtractedAt: fw.aiProcessing.controlsExtractedAt,
                  processedAt: fw.aiProcessing.processedAt,
                },
              },
            });

            // Also send a framework list refresh message
            sendToUser(userId, {
              type: "framework-list-refresh",
              message: "Framework processing completed, refreshing list",
            });
          } else if (
            message.status === "error" ||
            message.status === "failed"
          ) {
            fw.aiProcessing.status = "failed";
            fw.aiProcessing.control_extraction_status = "failed";
            fw.aiProcessing.errorMessage =
              message.message || message.error || "AI processing failed";
            await fw.save();

            wsMessage = {
              ...wsMessage,
              status: "failed",
              control_extraction_status: "failed",
              message:
                message.message || message.error || "AI processing failed",
              errorMessage: message.message || message.error,
            };
          } else if (
            message.status === "processing" ||
            message.status === "in-progress" ||
            message.status === "started"
          ) {
            fw.aiProcessing.control_extraction_status = "started";
            await fw.save();

            wsMessage = {
              ...wsMessage,
              status: "uploaded",
              control_extraction_status: "started",
              message: "AI is extracting controls from your framework...",
            };
          } else {
            // Handle other message statuses if needed
          }

          // Send real-time update to user
          sendToUser(userId, wsMessage);
        }
      );
    } catch (wsError) {
      console.error(
        `Failed to start background monitoring for framework ${id}:`,
        wsError
      );

      // Send error update via WebSocket
      sendToUser(userId, {
        type: "framework-ai-processing",
        frameworkId: id,
        status: "failed",
        control_extraction_status: "failed",
        message: "Failed to start background monitoring",
        errorMessage: wsError.message,
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Framework uploaded to AI service successfully. You will receive real-time updates via WebSocket.",
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
    console.error("Error uploading framework to AI service:", error);
    const userId = req.user._id.toString();

    // Update framework status on error
    if (req.params.id) {
      try {
        const framework = await UserFramework.findById(req.params.id);
        if (framework) {
          framework.aiProcessing.status = "failed";
          framework.aiProcessing.control_extraction_status = "failed";
          framework.aiProcessing.errorMessage = error.message;
          framework.aiProcessing.processedAt = new Date();
          await framework.save();

          // Send error update via WebSocket
          sendToUser(userId, {
            type: "framework-ai-processing",
            frameworkId: req.params.id,
            status: "failed",
            control_extraction_status: "failed",
            message: "Failed to upload framework to AI service",
            errorMessage: error.message,
          });
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

    const framework = await UserFramework.findOne({
      _id: id,
      isActive: true,
    });

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
