const redis = require("redis");

// Redis client for caching (REQUIRED)
let redisClient = null;

const initializeRedis = async () => {
  try {
    if (!process.env.REDIS_URL) {
      throw new Error(
        "REDIS_URL is required! Please configure Redis connection in .env file"
      );
    }

    console.log("🔗 Connecting to Redis...");

    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      retry_strategy: (options) => {
        if (options.error && options.error.code === "ECONNREFUSED") {
          console.log("Redis connection refused, retrying...");
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error("Retry time exhausted");
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      },
    });

    redisClient.on("error", (err) => {
      console.error("❌ Redis Client Error:", err);
      throw err;
    });

    redisClient.on("connect", () => {
      // Connected to Redis
    });

    redisClient.on("ready", () => {
      console.log("🚀 Redis client ready for operations");
    });

    redisClient.on("end", () => {
      // Redis connection ended
    });

    await redisClient.connect();

    // Test the connection
    await redisClient.ping();
    console.log("🏓 Redis ping successful - Cache system ready");
  } catch (error) {
    console.error("❌ Failed to initialize Redis:", error.message);
    console.error(
      "💡 Please ensure Redis is running and REDIS_URL is configured correctly"
    );
    console.error("💡 Example: REDIS_URL=redis://localhost:6379");
    throw error; // Stop application if Redis fails
  }
};

// Cache key generators
const generateCacheKey = (prefix, ...args) => {
  return `vora:${prefix}:${args.join(":")}`;
};

// Redis-only cache operations
const cacheOperations = {
  // Get from Redis cache
  async get(key) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        throw new Error("Redis client is not connected");
      }

      const value = await redisClient.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      console.error("Cache get error:", error);
      throw error; // Don't fallback, throw error for Redis-only mode
    }
  },

  // Set in Redis cache
  async set(key, value, ttl = 300) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        throw new Error("Redis client is not connected");
      }

      const serializedValue = JSON.stringify(value);
      await redisClient.setEx(key, ttl, serializedValue);
      return true;
    } catch (error) {
      console.error("Cache set error:", error);
      throw error; // Don't fallback, throw error for Redis-only mode
    }
  },

  // Delete from Redis cache
  async del(key) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        throw new Error("Redis client is not connected");
      }

      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error("Cache delete error:", error);
      throw error; // Don't fallback, throw error for Redis-only mode
    }
  },

  // Clear cache by pattern
  async clearPattern(pattern) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        throw new Error("Redis client is not connected");
      }

      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      console.error("Cache clear pattern error:", error);
      throw error; // Don't fallback, throw error for Redis-only mode
    }
  },

  // Check if key exists
  async exists(key) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        throw new Error("Redis client is not connected");
      }

      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      console.error("Cache exists error:", error);
      throw error;
    }
  },

  // Get TTL of a key
  async ttl(key) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        throw new Error("Redis client is not connected");
      }

      return await redisClient.ttl(key);
    } catch (error) {
      console.error("Cache TTL error:", error);
      throw error;
    }
  },

  // Get cache statistics
  async getStats() {
    try {
      if (!redisClient || !redisClient.isOpen) {
        throw new Error("Redis client is not connected");
      }

      const info = await redisClient.info("memory");
      const keyspace = await redisClient.info("keyspace");

      return {
        connected: true,
        memory: info,
        keyspace: keyspace,
        client_info: {
          connected: redisClient.isOpen,
          ready: redisClient.isReady,
        },
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return {
        connected: false,
        error: error.message,
      };
    }
  },

  // Flush all cache
  async flushAll() {
    try {
      if (!redisClient || !redisClient.isOpen) {
        throw new Error("Redis client is not connected");
      }

      await redisClient.flushAll();
      return true;
    } catch (error) {
      console.error("Cache flush error:", error);
      throw error;
    }
  },
};

// Cache key constants
const CACHE_KEYS = {
  USER: "user",
  FRAMEWORK: "framework",
  DOCUMENT: "document",
  FRAMEWORK_LIST: "framework_list",
  DOCUMENT_LIST: "document_list",
  USER_FRAMEWORKS: "user_frameworks",
  USER_DOCUMENTS: "user_documents",
  FRAMEWORK_STATS: "framework_stats",
  DOCUMENT_STATS: "document_stats",
};

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 1800, // 30 minutes
  VERY_LONG: 3600, // 1 hour
};

// Graceful shutdown
const closeRedis = async () => {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch (error) {
    console.error("❌ Error closing Redis connection:", error);
  }
};

module.exports = {
  initializeRedis,
  closeRedis,
  cacheOperations,
  generateCacheKey,
  CACHE_KEYS,
  CACHE_TTL,
  redisClient: () => redisClient,
};
