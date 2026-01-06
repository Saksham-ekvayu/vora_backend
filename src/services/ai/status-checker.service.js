const UserFramework = require("../../models/user-framework.model");
const aiService = require("./user-ai.service");
const {
  sendToUser,
} = require("../../websocket/framework-comparison.websocket");

/**
 * Service to periodically check AI processing status for frameworks
 * that might have missed WebSocket completion messages
 */
class StatusCheckerService {
  constructor() {
    this.checkInterval = null;
    this.isRunning = false;
  }

  /**
   * Start periodic status checking
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;

    // Check every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkPendingFrameworks();
    }, 30000);
  }

  /**
   * Stop periodic status checking
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
  }

  /**
   * Check frameworks that are in processing state for too long
   */
  async checkPendingFrameworks() {
    try {
      // Find frameworks that have been processing for more than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const pendingFrameworks = await UserFramework.find({
        "aiProcessing.status": { $in: ["uploaded", "processing"] },
        "aiProcessing.control_extraction_status": {
          $in: ["pending", "started"],
        },
        "aiProcessing.processedAt": { $lt: fiveMinutesAgo },
        "aiProcessing.uuid": { $exists: true },
        isActive: true,
      }).populate("uploadedBy", "_id");

      for (const framework of pendingFrameworks) {
        await this.checkFrameworkStatus(framework);
      }
    } catch (error) {
      console.error("❌ Error in status checker:", error);
    }
  }

  /**
   * Check individual framework status
   */
  async checkFrameworkStatus(framework) {
    try {
      const statusResult = await aiService.checkProcessingStatus(
        framework.aiProcessing.uuid
      );

      if (statusResult.status) {
        const aiStatus = statusResult.status;

        // Check if processing is actually completed
        if (
          aiStatus.status === "completed" ||
          (aiStatus.data &&
            Array.isArray(aiStatus.data) &&
            aiStatus.data.length > 0)
        ) {
          const controls = Array.isArray(aiStatus.data) ? aiStatus.data : [];

          // Update framework
          framework.aiProcessing.extractedControls = controls;
          framework.aiProcessing.controlsCount = controls.length;
          framework.aiProcessing.controlsExtractedAt = new Date();
          framework.aiProcessing.status = "completed";
          framework.aiProcessing.control_extraction_status = "completed";
          await framework.save();

          // Send WebSocket update
          const wsMessage = {
            type: "framework-ai-processing",
            frameworkId: framework._id.toString(),
            uuid: framework.aiProcessing.uuid,
            status: "completed",
            control_extraction_status: "completed",
            message: `AI processing completed! ${controls.length} controls extracted.`,
            controlsCount: controls.length,
            extractedControls: controls,
            controlsExtractedAt: framework.aiProcessing.controlsExtractedAt,
          };
          sendToUser(framework.uploadedBy._id.toString(), wsMessage);

          // Also send framework list refresh message
          sendToUser(framework.uploadedBy._id.toString(), {
            type: "framework-list-refresh",
            message: "Framework processing completed, refreshing list",
          });
        } else if (aiStatus.status === "failed" || aiStatus.error) {
          framework.aiProcessing.status = "failed";
          framework.aiProcessing.control_extraction_status = "failed";
          framework.aiProcessing.errorMessage =
            aiStatus.error || "AI processing failed";
          await framework.save();

          // Send WebSocket update
          const wsMessage = {
            type: "framework-ai-processing",
            frameworkId: framework._id.toString(),
            uuid: framework.aiProcessing.uuid,
            status: "failed",
            control_extraction_status: "failed",
            message: aiStatus.error || "AI processing failed",
            errorMessage: aiStatus.error,
          };

          sendToUser(framework.uploadedBy._id.toString(), wsMessage);
        }
      }
    } catch (error) {
      console.error(
        `❌ Error checking framework ${framework._id} status:`,
        error
      );
    }
  }
}

// Create singleton instance
const statusCheckerService = new StatusCheckerService();

module.exports = statusCheckerService;
