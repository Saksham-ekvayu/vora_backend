const UserFramework = require("../../models/user-framework.model");
const ExpertFramework = require("../../models/expert-framework.model");
const FrameworkComparison = require("../../models/framework-comparison.model");
const frameworkComparisonAIService = require("../../services/ai/framework-comparison-ai.service");

/**
 * Start framework comparison
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function startFrameworkComparison(req, res) {
  try {
    const { userFrameworkId, expertFrameworkId } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!userFrameworkId || !expertFrameworkId) {
      return res.status(400).json({
        success: false,
        message: "Both userFrameworkId and expertFrameworkId are required",
      });
    }

    // Check if user framework exists and belongs to user
    const userFramework = await UserFramework.findOne({
      _id: userFrameworkId,
      uploadedBy: userId,
      isActive: true,
    });

    if (!userFramework) {
      return res.status(404).json({
        success: false,
        message: "User framework not found or access denied",
      });
    }

    // Check if user framework has AI processing UUID
    if (!userFramework.aiProcessing?.uuid) {
      return res.status(400).json({
        success: false,
        message: "User framework must be processed by AI first",
      });
    }

    // Check if expert framework exists
    const expertFramework = await ExpertFramework.findOne({
      _id: expertFrameworkId,
      isActive: true,
    });

    if (!expertFramework) {
      return res.status(404).json({
        success: false,
        message: "Expert framework not found",
      });
    }

    // Check if expert framework has AI processing UUID
    if (!expertFramework.aiProcessing?.uuid) {
      return res.status(400).json({
        success: false,
        message: "Expert framework must be processed by AI first",
      });
    }

    // Check if comparison already exists and is in progress
    const existingComparison = await FrameworkComparison.findOne({
      userId,
      userFrameworkId,
      expertFrameworkId,
      "aiProcessing.status": { $in: ["pending", "in-process"] },
      isActive: true,
    });

    if (existingComparison) {
      return res.status(409).json({
        success: false,
        message:
          "Framework comparison is already in progress for these frameworks",
        frameworkComparisonId: existingComparison._id,
      });
    }

    // Create new framework comparison record
    const frameworkComparison = new FrameworkComparison({
      userId,
      userFrameworkId,
      userFrameworkUuid: userFramework.aiProcessing.uuid,
      expertFrameworkId,
      expertFrameworkUuid: expertFramework.aiProcessing.uuid,
      aiProcessing: {
        status: "pending",
      },
    });

    await frameworkComparison.save();

    // Start AI framework comparison process
    const { connectionId } =
      await frameworkComparisonAIService.startFrameworkComparison(
        userFramework.aiProcessing.uuid,
        expertFramework.aiProcessing.uuid,
        // onMessage callback
        async (message, aiConnectionId) => {
          await handleAIMessage(
            frameworkComparison._id,
            message,
            aiConnectionId
          );
        },
        // onError callback
        async (error, aiConnectionId) => {
          await handleAIError(frameworkComparison._id, error, aiConnectionId);
        },
        // onClose callback
        async (code, reason, aiConnectionId) => {
          await handleAIClose(
            frameworkComparison._id,
            code,
            reason,
            aiConnectionId
          );
        }
      );

    // Update framework comparison with AI connection info
    frameworkComparison.aiProcessing.status = "in-process";
    await frameworkComparison.save();

    res.status(200).json({
      success: true,
      message: "Framework comparison started successfully",
      data: {
        frameworkComparisonId: frameworkComparison._id,
        status: "in-process",
        userFramework: {
          id: userFramework._id,
          name: userFramework.frameworkName,
        },
        expertFramework: {
          id: expertFramework._id,
          name: expertFramework.frameworkName,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error starting framework comparison:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start framework comparison",
      error: error.message,
    });
  }
}

/**
 * Handle AI WebSocket message
 * @param {string} frameworkComparisonId - Framework Comparison ID
 * @param {Object} message - AI message
 * @param {string} aiConnectionId - AI connection ID
 */
async function handleAIMessage(frameworkComparisonId, message, aiConnectionId) {
  try {
    // Update framework comparison in database based on message status
    const frameworkComparison = await FrameworkComparison.findById(
      frameworkComparisonId
    );
    if (!frameworkComparison) {
      return;
    }

    let updateData = {};

    switch (message.status) {
      case "in-process":
        updateData = {
          "aiProcessing.status": "in-process",
        };
        break;

      case "completed":
      case "done":
        if (message.data && Array.isArray(message.data)) {
          updateData = {
            "aiProcessing.status": "completed",
            "aiProcessing.comparisonResults": message.data,
            "aiProcessing.resultsCount": message.data.length,
            "aiProcessing.processedAt": new Date(),
          };
        } else {
          updateData = {
            "aiProcessing.status": "error",
            "aiProcessing.errorMessage": "Invalid comparison data received",
          };
        }
        break;

      case "error":
        updateData = {
          "aiProcessing.status": "error",
          "aiProcessing.errorMessage": message.message || "AI processing error",
        };
        break;

      default:
        return;
    }

    // Update framework comparison in database
    await FrameworkComparison.findByIdAndUpdate(
      frameworkComparisonId,
      updateData
    );

    // Clean up if framework comparison is finished
    if (["completed", "done", "error"].includes(message.status)) {
      // Close AI connection
      frameworkComparisonAIService.closeConnection(aiConnectionId);
    }
  } catch (error) {
    console.error(
      `❌ Error handling AI message for framework comparison ${frameworkComparisonId}:`,
      error
    );
  }
}

