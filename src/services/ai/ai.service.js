const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const { addRequest, AI_BASE_URL } = require("./aiClient");

/**
 * AI Service - Unified service for all AI operations
 */

class AIService {
  constructor() {
    this.activeConnections = new Map();
  }

  /**
   * Upload framework to AI service
   * @param {string} filePath - Path to framework file
   * @returns {Promise<Object>} AI response
   */
  async uploadFramework(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const fileStats = fs.statSync(filePath);
      if (fileStats.size === 0) {
        throw new Error("File is empty");
      }

      const fileExtension = path.extname(filePath).toLowerCase();
      const supportedTypes = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];

      if (!supportedTypes.includes(fileExtension)) {
        throw new Error(
          `Invalid file type. Expected one of: ${supportedTypes.join(
            ", "
          )}, got: ${fileExtension}`
        );
      }

      const formData = new FormData();
      const fileStream = fs.createReadStream(filePath);

      let contentType = "application/octet-stream";
      switch (fileExtension) {
        case ".pdf":
          contentType = "application/pdf";
          break;
        case ".doc":
          contentType = "application/msword";
          break;
        case ".docx":
          contentType =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          break;
        case ".xls":
          contentType = "application/vnd.ms-excel";
          break;
        case ".xlsx":
          contentType =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          break;
      }

      formData.append("file", fileStream, {
        filename: path.basename(filePath),
        contentType: contentType,
      });

      const response = await addRequest("/expert/framework/upload", {
        method: "POST",
        data: formData,
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      if (!response.data || !response.data.status || !response.data.uuid) {
        throw new Error("Invalid response from AI service");
      }

      return {
        success: true,
        message: "Framework uploaded successfully to AI service",
        aiResponse: {
          status: response.data.status,
          filename: response.data.filename || path.basename(filePath),
          uuid: response.data.uuid,
          control_extraction_status:
            response.data.control_extraction_status || "pending",
        },
      };
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`File not found: ${filePath}`);
      }
      if (error.response?.status === 413) {
        throw new Error("File too large for AI processing");
      }
      if (error.response?.status === 415) {
        throw new Error("Unsupported file type for AI processing");
      }
      if (error.response?.status >= 500) {
        throw new Error("AI service internal error. Please try again later.");
      }

      throw error; // Re-throw the error from aiClient (which has proper error messages)
    }
  }

  /**
   * Start background monitoring for AI processing
   * @param {string} uuid - AI processing UUID
   * @param {string} frameworkId - Framework ID
   * @param {Function} onMessage - Callback for AI messages
   */
  startBackgroundMonitoring(uuid, frameworkId, onMessage) {
    try {
      const aiWsUrl = `${AI_BASE_URL.replace(
        "http",
        "ws"
      )}/expert/framework/extract-controls/${uuid}`;
      const aiWs = new WebSocket(aiWsUrl);

      this.activeConnections.set(frameworkId, aiWs);

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
          if (message.status === "completed" || message.status === "error") {
            setTimeout(() => {
              this.closeConnection(frameworkId);
            }, 1000);
          }
        } catch (parseError) {
          console.error("❌ Error parsing AI WebSocket message:", parseError);
        }
      });

      aiWs.on("error", (error) => {
        console.error(
          `❌ AI WebSocket error for framework ${frameworkId}:`,
          error
        );
        this.closeConnection(frameworkId);
      });

      aiWs.on("close", () => {
        this.activeConnections.delete(frameworkId);
      });
    } catch (error) {
      console.error(
        `❌ Error creating AI WebSocket connection for framework ${frameworkId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Close WebSocket connection
   * @param {string} frameworkId - Framework ID
   */
  closeConnection(frameworkId) {
    const aiWs = this.activeConnections.get(frameworkId);
    if (aiWs && aiWs.readyState === WebSocket.OPEN) {
      aiWs.close();
    }
    this.activeConnections.delete(frameworkId);
  }

  /**
   * Close all connections
   */
  closeAllConnections() {
    for (const [frameworkId, aiWs] of this.activeConnections) {
      if (aiWs && aiWs.readyState === WebSocket.OPEN) {
        aiWs.close();
      }
    }
    this.activeConnections.clear();
  }

  /**
   * Check AI processing status by UUID
   * @param {string} uuid - AI processing UUID
   * @returns {Promise<Object>} Processing status
   */
  async checkProcessingStatus(uuid) {
    try {
      if (!uuid) {
        throw new Error("UUID is required");
      }

      const response = await addRequest(`/expert/framework/status/${uuid}`, {
        method: "GET",
      });

      return {
        success: true,
        status: response.data,
      };
    } catch (error) {
      console.error("❌ AI Status Check Error:", error.message);
      throw error; // Re-throw the error from aiClient (which has proper error messages)
    }
  }
}

// Create singleton instance
const aiService = new AIService();

module.exports = aiService;
