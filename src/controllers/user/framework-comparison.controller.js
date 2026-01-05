const UserFramework = require("../../models/user-framework.model");
const ExpertFramework = require("../../models/expert-framework.model");
const FrameworkComparison = require("../../models/framework-comparison.model");
const frameworkComparisonAIService = require("../../services/ai/framework-comparison-ai.service");
const {
  sendToUser,
} = require("../../websocket/framework-comparison.websocket");

async function startFrameworkComparison(req, res) {
  try {
    const { userFrameworkId, expertFrameworkId } = req.body;
    const userId = req.user._id;

    // Validate frameworks
    const userFramework = await UserFramework.findOne({
      _id: userFrameworkId,
      uploadedBy: userId,
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

    // Create comparison
    const comparison = new FrameworkComparison({
      userId,
      userFrameworkId,
      userFrameworkUuid: userFramework.aiProcessing.uuid,
      expertFrameworkId,
      expertFrameworkUuid: expertFramework.aiProcessing.uuid,
      aiProcessing: { status: "in-process" },
    });

    await comparison.save();

    // Start AI process
    await frameworkComparisonAIService.startFrameworkComparison(
      userFramework.aiProcessing.uuid,
      expertFramework.aiProcessing.uuid,
      async (message) => handleAIMessage(comparison._id, message),
      async (error) => handleAIError(comparison._id, error),
      async (code) => handleAIClose(comparison._id, code)
    );

    // Immediate response
    res.json({
      success: true,
      message: "Comparison started. Connect to WebSocket for updates.",
      data: {
        frameworkComparisonId: comparison._id,
        websocketUrl: `/ws/framework-comparisons?token=<jwt_token>`,
      },
    });

    // Send WebSocket update
    sendToUser(userId.toString(), {
      type: "framework-comparison",
      frameworkComparisonId: comparison._id,
      status: "in-process",
      message: "Comparison started",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to start comparison",
      error: error.message,
    });
  }
}

async function handleAIMessage(comparisonId, message) {
  try {
    const comparison = await FrameworkComparison.findById(
      comparisonId
    ).populate("expertFrameworkId", "frameworkName");
    if (!comparison) return;

    const userId = comparison.userId.toString();
    let updateData = {};
    let wsMessage = {
      type: "framework-comparison",
      frameworkComparisonId: comparisonId,
    };

    switch (message.status) {
      case "completed":
      case "done":
        if (message.data?.length) {
          // Calculate average comparison score
          const avgScore =
            message.data.reduce(
              (sum, item) => sum + (item.Comparison_Score || 0),
              0
            ) / message.data.length;

          updateData = {
            "aiProcessing.status": "completed",
            "aiProcessing.comparisonResults": message.data,
            "aiProcessing.resultsCount": message.data.length,
            "aiProcessing.processedAt": new Date(),
          };

          // Store comparison results in user framework
          await UserFramework.findByIdAndUpdate(comparison.userFrameworkId, {
            $push: {
              comparisonResults: {
                expertFrameworkId: comparison.expertFrameworkId,
                expertFrameworkName: comparison.expertFrameworkId.frameworkName,
                comparisonData: message.data,
                comparisonScore: avgScore,
                resultsCount: message.data.length,
                comparedAt: new Date(),
                comparisonId: comparisonId,
              },
            },
          });

          wsMessage = {
            ...wsMessage,
            status: "completed",
            message: "Comparison completed and stored in user framework",
            data: message.data,
            resultsCount: message.data.length,
            averageScore: avgScore,
          };
        }
        break;

      case "error":
        updateData = {
          "aiProcessing.status": "error",
          "aiProcessing.errorMessage": message.message || "AI error",
        };
        wsMessage = {
          ...wsMessage,
          status: "error",
          message: message.message || "AI error",
        };
        break;
    }

    if (Object.keys(updateData).length) {
      await FrameworkComparison.findByIdAndUpdate(comparisonId, updateData);
      sendToUser(userId, wsMessage);
    }
  } catch (error) {
    console.error("AI message error:", error);
  }
}

async function handleAIError(comparisonId, error) {
  try {
    const comparison = await FrameworkComparison.findById(comparisonId);
    if (!comparison) return;

    await FrameworkComparison.findByIdAndUpdate(comparisonId, {
      "aiProcessing.status": "error",
      "aiProcessing.errorMessage": error.message,
    });

    sendToUser(comparison.userId.toString(), {
      type: "framework-comparison",
      frameworkComparisonId: comparisonId,
      status: "error",
      message: "Connection error",
    });
  } catch (err) {
    console.error("AI error handler error:", err);
  }
}

async function handleAIClose(comparisonId, code) {
  try {
    const comparison = await FrameworkComparison.findById(comparisonId);
    if (!comparison) return;

    // If closed normally with results, mark completed
    if (code === 1000 && comparison.aiProcessing.comparisonResults?.length) {
      await FrameworkComparison.findByIdAndUpdate(comparisonId, {
        "aiProcessing.status": "completed",
        "aiProcessing.processedAt": new Date(),
      });

      sendToUser(comparison.userId.toString(), {
        type: "framework-comparison",
        frameworkComparisonId: comparisonId,
        status: "completed",
        message: "Comparison completed",
        data: comparison.aiProcessing.comparisonResults,
        resultsCount: comparison.aiProcessing.resultsCount,
      });
    }
  } catch (error) {
    console.error("AI close handler error:", error);
  }
}

module.exports = {
  startFrameworkComparison,
};
