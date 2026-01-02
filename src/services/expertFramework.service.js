const ExpertFramework = require("../models/expertFramework.model");

/**
 * Expert Framework Service
 *
 * Contains all business logic for expert framework operations
 */

class ExpertFrameworkService {
  /**
   * Get formatted file size
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  static getFormattedFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Get frameworks by type
   * @param {string} frameworkType - Framework type
   * @returns {Promise<Array>} Frameworks
   */
  static async getByType(frameworkType) {
    return await ExpertFramework.find({
      frameworkType,
      isActive: true,
    }).populate("uploadedBy", "name email role");
  }

  /**
   * Get expert frameworks
   * @param {string} expertId - Expert ID
   * @returns {Promise<Array>} Expert frameworks
   */
  static async getExpertFrameworks(expertId) {
    return await ExpertFramework.find({
      uploadedBy: expertId,
      isActive: true,
    }).populate("uploadedBy", "name email role");
  }

  /**
   * Update AI processing status
   * @param {Object} framework - Framework document
   * @param {Object} aiData - AI data to update
   * @returns {Promise<Object>} Updated framework
   */
  static async updateAIStatus(framework, aiData) {
    framework.aiProcessing.uuid = aiData.uuid || framework.aiProcessing.uuid;
    framework.aiProcessing.status =
      aiData.status || framework.aiProcessing.status;
    framework.aiProcessing.control_extraction_status =
      aiData.control_extraction_status ||
      framework.aiProcessing.control_extraction_status;
    framework.aiProcessing.processedAt = aiData.processedAt || new Date();
    framework.aiProcessing.errorMessage = aiData.errorMessage || null;

    return await framework.save();
  }

  /**
   * Store extracted controls (handles all formats)
   * @param {Object} framework - Framework document
   * @param {Object|Array} controlsData - Controls data
   * @returns {Promise<Object>} Updated framework
   */
  static async storeExtractedControls(framework, controlsData) {
    let controls = [];

    // Handle different input formats
    if (Array.isArray(controlsData)) {
      // Direct array of controls
      controls = controlsData;
    } else if (controlsData && typeof controlsData === "object") {
      // WebSocket message format
      if (controlsData.controls && Array.isArray(controlsData.controls)) {
        controls = controlsData.controls;
      } else if (controlsData.data && Array.isArray(controlsData.data)) {
        controls = controlsData.data;
      }

      // Update status from WebSocket message
      if (controlsData.status) {
        framework.aiProcessing.status = controlsData.status;
        framework.aiProcessing.control_extraction_status = controlsData.status;
      }
    }

    // Store controls
    framework.aiProcessing.extractedControls = controls;
    framework.aiProcessing.controlsCount = controls.length;
    framework.aiProcessing.controlsExtractedAt = new Date();

    // Set completed status if not already set
    if (
      !framework.aiProcessing.status ||
      framework.aiProcessing.status !== "completed"
    ) {
      framework.aiProcessing.status = "completed";
      framework.aiProcessing.control_extraction_status = "completed";
    }

    return await framework.save();
  }

  /**
   * Format AI processing data for API response
   * @param {Object} aiProcessing - AI processing data
   * @returns {Object|null} Formatted AI processing data
   */
  static formatAIProcessingData(aiProcessing) {
    if (!aiProcessing?.uuid) {
      return null;
    }

    return {
      uuid: aiProcessing.uuid,
      status: aiProcessing.status,
      control_extraction_status: aiProcessing.control_extraction_status,
      processedAt: aiProcessing.processedAt,
      controlsCount: aiProcessing.controlsCount || 0,
      controlsExtractedAt: aiProcessing.controlsExtractedAt || null,
      errorMessage: aiProcessing.errorMessage || null,
    };
  }

  /**
   * Check if controls are available
   * @param {Object} framework - Framework document
   * @returns {boolean} True if controls are available
   */
  static hasExtractedControls(framework) {
    return (
      framework.aiProcessing.extractedControls &&
      framework.aiProcessing.extractedControls.length > 0 &&
      (framework.aiProcessing.status === "completed" ||
        framework.aiProcessing.control_extraction_status === "completed")
    );
  }

  /**
   * Check if processing is in progress
   * @param {Object} framework - Framework document
   * @returns {boolean} True if processing is in progress
   */
  static isProcessingInProgress(framework) {
    return (
      framework.aiProcessing.status === "processing" ||
      framework.aiProcessing.status === "uploaded" ||
      framework.aiProcessing.control_extraction_status === "processing" ||
      framework.aiProcessing.control_extraction_status === "started"
    );
  }

  /**
   * Check if processing has failed
   * @param {Object} framework - Framework document
   * @returns {boolean} True if processing has failed
   */
  static hasProcessingFailed(framework) {
    return framework.aiProcessing.status === "failed";
  }
}

module.exports = ExpertFrameworkService;
