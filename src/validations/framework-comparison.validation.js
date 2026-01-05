const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");

/**
 * Validation for starting framework comparison
 */
const startFrameworkComparisonValidation = [
  body("userFrameworkId")
    .notEmpty()
    .withMessage("User framework ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid user framework ID format");
      }
      return true;
    }),

  body("expertFrameworkId")
    .notEmpty()
    .withMessage("Expert framework ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid expert framework ID format");
      }
      return true;
    }),
];

/**
 * Validation for getting framework comparison by ID
 */
const getFrameworkComparisonByIdValidation = [
  param("frameworkComparisonId")
    .notEmpty()
    .withMessage("Framework comparison ID is required")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Invalid framework comparison ID format");
      }
      return true;
    }),
];

/**
 * Validation for framework comparison history query parameters
 */
const getFrameworkComparisonHistoryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("status")
    .optional()
    .isIn(["pending", "in-process", "completed", "error", "done"])
    .withMessage(
      "Status must be one of: pending, in-process, completed, error, done"
    ),
];

module.exports = {
  startFrameworkComparisonValidation,
  getFrameworkComparisonByIdValidation,
  getFrameworkComparisonHistoryValidation,
};
