const os = require("os");

const generateTempPassword = (length = 12) => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const specials = "@$!%*#?&";
  const all = upper + lower + digits + specials;

  // guarantee one from each set
  let pwdChars = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    specials[Math.floor(Math.random() * specials.length)],
  ];

  for (let i = pwdChars.length; i < length; i++) {
    pwdChars.push(all[Math.floor(Math.random() * all.length)]);
  }

  // shuffle
  for (let i = pwdChars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pwdChars[i], pwdChars[j]] = [pwdChars[j], pwdChars[i]];
  }

  return pwdChars.join("");
};

/**
 * Build search filter for MongoDB queries
 * @param {string} searchTerm - Search term from query params
 * @param {Array} searchFields - Array of field names to search in
 * @param {Object} additionalFilters - Additional filters to combine with search
 * @returns {Object} MongoDB filter object
 */
const buildSearchFilter = (
  searchTerm,
  searchFields = [],
  additionalFilters = {}
) => {
  let filter = { ...additionalFilters };

  if (searchTerm && searchTerm.trim() && searchFields.length > 0) {
    const searchRegex = new RegExp(searchTerm.trim(), "i"); // case-insensitive search

    const searchConditions = searchFields.map((field) => ({
      [field]: searchRegex,
    }));

    // If there are additional filters, combine with $and
    if (Object.keys(additionalFilters).length > 0) {
      filter = {
        $and: [additionalFilters, { $or: searchConditions }],
      };
    } else {
      filter = { $or: searchConditions };
    }
  }

  return filter;
};

/**
 * Enhanced pagination helper with built-in search and sort support
 * @param {Object} Model - Mongoose model to paginate
 * @param {Object} options - Pagination and search options
 * @param {number} options.page - Current page number
 * @param {number} options.limit - Items per page
 * @param {string} options.search - Search term
 * @param {Array} options.searchFields - Fields to search in
 * @param {Object} options.filter - Additional MongoDB filter object
 * @param {string} options.select - Fields to select
 * @param {string} options.sort - Sort query string (e.g., "createdAt", "-frameworkName")
 * @param {Array} options.sortFields - Allowed fields for sorting
 * @param {string|Object} options.populate - Fields to populate (optional)
 * @param {Function} options.transform - Transform function for each document
 * @returns {Object} Paginated result with data and pagination info
 */
const paginateWithSearch = async (Model, options = {}) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    searchFields = [],
    filter = {},
    select = "-password -otp",
    sort = "",
    sortBy = "",
    sortOrder = "desc",
    sortFields = ["createdAt", "updatedAt"],
    allowedSortFields = ["createdAt", "updatedAt"],
    populate = null,
    transform = null,
  } = options;

  // Build search filter
  const searchFilter = buildSearchFilter(search, searchFields, filter);

  // Build sort object - prioritize sort parameter over sortBy/sortOrder
  let sortObj;
  const fieldsToUse =
    allowedSortFields.length > 0 ? allowedSortFields : sortFields;

  if (sort) {
    sortObj = buildSortObject(sort, fieldsToUse);
  } else if (sortBy) {
    sortObj = buildSortFromParams(sortBy, sortOrder, fieldsToUse);
  } else {
    sortObj = { createdAt: -1 }; // default
  }

  // Use existing paginate function with search filter and sort
  const result = await paginate(Model, {
    page,
    limit,
    filter: searchFilter,
    select,
    sort: sortObj,
    populate,
    transform,
  });

  return {
    ...result,
    searchTerm: search || null,
    searchFields: searchFields.length > 0 ? searchFields : null,
    sortField: sort || sortBy || null,
    sortOrder: sort ? null : sortOrder,
    allowedSortFields: fieldsToUse,
  };
};

/**
 * Common pagination helper function
 * @param {Object} Model - Mongoose model to paginate
 * @param {Object} options - Pagination options
 * @param {number} options.page - Current page number (from query params)
 * @param {number} options.limit - Items per page (default: 10)
 * @param {Object} options.filter - MongoDB filter object (default: {})
 * @param {string} options.select - Fields to select (default: excludes password and otp)
 * @param {Object} options.sort - Sort object (default: {createdAt: -1})
 * @param {string|Object} options.populate - Fields to populate (optional)
 * @param {Function} options.transform - Optional function to transform each document
 * @returns {Object} Paginated result with data and pagination info
 */
