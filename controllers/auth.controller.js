const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { generateOTP, sendOTPEmail } = require("../services/email.service");

// Register user and send OTP
const register = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((error) => error.msg);
      return res.status(400).json({ message: errorMessages[0] });
    }

    const { name, email, password, phone } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
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
      return res.status(500).json({ message: "Error sending OTP email" });
    }

    res.status(201).json({
      message: "Registration successful. Please verify your email.",
      email: email,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Verify OTP
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Check if OTP exists and is valid
    if (!user.otp || !user.otp.code || !user.otp.expiresAt) {
      return res.status(400).json({ message: "No OTP found" });
    }

    // Check if OTP is expired
    if (user.otp.expiresAt < new Date()) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Verify OTP
    if (user.otp.code !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Update user verification status
    user.isEmailVerified = true;
    user.otp = undefined;
    await user.save();

    res.json({
      message: "Email verified successfully. Please login.",
      email: user.email,
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
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
      return res.status(500).json({ message: "Error sending OTP email" });
    }

    res.json({ message: "New OTP sent successfully" });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Login user
const login = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((error) => error.msg);
      return res.status(400).json({ message: errorMessages[0] });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res
        .status(400)
        .json({ message: "Please verify your email first" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({
      message: "Login successful",
      success: true,
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
    res.status(500).json({ message: "Server error" });
  }
};

const forgotPassword = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((error) => error.msg);
      return res.status(400).json({ message: errorMessages[0] });
    }

    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
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
      return res.status(500).json({ message: "Error sending OTP email" });
    }

    res.json({ message: "Password reset OTP sent to your email" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const verifyForgotPasswordOTP = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((error) => error.msg);
      return res.status(400).json({ message: errorMessages[0] });
    }

    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    if (!user.otp || !user.otp.code || !user.otp.expiresAt)
      return res.status(400).json({ message: "No OTP found" });

    // Ensure OTP was issued for password reset (if purpose stored)
    if (user.otp.purpose && user.otp.purpose !== "password_reset")
      return res.status(400).json({ message: "Invalid OTP purpose" });

    if (user.otp.expiresAt < new Date())
      return res.status(400).json({ message: "OTP has expired" });

    if (user.otp.code !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    // Mark OTP as verified for reset (so client can proceed to reset)
    user.otp.verified = true;
    await user.save();

    res.json({ message: "OTP verified. You can now reset your password." });
  } catch (error) {
    console.error("Verify forgot-password OTP error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Reset password using OTP
const resetPassword = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((error) => error.msg);
      return res.status(400).json({ message: errorMessages[0] });
    }

    const { email, otp, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    if (!user.otp || !user.otp.code || !user.otp.expiresAt)
      return res.status(400).json({ message: "No OTP found" });

    if (user.otp.purpose && user.otp.purpose !== "password_reset")
      return res.status(400).json({ message: "Invalid OTP purpose" });

    if (user.otp.expiresAt < new Date())
      return res.status(400).json({ message: "OTP has expired" });

    if (user.otp.code !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    // Set new password (assumes User model hashes password on save)
    user.password = password;
    user.otp = undefined;
    await user.save();

    res.json({
      message:
        "Password reset successful. Please login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  register,
  verifyOTP,
  resendOTP,
  login,
  forgotPassword,
  verifyForgotPasswordOTP,
  resetPassword,
};
