// Load .env into process.env BEFORE any other code reads it.
require("dotenv").config({ quiet: true });

const http = require("http");
const { createApp } = require("./app");

// Env vars are always strings. An empty PORT counts as "not set" (hence ||, not ??).
const rawPort = process.env.PORT || "5000";

// Validate the raw string: digits only. Number() alone is too forgiving
// (Number("") and Number(" ") are both 0, which means "random port").
const port = Number(rawPort);

if (!/^\d+$/.test(rawPort) || port > 65535) {
  console.error(`Invalid PORT: "${rawPort}". Must be an integer 0-65535.`);
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
  const actualPort = server.address().port; // differs from `port` when PORT=0
  console.log(`Huddle API listening on http://localhost:${actualPort} (${mode})`);
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
