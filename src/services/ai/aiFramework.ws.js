const WebSocket = require("ws");
const { AI_BASE_URL } = require("./aiClient");
const ExpertFramework = require("../../models/expertFramework.model");
const ExpertFrameworkService = require("../expertFramework.service");

/**
 * AI Framework WebSocket Service
 *
 * Handles WebSocket communication with AI service for framework control extraction
 */

class AIFrameworkWebSocketService {
  constructor() {
    this.activeConnections = new Map();
    this.clientConnections = new Map();
  }

  /**
   * Connect to AI WebSocket for framework control extraction
   * @param {string} uuid - Framework UUID from AI processing
   * @param {WebSocket} clientWs - Frontend client WebSocket connection
   * @param {string} frameworkId - Framework ID for tracking
   */
  connectToAIWebSocket(uuid, clientWs, frameworkId) {
    try {
      const aiWsUrl = `${AI_BASE_URL.replace(
        "http",
        "ws"
      )}/expert/framework/extract-controls/${uuid}`;
      const aiWs = new WebSocket(aiWsUrl);

      this.activeConnections.set(frameworkId, aiWs);
      this.clientConnections.set(frameworkId, clientWs);

      aiWs.on("open", () => {
        this.sendToClient(clientWs, {
          type: "connection",
          status: "connected",
          message: "Connected to AI service",
          frameworkId,
        });
      });

      aiWs.on("message", async (data) => {
        try {
          const message = JSON.parse(data.toString());

          this.sendToClient(clientWs, {
            type: "ai_message",
            frameworkId,
            ...message,
          });

          await this.handleAIMessage(message, frameworkId);
        } catch (parseError) {
          console.error("❌ Error parsing AI WebSocket message:", parseError);
          this.sendToClient(clientWs, {
            type: "error",
            frameworkId,
            message: "Error parsing AI response",
            error: parseError.message,
          });
        }
      });

      aiWs.on("error", (error) => {
        console.error(
          `❌ AI WebSocket error for framework ${frameworkId}:`,
          error
        );
        this.sendToClient(clientWs, {
          type: "error",
          frameworkId,
          message: "AI WebSocket connection error",
          error: error.message,
        });
        this.closeAIConnection(frameworkId);
      });

      aiWs.on("close", (code, reason) => {
        this.sendToClient(clientWs, {
          type: "connection",
          status: "disconnected",
          frameworkId,
          message: "AI connection closed",
          code,
        });
        this.cleanup(frameworkId);
      });

      clientWs.on("close", () => {
        this.closeAIConnection(frameworkId);
      });

      clientWs.on("error", (error) => {
        console.error(
          `❌ Client WebSocket error for framework ${frameworkId}:`,
          error
        );
        this.closeAIConnection(frameworkId);
      });
    } catch (error) {
      console.error(
        `❌ Error creating AI WebSocket connection for framework ${frameworkId}:`,
        error
      );
      this.sendToClient(clientWs, {
        type: "error",
        frameworkId,
        message: "Failed to connect to AI service",
        error: error.message,
      });
    }
  }

  /**
   * Start background monitoring for AI processing
   * @param {string} uuid - Framework UUID from AI processing
   * @param {string} frameworkId - Framework ID for tracking
   */
  startBackgroundMonitoring(uuid, frameworkId) {
    try {
      const aiWsUrl = `${AI_BASE_URL.replace(
        "http",
        "ws"
      )}/expert/framework/extract-controls/${uuid}`;
      const aiWs = new WebSocket(aiWsUrl);

      this.activeConnections.set(frameworkId, aiWs);

      aiWs.on("open", () => {
        // Background monitoring connected
      });

      aiWs.on("message", async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleAIMessage(message, frameworkId);
        } catch (parseError) {
          console.error(
            "❌ Error parsing background AI WebSocket message:",
            parseError
          );
        }
      });

      aiWs.on("error", (error) => {
        console.error(
          `❌ Background AI WebSocket error for framework ${frameworkId}:`,
          error
        );
        this.closeAIConnection(frameworkId);
      });

      aiWs.on("close", (code, reason) => {
        this.cleanup(frameworkId);
      });
    } catch (error) {
      console.error(
        `❌ Error creating background AI WebSocket connection for framework ${frameworkId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Handle AI message (unified handler for both client and background)
   * @param {Object} message - AI WebSocket message
   * @param {string} frameworkId - Framework ID
   */
  async handleAIMessage(message, frameworkId) {
    // Store controls in database when completed
    if (message.status === "completed" && (message.controls || message.data)) {
      try {
        const framework = await ExpertFramework.findById(frameworkId);
        if (framework) {
          await ExpertFrameworkService.storeExtractedControls(
            framework,
            message
          );
        }
      } catch (dbError) {
        console.error(
          `❌ Error storing controls in database for ${frameworkId}:`,
          dbError
        );
      }
    }

    // Handle completion or error - close AI connection
    if (message.status === "completed" || message.status === "error") {
      setTimeout(() => {
        this.closeAIConnection(frameworkId);
      }, 1000);
    }
  }

  /**
   * Send message to frontend client
   * @param {WebSocket} clientWs - Client WebSocket connection
   * @param {Object} message - Message to send
   */
  sendToClient(clientWs, message) {
    try {
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error("❌ Error sending message to client:", error);
    }
  }

  /**
   * Close AI WebSocket connection
   * @param {string} frameworkId - Framework ID
   */
  closeAIConnection(frameworkId) {
    const aiWs = this.activeConnections.get(frameworkId);
    if (aiWs && aiWs.readyState === WebSocket.OPEN) {
      aiWs.close();
    }
    this.cleanup(frameworkId);
  }

  /**
   * Cleanup connections
   * @param {string} frameworkId - Framework ID
   */
  cleanup(frameworkId) {
    this.activeConnections.delete(frameworkId);
    this.clientConnections.delete(frameworkId);
  }

  /**
   * Get connection status
   * @param {string} frameworkId - Framework ID
   * @returns {Object} Connection status
   */
  getConnectionStatus(frameworkId) {
    const aiWs = this.activeConnections.get(frameworkId);
    const clientWs = this.clientConnections.get(frameworkId);

    return {
      aiConnected: aiWs && aiWs.readyState === WebSocket.OPEN,
      clientConnected: clientWs && clientWs.readyState === WebSocket.OPEN,
      hasActiveConnection: this.activeConnections.has(frameworkId),
    };
  }

  /**
   * Close all connections (for graceful shutdown)
   */
  closeAllConnections() {
    for (const [frameworkId, aiWs] of this.activeConnections) {
      if (aiWs && aiWs.readyState === WebSocket.OPEN) {
        aiWs.close();
      }
    }

    this.activeConnections.clear();
    this.clientConnections.clear();
  }
}

// Create singleton instance
const aiFrameworkWsService = new AIFrameworkWebSocketService();

module.exports = {
  AIFrameworkWebSocketService,
  aiFrameworkWsService,
};
