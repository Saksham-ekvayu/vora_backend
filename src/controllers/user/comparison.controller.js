const Framework = require("../../models/user-framework.model");
const ExpertFramework = require("../../models/expert-framework.model");
const Comparison = require("../../models/comparison.model");
const comparisonAIService = require("../../services/ai/comparison-ai.service");

/**
 * Start framework comparison
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function startComparison(req, res) {
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
    const userFramework = await Framework.findOne({
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
    const existingComparison = await Comparison.findOne({
      userId,
      userFrameworkId,
      expertFrameworkId,
      "aiProcessing.status": { $in: ["pending", "in-process"] },
      isActive: true,
    });

    if (existingComparison) {
      return res.status(409).json({
        success: false,
        message: "Comparison is already in progress for these frameworks",
        comparisonId: existingComparison._id,
      });
    }

    // Create new comparison record
    const comparison = new Comparison({
      userId,
      userFrameworkId,
      userFrameworkUuid: userFramework.aiProcessing.uuid,
      expertFrameworkId,
      expertFrameworkUuid: expertFramework.aiProcessing.uuid,
      aiProcessing: {
        status: "pending",
      },
    });

    await comparison.save();

    // Start AI comparison process
    const { connectionId } = await comparisonAIService.startComparison(
      userFramework.aiProcessing.uuid,
      expertFramework.aiProcessing.uuid,
      // onMessage callback
      async (message, aiConnectionId) => {
        await handleAIMessage(comparison._id, message, aiConnectionId);
      },
      // onError callback
      async (error, aiConnectionId) => {
        await handleAIError(comparison._id, error, aiConnectionId);
      },
      // onClose callback
      async (code, reason, aiConnectionId) => {
        await handleAIClose(comparison._id, code, reason, aiConnectionId);
      }
    );

    // Update comparison with AI connection info
    comparison.aiProcessing.status = "in-process";
    await comparison.save();

    res.status(200).json({
      success: true,
      message: "Comparison started successfully",
      data: {
        comparisonId: comparison._id,
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
    console.error("❌ Error starting comparison:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start comparison",
      error: error.message,
    });
  }
}

/**
 * Handle AI WebSocket message
 * @param {string} comparisonId - Comparison ID
 * @param {Object} message - AI message
 * @param {string} aiConnectionId - AI connection ID
 */
async function handleAIMessage(comparisonId, message, aiConnectionId) {
  try {
    // Update comparison in database based on message status
    const comparison = await Comparison.findById(comparisonId);
    if (!comparison) {
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

    // Update comparison in database
    await Comparison.findByIdAndUpdate(comparisonId, updateData);

    // Clean up if comparison is finished
    if (["completed", "done", "error"].includes(message.status)) {
      // Close AI connection
      comparisonAIService.closeConnection(aiConnectionId);
    }
  } catch (error) {
    console.error(
      `❌ Error handling AI message for comparison ${comparisonId}:`,
      error
    );
  }
}

/**
 * Handle AI WebSocket error
 * @param {string} comparisonId - Comparison ID
 * @param {Error} error - AI error
 * @param {string} aiConnectionId - AI connection ID
 */
async function handleAIError(comparisonId, error, aiConnectionId) {
  try {
    // Update comparison status to error
    await Comparison.findByIdAndUpdate(comparisonId, {
      "aiProcessing.status": "error",
      "aiProcessing.errorMessage": error.message || "AI connection error",
    });
  } catch (dbError) {
    console.error(
      `❌ Error handling AI error for comparison ${comparisonId}:`,
      dbError
    );
  }
}

/**
 * Handle AI WebSocket close
 * @param {string} comparisonId - Comparison ID
 * @param {number} code - Close code
 * @param {string} reason - Close reason
 * @param {string} aiConnectionId - AI connection ID
 */
async function handleAIClose(comparisonId, code, reason, aiConnectionId) {
  try {
    // Check current comparison status
    const comparison = await Comparison.findById(comparisonId);
    if (comparison) {
      // If connection closed normally (code 1000) and we have results, mark as completed
      if (
        code === 1000 &&
        comparison.aiProcessing.comparisonResults &&
        comparison.aiProcessing.comparisonResults.length > 0
      ) {
        await Comparison.findByIdAndUpdate(comparisonId, {
          "aiProcessing.status": "completed",
          "aiProcessing.processedAt": new Date(),
        });
      }
      // If connection closed unexpectedly and not already completed
      else if (
        !["completed", "done"].includes(comparison.aiProcessing.status)
      ) {
        await Comparison.findByIdAndUpdate(comparisonId, {
          "aiProcessing.status": "error",
          "aiProcessing.errorMessage": `AI connection closed unexpectedly (Code: ${code})`,
        });
      }
    }
  } catch (error) {
    console.error(
      `❌ Error handling AI close for comparison ${comparisonId}:`,
      error
    );
  }
}

/**
 * Get comparison status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getComparisonStatus(req, res) {
  try {
    const { comparisonId } = req.params;
    const userId = req.user._id;

    // Find comparison
    const comparison = await Comparison.findOne({
      _id: comparisonId,
      userId,
      isActive: true,
    })
      .populate("userFrameworkId", "frameworkName originalFileName")
      .populate("expertFrameworkId", "frameworkName originalFileName");

    if (!comparison) {
      return res.status(404).json({
        success: false,
        message: "Comparison not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        comparisonId: comparison._id,
        status: comparison.aiProcessing.status,
        userFramework: {
          id: comparison.userFrameworkId._id,
          name: comparison.userFrameworkId.frameworkName,
          originalFileName: comparison.userFrameworkId.originalFileName,
        },
        expertFramework: {
          id: comparison.expertFrameworkId._id,
          name: comparison.expertFrameworkId.frameworkName,
          originalFileName: comparison.expertFrameworkId.originalFileName,
        },
        results: comparison.aiProcessing.comparisonResults || [],
        resultsCount: comparison.aiProcessing.resultsCount || 0,
        processedAt: comparison.aiProcessing.processedAt,
        errorMessage: comparison.aiProcessing.errorMessage,
        createdAt: comparison.createdAt,
        updatedAt: comparison.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Error getting comparison status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comparison status",
      error: error.message,
    });
  }
}

/**
 * Get user's comparison history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getComparisonHistory(req, res) {
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

    // Get comparisons with pagination
    const comparisons = await Comparison.find(query)
      .populate("userFrameworkId", "frameworkName originalFileName")
      .populate("expertFrameworkId", "frameworkName originalFileName")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count
    const total = await Comparison.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        comparisons: comparisons.map((comparison) => ({
          comparisonId: comparison._id,
          status: comparison.aiProcessing.status,
          userFramework: {
            id: comparison.userFrameworkId._id,
            name: comparison.userFrameworkId.frameworkName,
            originalFileName: comparison.userFrameworkId.originalFileName,
          },
          expertFramework: {
            id: comparison.expertFrameworkId._id,
            name: comparison.expertFrameworkId.frameworkName,
            originalFileName: comparison.expertFrameworkId.originalFileName,
          },
          resultsCount: comparison.aiProcessing.resultsCount || 0,
          processedAt: comparison.aiProcessing.processedAt,
          errorMessage: comparison.aiProcessing.errorMessage,
          createdAt: comparison.createdAt,
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("❌ Error getting comparison history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comparison history",
      error: error.message,
    });
  }
}

module.exports = {
  startComparison,
  getComparisonStatus,
  getComparisonHistory,
};
