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
 * Common pagination helper function
 * @param {Object} Model - Mongoose model to paginate
 * @param {Object} options - Pagination options
 * @param {number} options.page - Current page number (from query params)
 * @param {number} options.limit - Items per page (default: 10)
 * @param {Object} options.filter - MongoDB filter object (default: {})
 * @param {string} options.select - Fields to select (default: excludes password and otp)
 * @param {Object} options.sort - Sort object (default: {createdAt: -1})
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
    transform = null,
  } = options;

  const currentPage = parseInt(page) || 1;
  const itemsPerPage = parseInt(limit) || 10;
  const skip = (currentPage - 1) * itemsPerPage;

  // Get total count for pagination info
  const totalItems = await Model.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Get paginated data
  const data = await Model.find(filter)
    .select(select)
    .skip(skip)
    .limit(itemsPerPage)
    .sort(sort);

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

module.exports = {
  generateTempPassword,
  paginate,
};
