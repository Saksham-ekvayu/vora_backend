/**
 * Helper function to safely format uploadedBy user data
 * Handles cases where user might be deleted (null reference)
 */
const formatUploadedBy = (uploadedBy) => {
  if (!uploadedBy) {
    return {
      id: null,
      name: "Deleted User",
      email: "N/A",
      role: "N/A",
    };
  }

  return {
    id: uploadedBy._id,
    name: uploadedBy.name,
    email: uploadedBy.email,
    role: uploadedBy.role,
  };
};

module.exports = {
  formatUploadedBy,
};
