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
          message: `Access denied! This action requires one of the following roles: ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
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
const adminOnly = roleAccess('admin');
const expertOnly = roleAccess('expert');
const adminOrExpert = roleAccess('admin', 'expert');
const allRoles = roleAccess('admin', 'expert', 'user');

// Document-specific role middleware
const canCreateDocument = roleAccess('expert'); // Only experts can create documents
const canUpdateDocument = roleAccess('expert'); // Only experts can update documents
const canDeleteDocument = roleAccess('expert'); // Only experts can delete documents
const canViewDocument = roleAccess('admin', 'expert', 'user'); // Anyone can view documents

module.exports = {
  roleAccess,
  adminOnly,
  expertOnly,
  adminOrExpert,
  allRoles,
  canCreateDocument,
  canUpdateDocument,
  canDeleteDocument,
  canViewDocument,
};