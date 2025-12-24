const User = require("../models/user.model");
const { generateTempPassword, paginate } = require("../helpers/helper");

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

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
      },
      temporaryPassword: tempPassword, // return so admin can share/reset; remove in production
    });
  } catch (error) {
    console.error("Create user by admin error:", error);
    res.status(500).json({ success: false, message: "Server error" });
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

    // Use common pagination helper
    const result = await paginate(User, {
      page: req.query.page,
      limit: 10, // Fixed limit of 10 users per page
      transform: (user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      }),
    });

    res.json({
      success: true,
      message: "User list retrieved successfully",
      users: result.data,
      pagination: result.pagination,
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
    const user = await User.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    await User.findByIdAndDelete(id);
    res.json({ success: true, message: "User deleted successfully" });
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
  getAllUsers,
  getUserById,
  editProfile,
  deleteUser,
};
