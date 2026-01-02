const {
  cacheOperations,
  generateCacheKey,
  CACHE_TTL,
} = require("../config/cache.config");

// Generic cache middleware for Redis-only
const cacheMiddleware = (
  keyPrefix,
  ttl = CACHE_TTL.MEDIUM,
  keyGenerator = null
) => {
  return async (req, res, next) => {
    try {
      // Generate cache key
      let cacheKey;
      if (keyGenerator && typeof keyGenerator === "function") {
        cacheKey = keyGenerator(req);
      } else {
        // Default key generation based on URL and query params
        const queryString =
          Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : "";
        cacheKey = generateCacheKey(keyPrefix, req.originalUrl, queryString);
      }

      // Try to get from Redis cache
      try {
        const cachedData = await cacheOperations.get(cacheKey);

        if (cachedData) {
          // Add cache hit header
          res.set("X-Cache", "HIT");
          res.set("X-Cache-Source", "Redis");
          return res.status(200).json(cachedData);
        }
      } catch (cacheError) {
        console.error("Cache read error:", cacheError.message);
        // Continue to controller if cache read fails
      }

      // Cache miss - continue to controller
      res.set("X-Cache", "MISS");
      res.set("X-Cache-Source", "Redis");

      // Store original json method
      const originalJson = res.json;

      // Override json method to cache the response
      res.json = function (data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data && data.success) {
          cacheOperations.set(cacheKey, data, ttl).catch((err) => {
            console.error("Failed to cache response:", err.message);
          });
        }

        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error("Cache middleware error:", error);
      // Continue without caching on error
      next();
    }
  };
};

// Specific cache middleware for different endpoints
const frameworkListCache = cacheMiddleware(
  "framework_list",
  CACHE_TTL.MEDIUM,
  (req) => {
    const {
      page = 1,
      limit = 10,
      search = "",
      frameworkType = "",
      uploadedBy = "",
      sort = "",
    } = req.query;
    return generateCacheKey(
      "framework_list",
      page,
      limit,
      search,
      frameworkType,
      uploadedBy,
      sort
    );
  }
);

const documentListCache = cacheMiddleware(
  "document_list",
  CACHE_TTL.MEDIUM,
  (req) => {
    const {
      page = 1,
      limit = 10,
      search = "",
      documentType = "",
      uploadedBy = "",
      sort = "",
    } = req.query;
    return generateCacheKey(
      "document_list",
      page,
      limit,
      search,
      documentType,
      uploadedBy,
      sort
    );
  }
);

const userFrameworksCache = cacheMiddleware(
  "user_frameworks",
  CACHE_TTL.SHORT,
  (req) => {
    const userId = req.user ? req.user._id : "anonymous";
    const { page = 1, limit = 10, sort = "" } = req.query;
    return generateCacheKey("user_frameworks", userId, page, limit, sort);
  }
);

const userDocumentsCache = cacheMiddleware(
  "user_documents",
  CACHE_TTL.SHORT,
  (req) => {
    const userId = req.user ? req.user._id : "anonymous";
    const { page = 1, limit = 10, sort = "" } = req.query;
    return generateCacheKey("user_documents", userId, page, limit, sort);
  }
);

const frameworkByIdCache = cacheMiddleware(
  "framework_by_id",
  CACHE_TTL.LONG,
  (req) => {
    return generateCacheKey("framework", req.params.id);
  }
);

const documentByIdCache = cacheMiddleware(
  "document_by_id",
  CACHE_TTL.LONG,
  (req) => {
    return generateCacheKey("document", req.params.id);
  }
);

const userByIdCache = cacheMiddleware("user_by_id", CACHE_TTL.LONG, (req) => {
  return generateCacheKey("user", req.params.id);
});

// Cache invalidation helpers for Redis
const invalidateCache = {
  // Invalidate framework-related caches
  async frameworks(userId = null) {
    try {
      const patterns = ["vora:framework_list:*", "vora:framework_stats:*"];

      if (userId) {
        patterns.push(`vora:user_frameworks:${userId}:*`);
      } else {
        patterns.push("vora:user_frameworks:*");
      }

      for (const pattern of patterns) {
        await cacheOperations.clearPattern(pattern);
      }
      console.log("✅ Framework caches invalidated");
    } catch (error) {
      console.error("❌ Failed to invalidate framework caches:", error.message);
    }
  },

  // Invalidate document-related caches
  async documents(userId = null) {
    try {
      const patterns = ["vora:document_list:*", "vora:document_stats:*"];

      if (userId) {
        patterns.push(`vora:user_documents:${userId}:*`);
      } else {
        patterns.push("vora:user_documents:*");
      }

      for (const pattern of patterns) {
        await cacheOperations.clearPattern(pattern);
      }
      console.log("✅ Document caches invalidated");
    } catch (error) {
      console.error("❌ Failed to invalidate document caches:", error.message);
    }
  },

  // Invalidate specific framework
  async framework(frameworkId) {
    try {
      await cacheOperations.del(generateCacheKey("framework", frameworkId));
      // Also invalidate list caches as they might contain this framework
      await this.frameworks();
      console.log(`✅ Framework ${frameworkId} cache invalidated`);
    } catch (error) {
      console.error(
        `❌ Failed to invalidate framework ${frameworkId} cache:`,
        error.message
      );
    }
  },

  // Invalidate specific document
  async document(documentId) {
    try {
      await cacheOperations.del(generateCacheKey("document", documentId));
      // Also invalidate list caches as they might contain this document
      await this.documents();
      console.log(`✅ Document ${documentId} cache invalidated`);
    } catch (error) {
      console.error(
        `❌ Failed to invalidate document ${documentId} cache:`,
        error.message
      );
    }
  },

  // Invalidate user-related caches
  async user(userId) {
    try {
      await cacheOperations.del(generateCacheKey("user", userId));
      await cacheOperations.clearPattern(`vora:user_frameworks:${userId}:*`);
      await cacheOperations.clearPattern(`vora:user_documents:${userId}:*`);
      console.log(`✅ User ${userId} caches invalidated`);
    } catch (error) {
      console.error(
        `❌ Failed to invalidate user ${userId} caches:`,
        error.message
      );
    }
  },

  // Clear all caches
  async all() {
    try {
      await cacheOperations.flushAll();
      console.log("✅ All caches cleared");
    } catch (error) {
      console.error("❌ Failed to clear all caches:", error.message);
    }
  },
};

module.exports = {
  cacheMiddleware,
  frameworkListCache,
  documentListCache,
  userFrameworksCache,
  userDocumentsCache,
  frameworkByIdCache,
  documentByIdCache,
  userByIdCache,
  invalidateCache,
};
