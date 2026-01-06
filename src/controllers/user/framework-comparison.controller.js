const mongoose = require("mongoose");
const UserFramework = require("../../models/user-framework.model");
const ExpertFramework = require("../../models/expert-framework.model");
const frameworkComparisonAIService = require("../../services/ai/framework-comparison-ai.service");
const {
  sendToUser,
} = require("../../websocket/framework-comparison.websocket");

// Start framework comparison
const startFrameworkComparison = async (req, res) => {
  try {
    const { userFrameworkId, expertFrameworkId } = req.body;
    const userId = req.user._id.toString();

    // Validate frameworks
    const userFramework = await UserFramework.findOne({
      _id: userFrameworkId,
      uploadedBy: req.user._id,
      isActive: true,
    });

    if (!userFramework?.aiProcessing?.uuid) {
      return res.status(400).json({
        success: false,
        message: "User framework not found or not AI processed",
      });
    }

    const expertFramework = await ExpertFramework.findOne({
      _id: expertFrameworkId,
      isActive: true,
    });

    if (!expertFramework?.aiProcessing?.uuid) {
      return res.status(400).json({
        success: false,
        message: "Expert framework not found or not AI processed",
      });
    }

    // Start AI comparison - connects to AI service WebSocket
    frameworkComparisonAIService.startFrameworkComparison(
      userFramework.aiProcessing.uuid,
      expertFramework.aiProcessing.uuid,
      userFrameworkId,
      async (message) => {
        const fw = await UserFramework.findById(userFrameworkId);
        if (!fw) return;

        if (message.status === "completed") {
          const results = Array.isArray(message.data) ? message.data : [];
          const avgScore =
            results.length > 0
              ? results.reduce(
                  (sum, item) => sum + (item.Comparison_Score || 0),
                  0
                ) / results.length
              : 0;

          // Store comparison results in user framework
          fw.comparisonResults = fw.comparisonResults || [];
          fw.comparisonResults.push({
            expertFrameworkId,
            expertFrameworkName: expertFramework.frameworkName,
            comparisonData: results,
            comparisonScore: avgScore,
            resultsCount: results.length,
            comparedAt: new Date(),
            comparisonId: new mongoose.Types.ObjectId(), // Generate a simple ID for tracking
          });
          await fw.save();

          // Send WebSocket update
          sendToUser(userId, {
            type: "comparison-update",
            userFrameworkId,
            expertFrameworkId,
            aiMessage: {
              status: "completed",
              data: results,
              resultsCount: results.length,
              averageScore: avgScore,
            },
          });
        } else if (message.status === "error" || message.status === "failed") {
          // Send WebSocket update for error
          sendToUser(userId, {
            type: "comparison-update",
            userFrameworkId,
            expertFrameworkId,
            aiMessage: {
              status: "error",
              message: message.message || "Comparison failed",
            },
          });
        } else {
          // Send processing updates
          sendToUser(userId, {
            type: "comparison-update",
            userFrameworkId,
            expertFrameworkId,
            aiMessage: message,
          });
        }
      }
    );

    res.status(200).json({
      success: true,
      message:
        "Comparison started successfully. You will receive real-time updates.",
      data: {
        userFrameworkId,
        expertFrameworkId,
      },
    });
  } catch (error) {
    console.error("Error starting framework comparison:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start comparison",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  startFrameworkComparison,
};
