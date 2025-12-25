const express = require("express");
const cors = require("cors");
const { bgRed, bgYellow, bgBlue, bgMagenta } = require("colorette");
const dotenv = require("dotenv");
const path = require("path");
const SwaggerExpressDashboard = require("./swagger");
const { connectDB, disconnectDB } = require("./src/database/database");

// Import routes
const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");

// Load environment variables
dotenv.config();

const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;

// Create Express app
const app = express();

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

// Initialize dashboard
const dashboard = new SwaggerExpressDashboard({
  title: "Cypher Sentinel API",
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

// Register routes with dashboard for better documentation
dashboard.registerRoutes("/api/auth", authRoutes);
dashboard.registerRoutes("/api/user", userRoutes);

// Initialize dashboard (replaces your old endpoints)
dashboard.init(app);

let server;

async function start() {
  try {
    await connectDB(MONGODB_URI);
    console.log(bgMagenta("Connected to MongoDB"));

    server = app.listen(PORT, "0.0.0.0", () => {
      console.log(bgYellow(`Server running on http://0.0.0.0:${PORT}`));
      console.log(bgBlue(`Server listening on port http://localhost:${PORT}`));
    });
  } catch (err) {
    console.error(bgRed("Failed to start app:"), err);
    process.exit(1);
  }
}

function gracefulShutdown() {
  console.log(bgYellow("Shutting down..."));
  Promise.resolve()
    .then(() => disconnectDB())
    .then(() => {
      if (server) server.close(() => process.exit(0));
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
