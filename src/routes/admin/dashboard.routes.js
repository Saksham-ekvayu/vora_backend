const express = require("express");
const {
  getDashboardAnalytics,
} = require("../../controllers/admin/dashboard.controller");
const { authenticateToken } = require("../../middlewares/auth.middleware");

const router = express.Router();

// Get dashboard analytics (admin only)
router.get("/analytics", authenticateToken, getDashboardAnalytics);

module.exports = router;
