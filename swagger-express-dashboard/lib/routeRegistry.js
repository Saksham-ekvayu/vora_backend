class RouteRegistry {
  constructor() {
    this.registeredRoutes = [];
    this.routeDocumentation = new Map();
  }

  /**
   * Register routes with the registry
   * @param {string} basePath - Base path for the routes
   * @param {Router} router - Express router instance
   */
  register(basePath, router) {
    this.registeredRoutes.push({ basePath, router });
  }

  /**
   * Get all registered routes
   * @returns {Array} Array of registered routes
   */
  getRoutes() {
    return this.registeredRoutes;
  }

  /**
   * Add documentation for a specific route
   * @param {string} path - Route path
   * @param {string} method - HTTP method
   * @param {Object} documentation - Route documentation
   */
  addDocumentation(path, method, documentation) {
    const key = `${method.toUpperCase()}:${path}`;
    this.routeDocumentation.set(key, documentation);
  }

  /**
   * Get documentation for a specific route
   * @param {string} path - Route path
   * @param {string} method - HTTP method
   * @returns {Object|null} Route documentation or null
   */
  getDocumentation(path, method) {
    const key = `${method.toUpperCase()}:${path}`;
    return this.routeDocumentation.get(key) || null;
  }

  /**
   * Clear all registered routes
   */
  clear() {
    this.registeredRoutes = [];
    this.routeDocumentation.clear();
  }
}

module.exports = { RouteRegistry };
