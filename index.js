const express = require("express");
const http = require("http");
const cors = require("cors");
const { bgRed, bgYellow, bgBlue, bgMagenta, bgGreen } = require("colorette");
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
const statusCheckerService = require("./src/services/ai/status-checker.service");
const {
  initializeWebSocketServer,
} = require("./src/websocket/framework-comparison.websocket");

// Import routes
const authRoutes = require("./src/routes/auth/auth.routes");
const userRoutes = require("./src/routes/admin/user.routes");
const documentRoutes = require("./src/routes/user/user-document.routes");
const frameworkRoutes = require("./src/routes/user/user-framework.routes");
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
app.use("/api/users/documents", documentRoutes);
app.use("/api/users/frameworks", frameworkRoutes);
app.use("/api/users/framework-comparisons", frameworkComparisonRoutes);
app.use("/api/expert/frameworks", expertFrameworkRoutes);

// Debug endpoint for testing WebSocket completion
app.post("/api/debug/test-completion/:frameworkId", async (req, res) => {
  try {
    const { frameworkId } = req.params;
    const { userId } = req.body;

    const {
      sendToUser,
    } = require("./src/websocket/framework-comparison.websocket");

    const testMessage = {
      type: "framework-ai-processing",
      frameworkId: frameworkId,
      status: "completed",
      control_extraction_status: "completed",
      message: "AI processing completed! 15 controls extracted.",
      controlsCount: 15,
      extractedControls: [
        {
          Control_id: "2.1",
          Control_name: "Test Control",
          Control_description: "This is a test control for debugging",
          Control_type: "Configuration",
          Deployment_points: "Test deployment points",
        },
      ],
      controlsExtractedAt: new Date(),
    };

    console.log("🧪 Sending test completion message:", testMessage);
    sendToUser(userId, testMessage);

    res.json({
      success: true,
      message: "Test completion message sent",
      data: testMessage,
    });
  } catch (error) {
    console.error("❌ Debug endpoint error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Register routes with dashboard for better documentation
dashboard.registerRoutes("/api/auth", authRoutes);
dashboard.registerRoutes("/api/user", userRoutes);
dashboard.registerRoutes("/api/users/documents", documentRoutes);
dashboard.registerRoutes("/api/users/frameworks", frameworkRoutes);
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
    console.log(bgMagenta("📊 Connected to MongoDB"));

    httpServer = server.listen(PORT, "0.0.0.0", () => {
      const ipv4 = getLocalIPv4();

      // Initialize WebSocket server for framework comparisons
      initializeWebSocketServer(httpServer);

      // Start AI status checker service
      statusCheckerService.start();

      // ✅ Development ke liye actual IPv4
      if (process.env.NODE_ENV !== "production") {
        console.log(bgGreen(`🌐 Network access → http://${ipv4}:${PORT}`));
        console.log(
          bgGreen(
            `🔗 WebSocket URL → ws://${ipv4}:${PORT}/ws/framework-comparisons`
          )
        );
      }
      console.log(
        bgBlue(`🌐 Server listening on port → http://localhost:${PORT}`)
      );
      console.log(
        bgBlue(
          `🔗 WebSocket endpoint → ws://localhost:${PORT}/ws/framework-comparisons`
        )
      );
    });
  } catch (err) {
    console.error(bgRed("Failed to start app:"), err);
    process.exit(1);
  }
}

function gracefulShutdown() {
  console.log(bgYellow("Shutting down..."));

  // Close all AI WebSocket connections
  expertAIService.closeAllConnections();
  userAIService.closeAllConnections();
  frameworkComparisonAIService.closeAllConnections();

  // Stop status checker service
  statusCheckerService.stop();

  Promise.resolve()
    .then(() => disconnectDB())
    .then(() => {
      if (httpServer) httpServer.close(() => process.exit(0));
      else process.exit(0);
    })
    .catch((err) => {
      console.error(bgRed("Error during shutdown"), err);
      process.exit(1);
    });
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

start();
