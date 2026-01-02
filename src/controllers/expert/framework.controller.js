const ExpertFramework = require("../../models/expertFramework.model");
const { paginateWithSearch } = require("../../helpers/helper");
const fs = require("fs");
const {
  createDocumentUpload,
  getDocumentType,
  deleteFile,
  removeFileExtension,
} = require("../../config/multer.config");
const {
  cacheOperations,
  generateCacheKey,
  CACHE_TTL,
} = require("../../config/cache.config");
const { invalidateCache } = require("../../middlewares/cache.middleware");
const {
  uploadFrameworkToAI,
  getExtractedControls,
} = require("../../services/ai/aiUpload.service");

// Create upload instance with specific directory for expert frameworks
const upload = createDocumentUpload("src/uploads/expert-frameworks");

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
    const existingFramework = await ExpertFramework.findOne({
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

    // Populate uploadedBy field for response
    await framework.populate("uploadedBy", "name email role");

    // Cache the expert framework
    const cacheKey = generateCacheKey("expert_framework", framework._id);
    await cacheOperations.set(cacheKey, framework, CACHE_TTL.LONG);

    // Invalidate expert framework list caches
    await invalidateCache.frameworks(req.user._id);

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
          aiProcessing: {
            uuid: framework.aiProcessing?.uuid || null,
            status: framework.aiProcessing?.status || "pending",
            control_extraction_status:
              framework.aiProcessing?.control_extraction_status || "pending",
            processedAt: framework.aiProcessing?.processedAt || null,
            controlsCount: framework.aiProcessing?.controlsCount || 0,
            controlsExtractedAt:
              framework.aiProcessing?.controlsExtractedAt || null,
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

    console.error("Error creating expert framework:", error);
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
    const result = await paginateWithSearch(ExpertFramework, {
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
        aiProcessing: {
          uuid: doc.aiProcessing?.uuid || null,
          status: doc.aiProcessing?.status || "pending",
          control_extraction_status:
            doc.aiProcessing?.control_extraction_status || "pending",
          processedAt: doc.aiProcessing?.processedAt || null,
        },
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }),
    });

    // Determine appropriate message based on data availability
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

    // Try to get from cache first
    const cacheKey = generateCacheKey("expert_framework", id);
    let framework = await cacheOperations.get(cacheKey);

    if (!framework) {
      // Fetch from database
      framework = await ExpertFramework.findOne({
        _id: id,
        isActive: true,
      }).populate("uploadedBy", "name email role");

      if (!framework) {
        return res.status(404).json({
          success: false,
          message: "Framework not found",
        });
      }

      // Cache the framework
      await cacheOperations.set(cacheKey, framework, CACHE_TTL.LONG);
      console.log(`✅ Expert framework ${id} cached in Redis`);
    } else {
      console.log(`✅ Expert framework ${id} retrieved from Redis cache`);
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
          aiProcessing: {
            uuid: framework.aiProcessing?.uuid || null,
            status: framework.aiProcessing?.status || "pending",
            control_extraction_status:
              framework.aiProcessing?.control_extraction_status || "pending",
            processedAt: framework.aiProcessing?.processedAt || null,
            errorMessage: framework.aiProcessing?.errorMessage || null,
          },
          createdAt: framework.createdAt,
          updatedAt: framework.updatedAt,
        },
      },
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

    console.error("Error updating expert framework:", error);
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

    // Soft delete - set isActive to false
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

    // Build filter for expert's frameworks
    const filter = {
      uploadedBy: expertId,
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
    const result = await paginateWithSearch(ExpertFramework, {
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
        aiProcessing: {
          uuid: doc.aiProcessing?.uuid || null,
          status: doc.aiProcessing?.status || "pending",
          control_extraction_status:
            doc.aiProcessing?.control_extraction_status || "pending",
          processedAt: doc.aiProcessing?.processedAt || null,
        },
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }),
    });

    // Determine appropriate message based on data availability
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

