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
        field: firstError.path.join('.'),
        value: firstError.context?.value,
      });
    }
    next();
  };
};

// Atomic validators (reusable Joi schema functions)
const documentNameValidator = () => 
  Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Document name is required',
      'string.min': 'Document name must be at least 2 characters long',
      'string.max': 'Document name cannot exceed 100 characters',
      'any.required': 'Document name is required'
    });

const documentTypeValidator = () =>
  Joi.string()
    .valid('pdf', 'doc', 'docx', 'xls', 'xlsx')
    .required()
    .messages({
      'any.only': 'Document type must be one of: pdf, doc, docx, xls, xlsx',
      'any.required': 'Document type is required'
    });

const fileSizeValidator = () =>
  Joi.number()
    .positive()
    .max(10 * 1024 * 1024) // 10MB limit
    .required()
    .messages({
      'number.positive': 'File size must be a positive number',
      'number.max': 'File size cannot exceed 10MB',
      'any.required': 'File size is required'
    });

const originalFileNameValidator = () =>
  Joi.string()
    .trim()
    .min(1)
    .max(255)
    .required()
    .messages({
      'string.empty': 'Original file name is required',
      'string.max': 'Original file name cannot exceed 255 characters',
      'any.required': 'Original file name is required'
    });

const fileUrlValidator = () =>
  Joi.string()
    .trim()
    .uri()
    .required()
    .messages({
      'string.uri': 'File URL must be a valid URL',
      'string.empty': 'File URL is required',
      'any.required': 'File URL is required'
    });

const uploadedByValidator = () =>
  Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Uploaded by must be a valid MongoDB ObjectId',
      'any.required': 'Uploaded by user is required'
    });

const isActiveValidator = () =>
  Joi.boolean()
    .default(true)
    .messages({
      'boolean.base': 'isActive must be a boolean value'
    });

const documentIdValidator = () =>
  Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Document ID must be a valid MongoDB ObjectId',
      'any.required': 'Document ID is required'
    });

// Query parameter validators
const pageValidator = () =>
  Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    });

const limitValidator = () =>
  Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .messages({
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    });

const sortValidator = () =>
  Joi.string()
    .valid('createdAt', '-createdAt', 'documentName', '-documentName', 'fileSize', '-fileSize')
    .default('-createdAt')
    .messages({
      'any.only': 'Sort must be one of: createdAt, -createdAt, documentName, -documentName, fileSize, -fileSize'
    });

const searchValidator = () =>
  Joi.string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Search term must be at least 1 character long',
      'string.max': 'Search term cannot exceed 100 characters'
    });

// Composite validation schemas
const createDocumentSchema = Joi.object({
  documentName: documentNameValidator(),
  documentType: documentTypeValidator(),
  fileSize: fileSizeValidator(),
  originalFileName: originalFileNameValidator(),
  fileUrl: fileUrlValidator(),
  uploadedBy: uploadedByValidator(),
  isActive: isActiveValidator()
});

const updateDocumentSchema = Joi.object({
  documentName: documentNameValidator().optional(),
  documentType: documentTypeValidator().optional(),
  isActive: isActiveValidator()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

const getDocumentByIdSchema = Joi.object({
  id: documentIdValidator()
});

const deleteDocumentSchema = Joi.object({
  id: documentIdValidator()
});

const getDocumentsQuerySchema = Joi.object({
  page: pageValidator(),
  limit: limitValidator(),
  sort: sortValidator(),
  search: searchValidator(),
  documentType: Joi.string().valid('pdf', 'doc', 'docx', 'xls', 'xlsx').optional(),
  uploadedBy: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
});

// Validation middleware functions
const createDocumentValidation = handleJoiValidationErrors(createDocumentSchema);
const updateDocumentValidation = handleJoiValidationErrors(updateDocumentSchema);
const getDocumentByIdValidation = (req, res, next) => {
  const { error } = getDocumentByIdSchema.validate({ id: req.params.id });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
      field: 'id'
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
      field: 'id'
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
      field: error.details[0].path.join('.')
    });
  }
  next();
};

module.exports = {
  // Atomic validators (exported in case needed elsewhere)
  documentNameValidator,
  documentTypeValidator,
  fileSizeValidator,
  originalFileNameValidator,
  fileUrlValidator,
  uploadedByValidator,
  isActiveValidator,
  documentIdValidator,
  pageValidator,
  limitValidator,
  sortValidator,
  searchValidator,
  handleJoiValidationErrors,
  
  // Composite validation middleware
  createDocumentValidation,
  updateDocumentValidation,
  getDocumentByIdValidation,
  deleteDocumentValidation,
  getDocumentsQueryValidation,
  
  // Schemas (exported for testing or custom usage)
  createDocumentSchema,
  updateDocumentSchema,
  getDocumentByIdSchema,
  deleteDocumentSchema,
  getDocumentsQuerySchema
};