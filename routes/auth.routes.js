const express = require("express");
const {
  register,
  verifyOTP,
  resendOTP,
  login,
  forgotPassword,
  resetPassword,
  verifyForgotPasswordOTP,
} = require("../controllers/auth.controller");
const {
  registerValidation,
  otpValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} = require("../middlewares/validation");

const router = express.Router();

// Public routes
router.post("/register", registerValidation, register);
router.post("/verify-otp", otpValidation, verifyOTP);
router.post("/resend-otp", otpValidation, resendOTP);
router.post("/login", loginValidation, login);
router.post("/forgot-password", forgotPasswordValidation, forgotPassword);
router.post("/verify-forgot-otp", otpValidation, verifyForgotPasswordOTP);
router.post("/reset-password", resetPasswordValidation, resetPassword);

module.exports = router;
