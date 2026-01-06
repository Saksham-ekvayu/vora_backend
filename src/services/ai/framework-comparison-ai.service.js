const WebSocket = require("ws");
const { AI_BASE_URL } = require("./aiClient");

/**
 * Framework Comparison AI Service
 * Handles WebSocket connections for framework comparison with AI service
 */

class FrameworkComparisonAIService {
  constructor() {
    this.connections = new Map();
    this.AI_WS_BASE_URL =
      process.env.AI_WS_BASE_URL || AI_BASE_URL.replace("http", "ws");
  }

  /**
   * Start framework comparison process with AI service
   */
  async startFrameworkComparison(
    userFrameworkUuid,
    expertFrameworkUuid,
    onMessage,
    onError,
    onClose
  ) {
    try {
      if (!userFrameworkUuid || !expertFrameworkUuid) {
        throw new Error("Both user and expert framework UUIDs are required");
      }

      const wsUrl = `${this.AI_WS_BASE_URL}/user/websocket/comparison?user_framework_uuid=${userFrameworkUuid}&expert_framework_uuid=${expertFrameworkUuid}`;
      const ws = new WebSocket(wsUrl);
      const connectionId = `${userFrameworkUuid}_${expertFrameworkUuid}_${Date.now()}`;

      this.connections.set(connectionId, {
        ws,
        userFrameworkUuid,
        expertFrameworkUuid,
        createdAt: new Date(),
      });

      ws.on("open", () => {
        // Connected
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (onMessage) {
            onMessage(message, connectionId);
          }
        } catch (error) {
          if (onError) {
            onError(error, connectionId);
          }
        }
      });

      ws.on("error", (error) => {
        this.connections.delete(connectionId);
        if (onError) {
          onError(error, connectionId);
        }
      });

      ws.on("close", (code, reason) => {
        this.connections.delete(connectionId);
        if (onClose) {
          onClose(code, reason, connectionId);
        }
      });

      return { ws, connectionId };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Close specific WebSocket connection
   */
  closeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws) {
      try {
        connection.ws.close();
        this.connections.delete(connectionId);
      } catch (error) {
        // Silent fail
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
        // Silent fail
      }
    }
    this.connections.clear();
  }

  /**
   * Get active connections count
   */
  getActiveConnectionsCount() {
    return this.connections.size;
  }
}

const frameworkComparisonAIService = new FrameworkComparisonAIService();

module.exports = frameworkComparisonAIService;
