const axios = require("axios");

/**
 * AI Client Configuration
 *
 * Provides a centralized HTTP client for AI API communication
 * with base URL configuration and common request handling.
 */

// AI API Base Configuration
const AI_BASE_URL = process.env.AI_BASE_URL_API;

// Create axios instance with base configuration
const aiAxiosInstance = axios.create({
  baseURL: AI_BASE_URL,
  timeout: 30000, // 30 seconds timeout for AI processing
  headers: {
    Accept: "application/json",
  },
});

// Request interceptor for logging
aiAxiosInstance.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    console.error("❌ AI API Request Error:", error.message);
    return Promise.reject(error);
  }
);

// Response interceptor for logging and error handling
aiAxiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("❌ AI API Response Error:", {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

/**
 * Common request method for AI API calls
 * @param {string} endpoint - API endpoint (e.g., '/upload')
 * @param {Object} options - Request options
 * @param {string} options.method - HTTP method (GET, POST, etc.)
 * @param {Object} options.data - Request data
 * @param {Object} options.headers - Additional headers
 * @returns {Promise} Axios response promise
 */
const addRequest = async (endpoint, options = {}) => {
  try {
    // Validate inputs
    if (!endpoint) {
      throw new Error("Endpoint is required");
    }

    if (!AI_BASE_URL) {
      throw new Error("AI_BASE_URL is not configured");
    }

    const {
      method = "GET",
      data = null,
      headers = {},
      ...otherOptions
    } = options;

    const config = {
      method,
      url: endpoint,
      headers: {
        ...headers,
      },
      ...otherOptions,
    };

    // Add data based on method
    if (data) {
      if (method.toLowerCase() === "get") {
        config.params = data;
      } else {
        config.data = data;
      }
    }

    const response = await aiAxiosInstance(config);
    return response;
  } catch (error) {
    // Re-throw with additional context
    const enhancedError = new Error(`AI API request failed: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.endpoint = endpoint;
    enhancedError.status = error.response?.status;
    enhancedError.responseData = error.response?.data;

    throw enhancedError;
  }
};

module.exports = {
  AI_BASE_URL,
  aiAxiosInstance,
  addRequest,
};
