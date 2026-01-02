const cacheService = require("../../services/cache.service");
const { cacheOperations } = require("../../config/cache.config");
const { invalidateCache } = require("../../middlewares/cache.middleware");

// Get cache health and statistics
const getCacheHealth = async (req, res) => {
  try {
    const health = await cacheService.healthCheck();

    res.status(200).json({
      success: true,
      message: "Cache health retrieved successfully",
      data: health,
    });
  } catch (error) {
    console.error("Error getting cache health:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving cache health",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get cache statistics
const getCacheStats = async (req, res) => {
  try {
    const stats = cacheOperations.getStats();

    res.status(200).json({
      success: true,
      message: "Cache statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error getting cache stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving cache statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Warm up cache
const warmupCache = async (req, res) => {
  try {
    await cacheService.warmupCache();

    res.status(200).json({
      success: true,
      message: "Cache warmup completed successfully",
    });
  } catch (error) {
    console.error("Error warming up cache:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while warming up cache",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Clear specific cache patterns
const clearCache = async (req, res) => {
  try {
    const { pattern } = req.body;

    if (!pattern) {
      return res.status(400).json({
        success: false,
        message: "Cache pattern is required",
      });
    }

    let result;
    switch (pattern) {
      case "frameworks":
        result = await invalidateCache.frameworks();
        break;
      case "documents":
        result = await invalidateCache.documents();
        break;
      case "users":
        result = await invalidateCache.user();
        break;
      case "all":
        result = await invalidateCache.all();
        break;
      default:
        result = await cacheOperations.clearPattern(pattern);
    }

    res.status(200).json({
      success: true,
      message: `Cache cleared successfully for pattern: ${pattern}`,
      data: { pattern, cleared: true },
    });
  } catch (error) {
    console.error("Error clearing cache:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while clearing cache",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Preload user data
const preloadUserData = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const result = await cacheService.preloadUserData(userId);

    res.status(200).json({
      success: true,
      message: result
        ? "User data preloaded successfully"
        : "Failed to preload user data",
      data: { userId, preloaded: result },
    });
  } catch (error) {
    console.error("Error preloading user data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while preloading user data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get framework statistics from cache
const getFrameworkStats = async (req, res) => {
  try {
    const stats = await cacheService.getFrameworkStats();

    res.status(200).json({
      success: true,
      message: "Framework statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error getting framework stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving framework statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get document statistics from cache
const getDocumentStats = async (req, res) => {
  try {
    const stats = await cacheService.getDocumentStats();

    res.status(200).json({
      success: true,
      message: "Document statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error getting document stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving document statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getCacheHealth,
  getCacheStats,
  warmupCache,
  clearCache,
  preloadUserData,
  getFrameworkStats,
  getDocumentStats,
};
