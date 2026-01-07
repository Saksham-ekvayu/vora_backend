const User = require("../../models/user.model");
const UserDocument = require("../../models/user-document.model");
const UserFramework = require("../../models/user-framework.model");
const ExpertFramework = require("../../models/expert-framework.model");

// Get admin dashboard analytics
const getDashboardAnalytics = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: admin access required.",
      });
    }

    // Parallel aggregation queries for optimal performance
    const [
      totalUsers,
      totalUserFrameworks,
      totalExpertFrameworks,
      totalDocuments,
      usersByRole,
      recentUsers,
      userRegistrationChart,
    ] = await Promise.all([
      User.countDocuments(),
      UserFramework.countDocuments(),
      ExpertFramework.countDocuments(),
      UserDocument.countDocuments(),

      // Users by role aggregation
      User.aggregate([
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
          },
        },
      ]),

      // Recent 5 users
      User.find()
        .select("name email role createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // User registration chart (last 30 days)
      User.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]),
    ]);

    // Format user role counts
    const roleStats = {
      admin: 0,
      user: 0,
      expert: 0,
    };

    usersByRole.forEach((item) => {
      roleStats[item._id] = item.count;
    });

    // Format chart data
    const chartLabels = [];
    const chartValues = [];

    userRegistrationChart.forEach((item) => {
      chartLabels.push(item._id);
      chartValues.push(item.count);
    });

    // Check AI integration status
    const aiEnabled = process.env.AI_SERVICE_ENABLED === "true" || false;

    res.status(200).json({
      success: true,
      message: "Dashboard analytics retrieved successfully",
      data: {
        stats: {
          totalUsers,
          totalUserFrameworks,
          totalExpertFrameworks,
          totalDocuments,
          usersByRole: roleStats,
        },
        charts: {
          userRegistration: {
            labels: chartLabels,
            values: chartValues,
          },
        },
        aiEnabled,
        recentUsers: recentUsers.map((user) => ({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error getting dashboard analytics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving dashboard analytics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getDashboardAnalytics,
};
