const Joi = require("joi");

// Middleware to handle Joi validation errors
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
const documentNameValidator = () =>
  Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Document name is required",
    "string.min": "Document name must be at least 2 characters long",
    "string.max": "Document name cannot exceed 100 characters",
    "any.required": "Document name is required",
  });

const documentTypeValidator = () =>
  Joi.string().valid("pdf", "doc", "docx", "xls", "xlsx").required().messages({
    "any.only": "Document type must be one of: pdf, doc, docx, xls, xlsx",
    "any.required": "Document type is required",
  });

const isActiveValidator = () =>
  Joi.boolean().default(true).messages({
    "boolean.base": "isActive must be a boolean value",
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
  documentName: documentNameValidator().optional(),
  documentType: documentTypeValidator().optional(),
  isActive: isActiveValidator(),
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
const fileUploadValidation = (req, res, next) => {
  // Validate document name if provided
  if (req.body && req.body.documentName) {
    const { error } = Joi.object({
      documentName: documentNameValidator(),
    }).validate({ documentName: req.body.documentName });

    if (error) {
      // If validation fails, clean up the uploaded file
      if (req.file && req.file.path) {
        try {
          const fs = require("fs");
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
        } catch (cleanupError) {
          console.error(
            "Error cleaning up file after validation failure:",
            cleanupError
          );
        }
      }

      return res.status(400).json({
        success: false,
        message: error.details[0].message,
        field: "documentName",
      });
    }
  }

  next();
};

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
  // Atomic validators (exported in case needed elsewhere)
  documentNameValidator,
  documentTypeValidator,
  isActiveValidator,
  documentIdValidator,
  pageValidator,
  limitValidator,
  sortValidator,
  searchValidator,
  handleJoiValidationErrors,

  // Composite validation middleware
  updateDocumentValidation,
  getDocumentByIdValidation,
  deleteDocumentValidation,
  getDocumentsQueryValidation,
  fileUploadValidation,

  // Schemas (exported for testing or custom usage)
  updateDocumentSchema,
  getDocumentByIdSchema,
  deleteDocumentSchema,
  getDocumentsQuerySchema,
};
