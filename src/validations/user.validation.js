const { body, validationResult } = require("express-validator");

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return the first validation error message
    const firstError = errors.array()[0];
    return res.status(400).json({
      success: false,
      message: firstError.msg,
      field: firstError.path,
      value: firstError.value,
    });
  }
  next();
};

const nameValidator = () =>
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .matches(/^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/)
    .withMessage(
      "Name can only contain letters, spaces, hyphens, and apostrophes"
    );

const emailValidator = () =>
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email, Ex: john@gmail.com");

const roleValidator = () =>
  body("role")
    .trim()
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["admin", "expert", "user"])
    .withMessage("Role must be one of: admin, expert, user");

const passwordValidator = (field = "password") =>
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
    );

const phoneCustomValidator = (required = true) => {
  const baseChain = body("phone")
    .trim()
    .custom((value) => {
      const cleanPhone = value.replace(/[\s\-\(\)\+]/g, "");

      if (!/^\d+$/.test(cleanPhone)) {
        throw new Error("Phone number must contain only digits");
      }

      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        throw new Error("Phone number must be between 10 and 15 digits");
      }

      if (/^(\d)\1+$/.test(cleanPhone)) {
        throw new Error("Phone number cannot contain repeated digits");
      }

      const isSequential = (str) => {
        for (let i = 0; i < str.length - 1; i++) {
          if (+str[i + 1] !== +str[i] + 1) return false;
        }
        return true;
      };

      if (isSequential(cleanPhone)) {
        throw new Error("Phone number cannot be sequential digits");
      }

      if (cleanPhone.startsWith("0")) {
        throw new Error("Phone number cannot start with 0");
      }

      return true;
    })
    .customSanitizer((value) => value.replace(/[\s\-\(\)\+]/g, ""));

  return required
    ? baseChain.notEmpty().withMessage("Phone number is required")
    : baseChain.optional({ checkFalsy: true });
};

const otpValidator = () =>
  body("otp")
    .trim()
    .notEmpty()
    .withMessage("OTP is required")
    .matches(/^\d{6}$/)
    .withMessage("OTP must be exactly 6 digits");

// Composite validators using reusable pieces
// *******************************************************************

const createUserValidation = [
  nameValidator(),
  emailValidator(),
  roleValidator(),
  // phone not required on create user
  phoneCustomValidator(false),
  handleValidationErrors,
];

const updateUserValidation = [
  nameValidator(),
  roleValidator(),
  // phone not required on create user
  phoneCustomValidator(false),
  handleValidationErrors,
];

const registerValidation = [
  nameValidator(),
  emailValidator(),
  passwordValidator(),
  // phone required on register
  phoneCustomValidator(true),
  handleValidationErrors,
];

const loginValidation = [
  emailValidator(),
  passwordValidator(),
  handleValidationErrors,
];

const otpValidation = [
  emailValidator(),
  otpValidator(),
  handleValidationErrors,
];
const sendVerificationOTPValidation = [
  emailValidator(),
  handleValidationErrors,
];

const profileUpdateValidation = [
  nameValidator(),
  emailValidator(),
  // phone required in profile update
  phoneCustomValidator(true),
  handleValidationErrors,
];

const forgotPasswordValidation = [emailValidator(), handleValidationErrors];

const resetPasswordValidation = [
  emailValidator(),
  otpValidator(),
  passwordValidator(),
  handleValidationErrors,
];

// Validation for resend OTP (only needs email)
const resendOtpValidation = [emailValidator(), handleValidationErrors];

// Change password validation
const changePasswordValidation = [
  body("currentPassword")
    .trim()
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .trim()
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters long")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/
    )
    .withMessage(
      "New password must be at least 8 characters long and include uppercase, lowercase, number, and special character"
    ),
  handleValidationErrors,
];

module.exports = {
  // atomic validators (exported in case needed elsewhere)
  nameValidator,
  emailValidator,
  roleValidator,
  passwordValidator,
  otpValidator,
  phoneCustomValidator,
  handleValidationErrors,
  // composite validators
  createUserValidation,
  updateUserValidation,
  registerValidation,
  loginValidation,
  otpValidation,
  sendVerificationOTPValidation,
  profileUpdateValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  resendOtpValidation,
  changePasswordValidation,
};
