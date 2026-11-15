// First line: loads .env and validates ALL config. Throws (and the app exits) if invalid.
const { env } = require("./config/env");

const http = require("http");
const { createApp } = require("./app");
const { connectDB, disconnectDB } = require("./config/db");

// Register every model so connectDB() can create their indexes.
require("./models");

async function start() {
  // 1. Connect to MongoDB BEFORE accepting any request.
  try {
    await connectDB();
  } catch (err) {
    console.error(`Failed to connect to MongoDB: ${err.message}`);
    process.exit(1);
  }

  // 2. Build the app and the HTTP server. Socket.IO (M8) will attach to this server.
  const app = createApp();
  const server = http.createServer(app);

  // e.g. EADDRINUSE (port already taken) or EACCES (no permission for the port).
  server.on("error", (err) => {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  });

  // 3. Start accepting requests.
  server.listen(env.port, () => {
    const actualPort = server.address().port; // differs from env.port when PORT=0
    console.log(`Huddle API listening on http://localhost:${actualPort} (${env.nodeEnv})`);
  });

  // Graceful shutdown: stop new connections, let in-flight requests finish,
  // THEN close the DB (in-flight requests may still need it).
  function shutdown(signal) {
    console.log(`${signal} received: closing HTTP server...`);

    // Safety net: if something hangs, force exit after 10 seconds.
    setTimeout(() => {
      console.error("Shutdown timed out after 10s, forcing exit.");
      process.exit(1);
    }, 10_000).unref();

    server.close(async (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }

      try {
        await disconnectDB();
      } catch (dbErr) {
        console.error(`Error closing MongoDB: ${dbErr.message}`);
        process.exit(1);
      }

      console.log("HTTP server and MongoDB closed. Bye.");
      process.exit(0);
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
