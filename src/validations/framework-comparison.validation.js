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

module.exports = {
  startFrameworkComparisonValidation,
};
