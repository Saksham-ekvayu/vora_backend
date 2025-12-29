const express = require("express");
const { authenticateToken } = require("../middlewares/auth.middleware");
const {
  profileUpdateValidation,
  createUserValidation,
} = require("../middlewares/validation");
const {
  getUserById,
  editProfile,
  getAllUsers,
  deleteUser,
  createUserByAdmin,
} = require("../controllers/user.controller");

const router = express.Router();

router.get("/all-users", authenticateToken, getAllUsers);
router.post(
  "/create",
  authenticateToken,
  createUserValidation,
  createUserByAdmin
);
router.delete("/:id", authenticateToken, deleteUser);
router.get("/:id", authenticateToken, getUserById);
router.put(
  "/profile/update",
  authenticateToken,
  profileUpdateValidation,
  editProfile
);

module.exports = router;
