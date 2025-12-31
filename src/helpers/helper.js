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
 * Enhanced pagination helper with built-in search support
 * @param {Object} Model - Mongoose model to paginate
 * @param {Object} options - Pagination and search options
 * @param {number} options.page - Current page number
 * @param {number} options.limit - Items per page
 * @param {string} options.search - Search term
 * @param {Array} options.searchFields - Fields to search in
 * @param {Object} options.filter - Additional MongoDB filter object
 * @param {string} options.select - Fields to select
 * @param {Object} options.sort - Sort object
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
    sort = { createdAt: -1 },
    populate = null,
    transform = null,
  } = options;

  // Build search filter
  const searchFilter = buildSearchFilter(search, searchFields, filter);

  // Use existing paginate function with search filter
  const result = await paginate(Model, {
    page,
    limit,
    filter: searchFilter,
    select,
    sort,
    populate,
    transform,
  });

  return {
    ...result,
    searchTerm: search || null,
    searchFields: searchFields.length > 0 ? searchFields : null,
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

module.exports = {
  generateTempPassword,
  paginate,
  buildSearchFilter,
  paginateWithSearch,
  getLocalIPv4,
};
