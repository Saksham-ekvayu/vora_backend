const express = require("express");
const SwaggerExpressDashboard = require("../index");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize the dashboard
const dashboard = new SwaggerExpressDashboard({
  title: "Example API Documentation",
  description: "A simple example of the Swagger Express Dashboard",
  version: "1.0.0",
  basePath: "/api-docs",
  enableTesting: true,
  enableAuth: true,
});

// Sample routes
app.get("/api/users", (req, res) => {
  res.json({
    users: [
      { id: 1, name: "John Doe", email: "john@example.com" },
      { id: 2, name: "Jane Smith", email: "jane@example.com" },
    ],
  });
});

app.post("/api/users", (req, res) => {
  const { name, email, password } = req.body;
  res.json({
    message: "User created successfully",
    user: { id: 3, name, email },
  });
});

app.get("/api/users/:id", (req, res) => {
  const { id } = req.params;
  res.json({
    user: { id: parseInt(id), name: "John Doe", email: "john@example.com" },
  });
});

app.put("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  res.json({
    message: "User updated successfully",
    user: { id: parseInt(id), name, email },
  });
});

app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  res.json({
    message: `User ${id} deleted successfully`,
  });
});

// Authentication routes
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  res.json({
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    user: { id: 1, email },
  });
});

app.post("/api/auth/register", (req, res) => {
  const { name, email, password, phone } = req.body;
  res.json({
    message: "Registration successful",
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    user: { id: 1, name, email },
  });
});

// Initialize dashboard (must be called after defining routes)
dashboard.init(app);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Dashboard: http://localhost:${PORT}/api-docs`);
  console.log("\n📋 Available endpoints:");
  console.log("  GET    /api/users");
  console.log("  POST   /api/users");
  console.log("  GET    /api/users/:id");
  console.log("  PUT    /api/users/:id");
  console.log("  DELETE /api/users/:id");
  console.log("  POST   /api/auth/login");
  console.log("  POST   /api/auth/register");
});

module.exports = app;
