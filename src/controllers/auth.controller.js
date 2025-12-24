const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { generateOTP, sendOTPEmail } = require("../services/email.service");

// Register user and send OTP
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if user already exists by email
    let user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({
          success: false,
          message: "User with this email already exists",
        });
    }

    // Check if user already exists by phone
    if (phone) {
      const phoneUser = await User.findOne({ phone });
      if (phoneUser) {
        return res
          .status(400)
          .json({
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

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

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

const verifyForgotPasswordOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "User not found" });

    if (!user.otp || !user.otp.code || !user.otp.expiresAt)
      return res.status(400).json({ success: false, message: "No OTP found" });

    // Ensure OTP was issued for password reset (if purpose stored)
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

    // Mark OTP as verified for reset (so client can proceed to reset)
    user.otp.verified = true;
    await user.save();

    res.json({
      success: true,
      message: "OTP verified. You can now reset your password.",
    });
  } catch (error) {
    console.error("Verify forgot-password OTP error:", error);
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

module.exports = {
  register,
  verifyOTP,
  resendOTP,
  login,
  forgotPassword,
  verifyForgotPasswordOTP,
  resetPassword,
};
