const express = require("express");
const path = require("path");
const fs = require("fs");
const { RouteRegistry } = require("./lib/routeRegistry");
const { RouteAnalyzer } = require("./lib/routeAnalyzer");
const { DashboardGenerator } = require("./lib/dashboardGenerator");

class SwaggerExpressDashboard {
  constructor(options = {}) {
    this.options = {
      title: options.title || "API Documentation",
      description:
        options.description ||
        "Interactive API Documentation and Testing Dashboard",
      version: options.version || "1.0.0",
      basePath: options.basePath || "/api-docs",
      theme: options.theme || "dark", // dark, light, auto
      autoDetectControllers: options.autoDetectControllers !== false,
      controllersPath: options.controllersPath || "./src/controllers",
      enableTesting: options.enableTesting !== false,
      enableAuth: options.enableAuth !== false,
      customCSS: options.customCSS || "",
      ...options,
    };

    this.routeRegistry = new RouteRegistry();
    this.routeAnalyzer = new RouteAnalyzer(this.options);
    this.dashboardGenerator = new DashboardGenerator(this.options);
  }

  /**
   * Initialize the dashboard middleware
   * @param {Express} app - Express application instance
   * @returns {Function} Express middleware
   */
  init(app) {
    if (!app) {
      throw new Error("Express app instance is required");
    }

    // Serve static assets
    app.use(
      this.options.basePath + "/assets",
      express.static(path.join(__dirname, "templates/assets"))
    );

    // API endpoint to get route data
    app.get(this.options.basePath + "/api/routes", (req, res) => {
      try {
        const routes = this.routeAnalyzer.analyzeRoutes(
          app,
          this.routeRegistry.getRoutes()
        );
        res.json({ apis: routes });
      } catch (error) {
        console.error("Error analyzing routes:", error);
        res.status(500).json({ error: "Failed to analyze routes" });
      }
    });

    // Dashboard HTML page
    app.get(this.options.basePath, (req, res) => {
      try {
        const html = this.dashboardGenerator.generateHTML();
        res.send(html);
      } catch (error) {
        console.error("Error generating dashboard:", error);
        res.status(500).send("Error generating dashboard");
      }
    });

    return this;
  }

  /**
   * Register a route with the dashboard
   * @param {string} basePath - Base path for the routes
   * @param {Router} router - Express router instance
   */
  registerRoutes(basePath, router) {
    this.routeRegistry.register(basePath, router);
    return this;
  }

  /**
   * Auto-register all routes from an Express app
   * @param {Express} app - Express application instance
   */
  autoRegister(app) {
    // This will be called automatically when routes are analyzed
    return this;
  }

  /**
   * Add custom route documentation
   * @param {string} path - Route path
   * @param {string} method - HTTP method
   * @param {Object} documentation - Route documentation
   */
  addRouteDoc(path, method, documentation) {
    this.routeRegistry.addDocumentation(path, method, documentation);
    return this;
  }

  /**
   * Set global authentication configuration
   * @param {Object} authConfig - Authentication configuration
   */
  setAuth(authConfig) {
    this.options.auth = authConfig;
    return this;
  }
}

module.exports = SwaggerExpressDashboard;
