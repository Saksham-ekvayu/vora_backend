const express = require("express");
const http = require("http");
const cors = require("cors");
const {
  bgRed,
  bgYellow,
  bgBlue,
  bgMagenta,
  bgGreen,
  black,
  bgWhite,
  bgCyan,
  bgMagentaBright,
} = require("colorette");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables FIRST
dotenv.config();

const SwaggerExpressDashboard = require("./swagger");
const { connectDB, disconnectDB } = require("./src/database/database");
const { getLocalIPv4 } = require("./src/helpers/helper");
const expertAIService = require("./src/services/ai/expert-ai.service");
const userAIService = require("./src/services/ai/user-ai.service");
const frameworkComparisonAIService = require("./src/services/ai/framework-comparison-ai.service");
const {
  initializeWebSocketServer,
} = require("./src/websocket/framework-comparison.websocket");

// Import routes
const authRoutes = require("./src/routes/auth/auth.routes");
const userRoutes = require("./src/routes/admin/user.routes");
const userDocumentRoutes = require("./src/routes/user/user-document.routes");
const userFrameworkRoutes = require("./src/routes/user/user-framework.routes");
const expertFrameworkRoutes = require("./src/routes/expert/expert-framework.routes");
const frameworkComparisonRoutes = require("./src/routes/user/framework-comparison.routes");

// Import error handling middleware
const {
  globalErrorHandler,
  notFoundHandler,
} = require("./src/middlewares/errorHandler.middleware");

const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;

// Create Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redirect root (/) to /api-docs
app.get("/", (req, res) => {
  return res.redirect("/api-docs");
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Serve uploaded files (with authentication middleware if needed)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Initialize dashboard
const dashboard = new SwaggerExpressDashboard({
  title: "VORA Backend API",
  description: "Backend API Control Dashboard",
  version: "1.0.0",
  basePath: "/api-docs",
  enableAuth: true,
  enableTesting: true,
  controllersPath: "./src/controllers",
});

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/users/documents", userDocumentRoutes);
app.use("/api/users/frameworks", userFrameworkRoutes);
app.use("/api/users/framework-comparisons", frameworkComparisonRoutes);
app.use("/api/expert/frameworks", expertFrameworkRoutes);

// Register routes with dashboard for better documentation
dashboard.registerRoutes("/api/auth", authRoutes);
dashboard.registerRoutes("/api/user", userRoutes);
dashboard.registerRoutes("/api/users/documents", userDocumentRoutes);
dashboard.registerRoutes("/api/users/frameworks", userFrameworkRoutes);
dashboard.registerRoutes(
  "/api/users/framework-comparisons",
  frameworkComparisonRoutes
);
dashboard.registerRoutes("/api/expert/frameworks", expertFrameworkRoutes);

// Initialize dashboard
dashboard.init(app);

// Global error handling middleware (must be after all routes)
app.use(globalErrorHandler);

// 404 handler for undefined routes
app.use(notFoundHandler);

let httpServer;

async function start() {
  try {
    await connectDB(MONGODB_URI);
    console.log(bgYellow("🗄️ MongoDB connected successfully"));

    httpServer = server.listen(PORT, "0.0.0.0", () => {
      const ipv4 = getLocalIPv4();

      // Initialize WebSocket server
      initializeWebSocketServer(httpServer);

      // Development logs
      if (process.env.NODE_ENV !== "production") {
        console.log(bgGreen(`🌐 Server (Network) → http://${ipv4}:${PORT}`));
        console.log(
          bgWhite(black(`🔗 WebSocket (Network) → ws://${ipv4}:${PORT}`))
        );
      }

      console.log(bgBlue(`🌐 Server (Local) → http://localhost:${PORT}`));
      console.log(
        bgMagentaBright(`🔗 WebSocket (Local) → ws://localhost:${PORT}`)
      );
    });
  } catch (err) {
    console.error(bgRed("❌ Failed to start app"), err);
    process.exit(1);
  }
}

function gracefulShutdown() {
  console.log(bgYellow("🛑 Shutting down application..."));

  // Close all AI WebSocket connections
  expertAIService.closeAllConnections();
  userAIService.closeAllConnections();
  frameworkComparisonAIService.closeAllConnections();

  Promise.resolve()
    .then(() => disconnectDB())
    .then(() => {
      console.log(bgGreen("✅ Cleanup completed, exiting process"));

      if (httpServer) httpServer.close(() => process.exit(0));
      else process.exit(0);
    })
    .catch((err) => {
      console.error(bgRed("❌ Error during shutdown"), err);
      process.exit(1);
    });
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

start();
