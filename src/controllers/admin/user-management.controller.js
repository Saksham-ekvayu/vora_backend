const User = require("../../models/user.model");
const {
  generateTempPassword,
  paginateWithSearch,
  formatFileSize,
} = require("../../helpers/helper");
const { sendTempPasswordEmail } = require("../../services/email.service");
const UserDocument = require("../../models/user-document.model");
const UserFramework = require("../../models/user-framework.model");
const { deleteFile } = require("../../config/multer.config");
const ExpertFramework = require("../../models/expert-framework.model");
const FrameworkComparison = require("../../models/framework-comparison.model");

// Create user by admin
const createUserByAdmin = async (req, res) => {
  try {
    // only admins can create users
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: admin access required to perform this action.",
      });
    }

    const { name, email, role, phone } = req.body;

    // check email uniqueness
    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Email already exists" });
    }

    // if phone provided, ensure uniqueness
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "User with this phone number already exists",
        });
      }
    }

    // generate temporary password that satisfies validators
    const tempPassword = generateTempPassword(12);

    const newUser = new User({
      name,
      email,
      role: role || "expert",
      phone: phone || undefined,
      password: tempPassword,
      createdBy: "admin",
      isEmailVerified: true, // admin-created users considered verified by admin
    });

    await newUser.save();

    // Send temporary password via email
    const emailSent = await sendTempPasswordEmail(email, tempPassword, name);

    if (!emailSent) {
      // If email fails, we should still inform admin but log the issue
      console.error(`Failed to send temporary password email to ${email}`);
      return res.status(201).json({
        success: true,
        message:
          "User created successfully, but failed to send email. Please provide the temporary password manually.",
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          phone: newUser.phone,
        },
        warning: "Email delivery failed. Please contact the user directly.",
      });
    }

    // Cache the new user (commented out)
    // await cacheService.cacheUser(newUser);

    res.status(201).json({
      success: true,
      message:
        "User created successfully. Temporary password has been sent to their email address.",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
      },
      emailSent: true,
      instructions:
        "The user will receive their temporary password via email and must update it on first login.",
    });
  } catch (error) {
    console.error("Create user by admin error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update user by admin
const updateUserByAdmin = async (req, res) => {
  try {
    // only admins can update users
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: admin access required to perform this action.",
      });
    }

    const { id } = req.params;
    const { name, role, phone } = req.body;

    // Prevent admin from changing their own role
    if (req.user._id.toString() === id && role && role !== req.user.role) {
      return res.status(400).json({
        success: false,
        message: "Admin cannot change their own role",
      });
    }

    // find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Additional protection: Prevent changing other admin's role (optional security measure)
    if (
      user.role === "admin" &&
      role &&
      role !== "admin" &&
      req.user._id.toString() !== id
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot change role of other admin users",
      });
    }

    // phone uniqueness check (only if changed)
    if (phone && phone !== user.phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "User with this phone number already exists",
        });
      }
      user.phone = phone;
    }

    // update allowed fields
    if (name) user.name = name;
    if (role) user.role = role;

    await user.save();

    // Update cache (commented out)
    // await cacheService.cacheUser(user);

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email, // email unchanged
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Update user by admin error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    // only admins can fetch all users
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: only admin can access.",
      });
    }

    // Build sort object from query params
    let sortObj = { createdAt: -1 }; // Default sort by createdAt descending

    if (req.query.sortBy && req.query.sortOrder) {
      const sortBy = req.query.sortBy;
      const sortOrder = req.query.sortOrder === "desc" ? -1 : 1;

      // Validate sortBy field to prevent injection
      const allowedSortFields = [
        "name",
        "email",
        "role",
        "createdAt",
        "updatedAt",
        "isEmailVerified",
      ];
      if (allowedSortFields.includes(sortBy)) {
        sortObj = { [sortBy]: sortOrder };
      }
    }

    // Use enhanced pagination helper with search and sort support
    const result = await paginateWithSearch(User, {
      page: req.query.page,
      limit: 10, // Fixed limit of 10 users per page
      search: req.query.search,
      searchFields: ["name", "email", "phone"], // Fields to search in
      sort: sortObj,
      transform: (user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }),
    });

    // Determine appropriate message based on data availability
    let message = "User list retrieved successfully";
    if (result.data.length === 0) {
      if (result.searchTerm) {
        message = `No users match your search for "${result.searchTerm}". Try a different search term.`;
      } else {
        message = "No users available in the system yet.";
      }
    }

    res.json({
      success: true,
      message: message,
      users: result.data,
      pagination: result.pagination,
      searchTerm: result.searchTerm,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get user by ID with role-based statistics
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to get from cache first (commented out)
    // let user = await cacheService.getUserById(id);

    // Fetch directly from database
    const user = await User.findById(id).select("-password -otp");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Initialize statistics object
    let statistics = {
      documents: 0,
      frameworks: 0,
      comparisons: 0,
      aiProcessingStatus: {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      },
    };

    // Get role-based statistics
    if (user.role === "user") {
      // For users: count their documents, frameworks, and comparisons
      const [documentCount, frameworkCount, comparisonCount] =
        await Promise.all([
          UserDocument.countDocuments({ uploadedBy: id }),
          UserFramework.countDocuments({ uploadedBy: id }),
          FrameworkComparison.countDocuments({ userId: id }),
        ]);

      // Get AI processing status for user frameworks
      const userFrameworks = await UserFramework.find({
        uploadedBy: id,
      }).select("aiProcessing.status");
      const aiStatusCounts = userFrameworks.reduce((acc, framework) => {
        const status = framework.aiProcessing?.status || "pending";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      statistics = {
        documents: documentCount,
        frameworks: frameworkCount,
        comparisons: comparisonCount,
        aiProcessingStatus: {
          pending: aiStatusCounts.pending || 0,
          processing:
            (aiStatusCounts.processing || 0) + (aiStatusCounts.uploaded || 0),
          completed: aiStatusCounts.completed || 0,
          failed: aiStatusCounts.failed || 0,
        },
      };
    } else if (user.role === "expert") {
      // For experts: count their expert frameworks and related comparisons
      const [expertFrameworkCount, relatedComparisons] = await Promise.all([
        ExpertFramework.countDocuments({ uploadedBy: id }),
        FrameworkComparison.countDocuments({
          expertFrameworkId: {
            $in: await ExpertFramework.find({ uploadedBy: id }).select("_id"),
          },
        }),
      ]);

      // Get AI processing status for expert frameworks
      const expertFrameworks = await ExpertFramework.find({
        uploadedBy: id,
      }).select("aiProcessing.status");
      const aiStatusCounts = expertFrameworks.reduce((acc, framework) => {
        const status = framework.aiProcessing?.status || "pending";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      statistics = {
        documents: 0, // Experts don't have user documents
        frameworks: expertFrameworkCount,
        comparisons: relatedComparisons,
        aiProcessingStatus: {
          pending: aiStatusCounts.pending || 0,
          processing:
            (aiStatusCounts.processing || 0) + (aiStatusCounts.uploaded || 0),
          completed: aiStatusCounts.completed || 0,
          failed: aiStatusCounts.failed || 0,
        },
      };
    } else if (user.role === "admin") {
      // For admins: show system-wide statistics
      const [
        totalUsers,
        totalExperts,
        totalDocuments,
        totalUserFrameworks,
        totalExpertFrameworks,
        totalComparisons,
      ] = await Promise.all([
        User.countDocuments({ role: "user" }),
        User.countDocuments({ role: "expert" }),
        UserDocument.countDocuments(),
        UserFramework.countDocuments(),
        ExpertFramework.countDocuments(),
        FrameworkComparison.countDocuments(),
      ]);

      statistics = {
        systemStats: {
          totalUsers,
          totalExperts,
          totalDocuments,
          totalUserFrameworks,
          totalExpertFrameworks,
          totalComparisons,
        },
        documents: 0,
        frameworks: 0,
        comparisons: 0,
        aiProcessingStatus: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        },
      };
    }

    res.json({
      success: true,
      message: "User detail retrieved successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        statistics,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get detailed user statistics by ID
const getUserStatistics = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findById(id).select("name email role");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let detailedStats = {};

    if (user.role === "user") {
      // Get detailed user statistics
      const [
        documents,
        frameworks,
        comparisons,
        recentDocuments,
        recentFrameworks,
      ] = await Promise.all([
        UserDocument.find({ uploadedBy: id }).select(
          "documentName documentType fileSize createdAt"
        ),
        UserFramework.find({ uploadedBy: id }).select(
          "frameworkName frameworkType fileSize aiProcessing createdAt"
        ),
        FrameworkComparison.find({ userId: id })
          .populate("expertFrameworkId", "frameworkName")
          .select("aiProcessing createdAt"),
        UserDocument.find({ uploadedBy: id })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("documentName documentType createdAt"),
        UserFramework.find({ uploadedBy: id })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("frameworkName frameworkType aiProcessing.status createdAt"),
      ]);

      // Calculate framework statistics
      const frameworkStats = frameworks.reduce(
        (acc, framework) => {
          const status = framework.aiProcessing?.status || "pending";
          acc.byStatus[status] = (acc.byStatus[status] || 0) + 1;
          acc.byType[framework.frameworkType] =
            (acc.byType[framework.frameworkType] || 0) + 1;
          acc.totalSize += framework.fileSize || 0;
          return acc;
        },
        {
          byStatus: {},
          byType: {},
          totalSize: 0,
        }
      );

      // Calculate document statistics
      const documentStats = documents.reduce(
        (acc, doc) => {
          acc.byType[doc.documentType] =
            (acc.byType[doc.documentType] || 0) + 1;
          acc.totalSize += doc.fileSize || 0;
          return acc;
        },
        {
          byType: {},
          totalSize: 0,
        }
      );

      detailedStats = {
        role: user.role,
        summary: {
          totalDocuments: documents.length,
          totalFrameworks: frameworks.length,
          totalComparisons: comparisons.length,
          totalStorageUsed: formatFileSize(
            documentStats.totalSize + frameworkStats.totalSize
          ),
        },
        documents: {
          count: documents.length,
          byType: documentStats.byType,
          totalSize: formatFileSize(documentStats.totalSize),
          recent: recentDocuments,
        },
        frameworks: {
          count: frameworks.length,
          byType: frameworkStats.byType,
          byStatus: frameworkStats.byStatus,
          totalSize: formatFileSize(frameworkStats.totalSize),
          recent: recentFrameworks,
        },
        comparisons: {
          count: comparisons.length,
          recent: comparisons.slice(0, 5),
        },
      };
    } else if (user.role === "expert") {
      // Get detailed expert statistics
      const [expertFrameworks, relatedComparisons] = await Promise.all([
        ExpertFramework.find({ uploadedBy: id }).select(
          "frameworkName frameworkType fileSize aiProcessing createdAt"
        ),
        FrameworkComparison.find({
          expertFrameworkId: {
            $in: await ExpertFramework.find({ uploadedBy: id }).select("_id"),
          },
        })
          .populate("userFrameworkId", "frameworkName")
          .populate("userId", "name email")
          .select("aiProcessing createdAt"),
      ]);

      // Calculate expert framework statistics
      const frameworkStats = expertFrameworks.reduce(
        (acc, framework) => {
          const status = framework.aiProcessing?.status || "pending";
          acc.byStatus[status] = (acc.byStatus[status] || 0) + 1;
          acc.byType[framework.frameworkType] =
            (acc.byType[framework.frameworkType] || 0) + 1;
          acc.totalSize += framework.fileSize || 0;
          return acc;
        },
        {
          byStatus: {},
          byType: {},
          totalSize: 0,
        }
      );

      detailedStats = {
        role: user.role,
        summary: {
          totalExpertFrameworks: expertFrameworks.length,
          totalComparisonsInvolved: relatedComparisons.length,
          totalStorageUsed: formatFileSize(frameworkStats.totalSize),
        },
        expertFrameworks: {
          count: expertFrameworks.length,
          byType: frameworkStats.byType,
          byStatus: frameworkStats.byStatus,
          totalSize: formatFileSize(frameworkStats.totalSize),
          recent: expertFrameworks.slice(0, 5),
        },
        comparisonsInvolved: {
          count: relatedComparisons.length,
          recent: relatedComparisons.slice(0, 5),
        },
      };
    } else if (user.role === "admin") {
      // Get system-wide detailed statistics for admin
      const [
        allUsers,
        allExperts,
        allDocuments,
        allUserFrameworks,
        allExpertFrameworks,
        allComparisons,
      ] = await Promise.all([
        User.find({ role: "user" }).select("name email createdAt"),
        User.find({ role: "expert" }).select("name email createdAt"),
        UserDocument.find()
          .populate("uploadedBy", "name email")
          .select("documentName documentType fileSize createdAt"),
        UserFramework.find()
          .populate("uploadedBy", "name email")
          .select(
            "frameworkName frameworkType fileSize aiProcessing createdAt"
          ),
        ExpertFramework.find()
          .populate("uploadedBy", "name email")
          .select(
            "frameworkName frameworkType fileSize aiProcessing createdAt"
          ),
        FrameworkComparison.find()
          .populate("userId", "name email")
          .select("aiProcessing createdAt"),
      ]);

      detailedStats = {
        role: user.role,
        systemOverview: {
          totalUsers: allUsers.length,
          totalExperts: allExperts.length,
          totalDocuments: allDocuments.length,
          totalUserFrameworks: allUserFrameworks.length,
          totalExpertFrameworks: allExpertFrameworks.length,
          totalComparisons: allComparisons.length,
        },
        recentActivity: {
          recentUsers: allUsers.slice(0, 10),
          recentExperts: allExperts.slice(0, 10),
          recentDocuments: allDocuments.slice(0, 10),
          recentFrameworks: [...allUserFrameworks, ...allExpertFrameworks]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10),
        },
      };
    }

    res.json({
      success: true,
      message: "User statistics retrieved successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      statistics: detailedStats,
    });
  } catch (error) {
    console.error("Get user statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while retrieving user statistics",
    });
  }
};

// Delete user by ID (admin only) - Minimal & Production Ready
const deleteUser = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: only admin can access.",
      });
    }

    const { id } = req.params;
    const { deleteData } = req.body;

    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: "Admin cannot delete their own account",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete admin users",
      });
    }

    // Always delete comparisons
    await FrameworkComparison.deleteMany({ $or: [{ userId: id }] });

    if (deleteData) {
      // Delete all user data and files
      const [userDocs, userFrameworks, expertFrameworks] = await Promise.all([
        UserDocument.find({ uploadedBy: id }),
        UserFramework.find({ uploadedBy: id }),
        user.role === "expert" ? ExpertFramework.find({ uploadedBy: id }) : [],
      ]);

      // Delete files
      [...userDocs, ...userFrameworks, ...expertFrameworks].forEach((item) => {
        if (item.fileUrl) deleteFile(item.fileUrl);
      });

      // Delete database records
      await Promise.all([
        UserDocument.deleteMany({ uploadedBy: id }),
        UserFramework.deleteMany({ uploadedBy: id }),
        user.role === "expert"
          ? ExpertFramework.deleteMany({ uploadedBy: id })
          : Promise.resolve(),
      ]);
    }

    // Delete user
    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: deleteData
        ? `${
            user.role === "expert" ? "Expert" : "User"
          } and all data deleted successfully`
        : `${
            user.role === "expert" ? "Expert" : "User"
          } deleted. Data preserved.`,
      deletionSummary: {
        userDeleted: true,
        dataHandling: deleteData ? "deleted" : "preserved",
      },
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Edit user profile (for logged-in user)
const editProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const userId = req.user._id;

    // Email cannot be changed
    if (req.body.email) {
      return res.status(400).json({
        success: false,
        message: "Email cannot be changed",
      });
    }

    // Build update data only with provided fields
    const updateData = {};
    let hasChanges = false;

    if (name !== undefined && name !== null) {
      // Reject empty string for name
      if (name.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }
      if (name !== req.user.name) {
        updateData.name = name;
        hasChanges = true;
      }
    }

    if (phone !== undefined && phone !== null) {
      if (phone !== req.user.phone) {
        updateData.phone = phone;
        hasChanges = true;
      }
    }

    // If no fields to update, return error
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No changes detected. Provide different values.",
      });
    }

    // Check if phone is being changed and if it's already taken
    if (phone && phone !== req.user.phone) {
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Phone number already exists",
        });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: false,
    }).select("-password -otp");

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  createUserByAdmin,
  updateUserByAdmin,
  getAllUsers,
  getUserById,
  getUserStatistics,
  editProfile,
  deleteUser,
};
