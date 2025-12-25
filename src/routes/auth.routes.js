const express = require("express");
const {
  register,
  verifyOTP,
  resendOTP,
  login,
  forgotPassword,
  resetPassword,
} = require("../controllers/auth.controller");
const {
  registerValidation,
  otpValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  resendOtpValidation,
} = require("../middlewares/validation");

const router = express.Router();

// Public routes - validation middleware runs BEFORE controller
router.post("/register", registerValidation, register);
router.post("/verify-otp", otpValidation, verifyOTP);
router.post("/resend-otp", resendOtpValidation, resendOTP);
router.post("/login", loginValidation, login);
router.post("/forgot-password", forgotPasswordValidation, forgotPassword);
router.post("/reset-password", resetPasswordValidation, resetPassword);

module.exports = router;