const paginate = async (Model, options = {}) => {
  const {
    page = 1,
    limit = 10,
    filter = {},
    select = "-password -otp",
    sort = { createdAt: -1 },
    populate = null,
    transform = null,
  } = options;

  const currentPage = parseInt(page) || 1;
  const itemsPerPage = parseInt(limit) || 10;
  const skip = (currentPage - 1) * itemsPerPage;

  // Get total count for pagination info
  const totalItems = await Model.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Build query
  let query = Model.find(filter)
    .select(select)
    .skip(skip)
    .limit(itemsPerPage)
    .sort(sort);

  // Add populate if specified
  if (populate) {
    query = query.populate(populate);
  }

  // Get paginated data
  const data = await query;

  // Transform data if transform function is provided
  const transformedData = transform ? data.map(transform) : data;

  return {
    data: transformedData,
    pagination: {
      currentPage,
      totalPages,
      totalItems,
      limit: itemsPerPage,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
  };
};

// Get Local IPv4
function getLocalIPv4() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address; // first non-internal IPv4
      }
    }
  }
  return "localhost";
}

/**
 * Format file size in bytes to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size (e.g., "1.5 MB", "256 KB")
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * Build sort object from query parameter with validation
 * @param {string} sortQuery - Sort query parameter (e.g., "createdAt", "-frameworkName")
 * @param {Array} allowedFields - Array of allowed field names for sorting
 * @param {Object} defaultSort - Default sort object if no valid sort provided
 * @returns {Object} MongoDB sort object
 */
const buildSortObject = (
  sortQuery,
  allowedFields = ["createdAt", "updatedAt"],
  defaultSort = { createdAt: -1 }
) => {
  if (!sortQuery || typeof sortQuery !== "string") {
    return defaultSort;
  }

  const sort = sortQuery.trim();

  if (sort.startsWith("-")) {
    const field = sort.substring(1);
    if (allowedFields.includes(field)) {
      return { [field]: -1 };
    }
  } else {
    if (allowedFields.includes(sort)) {
      return { [sort]: 1 };
    }
  }

  return defaultSort;
};

/**
 * Build sort object from separate sortBy and sortOrder parameters
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - Sort order ('asc' or 'desc')
 * @param {Array} allowedFields - Array of allowed field names for sorting
 * @param {Object} defaultSort - Default sort object if no valid sort provided
 * @returns {Object} MongoDB sort object
 */
const buildSortFromParams = (
  sortBy,
  sortOrder = "desc",
  allowedFields = ["createdAt", "updatedAt"],
  defaultSort = { createdAt: -1 }
) => {
  if (!sortBy || !allowedFields.includes(sortBy)) {
    return defaultSort;
  }

  const order = sortOrder === "asc" ? 1 : -1;
  return { [sortBy]: order };
};

// Helper function to format Ai Processing data
const formatAIProcessingData = (aiProcessing, includeControls = false) => {
  if (!aiProcessing?.uuid) return null;

  const baseData = {
    uuid: aiProcessing.uuid,
    status: aiProcessing.status,
    control_extraction_status: aiProcessing.control_extraction_status,
    processedAt: aiProcessing.processedAt,
    controlsExtractedAt: aiProcessing.controlsExtractedAt || null,
    errorMessage: aiProcessing.errorMessage || null,
    controlsCount: aiProcessing.controlsCount || 0,
  };

  // Include controls data if requested
  if (includeControls && aiProcessing.extractedControls?.length > 0) {
    baseData.extractedControls = aiProcessing.extractedControls;
  }

  return baseData;
};

// Helper function to format frameworkUploadedBy data
const formatFrameworkUploadedBy = (framework) => {
  if (framework.uploadedBy) {
    return {
      id: framework.uploadedBy._id,
      name: framework.uploadedBy.name,
      email: framework.uploadedBy.email,
      role: framework.uploadedBy.role,
      isUserDeleted: false,
    };
  } else if (framework.originalUploadedBy) {
    return {
      id: framework.originalUploadedBy.userId,
      name: framework.originalUploadedBy.name,
      email: framework.originalUploadedBy.email,
      role: framework.originalUploadedBy.role,
      isUserDeleted: true,
    };
  } else {
    return {
      id: null,
      name: "Deleted User",
      email: "N/A",
      role: "N/A",
      isUserDeleted: true,
    };
  }
};

// Helper function to format documentUploadedBy data
const formatDocumentUploadedBy = (document) => {
  if (document.uploadedBy) {
    return {
      id: document.uploadedBy._id,
      name: document.uploadedBy.name,
      email: document.uploadedBy.email,
      role: document.uploadedBy.role,
      isUserDeleted: false,
    };
  } else if (document.originalUploadedBy) {
    return {
      id: document.originalUploadedBy.userId,
      name: document.originalUploadedBy.name,
      email: document.originalUploadedBy.email,
      role: document.originalUploadedBy.role,
      isUserDeleted: true,
    };
  } else {
    return {
      id: null,
      name: "Deleted User",
      email: "N/A",
      role: "N/A",
      isUserDeleted: true,
    };
  }
};

module.exports = {
  generateTempPassword,
  paginate,
  buildSearchFilter,
  paginateWithSearch,
  buildSortObject,
  buildSortFromParams,
  getLocalIPv4,
  formatFileSize,
  formatAIProcessingData,
  formatFrameworkUploadedBy,
  formatDocumentUploadedBy,
};
