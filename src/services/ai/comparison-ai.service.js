const WebSocket = require("ws");
const { AI_BASE_URL } = require("./aiClient");

/**
 * Comparison AI Service
 * Handles WebSocket connections for framework comparison with AI service
 */

class ComparisonAIService {
  constructor() {
    this.connections = new Map(); // Store active WebSocket connections
    this.AI_WS_BASE_URL =
      process.env.AI_WS_BASE_URL || AI_BASE_URL.replace("http", "ws");
  }

  /**
   * Start comparison process with AI service
   * @param {string} userFrameworkUuid - User framework UUID
   * @param {string} expertFrameworkUuid - Expert framework UUID
   * @param {Function} onMessage - Callback for WebSocket messages
   * @param {Function} onError - Callback for WebSocket errors
   * @param {Function} onClose - Callback for WebSocket close
   * @returns {Promise<Object>} WebSocket connection info
   */
  async startComparison(
    userFrameworkUuid,
    expertFrameworkUuid,
    onMessage,
    onError,
    onClose
  ) {
    try {
      // Validate UUIDs
      if (!userFrameworkUuid || !expertFrameworkUuid) {
        throw new Error("Both user and expert framework UUIDs are required");
      }

      // Create WebSocket URL
      const wsUrl = `${this.AI_WS_BASE_URL}/user/websocket/comparision?user_framework_uuid=${userFrameworkUuid}&expert_framework_uuid=${expertFrameworkUuid}`;

      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);

      // Generate connection ID
      const connectionId = `${userFrameworkUuid}_${expertFrameworkUuid}_${Date.now()}`;

      // Store connection
      this.connections.set(connectionId, {
        ws,
        userFrameworkUuid,
        expertFrameworkUuid,
        createdAt: new Date(),
      });

      // Set up WebSocket event handlers
      ws.on("open", () => {
        console.log(
          `✅ AI WebSocket connected for comparison: ${connectionId}`
        );
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());

          // Call the provided message handler
          if (onMessage) {
            onMessage(message, connectionId);
          }
        } catch (error) {
          console.error("❌ Error parsing WebSocket message:", error);
          if (onError) {
            onError(error, connectionId);
          }
        }
      });

      ws.on("error", (error) => {
        console.error(`❌ AI WebSocket error for ${connectionId}:`, error);

        // Remove connection on error
        this.connections.delete(connectionId);

        if (onError) {
          onError(error, connectionId);
        }
      });

      ws.on("close", (code, reason) => {
        // Remove connection on close
        this.connections.delete(connectionId);

        if (onClose) {
          onClose(code, reason, connectionId);
        }
      });

      return { ws, connectionId };
    } catch (error) {
      console.error("❌ Error starting comparison:", error);
      throw error;
    }
  }

  /**
   * Close specific WebSocket connection
   * @param {string} connectionId - Connection ID to close
   */
  closeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws) {
      try {
        connection.ws.close();
        this.connections.delete(connectionId);
      } catch (error) {
        console.error(`❌ Error closing connection ${connectionId}:`, error);
      }
    }
  }

  /**
   * Close all active WebSocket connections
   */
  closeAllConnections() {
    for (const [connectionId, connection] of this.connections) {
      try {
        if (connection.ws) {
          connection.ws.close();
        }
      } catch (error) {
        console.error(`❌ Error closing connection ${connectionId}:`, error);
      }
    }

    this.connections.clear();
  }

  /**
   * Get active connections count
   * @returns {number} Number of active connections
   */
  getActiveConnectionsCount() {
    return this.connections.size;
  }
}

// Create singleton instance
const comparisonAIService = new ComparisonAIService();

module.exports = comparisonAIService;
