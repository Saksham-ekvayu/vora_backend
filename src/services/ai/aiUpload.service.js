const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const { addRequest } = require("./aiClient");

/**
 * AI Upload Service
 *
 * Handles framework document upload to AI processing service
 * for control extraction and analysis.
 */

/**
 * Upload framework PDF to AI service for processing
 * @param {string} filePath - Absolute or relative path to the PDF file
 * @returns {Promise<Object>} AI service response
 * @throws {Error} If file doesn't exist or upload fails
 */
const uploadFrameworkToAI = async (filePath) => {
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Get file stats for validation
    const fileStats = fs.statSync(filePath);
    if (fileStats.size === 0) {
      throw new Error("File is empty");
    }

    // Validate file extension (AI service expects PDF)
    const fileExtension = path.extname(filePath).toLowerCase();
    if (fileExtension !== ".pdf") {
      throw new Error(`Invalid file type. Expected PDF, got: ${fileExtension}`);
    }

    // Create FormData for multipart upload
    const formData = new FormData();

    // Create read stream for the file
    const fileStream = fs.createReadStream(filePath);

    // Add file to form data with field name 'file' as required by AI API
    formData.append("file", fileStream, {
      filename: path.basename(filePath),
      contentType: "application/pdf",
    });

    // Make request to AI upload endpoint
    const response = await addRequest("/upload", {
      method: "POST",
      data: formData,
      headers: {
        ...formData.getHeaders(), // This includes Content-Type: multipart/form-data with boundary
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Validate response structure
    if (!response.data) {
      throw new Error("Invalid response from AI service: missing data");
    }

    const aiResponse = response.data;

    // Validate required fields in AI response
    if (!aiResponse.status) {
      throw new Error("Invalid AI response: missing status field");
    }

    if (!aiResponse.uuid) {
      throw new Error("Invalid AI response: missing uuid field");
    }

    return {
      success: true,
      message: "Framework uploaded successfully to AI service",
      aiResponse: {
        status: aiResponse.status,
        filename: aiResponse.filename || path.basename(filePath),
        uuid: aiResponse.uuid,
        control_extraction_status:
          aiResponse.control_extraction_status || "pending",
      },
    };
  } catch (error) {
    console.error("❌ AI Upload Error:", error.message);

    // Handle specific error types
    if (error.code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }

    if (error.code === "ECONNREFUSED") {
      throw new Error("AI service is not available. Please try again later.");
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

    // Re-throw with context
    throw new Error(`AI upload failed: ${error.message}`);
  }
};

/**
 * Check AI processing status by UUID
 * @param {string} uuid - AI processing UUID
 * @returns {Promise<Object>} Processing status
 */
const checkProcessingStatus = async (uuid) => {
  try {
    if (!uuid) {
      throw new Error("UUID is required");
    }

    const response = await addRequest(`/status/${uuid}`, {
      method: "GET",
    });

    return {
      success: true,
      status: response.data,
    };
  } catch (error) {
    console.error("❌ AI Status Check Error:", error.message);
    throw new Error(`Failed to check AI processing status: ${error.message}`);
  }
};

/**
 * Get extracted controls from AI service by UUID
 * @param {string} uuid - AI processing UUID
 * @returns {Promise<Object>} Extracted controls or processing status
 */
const getExtractedControls = async (uuid) => {
  try {
    if (!uuid) {
      throw new Error("UUID is required");
    }

    const response = await addRequest(`/extract_controls/${uuid}`, {
      method: "GET",
    });

    const responseData = response.data;

    // Check if response is processing status or actual results
    if (
      responseData &&
      typeof responseData === "object" &&
      responseData.status &&
      responseData.msg
    ) {
      return {
        success: true,
        isProcessing: true,
        status: responseData.status,
        message: responseData.msg,
        controls: null,
      };
    } else if (Array.isArray(responseData) && responseData.length > 0) {
      // Processing complete - got controls array
      return {
        success: true,
        isProcessing: false,
        status: "completed",
        message: `Successfully extracted ${responseData.length} controls`,
        controls: responseData,
      };
    } else {
      // Unexpected response format or empty array
      console.log(`⚠️ Controls extraction completed but no controls found`);
      return {
        success: true,
        isProcessing: false,
        status: "completed",
        message: "Controls extraction completed but no controls found",
        controls: [],
      };
    }
  } catch (error) {
    console.error("❌ AI Controls Extraction Error:", error.message);

    // Handle specific error types
    if (error.response?.status === 404) {
      throw new Error("UUID not found in AI service");
    }

    if (error.response?.status >= 500) {
      throw new Error("AI service internal error. Please try again later.");
    }

    throw new Error(`Failed to get extracted controls: ${error.message}`);
  }
};

module.exports = {
  uploadFrameworkToAI,
  checkProcessingStatus,
  getExtractedControls,
};
