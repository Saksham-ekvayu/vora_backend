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

    // Validate file extension (AI service expects supported document types)
    const fileExtension = path.extname(filePath).toLowerCase();
    const supportedTypes = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];

    if (!supportedTypes.includes(fileExtension)) {
      throw new Error(
        `Invalid file type. Expected one of: ${supportedTypes.join(
          ", "
        )}, got: ${fileExtension}`
      );
    }

    // Create FormData for multipart upload
    const formData = new FormData();

    // Create read stream for the file
    const fileStream = fs.createReadStream(filePath);

    // Determine content type based on file extension
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

    // Add file to form data with field name 'file' as required by AI API
    formData.append("file", fileStream, {
      filename: path.basename(filePath),
      contentType: contentType,
    });

    // Make request to AI upload endpoint
    const response = await addRequest("/expert/framework/upload", {
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

    const response = await addRequest(`/expert/framework/status/${uuid}`, {
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

module.exports = {
  uploadFrameworkToAI,
  checkProcessingStatus,
};
