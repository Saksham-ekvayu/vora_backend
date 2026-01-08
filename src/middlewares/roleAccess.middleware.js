const roleAccess = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated (should be set by authenticateToken middleware)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized! User not authenticated.",
        });
      }

      // Check if user's role is in the allowed roles
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied! This action requires one of the following roles: ${allowedRoles.join(
            ", "
          )}. Your role: ${req.user.role}`,
        });
      }

      // User has the required role, proceed to next middleware
      next();
    } catch (error) {
      console.error("Role access error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during role verification",
      });
    }
  };
};

// Specific role middleware functions for common use cases
const adminOnly = roleAccess("admin");
const expertOnly = roleAccess("expert");
const adminOrExpert = roleAccess("admin", "expert");
const allRoles = roleAccess("admin", "expert", "user");

// Generic role middleware for user operations
const canUserCreate = roleAccess("user"); // Only users can create (documents, frameworks, etc.)
const canUserUpdate = roleAccess("user"); // Only users can update (documents, frameworks, etc.)
const canUserDelete = roleAccess("user"); // Only users can delete (documents, frameworks, etc.)
const canUserView = roleAccess("user"); // Only users can view (documents, frameworks, etc.)

// Generic role middleware for expert operations
const canExpertCreate = roleAccess("expert"); // Only experts can create (frameworks, etc.)
const canExpertUpdate = roleAccess("expert"); // Only experts can update (frameworks, etc.)
const canExpertDelete = roleAccess("expert"); // Only experts can delete (frameworks, etc.)
const canExpertView = roleAccess("expert"); // Only experts can view (frameworks, etc.)

module.exports = {
  roleAccess,
  adminOnly,
  expertOnly,
  adminOrExpert,
  allRoles,
  canUserCreate,
  canUserUpdate,
  canUserDelete,
  canUserView,
  canExpertCreate,
  canExpertUpdate,
  canExpertDelete,
  canExpertView,
};
