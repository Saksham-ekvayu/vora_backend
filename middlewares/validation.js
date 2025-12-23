const { body, validationResult } = require("express-validator");

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return the first validation error message
    const firstError = errors.array()[0];
    return res.status(400).json({
      message: firstError.msg,
      field: firstError.path,
      value: firstError.value,
    });
  }
  next();
};

const registerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .matches(/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/)
    .withMessage(
      "Name can only contain letters, spaces, hyphens, and apostrophes"
    ),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email, Ex: john@gmail.com"),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/
    )
    .withMessage(
      "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
    ),
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .custom((value) => {
      const cleanPhone = value.replace(/[\s\-\(\)\+]/g, "");

      // Only digits
      if (!/^\d+$/.test(cleanPhone)) {
        throw new Error("Phone number must contain only digits");
      }

      // Length check
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        throw new Error("Phone number must be between 10 and 15 digits");
      }

      // All same digits
      if (/^(\d)\1+$/.test(cleanPhone)) {
        throw new Error("Phone number cannot contain repeated digits");
      }

      // Sequential digits
      const isSequential = (str) => {
        for (let i = 0; i < str.length - 1; i++) {
          if (Number(str[i + 1]) !== Number(str[i]) + 1) {
            return false;
          }
        }
        return true;
      };

      if (isSequential(cleanPhone)) {
        throw new Error("Phone number cannot be sequential digits");
      }

      // Leading zero
      if (cleanPhone.startsWith("0")) {
        throw new Error("Phone number cannot start with 0");
      }

      return true;
    })
    .customSanitizer((value) => {
      return value.replace(/[\s\-\(\)\+]/g, "");
    }),
  handleValidationErrors,
];

const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email, Ex: john@gmail.com"),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/
    )
    .withMessage(
      "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
    ),
  handleValidationErrors,
];

const otpValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email, Ex: john@gmail.com"),
  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .matches(/^\d{6}$/)
    .withMessage("OTP must be exactly 6 digits"),
  handleValidationErrors,
];

const profileUpdateValidation = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters long"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email, Ex: john@gmail.com"),
  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Phone number is required")
    .custom((value) => {
      const cleanPhone = value.replace(/[\s\-\(\)\+]/g, "");

      // Only digits
      if (!/^\d+$/.test(cleanPhone)) {
        throw new Error("Phone number must contain only digits");
      }

      // Length check
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        throw new Error("Phone number must be between 10 and 15 digits");
      }

      // All same digits
      if (/^(\d)\1+$/.test(cleanPhone)) {
        throw new Error("Phone number cannot contain repeated digits");
      }

      // Sequential digits
      const isSequential = (str) => {
        for (let i = 0; i < str.length - 1; i++) {
          if (Number(str[i + 1]) !== Number(str[i]) + 1) {
            return false;
          }
        }
        return true;
      };

      if (isSequential(cleanPhone)) {
        throw new Error("Phone number cannot be sequential digits");
      }

      // Leading zero
      if (cleanPhone.startsWith("0")) {
        throw new Error("Phone number cannot start with 0");
      }

      return true;
    })
    .customSanitizer((value) => {
      return value.replace(/[\s\-\(\)\+]/g, "");
    }),
  handleValidationErrors,
];

const forgotPasswordValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email, Ex: john@gmail.com"),
  handleValidationErrors,
];

const resetPasswordValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email, Ex: john@gmail.com"),
  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP must be 6 digits")
    .isNumeric()
    .withMessage("OTP must contain only numbers"),
  body("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/
    )
    .withMessage(
      "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
    ),
  handleValidationErrors,
];

// Validation for resend OTP (only needs email)
const resendOtpValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email, Ex: john@gmail.com"),
  handleValidationErrors,
];

module.exports = {
  registerValidation,
  loginValidation,
  otpValidation,
  profileUpdateValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  resendOtpValidation,
  handleValidationErrors,
};
