const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../../models/user.model");
const { generateOTP, sendOTPEmail } = require("../../services/email.service");

// Register user and send OTP
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if user already exists by email
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Check if user already exists by phone
    if (phone) {
      const phoneUser = await User.findOne({ phone });
      if (phoneUser) {
        return res.status(400).json({
          success: false,
          message: "User with this phone number already exists",
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Create new user
    user = new User({
      name,
      email,
      password,
      phone,
      otp: {
        code: otp,
        expiresAt: otpExpiry,
      },
    });

    // Save user to database
    await user.save();

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
      await User.deleteOne({ email });
      return res
        .status(500)
        .json({ success: false, message: "Error sending OTP email" });
    }

    res.status(201).json({
      success: true,
      message: "Registration successful. Please verify your email.",
      email: email,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    // Check if OTP exists and is valid
    if (!user.otp || !user.otp.code || !user.otp.expiresAt) {
      return res.status(400).json({ success: false, message: "No OTP found" });
    }

    // Check if OTP is expired
    if (user.otp.expiresAt < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired" });
    }

    // Verify OTP
    if (user.otp.code !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // Update user verification status
    user.isEmailVerified = true;
    user.otp = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Email verified successfully. Please login.",
      email: user.email,
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user's OTP
    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
    };
    await user.save();

    // Send new OTP email
    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
      return res
        .status(500)
        .json({ success: false, message: "Error sending OTP email" });
    }

    res.json({ success: true, message: "New OTP sent successfully" });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email or password" });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res
        .status(400)
        .json({ success: false, message: "Please verify your email first" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email or password" });
    }

    // Increment token version to invalidate all previous tokens
    user.tokenVersion += 1;
    await user.save();

    // Generate JWT token with tokenVersion
    const token = jwt.sign(
      {
        userId: user._id,
        tokenVersion: user.tokenVersion,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "24h",
      }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    // Generate OTP for password reset
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save OTP to user
    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
      purpose: "password_reset",
    };
    await user.save();

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
      return res
        .status(500)
        .json({ success: false, message: "Error sending OTP email" });
    }

    res.json({
      success: true,
      message: "Password reset OTP sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Reset password using OTP
const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "User not found" });

    if (!user.otp || !user.otp.code || !user.otp.expiresAt)
      return res.status(400).json({ success: false, message: "No OTP found" });

    if (user.otp.purpose && user.otp.purpose !== "password_reset")
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP purpose" });

    if (user.otp.expiresAt < new Date())
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired" });

    if (user.otp.code !== otp)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    // 🔴 CHECK: New password should not be old password
    const isSamePassword = await bcrypt.compare(password, user.password);

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        warning: true,
        message:
          "This password looks like your old password. Please choose a new one.",
      });
    }

    // Set new password (assumes User model hashes password on save)
    user.password = password;
    user.otp = undefined;
    await user.save();

    res.json({
      success: true,
      message:
        "Password reset successful. Please login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const sendVerificationOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    // Already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    user.otp = {
      code: otp,
      expiresAt: otpExpiry,
      purpose: "email_verification",
    };

    await user.save();

    // Send OTP
    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send verification OTP",
      });
    }

    res.json({
      success: true,
      message: "Verification OTP sent to your email",
    });
  } catch (error) {
    console.error("Send verification OTP error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Logout user
// Logout user with token blacklisting (cache disabled)
const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    res.json({
      success: true,
      message: "Logout successful.",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Logout from all devices
const logoutAllDevices = async (req, res) => {
  try {
    const user = req.user;

    // Increment token version to invalidate all tokens
    user.tokenVersion += 1;
    await user.save();

    res.json({
      success: true,
      message: "Logged out from all devices successfully.",
    });
  } catch (error) {
    console.error("Logout all devices error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Change password for logged-in user
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Get user from database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Check if new password is different from current password
    const isSamePassword = await user.comparePassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password",
      });
    }

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;

    // Increment token version to invalidate all existing tokens
    user.tokenVersion += 1;

    await user.save();

    res.json({
      success: true,
      message:
        "Password changed successfully. Please login again with your new password.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  register,
  verifyOTP,
  resendOTP,
  login,
  logout,
  logoutAllDevices,
  changePassword,
  forgotPassword,
  resetPassword,
  sendVerificationOTP,
};
