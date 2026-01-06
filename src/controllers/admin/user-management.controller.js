const User = require("../../models/user.model");
const {
  generateTempPassword,
  paginateWithSearch,
} = require("../../helpers/helper");
const { sendTempPasswordEmail } = require("../../services/email.service");
const UserDocument = require("../../models/user-document.model");
const UserFramework = require("../../models/user-framework.model");
const { deleteFile } = require("../../config/multer.config");

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

// Get user by ID
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

    res.json({
      success: true,
      message: "User detail retrieved successfully ",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete user by ID (admin only)
const deleteUser = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: only admin can access.",
      });
    }

    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: "Admin cannot delete their own account",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Additional check: Prevent deletion of other admin users (optional security measure)
    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete admin users",
      });
    }

    // Delete all user's documents and their files
    const userDocuments = await UserDocument.find({ uploadedBy: id });
    const userFrameworks = await UserFramework.find({ uploadedBy: id });

    // Delete document files
    for (const doc of userDocuments) {
      if (doc.fileUrl) {
        deleteFile(doc.fileUrl);
      }
    }

    // Delete framework files
    for (const framework of userFrameworks) {
      if (framework.fileUrl) {
        deleteFile(framework.fileUrl);
      }
    }

    // Delete documents and frameworks from database
    await UserDocument.deleteMany({ uploadedBy: id });
    await UserFramework.deleteMany({ uploadedBy: id });

    // Delete user
    await User.findByIdAndDelete(id);

    // Invalidate user cache (commented out)
    // await invalidateCache.user(id);

    res.json({
      success: true,
      message: "User and all associated data deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Edit user profile (for logged-in user)
const editProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const userId = req.user._id;

    // Check if email is being changed and if it's already taken
    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res
          .status(400)
          .json({ success: false, message: "Email already exists" });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
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
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createUserByAdmin,
  updateUserByAdmin,
  getAllUsers,
  getUserById,
  editProfile,
  deleteUser,
};
