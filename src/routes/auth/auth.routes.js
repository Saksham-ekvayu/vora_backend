const express = require("express");
const {
  register,
  verifyOTP,
  resendOTP,
  login,
  logout,
  forgotPassword,
  resetPassword,
  sendVerificationOTP,
} = require("../../controllers/auth/auth.controller");
const {
  registerValidation,
  otpValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  resendOtpValidation,
  sendVerificationOTPValidation,
} = require("../../validations/user.validation");
const { authenticateToken } = require("../../middlewares/auth.middleware");

const router = express.Router();

// Public routes - validation middleware runs BEFORE controller
router.post("/register", registerValidation, register);
router.post("/verify-otp", otpValidation, verifyOTP);
router.post("/resend-otp", resendOtpValidation, resendOTP);
router.post("/login", loginValidation, login);
router.post("/forgot-password", forgotPasswordValidation, forgotPassword);
router.post("/reset-password", resetPasswordValidation, resetPassword);
router.post(
  "/verify-email",
  sendVerificationOTPValidation,
  sendVerificationOTP
);

// Protected routes - require authentication
router.post("/logout", authenticateToken, logout);

module.exports = router;
