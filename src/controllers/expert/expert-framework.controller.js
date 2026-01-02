const ExpertFramework = require("../../models/expert-framework.model");
const { paginateWithSearch } = require("../../helpers/helper");
const fs = require("fs");
const {
  createDocumentUpload,
  getDocumentType,
  deleteFile,
  removeFileExtension,
} = require("../../config/multer.config");
const aiService = require("../../services/ai/ai.service");

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
  };

  // Include controls data if requested
  if (includeControls) {
    if (hasExtractedControls({ aiProcessing })) {
      baseData.extractedControls = aiProcessing.extractedControls;
      baseData.controlsCount = aiProcessing.controlsCount || 0;
    } else if (isProcessingInProgress({ aiProcessing })) {
      baseData.controlsCount = 0;
      baseData.processingMessage =
        "Framework is being processed by AI service. Controls will be available once processing is complete.";
    } else if (hasProcessingFailed({ aiProcessing })) {
      baseData.controlsCount = 0;
      baseData.processingMessage = "AI processing failed for this framework";
    } else {
      baseData.controlsCount = 0;
      baseData.processingMessage =
        "Framework processing has not started yet. Please upload the framework to AI service first.";
    }
  } else {
    // Default behavior - just show count
    baseData.controlsCount = aiProcessing.controlsCount || 0;
  }

  return baseData;
};

const updateAIStatus = async (framework, aiData) => {
  framework.aiProcessing.uuid = aiData.uuid || framework.aiProcessing.uuid;
  framework.aiProcessing.status =
    aiData.status || framework.aiProcessing.status;
  framework.aiProcessing.control_extraction_status =
    aiData.control_extraction_status ||
    framework.aiProcessing.control_extraction_status;
  framework.aiProcessing.processedAt = aiData.processedAt || new Date();
  framework.aiProcessing.errorMessage = aiData.errorMessage || null;
  return await framework.save();
};

const storeExtractedControls = async (framework, controlsData) => {
  let controls = [];

  if (Array.isArray(controlsData)) {
    controls = controlsData;
  } else if (controlsData && typeof controlsData === "object") {
    if (controlsData.controls && Array.isArray(controlsData.controls)) {
      controls = controlsData.controls;
    } else if (controlsData.data && Array.isArray(controlsData.data)) {
      controls = controlsData.data;
    }

    if (controlsData.status) {
      framework.aiProcessing.status = controlsData.status;
      framework.aiProcessing.control_extraction_status = controlsData.status;
    }
  }

  framework.aiProcessing.extractedControls = controls;
  framework.aiProcessing.controlsCount = controls.length;
  framework.aiProcessing.controlsExtractedAt = new Date();

  if (
    !framework.aiProcessing.status ||
    framework.aiProcessing.status !== "completed"
  ) {
    framework.aiProcessing.status = "completed";
    framework.aiProcessing.control_extraction_status = "completed";
  }

  return await framework.save();
};

const hasExtractedControls = (framework) => {
  return (
    framework.aiProcessing.extractedControls &&
    framework.aiProcessing.extractedControls.length > 0 &&
    (framework.aiProcessing.status === "completed" ||
      framework.aiProcessing.control_extraction_status === "completed")
  );
};

const isProcessingInProgress = (framework) => {
  return (
    framework.aiProcessing.status === "processing" ||
    framework.aiProcessing.status === "uploaded" ||
    framework.aiProcessing.control_extraction_status === "processing" ||
    framework.aiProcessing.control_extraction_status === "started"
  );
};

const hasProcessingFailed = (framework) => {
  return framework.aiProcessing.status === "failed";
};

// Create upload instance
const upload = createDocumentUpload("src/uploads/expert-frameworks");

