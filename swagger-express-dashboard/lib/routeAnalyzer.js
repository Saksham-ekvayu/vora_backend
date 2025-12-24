const fs = require("fs");
const path = require("path");

class RouteAnalyzer {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Analyze routes from Express app and registered routes
   * @param {Express} app - Express application instance
   * @param {Array} registeredRoutes - Array of registered routes
   * @returns {Array} Array of analyzed routes
   */
  analyzeRoutes(app, registeredRoutes = []) {
    const routes = [];

    // Analyze registered routes first
    registeredRoutes.forEach(({ basePath, router }) => {
      if (router && router.stack) {
        router.stack.forEach((layer) => {
          if (layer.route) {
            const methods = Object.keys(layer.route.methods).map((m) =>
              m.toUpperCase()
            );
            const fullPath = `${basePath}${layer.route.path}`;

            methods.forEach((method) => {
              const routeInfo = this.analyzeRoute(fullPath, method);
              if (routeInfo) {
                routes.push(routeInfo);
              }
            });
          }
        });
      }
    });

    // If no registered routes, try to analyze app routes directly
    if (routes.length === 0 && app._router) {
      this.extractAppRoutes(app._router, routes);
    }

    return routes;
  }

  /**
   * Extract routes directly from Express app router
   * @param {Router} router - Express router
   * @param {Array} routes - Routes array to populate
   * @param {string} basePath - Base path for routes
   */
  extractAppRoutes(router, routes, basePath = "") {
    if (!router || !router.stack) return;

    router.stack.forEach((layer) => {
      if (layer.route) {
        // Direct route
        const methods = Object.keys(layer.route.methods).map((m) =>
          m.toUpperCase()
        );
        const fullPath = basePath + layer.route.path;

        methods.forEach((method) => {
          const routeInfo = this.analyzeRoute(fullPath, method);
          if (routeInfo) {
            routes.push(routeInfo);
          }
        });
      } else if (
        layer.name === "router" &&
        layer.handle &&
        layer.handle.stack
      ) {
        // Nested router
        const nestedBasePath =
          basePath +
          (layer.regexp.source.replace(/\\\//g, "/").replace(/\$.*/, "") || "");
        this.extractAppRoutes(layer.handle, routes, nestedBasePath);
      }
    });
  }

  /**
   * Analyze a single route
   * @param {string} path - Route path
   * @param {string} method - HTTP method
   * @returns {Object} Route information
   */
  analyzeRoute(path, method) {
    const body = this.extractRequestBodySchema(path, method);

    return {
      path: path,
      method: method,
      body: body,
      headers: this.getDefaultHeaders(method),
      description: this.generateDescription(path, method),
      tags: this.extractTags(path),
    };
  }

  /**
   * Extract request body schema from controller files
   * @param {string} routePath - Route path
   * @param {string} method - HTTP method
   * @returns {Object|null} Request body schema
   */
  extractRequestBodySchema(routePath, method) {
    if (!this.options.autoDetectControllers) {
      return this.getDefaultBodySchema(routePath, method);
    }

    try {
      const controllerMap = this.discoverControllerFiles();
      let controllerFile = null;

      // Find appropriate controller file
      for (const [basePath, filePath] of Object.entries(controllerMap)) {
        if (routePath.startsWith(basePath)) {
          controllerFile = filePath;
          break;
        }
      }

      if (!controllerFile || !fs.existsSync(controllerFile)) {
        return this.getDefaultBodySchema(routePath, method);
      }

      const controllerContent = fs.readFileSync(controllerFile, "utf8");
      const functionName = this.findMatchingFunction(
        routePath,
        method,
        controllerContent
      );

      if (!functionName) {
        return this.getDefaultBodySchema(routePath, method);
      }

      return (
        this.extractBodyFromFunction(controllerContent, functionName) ||
        this.getDefaultBodySchema(routePath, method)
      );
    } catch (error) {
      console.error("Error extracting request body schema:", error);
      return this.getDefaultBodySchema(routePath, method);
    }
  }

  /**
   * Discover controller files automatically
   * @returns {Object} Map of base paths to controller files
   */
  discoverControllerFiles() {
    const controllerFiles = {};
    const controllersDir = path.resolve(
      this.options.controllersPath || "./src/controllers"
    );

    try {
      if (!fs.existsSync(controllersDir)) {
        return controllerFiles;
      }

      const files = fs.readdirSync(controllersDir);

      files.forEach((file) => {
        if (file.endsWith(".controller.js") || file.endsWith(".js")) {
          const controllerName = file.replace(/\.controller\.js$|\.js$/, "");
          const filePath = path.join(controllersDir, file);
          controllerFiles[`/api/${controllerName}`] = filePath;
        }
      });

      return controllerFiles;
    } catch (error) {
      console.error("Error discovering controller files:", error);
      return controllerFiles;
    }
  }

  /**
   * Find matching function in controller content
   * @param {string} routePath - Route path
   * @param {string} method - HTTP method
   * @param {string} controllerContent - Controller file content
   * @returns {string|null} Function name
   */
  findMatchingFunction(routePath, method, controllerContent) {
    const availableFunctions = this.extractFunctionNames(controllerContent);

    if (availableFunctions.length === 0) {
      return null;
    }

    const pathParts = routePath.split("/").filter((part) => part);
    const lastPart = pathParts[pathParts.length - 1];

    // Method-based patterns
    const methodActions = {
      GET: ["get", "fetch", "retrieve", "list", "show", "find"],
      POST: ["create", "add", "register", "login", "send", "verify", "resend"],
      PUT: ["update", "edit", "modify", "change"],
      DELETE: ["delete", "remove", "destroy"],
      PATCH: ["patch", "update", "modify"],
    };

    // Try exact matches first
    const patterns = [
      lastPart,
      `${method.toLowerCase()}${this.capitalize(lastPart)}`,
      `${lastPart}${this.capitalize(method)}`,
      ...methodActions[method].map(
        (action) => `${action}${this.capitalize(lastPart)}`
      ),
    ];

    for (const pattern of patterns) {
      const found = availableFunctions.find(
        (func) => func.toLowerCase() === pattern.toLowerCase()
      );
      if (found) return found;
    }

    return availableFunctions[0]; // Fallback to first function
  }

  /**
   * Extract function names from controller content
   * @param {string} controllerContent - Controller file content
   * @returns {Array} Array of function names
   */
  extractFunctionNames(controllerContent) {
    const functionNames = [];
    const patterns = [
      /const\s+(\w+)\s*=\s*async\s*\([^)]*\)\s*=>/g,
      /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g,
      /async\s+function\s+(\w+)\s*\([^)]*\)/g,
      /function\s+(\w+)\s*\([^)]*\)/g,
      /exports\.(\w+)\s*=/g,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(controllerContent)) !== null) {
        const funcName = match[1];
        if (!functionNames.includes(funcName)) {
          functionNames.push(funcName);
        }
      }
    });

    return functionNames;
  }

  /**
   * Extract request body fields from function content
   * @param {string} controllerContent - Controller file content
   * @param {string} functionName - Function name to analyze
   * @returns {Object|null} Request body schema
   */
  extractBodyFromFunction(controllerContent, functionName) {
    const functionPatterns = [
      new RegExp(
        `const\\s+${functionName}\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>\\s*{([\\s\\S]*?)^};`,
        "gm"
      ),
      new RegExp(
        `const\\s+${functionName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*{([\\s\\S]*?)^};`,
        "gm"
      ),
      new RegExp(
        `async\\s+function\\s+${functionName}\\s*\\([^)]*\\)\\s*{([\\s\\S]*?)^}`,
        "gm"
      ),
      new RegExp(
        `function\\s+${functionName}\\s*\\([^)]*\\)\\s*{([\\s\\S]*?)^}`,
        "gm"
      ),
      new RegExp(
        `exports\\.${functionName}\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>\\s*{([\\s\\S]*?)^};`,
        "gm"
      ),
    ];

    let functionBody = null;

    for (const pattern of functionPatterns) {
      const match = pattern.exec(controllerContent);
      if (match) {
        functionBody = match[1];
        break;
      }
    }

    if (!functionBody) return null;

    // Extract req.body destructuring
    const destructuringPatterns = [
      /const\s*{\s*([^}]+)\s*}\s*=\s*req\.body/g,
      /{\s*([^}]+)\s*}\s*=\s*req\.body/g,
    ];

    let extractedFields = [];

    for (const pattern of destructuringPatterns) {
      let match;
      while ((match = pattern.exec(functionBody)) !== null) {
        const fieldsString = match[1];
        const fields = fieldsString
          .split(",")
          .map((field) => {
            let cleanField = field.trim();
            if (cleanField.includes(":")) {
              cleanField = cleanField.split(":")[0].trim();
            }
            if (cleanField.includes("=")) {
              cleanField = cleanField.split("=")[0].trim();
            }
            return cleanField;
          })
          .filter((field) => field && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(field));

        extractedFields = extractedFields.concat(fields);
      }
    }

    if (extractedFields.length === 0) return null;

    const schema = {};
    extractedFields.forEach((field) => {
      const isOptional =
        functionBody.includes(`if (${field})`) ||
        functionBody.includes(`${field} ?`) ||
        functionBody.includes(`${field} &&`) ||
        functionBody.includes(`${field} ||`);

      schema[field] = isOptional ? "string (optional)" : "string";
    });

    return schema;
  }

  /**
   * Get default body schema based on route path and method
   * @param {string} routePath - Route path
   * @param {string} method - HTTP method
   * @returns {Object|null} Default body schema
   */
  getDefaultBodySchema(routePath, method) {
    if (method === "GET" || method === "DELETE") {
      return null;
    }

    // Smart defaults based on route path
    if (routePath.includes("register")) {
      return {
        name: "string",
        email: "string",
        password: "string",
        phone: "string (optional)",
      };
    } else if (routePath.includes("login")) {
      return {
        email: "string",
        password: "string",
      };
    } else if (routePath.includes("verify")) {
      return {
        email: "string",
        otp: "string",
      };
    } else if (routePath.includes("password")) {
      return {
        email: "string",
        password: "string (optional)",
        otp: "string (optional)",
      };
    }

    return {
      field1: "string",
      field2: "string (optional)",
    };
  }

  /**
   * Get default headers for a method
   * @param {string} method - HTTP method
   * @returns {Object|null} Default headers
   */
  getDefaultHeaders(method) {
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      return {
        "Content-Type": "application/json",
      };
    }
    return null;
  }

  /**
   * Generate description for a route
   * @param {string} path - Route path
   * @param {string} method - HTTP method
   * @returns {string} Route description
   */
  generateDescription(path, method) {
    const pathParts = path.split("/").filter((part) => part);
    const lastPart = pathParts[pathParts.length - 1];

    const descriptions = {
      GET: "Retrieve",
      POST: "Create",
      PUT: "Update",
      DELETE: "Delete",
      PATCH: "Partially update",
    };

    return `${descriptions[method] || method} ${lastPart || "resource"}`;
  }

  /**
   * Extract tags from route path
   * @param {string} path - Route path
   * @returns {Array} Array of tags
   */
  extractTags(path) {
    const pathParts = path
      .split("/")
      .filter((part) => part && !part.startsWith(":"));
    return pathParts.slice(0, 2); // Take first two meaningful parts
  }

  /**
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
  }
}

module.exports = { RouteAnalyzer };
