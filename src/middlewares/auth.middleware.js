const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
// const cacheService = require("../services/cache.service");

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Unauthorized!, You are not logged in. Please login and try again.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token - user not found",
      });
    }

    // Check if token version matches current user's token version
    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Token has been invalidated. Please login again.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please login again.",
        error: "TOKEN_EXPIRED",
        expiredAt: error.expiredAt,
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token format.",
      });
    }

    if (error.name === "NotBeforeError") {
      return res.status(401).json({
        success: false,
        message: "Token not active yet.",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token",
      error: "AUTHENTICATION_FAILED",
    });
  }
};

module.exports = { authenticateToken };
