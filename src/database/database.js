const mongoose = require("mongoose");

async function connectDB(uri, options = {}) {
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri, options);
  mongoose.connection.on("connected", () => console.log("MongoDB connected"));
  mongoose.connection.on("error", (err) =>
    console.error("MongoDB error:", err)
  );
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
