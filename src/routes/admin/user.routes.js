const express = require("express");
const { authenticateToken } = require("../../middlewares/auth.middleware");
const {
  profileUpdateValidation,
  createUserValidation,
  updateUserValidation,
} = require("../../validations/user.validation");
const {
  getUserById,
  editProfile,
  getAllUsers,
  deleteUser,
  createUserByAdmin,
  updateUserByAdmin,
} = require("../../controllers/admin/user.controller");
// const { userByIdCache } = require("../../middlewares/cache.middleware");

const router = express.Router();

router.get("/all-users", authenticateToken, getAllUsers);
router.post(
  "/create",
  authenticateToken,
  createUserValidation,
  createUserByAdmin
);
router.put(
  "/update/:id",
  authenticateToken,
  updateUserValidation,
  updateUserByAdmin
);
router.delete("/:id", authenticateToken, deleteUser);
router.get("/:id", authenticateToken, /* userByIdCache, */ getUserById);
router.put(
  "/profile/update",
  authenticateToken,
  profileUpdateValidation,
  editProfile
);

module.exports = router;
