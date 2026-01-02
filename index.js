const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const { bgRed, bgYellow, bgBlue, bgMagenta, bgGreen, bgMagentaBright } = require("colorette");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables FIRST
dotenv.config();

const SwaggerExpressDashboard = require("./swagger");
const { connectDB, disconnectDB } = require("./src/database/database");
const { getLocalIPv4 } = require("./src/helpers/helper");
const { aiFrameworkWsService } = require("./src/services/ai/aiFramework.ws");
const ExpertFramework = require("./src/models/expertFramework.model");
// const { initializeRedis, closeRedis } = require("./src/config/cache.config");
// const cacheService = require("./src/services/cache.service");

// Import routes
const authRoutes = require("./src/routes/auth/auth.routes");
const userRoutes = require("./src/routes/admin/user.routes");
const documentRoutes = require("./src/routes/user/document.routes");
const frameworkRoutes = require("./src/routes/user/framework.routes");
const expertFrameworkRoutes = require("./src/routes/expert/framework.routes");
// const cacheRoutes = require("./src/routes/admin/cache.routes");

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
app.use("/api/expert/frameworks", expertFrameworkRoutes);
// app.use("/api/admin/cache", cacheRoutes);

// Register routes with dashboard for better documentation
dashboard.registerRoutes("/api/auth", authRoutes);
dashboard.registerRoutes("/api/user", userRoutes);
dashboard.registerRoutes("/api/users/documents", documentRoutes);
dashboard.registerRoutes("/api/users/frameworks", frameworkRoutes);
dashboard.registerRoutes("/api/expert/frameworks", expertFrameworkRoutes);
// dashboard.registerRoutes("/api/admin/cache", cacheRoutes);

// Initialize dashboard (replaces your old endpoints)
dashboard.init(app);

// WebSocket Server Setup
const wss = new WebSocket.Server({ server });

// WebSocket connection handler
wss.on("connection", (ws, req) => {
  const url = req.url;
  console.log(`🔌 WebSocket connection: ${url}`);

  // Handle framework controls WebSocket endpoint
  const frameworkControlsMatch = url.match(
    /^\/ws\/framework-controls\/([a-fA-F0-9]{24})$/
  );

  if (frameworkControlsMatch) {
    const frameworkId = frameworkControlsMatch[1];
    handleFrameworkControlsWebSocket(ws, frameworkId);
  } else {
    // Unknown WebSocket endpoint
    ws.close(1000, "Unknown endpoint");
  }
});

// Framework Controls WebSocket Handler
async function handleFrameworkControlsWebSocket(ws, frameworkId) {
  try {
    console.log(
      `🔌 Framework controls WebSocket connected for: ${frameworkId}`
    );

    // Find framework in database
    const framework = await ExpertFramework.findOne({
      _id: frameworkId,
      isActive: true,
    }).populate("uploadedBy", "name email role");

    if (!framework) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Framework not found",
          frameworkId,
        })
      );
      ws.close(1000, "Framework not found");
      return;
    }

    // Check if framework has AI UUID
    if (!framework.aiProcessing.uuid) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Framework has not been uploaded to AI service yet",
          frameworkId,
        })
      );
      ws.close(1000, "No AI UUID");
      return;
    }

    // If controls are already extracted and stored, send them immediately
    if (
      framework.aiProcessing.extractedControls &&
      framework.aiProcessing.extractedControls.length > 0 &&
      framework.aiProcessing.status === "completed"
    ) {
      ws.send(
        JSON.stringify({
          type: "ai_message",
          status: "completed",
          frameworkId,
          controls: framework.aiProcessing.extractedControls,
          controlsCount: framework.aiProcessing.controlsCount,
          message: `Found ${framework.aiProcessing.controlsCount} extracted controls`,
        })
      );
      ws.close(1000, "Controls already available");
      return;
    }

    // Connect to AI WebSocket for real-time updates
    aiFrameworkWsService.connectToAIWebSocket(
      framework.aiProcessing.uuid,
      ws,
      frameworkId
    );

    // Handle WebSocket close
    ws.on("close", () => {
      console.log(`🔌 Framework controls WebSocket closed for: ${frameworkId}`);
    });
  } catch (error) {
    console.error(
      `❌ Error handling framework controls WebSocket for ${frameworkId}:`,
      error
    );

    ws.send(
      JSON.stringify({
        type: "error",
        message: "Internal server error",
        frameworkId,
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      })
    );

    ws.close(1000, "Internal error");
  }
}

// Global error handling middleware (must be after all routes)
app.use(globalErrorHandler);

// 404 handler for undefined routes
app.use(notFoundHandler);

let httpServer;

async function start() {
  try {
    await connectDB(MONGODB_URI);
    console.log(bgMagenta("📊 Connected to MongoDB"));

    // Initialize caching (commented out for now)
    // await initializeRedis();
    // console.log(bgMagenta("Cache system initialized"));

    // Warm up cache with frequently accessed data (commented out for now)
    // setTimeout(() => {
    //   cacheService.warmupCache();
    // }, 5000); // Wait 5 seconds after startup

    httpServer = server.listen(PORT, "0.0.0.0", () => {
      const ipv4 = getLocalIPv4();
      // ✅ Development ke liye actual IPv4
      if (process.env.NODE_ENV !== "production") {
        console.log(bgGreen(`🌐 Network access → http://${ipv4}:${PORT}`));
        console.log(
          bgMagentaBright(`🤖 AI Service Base URL: ${process.env.AI_BASE_URL_API}`)
        );
      }
      console.log(
        bgBlue(`🌐 Server listening on port → http://localhost:${PORT}`)
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
  aiFrameworkWsService.closeAllConnections();

  Promise.resolve()
    // .then(() => closeRedis()) // Commented out for now
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