/**
 * Handle AI WebSocket error
 * @param {string} frameworkComparisonId - Framework Comparison ID
 * @param {Error} error - AI error
 * @param {string} aiConnectionId - AI connection ID
 */
async function handleAIError(frameworkComparisonId, error, aiConnectionId) {
  try {
    // Update framework comparison status to error
    await FrameworkComparison.findByIdAndUpdate(frameworkComparisonId, {
      "aiProcessing.status": "error",
      "aiProcessing.errorMessage": error.message || "AI connection error",
    });
  } catch (dbError) {
    console.error(
      `❌ Error handling AI error for framework comparison ${frameworkComparisonId}:`,
      dbError
    );
  }
}

/**
 * Handle AI WebSocket close
 * @param {string} frameworkComparisonId - Framework Comparison ID
 * @param {number} code - Close code
 * @param {string} reason - Close reason
 * @param {string} aiConnectionId - AI connection ID
 */
async function handleAIClose(
  frameworkComparisonId,
  code,
  reason,
  aiConnectionId
) {
  try {
    // Check current framework comparison status
    const frameworkComparison = await FrameworkComparison.findById(
      frameworkComparisonId
    );
    if (frameworkComparison) {
      // If connection closed normally (code 1000) and we have results, mark as completed
      if (
        code === 1000 &&
        frameworkComparison.aiProcessing.comparisonResults &&
        frameworkComparison.aiProcessing.comparisonResults.length > 0
      ) {
        await FrameworkComparison.findByIdAndUpdate(frameworkComparisonId, {
          "aiProcessing.status": "completed",
          "aiProcessing.processedAt": new Date(),
        });
      }
      // If connection closed unexpectedly and not already completed
      else if (
        !["completed", "done"].includes(frameworkComparison.aiProcessing.status)
      ) {
        await FrameworkComparison.findByIdAndUpdate(frameworkComparisonId, {
          "aiProcessing.status": "error",
          "aiProcessing.errorMessage": `AI connection closed unexpectedly (Code: ${code})`,
        });
      }
    }
  } catch (error) {
    console.error(
      `❌ Error handling AI close for framework comparison ${frameworkComparisonId}:`,
      error
    );
  }
}

/**
 * Get framework comparison status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getFrameworkComparisonStatus(req, res) {
  try {
    const { frameworkComparisonId } = req.params;
    const userId = req.user._id;

    // Find framework comparison
    const frameworkComparison = await FrameworkComparison.findOne({
      _id: frameworkComparisonId,
      userId,
      isActive: true,
    })
      .populate("userFrameworkId", "frameworkName originalFileName")
      .populate("expertFrameworkId", "frameworkName originalFileName");

    if (!frameworkComparison) {
      return res.status(404).json({
        success: false,
        message: "Framework comparison not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        frameworkComparisonId: frameworkComparison._id,
        status: frameworkComparison.aiProcessing.status,
        userFramework: {
          id: frameworkComparison.userFrameworkId._id,
          name: frameworkComparison.userFrameworkId.frameworkName,
          originalFileName:
            frameworkComparison.userFrameworkId.originalFileName,
        },
        expertFramework: {
          id: frameworkComparison.expertFrameworkId._id,
          name: frameworkComparison.expertFrameworkId.frameworkName,
          originalFileName:
            frameworkComparison.expertFrameworkId.originalFileName,
        },
        results: frameworkComparison.aiProcessing.comparisonResults || [],
        resultsCount: frameworkComparison.aiProcessing.resultsCount || 0,
        processedAt: frameworkComparison.aiProcessing.processedAt,
        errorMessage: frameworkComparison.aiProcessing.errorMessage,
        createdAt: frameworkComparison.createdAt,
        updatedAt: frameworkComparison.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error getting framework comparison status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get framework comparison status",
      error: error.message,
    });
  }
}

/**
 * Get user's framework comparison history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getFrameworkComparisonHistory(req, res) {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;

    // Build query
    const query = {
      userId,
      isActive: true,
    };

    if (status) {
      query["aiProcessing.status"] = status;
    }

    // Get framework comparisons with pagination
    const frameworkComparisons = await FrameworkComparison.find(query)
      .populate("userFrameworkId", "frameworkName originalFileName")
      .populate("expertFrameworkId", "frameworkName originalFileName")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count
    const total = await FrameworkComparison.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        frameworkComparisons: frameworkComparisons.map(
          (frameworkComparison) => ({
            frameworkComparisonId: frameworkComparison._id,
            status: frameworkComparison.aiProcessing.status,
            userFramework: {
              id: frameworkComparison.userFrameworkId._id,
              name: frameworkComparison.userFrameworkId.frameworkName,
              originalFileName:
                frameworkComparison.userFrameworkId.originalFileName,
            },
            expertFramework: {
              id: frameworkComparison.expertFrameworkId._id,
              name: frameworkComparison.expertFrameworkId.frameworkName,
              originalFileName:
                frameworkComparison.expertFrameworkId.originalFileName,
            },
            resultsCount: frameworkComparison.aiProcessing.resultsCount || 0,
            processedAt: frameworkComparison.aiProcessing.processedAt,
            errorMessage: frameworkComparison.aiProcessing.errorMessage,
            createdAt: frameworkComparison.createdAt,
          })
        ),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("❌ Error getting framework comparison history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get framework comparison history",
      error: error.message,
    });
  }
}

module.exports = {
  startFrameworkComparison,
  getFrameworkComparisonStatus,
  getFrameworkComparisonHistory,
};
