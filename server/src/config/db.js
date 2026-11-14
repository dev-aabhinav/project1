const mongoose = require("mongoose");
const { env } = require("./env");

// If the DB is down, fail queries immediately instead of silently queueing them.
mongoose.set("bufferCommands", false);

// Log connection state changes so DB problems are visible in the server logs.
mongoose.connection.on("disconnected", () => {
  console.warn("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

mongoose.connection.on("error", (err) => {
  console.error(`MongoDB error: ${err.message}`);
});

/**
 * Connects to MongoDB. Throws if the server cannot be reached within 5 s.
 * The caller (server.js) decides what to do on failure.
 */
async function connectDB() {
  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 5000,
  });

  // Log host and DB name only: the full URI can contain a password.
  const { host, port, name } = mongoose.connection;
  console.log(`MongoDB connected: ${host}:${port}/${name}`);
}

/** True only while the connection is open (readyState 1 = "connected"). */
function isDBReady() {
  return mongoose.connection.readyState === 1;
}

/** Closes the connection pool. Used during graceful shutdown. */
async function disconnectDB() {
  await mongoose.connection.close();
}

module.exports = { connectDB, isDBReady, disconnectDB };
