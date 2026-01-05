const {
  cacheOperations,
  generateCacheKey,
  CACHE_KEYS,
  CACHE_TTL,
} = require("../config/cache.config");
const User = require("../models/user.model");
const UserFramework = require("../models/user-framework.model");
const UserDocument = require("../models/user-document.model");

class CacheService {
  // User caching methods
  async getUserById(userId) {
    const cacheKey = generateCacheKey(CACHE_KEYS.USER, userId);

    try {
      let user = await cacheOperations.get(cacheKey);
      if (user) {
        return user;
      }
    } catch (error) {
      console.error(`Failed to get user ${userId} from cache:`, error.message);
    }

    // Fetch from database
    const user = await User.findById(userId).select("-password -otp").lean();
    if (user) {
      try {
        await cacheOperations.set(cacheKey, user, CACHE_TTL.LONG);
      } catch (error) {
        console.error(`Failed to cache user ${userId}:`, error.message);
      }
    }

    return user;
  }

  async cacheUser(user) {
    const cacheKey = generateCacheKey(CACHE_KEYS.USER, user._id);
    const userToCache = { ...user };
    delete userToCache.password;
    delete userToCache.otp;

    try {
      await cacheOperations.set(cacheKey, userToCache, CACHE_TTL.LONG);
    } catch (error) {
      console.error(`Failed to cache user ${user._id}:`, error.message);
    }
  }

  // Framework caching methods
  async getFrameworkById(frameworkId) {
    const cacheKey = generateCacheKey(CACHE_KEYS.FRAMEWORK, frameworkId);

    try {
      let framework = await cacheOperations.get(cacheKey);
      if (framework) {
        return framework;
      }
    } catch (error) {
      console.error(
        `Failed to get framework ${frameworkId} from cache:`,
        error.message
      );
    }

    // Fetch from database
    const framework = await UserFramework.findOne({
      _id: frameworkId,
      isActive: true,
    })
      .populate("uploadedBy", "name email role")
      .lean();

    if (framework) {
      try {
        await cacheOperations.set(cacheKey, framework, CACHE_TTL.LONG);
      } catch (error) {
        console.error(
          `Failed to cache framework ${frameworkId}:`,
          error.message
        );
      }
    }

    return framework;
  }

  async cacheFramework(framework) {
    const cacheKey = generateCacheKey(CACHE_KEYS.FRAMEWORK, framework._id);
    try {
      await cacheOperations.set(cacheKey, framework, CACHE_TTL.LONG);
    } catch (error) {
      console.error(
        `Failed to cache framework ${framework._id}:`,
        error.message
      );
    }
  }

  // Document caching methods
  async getDocumentById(documentId) {
    const cacheKey = generateCacheKey(CACHE_KEYS.DOCUMENT, documentId);

    try {
      let document = await cacheOperations.get(cacheKey);
      if (document) {
        return document;
      }
    } catch (error) {
      console.error(
        `Failed to get document ${documentId} from cache:`,
        error.message
      );
    }

    // Fetch from database
    const document = await UserDocument.findOne({
      _id: documentId,
      isActive: true,
    })
      .populate("uploadedBy", "name email role")
      .lean();

    if (document) {
      try {
        await cacheOperations.set(cacheKey, document, CACHE_TTL.LONG);
      } catch (error) {
        console.error(`Failed to cache document ${documentId}:`, error.message);
      }
    }

    return document;
  }

  async cacheDocument(document) {
    const cacheKey = generateCacheKey(CACHE_KEYS.DOCUMENT, document._id);
    try {
      await cacheOperations.set(cacheKey, document, CACHE_TTL.LONG);
    } catch (error) {
      console.error(`Failed to cache document ${document._id}:`, error.message);
    }
  }

