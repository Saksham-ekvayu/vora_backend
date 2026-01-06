const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const userConnections = new Map();

async function authenticateWebSocket(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.userId);
  if (!user || decoded.tokenVersion !== user.tokenVersion) {
    throw new Error("Invalid token");
  }
  return user;
}

function sendToUser(userId, message) {
  const connections = userConnections.get(userId);
  if (connections) {
    const messageStr = JSON.stringify(message);
    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }
}

async function handleWebSocketConnection(ws, req) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(1008, "No token provided");
      return;
    }

    const user = await authenticateWebSocket(token);
    const userId = user._id.toString();

    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId).add(ws);

    ws.send(JSON.stringify({ type: "connection", status: "connected" }));

    ws.on("close", () => {
      const connections = userConnections.get(userId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          userConnections.delete(userId);
        }
      }
    });
  } catch (error) {
    ws.close(1008, "Authentication failed");
  }
}

function initializeWebSocketServer(server) {
  const wss = new WebSocket.Server({
    server,
    path: "/ws/framework-comparisons",
    verifyClient: (info) => {
      // Allow connections from localhost and the network IP
      const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://192.168.1.21:5173",
        "http://192.168.1.21:5174",
      ];

      const origin = info.origin;

      if (!origin || allowedOrigins.includes(origin)) {
        return true;
      }

      return false;
    },
  });

  wss.on("connection", handleWebSocketConnection);
  return wss;
}

module.exports = {
  initializeWebSocketServer,
  sendToUser,
};
