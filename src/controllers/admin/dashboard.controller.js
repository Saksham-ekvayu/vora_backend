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
      recentCreatedUsers,
      userCreationChart,
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

      // Recent 5 created users
      User.find()
        .select("name email role createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // User creation chart by source (last 30 days)
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
              date: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$createdAt",
                },
              },
              createdBy: "$createdBy",
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.date": 1 },
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

    // Format chart data - combine self registration and admin creation
    const chartLabels = [];
    const selfRegistrationValues = [];
    const adminCreationValues = [];
    const dateMap = {};

    // Initialize date map with all dates
    userCreationChart.forEach((item) => {
      const date = item._id.date;
      if (!dateMap[date]) {
        dateMap[date] = { self: 0, admin: 0 };
      }
      dateMap[date][item._id.createdBy] = item.count;
    });

    // Sort dates and build arrays
    Object.keys(dateMap)
      .sort()
      .forEach((date) => {
        chartLabels.push(date);
        selfRegistrationValues.push(dateMap[date].self || 0);
        adminCreationValues.push(dateMap[date].admin || 0);
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
          userCreation: {
            labels: chartLabels,
            selfRegistration: selfRegistrationValues,
            adminCreation: adminCreationValues,
          },
        },
        aiEnabled,
        recentCreatedUsers: recentCreatedUsers.map((user) => ({
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
