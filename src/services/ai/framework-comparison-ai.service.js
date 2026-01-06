const WebSocket = require("ws");
const { AI_BASE_URL } = require("./aiClient");

/**
 * Framework Comparison AI Service - Simplified
 */

class FrameworkComparisonAIService {
  constructor() {
    this.activeConnections = new Map();
  }

  /**
   * Start framework comparison with AI service
   * @param {string} userFrameworkUuid - User framework UUID
   * @param {string} expertFrameworkUuid - Expert framework UUID
   * @param {string} userFrameworkId - User framework ID for connection tracking
   * @param {Function} onMessage - Callback for AI messages
   */
  startFrameworkComparison(
    userFrameworkUuid,
    expertFrameworkUuid,
    userFrameworkId,
    onMessage
  ) {
    try {
      const aiWsUrl = `${AI_BASE_URL.replace(
        "http",
        "ws"
      )}/user/websocket/comparison?user_framework_uuid=${userFrameworkUuid}&expert_framework_uuid=${expertFrameworkUuid}`;
      const aiWs = new WebSocket(aiWsUrl);

      this.activeConnections.set(userFrameworkId, aiWs);

      aiWs.on("open", () => {
        // Connected to AI WebSocket
      });

      aiWs.on("message", async (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (onMessage) {
            await onMessage(message);
          }

          // Close connection on completion or error
          if (
            message.status === "completed" ||
            message.status === "error" ||
            message.status === "done"
          ) {
            setTimeout(() => {
              this.closeConnection(userFrameworkId);
            }, 1000);
          }
        } catch (parseError) {
          console.error("❌ Error parsing AI WebSocket message:", parseError);
        }
      });

      aiWs.on("error", (error) => {
        console.error(
          `❌ AI WebSocket error for comparison ${userFrameworkId}:`,
          error
        );
        this.closeConnection(userFrameworkId);
      });

      aiWs.on("close", () => {
        this.activeConnections.delete(userFrameworkId);
      });
    } catch (error) {
      console.error(
        `❌ Error creating AI WebSocket connection for comparison ${userFrameworkId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Close WebSocket connection
   * @param {string} userFrameworkId - User framework ID
   */
  closeConnection(userFrameworkId) {
    const aiWs = this.activeConnections.get(userFrameworkId);
    if (aiWs && aiWs.readyState === WebSocket.OPEN) {
      aiWs.close();
    }
    this.activeConnections.delete(userFrameworkId);
  }

  /**
   * Close all connections
   */
  closeAllConnections() {
    for (const [userFrameworkId, aiWs] of this.activeConnections) {
      if (aiWs && aiWs.readyState === WebSocket.OPEN) {
        aiWs.close();
      }
    }
    this.activeConnections.clear();
  }
}

// Create singleton instance
const frameworkComparisonAIService = new FrameworkComparisonAIService();

module.exports = frameworkComparisonAIService;
