const express = require("express");
const { authenticateToken } = require("../middlewares/auth.middleware");
const { profileUpdateValidation } = require("../middlewares/validation");
const { getUserById, editProfile } = require("../controllers/user.controller");

const router = express.Router();

// Protected routes
router.get("/user/:id", authenticateToken, getUserById);
router.put(
  "/profile/update",
  authenticateToken,
  profileUpdateValidation,
  editProfile
);

module.exports = router;
