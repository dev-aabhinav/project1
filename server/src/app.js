const express = require("express");

/**
 * Builds and returns the Express app WITHOUT starting it.
 * server.js calls listen(); tests import createApp() and use it directly.
 */
function createApp() {
  const app = express();

  // Don't advertise "X-Powered-By: Express" to the world.
  app.disable("x-powered-by");

  // Parse JSON request bodies into req.body. Bodies over 100 KB get a 413.
  app.use(express.json({ limit: "100kb" }));

  // Liveness probe: "is the process up?" It does NOT check the database.
  app.get("/api/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // 404: reached only if no route above matched.
  app.use((req, res) => {
    res.status(404).json({
      error: `Route not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Central error handler. Express recognises it by its 4 parameters.
  // In Express 5, errors thrown in async handlers also land here.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    const status = err.status || err.statusCode || 500;

    if (status >= 500) {
      console.error(err);
    }

    const message = status >= 500 ? "Internal server error" : err.message;

    res.status(status).json({ error: message });
  });

  return app;
}

module.exports = { createApp };
