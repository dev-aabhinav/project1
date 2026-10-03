// Load .env into process.env BEFORE any other code reads it.
require("dotenv").config({ quiet: true });

const http = require("http");
const { createApp } = require("./app");

// Env vars are always strings: convert and validate, or crash now (fail fast).
const port = Number(process.env.PORT ?? 5000);

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`Invalid PORT: "${process.env.PORT}". Must be an integer 0-65535.`);
  process.exit(1);
}

const app = createApp();

// A plain Node HTTP server that hands every request to our Express app.
// Socket.IO (Milestone 8) will attach to this same server.
const server = http.createServer(app);

// e.g. EADDRINUSE (port already taken) or EACCES (no permission for the port).
server.on("error", (err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

server.listen(port, () => {
  const mode = process.env.NODE_ENV || "development";
  console.log(`Huddle API listening on http://localhost:${port} (${mode})`);
});

// Graceful shutdown: stop accepting new connections, let in-flight requests finish.
function shutdown(signal) {
  console.log(`${signal} received: closing HTTP server...`);

  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    console.log("HTTP server closed. Bye.");
    process.exit(0);
  });

  // Safety net: if something hangs, force exit after 10 seconds.
  setTimeout(() => {
    console.error("Shutdown timed out after 10s, forcing exit.");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
