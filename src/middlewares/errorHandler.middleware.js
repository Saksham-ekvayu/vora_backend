const { bgRed } = require("colorette");

// Global error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  console.log(bgRed("Global error handler:"), err);

  // Handle validation errors from express-validator
  if (
    err.name === "ValidationError" ||
    (err.errors && Array.isArray(err.errors))
  ) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.errors || [{ msg: err.message }],
    });
  }

  // Handle MongoDB duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json({
      success: false,
      message: `${
        field.charAt(0).toUpperCase() + field.slice(1)
      } already exists`,
      field: field,
    });
  }

  // Handle MongoDB cast errors (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
      field: err.path,
    });
  }

  // Handle custom file type errors
  if (err.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({
      success: false,
      message: err.message,
      field: "document",
    });
  }

  // Handle multer errors
  if (err.name === "MulterError" || err.code?.startsWith("LIMIT_")) {
    return handleMulterError(err, res);
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
};

// Helper function to handle multer errors
const handleMulterError = (err, res) => {
  const errorCode = err.code;

  switch (errorCode) {
    case "LIMIT_FILE_SIZE":
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum allowed size is 30MB.",
        field: "document",
      });

    case "LIMIT_UNEXPECTED_FILE":
      return res.status(400).json({
        success: false,
        message:
          "Only 1 document can be uploaded at a time. Please select a single file.",
        field: "document",
      });

    case "LIMIT_PART_COUNT":
      return res.status(400).json({
        success: false,
        message: "Too many form fields. Please reduce the number of fields.",
        field: "document",
      });

    case "LIMIT_FIELD_KEY":
      return res.status(400).json({
        success: false,
        message: "Field name too long.",
        field: "document",
      });

    case "LIMIT_FIELD_VALUE":
      return res.status(400).json({
        success: false,
        message: "Field value too long.",
        field: "document",
      });

    case "LIMIT_FIELD_COUNT":
      return res.status(400).json({
        success: false,
        message: "Too many fields in the form.",
        field: "document",
      });

    default:
      return res.status(400).json({
        success: false,
        message: `File upload error: ${err.message || "Unknown multer error"}`,
        field: "document",
      });
  }
};

// 404 handler for undefined routes
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
};

module.exports = {
  globalErrorHandler,
  notFoundHandler,
};
