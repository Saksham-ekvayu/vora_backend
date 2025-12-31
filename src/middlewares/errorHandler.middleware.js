// Global error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  console.error("Global error handler:", err);

  // Handle multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File size too large. Maximum allowed size is 30MB.",
      field: "document",
    });
  }

  if (err.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({
      success: false,
      message: err.message,
      field: "document",
    });
  }

  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      success: false,
      message: "Only 1 document can be uploaded at a time.",
      field: "document",
    });
  }

  // Handle other multer errors
  if (err.name === "MulterError") {
    switch (err.code) {
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: "Unexpected file field. Use 'document' as the field name.",
          field: "document",
        });
      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          message: "Only 1 document can be uploaded at a time.",
          field: "document",
        });
      default:
        return res.status(400).json({
          success: false,
          message: "File upload error: " + err.message,
          field: "document",
        });
    }
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
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
