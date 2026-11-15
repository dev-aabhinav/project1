const express = require("express");
const { isDBReady } = require("./config/db");
const { toHttpError } = require("./utils/httpError");

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

  // Readiness probe: "can this instance serve real traffic?" Checks the DB connection
  // state in memory (no query), so frequent probes add no DB load.
  app.get("/api/ready", (req, res) => {
    if (!isDBReady()) {
      return res.status(503).json({ status: "not ready", db: "disconnected" });
    }

    res.status(200).json({ status: "ready", db: "connected" });
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

    const httpError = toHttpError(err);

    // Log the ORIGINAL error for server faults; we need its stack to fix the bug.
    if (httpError.status >= 500) {
      console.error(err);
    }

    const body = { error: httpError.message };

    if (httpError.details) {
      body.details = httpError.details;
    }

    res.status(httpError.status).json(body);
  });

  return app;
}

module.exports = { createApp };
