const { body, validationResult } = require("express-validator");

// Middleware to handle validation errors (same as user validation)
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

// Atomic validators (same pattern as user validation)
const frameworkNameValidator = () =>
  body("frameworkName")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Framework name must be between 2 and 100 characters")
    .matches(/^[A-Za-z0-9\s\-_\.()]+$/)
    .withMessage(
      "Framework name can only contain letters, numbers, spaces, hyphens, underscores, dots, and parentheses"
    )
    .custom((value) => {
      // Check for consecutive special characters
      if (/[-_\.]{2,}/.test(value)) {
        throw new Error(
          "Framework name cannot contain consecutive special characters"
        );
      }
      // Check if name starts or ends with special characters
      if (/^[-_\.]|[-_\.]$/.test(value)) {
        throw new Error(
          "Framework name cannot start or end with special characters"
        );
      }
      // Check for only spaces
      if (/^\s+$/.test(value)) {
        throw new Error("Framework name cannot contain only spaces");
      }
      // Check for repeated characters (more than 4 consecutive same characters)
      if (/(.)\1{4,}/.test(value)) {
        throw new Error(
          "Framework name cannot contain more than 4 consecutive identical characters"
        );
      }
      return true;
    });

// File upload validation middleware
const fileUploadValidation = (req, res, next) => {
  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded. Please select a file to upload.",
      field: "file",
    });
  }
  next();
};

// Composite validators using reusable pieces (same pattern as user validation)
const expertFrameworkUploadValidation = [
  frameworkNameValidator(),
  handleValidationErrors,
  fileUploadValidation,
];

// For other framework operations, we still need Joi validators
const Joi = require("joi");

// Middleware to handle Joi validation errors (for other framework operations)
const handleJoiValidationErrors = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const firstError = error.details[0];
      return res.status(400).json({
        success: false,
        message: firstError.message,
        field: firstError.path.join("."),
        value: firstError.context?.value,
      });
    }
    next();
  };
};

// Atomic validators (reusable Joi schema functions)
const frameworkTypeValidator = () =>
  Joi.string().valid("pdf", "doc", "docx", "xls", "xlsx").required().messages({
    "any.only": "Framework type must be one of: pdf, doc, docx, xls, xlsx",
    "any.required": "Framework type is required",
  });

const frameworkIdValidator = () =>
  Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Framework ID must be a valid MongoDB ObjectId",
      "any.required": "Framework ID is required",
    });

// Query parameter validators
const pageValidator = () =>
  Joi.number().integer().min(1).default(1).messages({
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  });

const limitValidator = () =>
  Joi.number().integer().min(1).max(100).default(10).messages({
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  });

const sortValidator = () =>
  Joi.string()
    .valid(
      "createdAt",
      "-createdAt",
      "frameworkName",
      "-frameworkName",
      "fileSize",
      "-fileSize"
    )
    .default("-createdAt")
    .messages({
      "any.only":
        "Sort must be one of: createdAt, -createdAt, frameworkName, -frameworkName, fileSize, -fileSize",
    });

const searchValidator = () =>
  Joi.string().trim().min(1).max(100).optional().messages({
    "string.min": "Search term must be at least 1 character long",
    "string.max": "Search term cannot exceed 100 characters",
  });

// Composite validation schemas
const updateExpertFrameworkSchema = Joi.object({
  frameworkName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[A-Za-z0-9\s\-_\.()]+$/)
    .custom((value, helpers) => {
      // Check for consecutive special characters
      if (/[-_\.]{2,}/.test(value)) {
        return helpers.error("string.consecutiveSpecial");
      }
      // Check if name starts or ends with special characters
      if (/^[-_\.]|[-_\.]$/.test(value)) {
        return helpers.error("string.specialBoundary");
      }
      // Check for only spaces
      if (/^\s+$/.test(value)) {
        return helpers.error("string.onlySpaces");
      }
      // Check for repeated characters (more than 4 consecutive same characters)
      if (/(.)\1{4,}/.test(value)) {
        return helpers.error("string.repeatedChars");
      }
      return value;
    })
    .optional()
    .messages({
      "string.min": "Framework name must be at least 2 characters long",
      "string.max": "Framework name cannot exceed 100 characters",
      "string.pattern.base":
        "Framework name can only contain letters, numbers, spaces, hyphens, underscores, dots, and parentheses",
      "string.consecutiveSpecial":
        "Framework name cannot contain consecutive special characters",
      "string.specialBoundary":
        "Framework name cannot start or end with special characters",
      "string.onlySpaces": "Framework name cannot contain only spaces",
      "string.repeatedChars":
        "Framework name cannot contain more than 4 consecutive identical characters",
    }),
  frameworkType: frameworkTypeValidator().optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const getExpertFrameworkByIdSchema = Joi.object({
  id: frameworkIdValidator(),
});

const deleteExpertFrameworkSchema = Joi.object({
  id: frameworkIdValidator(),
});

const getExpertFrameworksQuerySchema = Joi.object({
  page: pageValidator(),
  limit: limitValidator(),
  sort: sortValidator(),
  search: searchValidator(),
  frameworkType: Joi.string()
    .valid("pdf", "doc", "docx", "xls", "xlsx")
    .optional(),
  uploadedBy: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional(),
});

const uploadFrameworkToAISchema = Joi.object({
  frameworkId: frameworkIdValidator(),
});

// Special validation for AI upload that handles both JSON and form-data
const uploadFrameworkToAIValidation = (req, res, next) => {
  // Get frameworkId from body (handle case where body might be undefined)
  const frameworkId = req.body?.frameworkId;

  if (!frameworkId) {
    return res.status(400).json({
      success: false,
      message: "Framework ID is required",
      field: "frameworkId",
    });
  }

  const { error } = uploadFrameworkToAISchema.validate({ frameworkId });

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
      field: "frameworkId",
    });
  }

  // Ensure frameworkId is available in req.body for the controller
  req.body = req.body || {};
  req.body.frameworkId = frameworkId;

  next();
};

// File upload validation middleware (runs AFTER multer has parsed the form data)
// Validation middleware functions
const updateExpertFrameworkValidation = handleJoiValidationErrors(
  updateExpertFrameworkSchema
);
const getExpertFrameworkByIdValidation = (req, res, next) => {
  const { error } = getExpertFrameworkByIdSchema.validate({
    id: req.params.id,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
      field: "id",
    });
  }
  next();
};
const deleteExpertFrameworkValidation = (req, res, next) => {
  const { error } = deleteExpertFrameworkSchema.validate({ id: req.params.id });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
      field: "id",
    });
  }
  next();
};
const getExpertFrameworksQueryValidation = (req, res, next) => {
  const { error } = getExpertFrameworksQuerySchema.validate(req.query);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
      field: error.details[0].path.join("."),
    });
  }
  next();
};

module.exports = {
  // atomic validators (exported in case needed elsewhere)
  frameworkNameValidator,
  handleValidationErrors,
  fileUploadValidation,

  // composite validators (same pattern as user validation)
  expertFrameworkUploadValidation,

  // Joi-based validators (for other operations)
  frameworkTypeValidator,
  frameworkIdValidator,
  pageValidator,
  limitValidator,
  sortValidator,
  searchValidator,
  handleJoiValidationErrors,
  updateExpertFrameworkValidation,
  getExpertFrameworkByIdValidation,
  deleteExpertFrameworkValidation,
  getExpertFrameworksQueryValidation,

  // Schemas (exported for testing or custom usage)
  updateExpertFrameworkSchema,
  getExpertFrameworkByIdSchema,
  deleteExpertFrameworkSchema,
  getExpertFrameworksQuerySchema,
};