  // Statistics caching
  async getFrameworkStats() {
    const cacheKey = generateCacheKey(CACHE_KEYS.FRAMEWORK_STATS);

    try {
      let stats = await cacheOperations.get(cacheKey);
      if (stats) {
        return stats;
      }
    } catch (error) {
      console.error("Failed to get framework stats from cache:", error.message);
    }

    // Calculate stats from database
    const [totalFrameworks, activeFrameworks, frameworksByType] =
      await Promise.all([
        UserFramework.countDocuments(),
        UserFramework.countDocuments({ isActive: true }),
        UserFramework.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: "$frameworkType", count: { $sum: 1 } } },
        ]),
      ]);

    const stats = {
      total: totalFrameworks,
      active: activeFrameworks,
      byType: frameworksByType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      lastUpdated: new Date(),
    };

    try {
      await cacheOperations.set(cacheKey, stats, CACHE_TTL.MEDIUM);
    } catch (error) {
      console.error("Failed to cache framework stats:", error.message);
    }

    return stats;
  }

  async getDocumentStats() {
    const cacheKey = generateCacheKey(CACHE_KEYS.DOCUMENT_STATS);

    try {
      let stats = await cacheOperations.get(cacheKey);
      if (stats) {
        return stats;
      }
    } catch (error) {
      console.error("Failed to get document stats from cache:", error.message);
    }

    // Calculate stats from database
    const [totalDocuments, activeDocuments, documentsByType] =
      await Promise.all([
        UserDocument.countDocuments(),
        UserDocument.countDocuments({ isActive: true }),
        UserDocument.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: "$documentType", count: { $sum: 1 } } },
        ]),
      ]);

    const stats = {
      total: totalDocuments,
      active: activeDocuments,
      byType: documentsByType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      lastUpdated: new Date(),
    };

    try {
      await cacheOperations.set(cacheKey, stats, CACHE_TTL.MEDIUM);
    } catch (error) {
      console.error("Failed to cache document stats:", error.message);
    }

    return stats;
  }

  // Bulk caching operations
  async warmupCache() {
    try {
      console.log("🔥 Starting Redis cache warmup...");

      // Cache recent frameworks
      const recentFrameworks = await UserFramework.find({ isActive: true })
        .populate("uploadedBy", "name email role")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      for (const framework of recentFrameworks) {
        await this.cacheFramework(framework);
      }

      // Cache recent documents
      const recentDocuments = await UserDocument.find({ isActive: true })
        .populate("uploadedBy", "name email role")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      for (const document of recentDocuments) {
        await this.cacheDocument(document);
      }

      // Cache statistics
      await this.getFrameworkStats();
      await this.getDocumentStats();

      console.log("🎉 Redis cache warmup completed successfully");
    } catch (error) {
      console.error("❌ Redis cache warmup failed:", error.message);
    }
  }

  // Generic cache methods for token blacklisting
  async setCache(key, value, ttl = CACHE_TTL.MEDIUM) {
    try {
      await cacheOperations.set(key, value, ttl);
      return true;
    } catch (error) {
      console.error(`Failed to set cache for key ${key}:`, error.message);
      return false;
    }
  }

  async getCache(key) {
    try {
      return await cacheOperations.get(key);
    } catch (error) {
      console.error(`Failed to get cache for key ${key}:`, error.message);
      return null;
    }
  }

  async deleteCache(key) {
    try {
      await cacheOperations.del(key);
      return true;
    } catch (error) {
      console.error(`Failed to delete cache for key ${key}:`, error.message);
      return false;
    }
  }

  // Cache health check
  async healthCheck() {
    try {
      const testKey = generateCacheKey("health_check", "test");
      const testValue = { timestamp: Date.now(), test: "Redis health check" };

      // Test set operation
      await cacheOperations.set(testKey, testValue, 10);

      // Test get operation
      const retrieved = await cacheOperations.get(testKey);

      // Test delete operation
      await cacheOperations.del(testKey);

      const isHealthy =
        retrieved && retrieved.timestamp === testValue.timestamp;

      const stats = await cacheOperations.getStats();

      return {
        healthy: isHealthy,
        timestamp: new Date(),
        redis: {
          connected: true,
          stats: stats,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date(),
        redis: {
          connected: false,
        },
      };
    }
  }

  // Preload user-specific data
  async preloadUserData(userId) {
    try {
      // Cache user info
      await this.getUserById(userId);

      // Cache user's recent frameworks
      const userFrameworks = await UserFramework.find({
        uploadedBy: userId,
        isActive: true,
      })
        .populate("uploadedBy", "name email role")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      for (const framework of userFrameworks) {
        await this.cacheFramework(framework);
      }

      // Cache user's recent documents
      const userDocuments = await UserDocument.find({
        uploadedBy: userId,
        isActive: true,
      })
        .populate("uploadedBy", "name email role")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      for (const document of userDocuments) {
        await this.cacheDocument(document);
      }

      return true;
    } catch (error) {
      console.error(`Failed to preload user ${userId} data:`, error.message);
      return false;
    }
  }
}

module.exports = new CacheService();
