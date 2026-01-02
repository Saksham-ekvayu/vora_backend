const express = require("express");
const router = express.Router();

// Import middlewares
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { adminOnly } = require("../../middlewares/roleAccess.middleware");

// Import controller
const {
  getCacheHealth,
  getCacheStats,
  warmupCache,
  clearCache,
  preloadUserData,
  getFrameworkStats,
  getDocumentStats,
} = require("../../controllers/admin/cache.controller");

/**
 * @route   GET /api/admin/cache/health
 * @desc    Get cache health status
 * @access  Private (Admin only)
 */
router.get("/health", authenticateToken, adminOnly, getCacheHealth);

/**
 * @route   GET /api/admin/cache/stats
 * @desc    Get cache statistics
 * @access  Private (Admin only)
 */
router.get("/stats", authenticateToken, adminOnly, getCacheStats);

/**
 * @route   POST /api/admin/cache/warmup
 * @desc    Warm up cache with frequently accessed data
 * @access  Private (Admin only)
 */
router.post("/warmup", authenticateToken, adminOnly, warmupCache);

/**
 * @route   POST /api/admin/cache/clear
 * @desc    Clear cache by pattern
 * @access  Private (Admin only)
 * @body    { pattern: string } - Pattern to clear (frameworks, documents, users, all, or custom pattern)
 */
router.post("/clear", authenticateToken, adminOnly, clearCache);

/**
 * @route   POST /api/admin/cache/preload/:userId
 * @desc    Preload user-specific data into cache
 * @access  Private (Admin only)
 */
router.post("/preload/:userId", authenticateToken, adminOnly, preloadUserData);

/**
 * @route   GET /api/admin/cache/framework-stats
 * @desc    Get framework statistics from cache
 * @access  Private (Admin only)
 */
router.get("/framework-stats", authenticateToken, adminOnly, getFrameworkStats);

/**
 * @route   GET /api/admin/cache/document-stats
 * @desc    Get document statistics from cache
 * @access  Private (Admin only)
 */
router.get("/document-stats", authenticateToken, adminOnly, getDocumentStats);

module.exports = router;