// Upload framework to AI service for processing
const uploadFrameworkToAIService = async (req, res) => {
  try {
    const { frameworkId } = req.body;

    // Validate frameworkId
    if (!frameworkId) {
      return res.status(400).json({
        success: false,
        message: "Framework ID is required",
        field: "frameworkId",
      });
    }

    // Find framework in database
    const framework = await ExpertFramework.findOne({
      _id: frameworkId,
      isActive: true,
    }).populate("uploadedBy", "name email role");

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    // Check if framework belongs to the requesting expert
    if (framework.uploadedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only upload your own frameworks to AI service",
      });
    }

    // Check if file exists on disk
    if (!fs.existsSync(framework.fileUrl)) {
      return res.status(404).json({
        success: false,
        message: "Framework file not found on server",
      });
    }

    // Check if framework is already uploaded to AI
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

    // Upload to AI service
    const aiResult = await uploadFrameworkToAI(framework.fileUrl);

    if (!aiResult.success) {
      throw new Error("AI upload failed");
    }

    // Update framework with AI response data
    await framework.updateAIStatus({
      uuid: aiResult.aiResponse.uuid,
      status: aiResult.aiResponse.status,
      control_extraction_status: aiResult.aiResponse.control_extraction_status,
      processedAt: new Date(),
      errorMessage: null,
    });

    // Invalidate cache for this framework
    const cacheKey = generateCacheKey("expert_framework", framework._id);
    await cacheOperations.del(cacheKey);

    // Invalidate expert framework list caches
    await invalidateCache.frameworks(req.user._id);

    res.status(200).json({
      success: true,
      message: "Framework uploaded to AI service successfully",
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
    console.error("❌ Error uploading framework to AI service:", error);

    // Try to update framework with error status if we have frameworkId
    if (req.body.frameworkId) {
      try {
        const framework = await ExpertFramework.findById(req.body.frameworkId);
        if (framework) {
          await framework.updateAIStatus({
            status: "failed",
            errorMessage: error.message,
            processedAt: new Date(),
          });
        }
      } catch (updateError) {
        console.error("Failed to update framework error status:", updateError);
      }
    }

    // Handle specific error types
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

// Get extracted controls from AI service
const getFrameworkControls = async (req, res) => {
  try {
    const { frameworkId } = req.params;

    // Find framework in database
    const framework = await ExpertFramework.findOne({
      _id: frameworkId,
      isActive: true,
    }).populate("uploadedBy", "name email role");

    if (!framework) {
      return res.status(404).json({
        success: false,
        message: "Framework not found",
      });
    }

    // Check if framework belongs to the requesting expert
    if (framework.uploadedBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only access controls for your own frameworks",
      });
    }

    // Check if framework has been uploaded to AI
    if (!framework.aiProcessing.uuid) {
      return res.status(400).json({
        success: false,
        message: "Framework has not been uploaded to AI service yet",
      });
    }

    // If controls are already stored in database, return them
    if (
      framework.aiProcessing.extractedControls &&
      framework.aiProcessing.extractedControls.length > 0
    ) {
      return res.status(200).json({
        success: true,
        message: `Found ${framework.aiProcessing.controlsCount} cached controls`,
        data: {
          framework: {
            id: framework._id,
            frameworkName: framework.frameworkName,
            frameworkType: framework.frameworkType,
          },
          aiProcessing: {
            uuid: framework.aiProcessing.uuid,
            status: framework.aiProcessing.status,
            control_extraction_status:
              framework.aiProcessing.control_extraction_status,
            controlsCount: framework.aiProcessing.controlsCount,
            controlsExtractedAt: framework.aiProcessing.controlsExtractedAt,
          },
          controls: framework.aiProcessing.extractedControls,
        },
      });
    }

    // Get controls from AI service
    const aiResult = await getExtractedControls(framework.aiProcessing.uuid);

    if (!aiResult.success) {
      throw new Error("Failed to get controls from AI service");
    }

    // If still processing, return processing status
    if (aiResult.isProcessing) {
      return res.status(202).json({
        success: true,
        message: aiResult.message,
        data: {
          framework: {
            id: framework._id,
            frameworkName: framework.frameworkName,
            frameworkType: framework.frameworkType,
          },
          aiProcessing: {
            uuid: framework.aiProcessing.uuid,
            status: aiResult.status,
            control_extraction_status: aiResult.status,
            isProcessing: true,
          },
          controls: null,
        },
      });
    }

    // Processing complete - store controls in database
    if (aiResult.controls && aiResult.controls.length > 0) {
      await framework.storeExtractedControls(aiResult.controls);

      // Invalidate cache for this framework
      const cacheKey = generateCacheKey("expert_framework", framework._id);
      await cacheOperations.del(cacheKey);
    }

    res.status(200).json({
      success: true,
      message: aiResult.message,
      data: {
        framework: {
          id: framework._id,
          frameworkName: framework.frameworkName,
          frameworkType: framework.frameworkType,
        },
        aiProcessing: {
          uuid: framework.aiProcessing.uuid,
          status: framework.aiProcessing.status,
          control_extraction_status:
            framework.aiProcessing.control_extraction_status,
          controlsCount: framework.aiProcessing.controlsCount,
          controlsExtractedAt: framework.aiProcessing.controlsExtractedAt,
          isProcessing: false,
        },
        controls: aiResult.controls || [],
      },
    });
  } catch (error) {
    console.error("❌ Error getting framework controls:", error);

    // Handle specific error types
    if (error.message.includes("UUID not found")) {
      return res.status(404).json({
        success: false,
        message: "Framework processing not found in AI service",
      });
    }

    if (error.message.includes("AI service is not available")) {
      return res.status(503).json({
        success: false,
        message: "AI service is currently unavailable. Please try again later.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to get framework controls",
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
  getFrameworkControls,
};
