const express = require("express");
const {
  register,
  verifyOTP,
  resendOTP,
  login,
} = require("../controllers/auth.controller");
const {
  registerValidation,
  otpValidation,
  loginValidation,
} = require("../middlewares/validation");


const router = express.Router();

// Public routes
router.post("/register", registerValidation, register);
router.post("/verify-otp", otpValidation, verifyOTP);
router.post("/resend-otp", otpValidation, resendOTP);
router.post("/login", loginValidation, login);



module.exports = router;
