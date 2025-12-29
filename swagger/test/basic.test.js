const express = require("express");
const request = require("supertest");
const SwaggerExpressDashboard = require("../index");

describe("Swagger Express Dashboard", () => {
  let app;
  let dashboard;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    dashboard = new SwaggerExpressDashboard({
      title: "Test API",
      description: "Test Description",
      version: "1.0.0",
    });
  });

  test("should initialize dashboard", () => {
    expect(dashboard).toBeDefined();
    expect(dashboard.options.title).toBe("Test API");
  });

  test("should serve dashboard HTML", async () => {
    // Add a test route
    app.get("/api/test", (req, res) => {
      res.json({ message: "test" });
    });

    // Initialize dashboard
    dashboard.init(app);

    const response = await request(app).get("/api-docs").expect(200);

    expect(response.text).toContain("Test API");
    expect(response.text).toContain("Test Description");
  });

  test("should serve routes API", async () => {
    // Add test routes
    app.get("/api/users", (req, res) => {
      res.json({ users: [] });
    });

    app.post("/api/users", (req, res) => {
      res.json({ message: "created" });
    });

    // Initialize dashboard
    dashboard.init(app);

    const response = await request(app).get("/api-docs/api/routes").expect(200);

    expect(response.body).toHaveProperty("apis");
    expect(Array.isArray(response.body.apis)).toBe(true);
  });

  test("should register routes", () => {
    const router = express.Router();
    router.get("/test", (req, res) => res.json({}));

    dashboard.registerRoutes("/api", router);

    const routes = dashboard.routeRegistry.getRoutes();
    expect(routes).toHaveLength(1);
    expect(routes[0].basePath).toBe("/api");
  });

  test("should add route documentation", () => {
    dashboard.addRouteDoc("/api/test", "GET", {
      description: "Test endpoint",
    });

    const doc = dashboard.routeRegistry.getDocumentation("/api/test", "GET");
    expect(doc).toBeDefined();
    expect(doc.description).toBe("Test endpoint");
  });

  test("should handle custom configuration", () => {
    const customDashboard = new SwaggerExpressDashboard({
      title: "Custom API",
      basePath: "/docs",
      enableTesting: false,
      enableAuth: false,
      theme: "light",
    });

    expect(customDashboard.options.title).toBe("Custom API");
    expect(customDashboard.options.basePath).toBe("/docs");
    expect(customDashboard.options.enableTesting).toBe(false);
    expect(customDashboard.options.enableAuth).toBe(false);
    expect(customDashboard.options.theme).toBe("light");
  });
});
