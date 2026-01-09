const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const { adminOnly } = require("../../middlewares/roleAccess.middleware");
const {
  profileUpdateValidation,
  createUserValidation,
  updateUserValidation,
  deleteUserValidation,
} = require("../../validations/user.validation");
const {
  getUserById,
  getUserStatistics,
  editProfile,
  getAllUsers,
  deleteUser,
  createUserByAdmin,
  updateUserByAdmin,
} = require("../../controllers/admin/user-management.controller");

const router = express.Router();

router.get("/all-users", authenticateToken, adminOnly, getAllUsers);
router.post(
  "/create",
  authenticateToken,
  adminOnly,
  createUserValidation,
  createUserByAdmin
);
router.put(
  "/update/:id",
  authenticateToken,
  adminOnly,
  updateUserValidation,
  updateUserByAdmin
);
router.delete(
  "/:id",
  authenticateToken,
  adminOnly,
  deleteUserValidation,
  deleteUser
);
router.get("/:id/statistics", authenticateToken, adminOnly, getUserStatistics);
router.get("/:id", authenticateToken, adminOnly, getUserById);
router.put(
  "/profile/update",
  authenticateToken,
  profileUpdateValidation,
  editProfile
);

module.exports = router;
