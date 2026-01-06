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
const documentNameValidator = () =>
  body("documentName")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Document name must be between 2 and 100 characters")
    .matches(/^[A-Za-z0-9\s\-_\.()]+$/)
    .withMessage(
      "Document name can only contain letters, numbers, spaces, hyphens, underscores, dots, and parentheses"
    )
    .custom((value) => {
      // Check for consecutive special characters
      if (/[-_\.]{2,}/.test(value)) {
        throw new Error(
          "Document name cannot contain consecutive special characters"
        );
      }
      // Check if name starts or ends with special characters
      if (/^[-_\.]|[-_\.]$/.test(value)) {
        throw new Error(
          "Document name cannot start or end with special characters"
        );
      }
      // Check for only spaces
      if (/^\s+$/.test(value)) {
        throw new Error("Document name cannot contain only spaces");
      }
      // Check for repeated characters (more than 4 consecutive same characters)
      if (/(.)\1{4,}/.test(value)) {
        throw new Error(
          "Document name cannot contain more than 4 consecutive identical characters"
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
      field: "document",
    });
  }
  next();
};

// Composite validators using reusable pieces (same pattern as user validation)
const documentUploadValidation = [
  documentNameValidator(),
  handleValidationErrors,
  fileUploadValidation,
];

// For other document operations, we still need Joi validators
const Joi = require("joi");

// Middleware to handle Joi validation errors (for other document operations)
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
const documentTypeValidator = () =>
  Joi.string().valid("pdf", "doc", "docx", "xls", "xlsx").required().messages({
    "any.only": "Document type must be one of: pdf, doc, docx, xls, xlsx",
    "any.required": "Document type is required",
  });

const documentIdValidator = () =>
  Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Document ID must be a valid MongoDB ObjectId",
      "any.required": "Document ID is required",
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
      "documentName",
      "-documentName",
      "fileSize",
      "-fileSize"
    )
    .default("-createdAt")
    .messages({
      "any.only":
        "Sort must be one of: createdAt, -createdAt, documentName, -documentName, fileSize, -fileSize",
    });

const searchValidator = () =>
  Joi.string().trim().min(1).max(100).optional().messages({
    "string.min": "Search term must be at least 1 character long",
    "string.max": "Search term cannot exceed 100 characters",
  });

// Composite validation schemas
const updateDocumentSchema = Joi.object({
  documentName: Joi.string()
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
      "string.min": "Document name must be at least 2 characters long",
      "string.max": "Document name cannot exceed 100 characters",
      "string.pattern.base":
        "Document name can only contain letters, numbers, spaces, hyphens, underscores, dots, and parentheses",
      "string.consecutiveSpecial":
        "Document name cannot contain consecutive special characters",
      "string.specialBoundary":
        "Document name cannot start or end with special characters",
      "string.onlySpaces": "Document name cannot contain only spaces",
      "string.repeatedChars":
        "Document name cannot contain more than 4 consecutive identical characters",
    }),
  documentType: documentTypeValidator().optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const getDocumentByIdSchema = Joi.object({
  id: documentIdValidator(),
});

const deleteDocumentSchema = Joi.object({
  id: documentIdValidator(),
});

const getDocumentsQuerySchema = Joi.object({
  page: pageValidator(),
  limit: limitValidator(),
  sort: sortValidator(),
  search: searchValidator(),
  documentType: Joi.string()
    .valid("pdf", "doc", "docx", "xls", "xlsx")
    .optional(),
  uploadedBy: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional(),
});

// File upload validation middleware (runs AFTER multer has parsed the form data)
// Validation middleware functions
const updateDocumentValidation =
  handleJoiValidationErrors(updateDocumentSchema);
const getDocumentByIdValidation = (req, res, next) => {
  const { error } = getDocumentByIdSchema.validate({ id: req.params.id });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
      field: "id",
    });
  }
  next();
};
const deleteDocumentValidation = (req, res, next) => {
  const { error } = deleteDocumentSchema.validate({ id: req.params.id });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
      field: "id",
    });
  }
  next();
};
const getDocumentsQueryValidation = (req, res, next) => {
  const { error } = getDocumentsQuerySchema.validate(req.query);
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
  documentNameValidator,
  handleValidationErrors,
  fileUploadValidation,

  // composite validators (same pattern as user validation)
  documentUploadValidation,

  // Joi-based validators (for other operations)
  documentTypeValidator,
  documentIdValidator,
  pageValidator,
  limitValidator,
  sortValidator,
  searchValidator,
  handleJoiValidationErrors,
  updateDocumentValidation,
  getDocumentByIdValidation,
  deleteDocumentValidation,
  getDocumentsQueryValidation,

  // Schemas (exported for testing or custom usage)
  updateDocumentSchema,
  getDocumentByIdSchema,
  deleteDocumentSchema,
  getDocumentsQuerySchema,
};