// Create a new framework
const createFramework = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded. Please select a file to upload.",
        field: "framework",
      });
    }

    const { frameworkName } = req.body;
    const file = req.file;

    const frameworkType = getDocumentType(file.originalname);
    if (!frameworkType) {
      deleteFile(file.path);
      return res.status(400).json({
        success: false,
        message: "Invalid file type detected.",
      });
    }

    const existingFramework = await ExpertFramework.findOne({
      originalFileName: file.originalname,
      uploadedBy: req.user._id,
      isActive: true,
    });

    let framework;
    let message;

    if (existingFramework) {
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
      framework = new ExpertFramework({
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
  } catch (error) {
    if (req.file) {
      deleteFile(req.file.path);
    }

    console.error("Error creating expert framework:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating framework",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all frameworks
const getAllFrameworks = async (req, res) => {
  try {
    const { search, frameworkType, uploadedBy } = req.query;

    const additionalFilters = { isActive: true };

    if (frameworkType) {
      additionalFilters.frameworkType = frameworkType;
    }

    if (uploadedBy) {
      additionalFilters.uploadedBy = uploadedBy;
    }

    let sortObj = { createdAt: -1 };

    if (req.query.sort) {
      const sort = req.query.sort;
      if (sort.startsWith("-")) {
        sortObj = { [sort.substring(1)]: -1 };
      } else {
        sortObj = { [sort]: 1 };
      }
    }

    const result = await paginateWithSearch(ExpertFramework, {
      page: req.query.page,
      limit: req.query.limit || 10,
      search: search,
      searchFields: ["frameworkName", "originalFileName"],
      filter: additionalFilters,
      select: "",
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

    let message = "Expert frameworks retrieved successfully";
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
    console.error("Error getting expert frameworks:", error);
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

    const framework = await ExpertFramework.findOne({
      _id: id,
      isActive: true,
    }).populate("uploadedBy", "name email role");

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    // Base framework data with enhanced AI processing that includes controls
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
        createdAt: framework.createdAt,
        updatedAt: framework.updatedAt,
      },
    };

    let message = "Framework retrieved successfully";
    if (hasExtractedControls(framework)) {
      message = `Framework retrieved successfully with ${framework.aiProcessing.controlsCount} extracted controls`;
    }

    res.status(200).json({
      success: true,
      message: message,
      data: responseData,
    });
  } catch (error) {
    console.error("Error getting expert framework by ID:", error);
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

    const framework = await ExpertFramework.findOne({
      _id: id,
      isActive: true,
    });

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    if (req.file) {
      const file = req.file;

      const frameworkType = getDocumentType(file.originalname);
      if (!frameworkType) {
        deleteFile(file.path);
        return res.status(400).json({
          success: false,
          message: "Invalid file type detected.",
        });
      }

      if (framework.fileUrl && fs.existsSync(framework.fileUrl)) {
        deleteFile(framework.fileUrl);
      }

      framework.fileUrl = file.path;
      framework.frameworkType = frameworkType;
      framework.fileSize = file.size;
      framework.originalFileName = file.originalname;

      if (frameworkName === undefined) {
        framework.frameworkName = removeFileExtension(file.originalname);
      }
    }

    if (frameworkName !== undefined) {
      framework.frameworkName = frameworkName;
    }
    if (isActive !== undefined) {
      framework.isActive = isActive;
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
  } catch (error) {
    if (req.file) {
      deleteFile(req.file.path);
    }

    console.error("Error updating expert framework:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating framework",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete framework
const deleteFramework = async (req, res) => {
  try {
    const { id } = req.params;

    const framework = await ExpertFramework.findOne({
      _id: id,
      isActive: true,
    });

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    framework.isActive = false;
    await framework.save();

    res.status(200).json({
      success: true,
      message: "Framework deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expert framework:", error);
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

    const framework = await ExpertFramework.findOne({
      _id: id,
      isActive: true,
    });

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    if (!fs.existsSync(framework.fileUrl)) {
      return res.status(404).json({
        success: false,
        message: "File not found on server",
      });
    }

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${framework.originalFileName}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");

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
    console.error("Error downloading expert framework:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while downloading framework",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get expert's frameworks
const getExpertFrameworks = async (req, res) => {
  try {
    const expertId = req.user._id;

    const filter = {
      uploadedBy: expertId,
      isActive: true,
    };

    let sortObj = { createdAt: -1 };

    if (req.query.sort) {
      const sort = req.query.sort;
      if (sort.startsWith("-")) {
        sortObj = { [sort.substring(1)]: -1 };
      } else {
        sortObj = { [sort]: 1 };
      }
    }

    const result = await paginateWithSearch(ExpertFramework, {
      page: req.query.page,
      limit: req.query.limit || 10,
      filter: filter,
      select: "",
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

    let message = "Expert frameworks retrieved successfully";
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
    console.error("Error getting expert frameworks:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving expert frameworks",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Upload framework to AI service
const uploadFrameworkToAIService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Framework ID is required",
        field: "id",
      });
    }

    const framework = await ExpertFramework.findOne({
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
        data: {
          aiStatus: {
            uuid: framework.aiProcessing.uuid,
            status: framework.aiProcessing.status,
            control_extraction_status:
              framework.aiProcessing.control_extraction_status,
            processedAt: framework.aiProcessing.processedAt,
          },
        },
      });
    }

    const aiResult = await aiService.uploadFramework(framework.fileUrl);

    if (!aiResult.success) {
      throw new Error("AI upload failed");
    }

    await updateAIStatus(framework, {
      uuid: aiResult.aiResponse.uuid,
      status: aiResult.aiResponse.status,
      control_extraction_status: aiResult.aiResponse.control_extraction_status,
      processedAt: new Date(),
      errorMessage: null,
    });

    // Start background monitoring
    try {
      aiService.startBackgroundMonitoring(
        aiResult.aiResponse.uuid,
        id,
        async (message) => {
          if (
            message.status === "completed" &&
            (message.controls || message.data)
          ) {
            const fw = await ExpertFramework.findById(id);
            if (fw) {
              await storeExtractedControls(fw, message);
            }
          }
        }
      );
    } catch (wsError) {
      console.error(
        `❌ Failed to start background monitoring for framework ${id}:`,
        wsError
      );
    }

    res.status(200).json({
      success: true,
      message:
        "Framework uploaded to AI service successfully. Processing will continue in background.",
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
        instructions:
          "Controls will be automatically extracted and stored. Use GET /:id API to check status and retrieve results with controls data.",
      },
    });
  } catch (error) {
    console.error("❌ Error uploading framework to AI service:", error);

    if (req.params.id) {
      try {
        const framework = await ExpertFramework.findById(req.params.id);
        if (framework) {
          await updateAIStatus(framework, {
            status: "failed",
            errorMessage: error.message,
            processedAt: new Date(),
          });
        }
      } catch (updateError) {
        console.error("Failed to update framework error status:", updateError);
      }
    }

    if (error.message.includes("File not found")) {
      return res.status(404).json({
        success: false,
        message: "Framework file not found",
      });
    }

    if (error.message.includes("AI service is not available")) {
      return res.status(503).json({
        success: false,
        message: "AI service is currently unavailable. Please try again later.",
      });
    }

    if (error.message.includes("File too large")) {
      return res.status(413).json({
        success: false,
        message: "Framework file is too large for AI processing",
      });
    }

    if (error.message.includes("Unsupported file type")) {
      return res.status(415).json({
        success: false,
        message: "Framework file type is not supported by AI service",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to upload framework to AI service",
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
  getExpertFrameworks,
  uploadFrameworkToAIService,
};
