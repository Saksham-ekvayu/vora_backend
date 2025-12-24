const express = require("express");
const SwaggerExpressDashboard = require("../index");

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize the dashboard with advanced configuration
const dashboard = new SwaggerExpressDashboard({
  title: "Advanced API Dashboard",
  description: "Complete API documentation with route registration",
  version: "2.0.0",
  basePath: "/docs",
  enableAuth: true,
  enableTesting: true,
  autoDetectControllers: true,
  controllersPath: "./controllers", // This would be your actual controllers path
  theme: "dark",
  customCSS: `
    .title {
      background: linear-gradient(45deg, #00ff41, #00d4ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
  `,
});

// Create separate routers for better organization
const authRouter = express.Router();
const userRouter = express.Router();
const productRouter = express.Router();

// Authentication routes
authRouter.post("/login", (req, res) => {
  const { email, password } = req.body;

  // Simulate authentication
  if (email && password) {
    res.json({
      token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      user: { id: 1, email, name: "John Doe" },
      expiresIn: "24h",
    });
  } else {
    res.status(400).json({ error: "Invalid credentials" });
  }
});

authRouter.post("/register", (req, res) => {
  const { name, email, password, phone } = req.body;

  res.json({
    message: "Registration successful",
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
    user: { id: 2, name, email, phone },
  });
});

authRouter.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  res.json({
    message: "OTP verified successfully",
    verified: true,
  });
});

authRouter.post("/forgot-password", (req, res) => {
  const { email } = req.body;

  res.json({
    message: "Password reset OTP sent to email",
    otpSent: true,
  });
});

authRouter.post("/reset-password", (req, res) => {
  const { email, otp, password } = req.body;

  res.json({
    message: "Password reset successful",
  });
});

// User management routes
userRouter.get("/profile", (req, res) => {
  res.json({
    user: {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      phone: "+1234567890",
      role: "user",
      createdAt: "2024-01-01T00:00:00Z",
    },
  });
});

userRouter.put("/profile", (req, res) => {
  const { name, email, phone } = req.body;

  res.json({
    message: "Profile updated successfully",
    user: { id: 1, name, email, phone },
  });
});

userRouter.get("/all-users", (req, res) => {
  const { page = 1, limit = 10, sort = "name" } = req.query;

  res.json({
    users: [
      { id: 1, name: "John Doe", email: "john@example.com", role: "admin" },
      { id: 2, name: "Jane Smith", email: "jane@example.com", role: "user" },
      { id: 3, name: "Bob Johnson", email: "bob@example.com", role: "user" },
    ],
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: 3,
      pages: 1,
    },
  });
});

userRouter.post("/", (req, res) => {
  const { name, email, role, phone } = req.body;

  res.json({
    message: "User created by admin",
    user: { id: 4, name, email, role, phone },
  });
});

userRouter.delete("/:id", (req, res) => {
  const { id } = req.params;

  res.json({
    message: `User ${id} deleted successfully`,
  });
});

// Product routes (example of additional category)
productRouter.get("/", (req, res) => {
  const { category, minPrice, maxPrice } = req.query;

  res.json({
    products: [
      { id: 1, name: "Laptop", price: 999, category: "electronics" },
      { id: 2, name: "Phone", price: 599, category: "electronics" },
      { id: 3, name: "Book", price: 29, category: "books" },
    ],
    filters: { category, minPrice, maxPrice },
  });
});

productRouter.post("/", (req, res) => {
  const { name, price, category, description } = req.body;

  res.json({
    message: "Product created successfully",
    product: { id: 4, name, price, category, description },
  });
});

productRouter.get("/:id", (req, res) => {
  const { id } = req.params;

  res.json({
    product: {
      id: parseInt(id),
      name: "Sample Product",
      price: 99.99,
      category: "electronics",
      description: "A sample product description",
    },
  });
});

productRouter.put("/:id", (req, res) => {
  const { id } = req.params;
  const { name, price, category, description } = req.body;

  res.json({
    message: "Product updated successfully",
    product: { id: parseInt(id), name, price, category, description },
  });
});

productRouter.delete("/:id", (req, res) => {
  const { id } = req.params;

  res.json({
    message: `Product ${id} deleted successfully`,
  });
});

// Register routes with Express
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/products", productRouter);

// Register routes with dashboard for better documentation
dashboard.registerRoutes("/api/auth", authRouter);
dashboard.registerRoutes("/api/user", userRouter);
dashboard.registerRoutes("/api/products", productRouter);

// Add custom documentation for specific routes
dashboard.addRouteDoc("/api/user/:id", "DELETE", {
  description: "Delete user by ID (Admin only)",
  parameters: {
    id: "User ID to delete",
  },
  responses: {
    200: "User deleted successfully",
    403: "Forbidden - Admin access required",
    404: "User not found",
  },
});

dashboard.addRouteDoc("/api/products", "GET", {
  description: "Get products with optional filtering",
  queryParameters: {
    category: "Filter by category (optional)",
    minPrice: "Minimum price filter (optional)",
    maxPrice: "Maximum price filter (optional)",
    page: "Page number for pagination (default: 1)",
    limit: "Items per page (default: 10)",
  },
});

// Initialize dashboard (must be called after route registration)
dashboard.init(app);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Dashboard: http://localhost:${PORT}/docs`);
  console.log("\n📋 Available API categories:");
  console.log("  🔐 Authentication APIs (/api/auth)");
  console.log("     - POST /login");
  console.log("     - POST /register");
  console.log("     - POST /verify-otp");
  console.log("     - POST /forgot-password");
  console.log("     - POST /reset-password");
  console.log("\n  👥 User Management APIs (/api/user)");
  console.log("     - GET  /profile");
  console.log("     - PUT  /profile");
  console.log("     - GET  /all-users");
  console.log("     - POST / (create user)");
  console.log("     - DELETE /:id");
  console.log("\n  📦 Product APIs (/api/products)");
  console.log("     - GET  / (with filtering)");
  console.log("     - POST / (create product)");
  console.log("     - GET  /:id");
  console.log("     - PUT  /:id");
  console.log("     - DELETE /:id");
});

module.exports = app;
