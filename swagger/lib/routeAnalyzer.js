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

      const extractedSchema = this.extractBodyFromFunction(
        controllerContent,
        functionName
      );

      return extractedSchema || this.getDefaultBodySchema(routePath, method);
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

          // Generic mapping - extract controller name and map to API path
          // This works for any controller naming convention
          controllerFiles[`/api/${controllerName}`] = filePath;

          // Also add without /api prefix for flexibility
          controllerFiles[`/${controllerName}`] = filePath;
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

    // Extract meaningful parts from route path
    const pathParts = routePath
      .split("/")
      .filter((part) => part && part !== "api");

    // Generate all possible function name patterns
    const possibleNames = this.generateFunctionNamePatterns(pathParts, method);

    // Try to match patterns with available functions
    for (const pattern of possibleNames) {
      const found = availableFunctions.find(
        (func) => func.toLowerCase() === pattern.toLowerCase()
      );
      if (found) return found;
    }

    // If no exact match, try fuzzy matching
    const fuzzyMatch = this.findFuzzyMatch(possibleNames, availableFunctions);
    if (fuzzyMatch) return fuzzyMatch;

    return availableFunctions[0]; // Fallback to first function
  }

  /**
   * Generate all possible function name patterns from route parts and method
   * @param {Array} pathParts - Route path parts
   * @param {string} method - HTTP method
   * @returns {Array} Array of possible function names
   */
  generateFunctionNamePatterns(pathParts, method) {
    const patterns = new Set();

    // Method-based actions
    const methodActions = {
      GET: [
        "get",
        "fetch",
        "retrieve",
        "list",
        "show",
        "find",
        "getAll",
        "view",
      ],
      POST: [
        "create",
        "add",
        "register",
        "login",
        "send",
        "verify",
        "resend",
        "post",
        "insert",
      ],
      PUT: ["update", "edit", "modify", "change", "put", "replace"],
      DELETE: ["delete", "remove", "destroy", "del"],
      PATCH: ["patch", "update", "modify", "change"],
    };

    const actions = methodActions[method] || [method.toLowerCase()];

    // Single part patterns
    pathParts.forEach((part) => {
      const cleanPart = part.replace(/[-_]/g, "");
      const camelPart = this.toCamelCase(part);

      // Direct part names
      patterns.add(part);
      patterns.add(cleanPart);
      patterns.add(camelPart);

      // Method + part combinations
      actions.forEach((action) => {
        patterns.add(action + this.capitalize(part));
        patterns.add(action + this.capitalize(cleanPart));
        patterns.add(action + this.capitalize(camelPart));
        patterns.add(part + this.capitalize(action));
        patterns.add(cleanPart + this.capitalize(action));
      });
    });

    // Multi-part combinations
    if (pathParts.length >= 2) {
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part1 = pathParts[i];
        const part2 = pathParts[i + 1];

        // Combine adjacent parts
        patterns.add(part1 + this.capitalize(part2));
        patterns.add(part2 + this.capitalize(part1));
        patterns.add(this.toCamelCase(part1 + "-" + part2));
        patterns.add(this.toCamelCase(part2 + "-" + part1));

        // With actions
        actions.forEach((action) => {
          patterns.add(
            action + this.capitalize(part1) + this.capitalize(part2)
          );
          patterns.add(
            action + this.capitalize(part2) + this.capitalize(part1)
          );
          patterns.add(
            part1 + this.capitalize(part2) + this.capitalize(action)
          );
          patterns.add(
            part2 + this.capitalize(part1) + this.capitalize(action)
          );
        });
      }
    }

    // Full path combinations
    if (pathParts.length >= 3) {
      const lastThree = pathParts.slice(-3);
      patterns.add(this.toCamelCase(lastThree.join("-")));

      actions.forEach((action) => {
        patterns.add(
          action + lastThree.map((p) => this.capitalize(p)).join("")
        );
      });
    }

    return Array.from(patterns);
  }

  /**
   * Find fuzzy match between patterns and available functions
   * @param {Array} patterns - Generated patterns
   * @param {Array} availableFunctions - Available function names
   * @returns {string|null} Best matching function name
   */
  findFuzzyMatch(patterns, availableFunctions) {
    let bestMatch = null;
    let bestScore = 0;

    for (const pattern of patterns) {
      for (const func of availableFunctions) {
        const score = this.calculateSimilarity(
          pattern.toLowerCase(),
          func.toLowerCase()
        );
        if (score > bestScore && score > 0.6) {
          // 60% similarity threshold
          bestScore = score;
          bestMatch = func;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calculate similarity between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
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
   * Extract request body schema from validation middleware
   * @param {string} routePath - Route path
   * @param {string} method - HTTP method
   * @returns {Object|null} Request body schema from validation
   */
  extractFromValidationMiddleware(routePath, method) {
    try {
      // Find validation middleware files
      const middlewaresDir = path.resolve("./src/middlewares");
      if (!fs.existsSync(middlewaresDir)) {
        return null;
      }

      const validationFiles = fs
        .readdirSync(middlewaresDir)
        .filter((file) => file.includes("validation") && file.endsWith(".js"));

      for (const file of validationFiles) {
        const filePath = path.join(middlewaresDir, file);
        const content = fs.readFileSync(filePath, "utf8");

        // Extract validation schemas from the file
        const schema = this.parseValidationFile(content, routePath, method);
        if (schema) {
          return schema;
        }
      }

      return null;
    } catch (error) {
      console.error("Error extracting from validation middleware:", error);
      return null;
    }
  }

  /**
   * Parse validation file to extract field requirements
   * @param {string} content - Validation file content
   * @param {string} routePath - Route path
   * @param {string} method - HTTP method
   * @returns {Object|null} Parsed validation schema
   */
  parseValidationFile(content, routePath, method) {
    try {
      // Extract validation function names and their field requirements
      const validationFunctions = this.extractValidationFunctions(content);

      // Try to match route to validation function
      const matchedValidation = this.matchRouteToValidation(
        routePath,
        method,
        validationFunctions
      );

      return matchedValidation;
    } catch (error) {
      console.error("Error parsing validation file:", error);
      return null;
    }
  }

  /**
   * Extract validation functions and their field requirements
   * @param {string} content - Validation file content
   * @returns {Object} Map of validation functions to their fields
   */
  extractValidationFunctions(content) {
    const validations = {};

    // Pattern to match validation function definitions
    const validationPattern = /const\s+(\w+Validation)\s*=\s*\[([\s\S]*?)\]/g;

    let match;
    while ((match = validationPattern.exec(content)) !== null) {
      const functionName = match[1];
      const validationBody = match[2];

      // Extract field validators from the validation array
      const fields = this.extractFieldsFromValidation(validationBody, content);
      if (fields && Object.keys(fields).length > 0) {
        validations[functionName] = fields;
      }
    }

    return validations;
  }

  /**
   * Extract fields from validation function body
   * @param {string} validationBody - Validation function body
   * @param {string} fullContent - Full file content for reference
   * @returns {Object} Field schema
   */
  extractFieldsFromValidation(validationBody, fullContent) {
    const fields = {};

    // Pattern to match validator function calls
    const validatorPattern = /(\w+Validator)\(\s*([^)]*)\s*\)/g;

    let match;
    while ((match = validatorPattern.exec(validationBody)) !== null) {
      const validatorName = match[1];
      const params = match[2];

      // Extract field name from validator
      const fieldName = this.getFieldFromValidator(validatorName, fullContent);
      if (fieldName) {
        // Check if field is optional based on parameters
        const isOptional =
          params.includes("false") ||
          validationBody.includes(`${validatorName}(false)`);
        fields[fieldName] = isOptional ? "string (optional)" : "string";
      }
    }

    return fields;
  }

  /**
   * Get field name from validator function
   * @param {string} validatorName - Validator function name
   * @param {string} content - File content
   * @returns {string|null} Field name
   */
  getFieldFromValidator(validatorName, content) {
    // Try multiple patterns to extract field name from validator definition
    const patterns = [
      // Pattern 1: const nameValidator = () => body("name")
      new RegExp(
        `const\\s+${validatorName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*body\\("([^"]+)"\\)`,
        "g"
      ),
      // Pattern 2: const nameValidator = body("name")
      new RegExp(`const\\s+${validatorName}\\s*=\\s*body\\("([^"]+)"\\)`, "g"),
      // Pattern 3: nameValidator: body("name")
      new RegExp(`${validatorName}\\s*:\\s*body\\("([^"]+)"\\)`, "g"),
      // Pattern 4: anywhere in the validator function body
      new RegExp(`${validatorName}[\\s\\S]*?body\\("([^"]+)"\\)`, "g"),
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(content);
      if (match && match[1]) {
        return match[1];
      }
    }

    // Fallback: try to infer from validator name by removing common suffixes
    let fieldName = validatorName.toLowerCase();

    // Remove common validator suffixes
    const suffixes = ["validator", "validation", "custom"];
    for (const suffix of suffixes) {
      if (fieldName.endsWith(suffix)) {
        fieldName = fieldName.slice(0, -suffix.length);
        break;
      }
    }

    // Return the inferred field name if it looks valid
    return fieldName && /^[a-zA-Z][a-zA-Z0-9]*$/.test(fieldName)
      ? fieldName
      : null;
  }

  /**
   * Match route to appropriate validation function
   * @param {string} routePath - Route path
   * @param {string} method - HTTP method
   * @param {Object} validationFunctions - Available validation functions
   * @returns {Object|null} Matched validation schema
   */
  matchRouteToValidation(routePath, method, validationFunctions) {
    // Extract meaningful parts from route path
    const pathParts = routePath
      .toLowerCase()
      .split("/")
      .filter((part) => part && part !== "api");

    // Generate possible validation function names dynamically
    const possibleNames = new Set();

    // Add combinations of path parts
    pathParts.forEach((part, index) => {
      // Single part
      possibleNames.add(part + "Validation");
      possibleNames.add(part.replace("-", "") + "Validation");
      possibleNames.add(this.toCamelCase(part) + "Validation");

      // Method + part combinations
      possibleNames.add(
        method.toLowerCase() + this.capitalize(part) + "Validation"
      );

      // Multi-part combinations
      if (index > 0) {
        const prevPart = pathParts[index - 1];
        possibleNames.add(prevPart + this.capitalize(part) + "Validation");
        possibleNames.add(part + this.capitalize(prevPart) + "Validation");
      }

      // Next part combinations
      if (index < pathParts.length - 1) {
        const nextPart = pathParts[index + 1];
        possibleNames.add(part + this.capitalize(nextPart) + "Validation");
      }
    });

    // Add full path combinations
    if (pathParts.length >= 2) {
      const lastTwo = pathParts.slice(-2);
      possibleNames.add(lastTwo.join("") + "Validation");
      possibleNames.add(this.toCamelCase(lastTwo.join("-")) + "Validation");
    }

    // Try all possible names
    for (const name of possibleNames) {
      if (validationFunctions[name]) {
        return validationFunctions[name];
      }
    }

    return null;
  }

  /**
   * Extract request body schema from controller function
   * @param {string} routePath - Route path
   * @param {string} method - HTTP method
   * @returns {Object|null} Request body schema from controller
   */
  extractFromController(routePath, method) {
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
        return null;
      }

      const controllerContent = fs.readFileSync(controllerFile, "utf8");
      const functionName = this.findMatchingFunction(
        routePath,
        method,
        controllerContent
      );

      if (!functionName) {
        return null;
      }

      return this.extractBodyFromFunction(controllerContent, functionName);
    } catch (error) {
      console.error("Error extracting from controller:", error);
      return null;
    }
  }

  /**
   * Get default body schema based on route path and method
   * @param {string} routePath - Route path
   * @param {string} method - HTTP method
   * @returns {Object|null} Request body schema
   */
  getDefaultBodySchema(routePath, method) {
    if (method === "GET" || method === "DELETE") {
      return null;
    }

    // Try to extract from validation middleware first
    const validationSchema = this.extractFromValidationMiddleware(
      routePath,
      method
    );
    if (validationSchema) {
      return validationSchema;
    }

    // Try to extract from controller function
    const controllerSchema = this.extractFromController(routePath, method);
    if (controllerSchema) {
      return controllerSchema;
    }

    // Generic fallback - return null to indicate no body expected
    return null;
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

  /**
   * Convert kebab-case or snake_case to camelCase
   * @param {string} str - String to convert
   * @returns {string} camelCase string
   */
  toCamelCase(str) {
    return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
  }
}

module.exports = { RouteAnalyzer };
