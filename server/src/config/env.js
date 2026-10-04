// The ONLY file that reads process.env.
// It loads .env, validates every variable once at startup, and exports a frozen config.
// If anything is missing or invalid, the app refuses to start (fail fast).

require("dotenv").config({ quiet: true });

const ALLOWED_NODE_ENVS = ["development", "production", "test"];

const errors = [];

// ---- NODE_ENV ----
const nodeEnv = process.env.NODE_ENV || "development";

if (!ALLOWED_NODE_ENVS.includes(nodeEnv)) {
  errors.push(`NODE_ENV must be one of ${ALLOWED_NODE_ENVS.join(", ")} (got "${nodeEnv}")`);
}

// ---- PORT ----
// Empty counts as "not set" (hence ||). Validate the raw string: digits only.
const rawPort = process.env.PORT || "5000";
const port = Number(rawPort);

if (!/^\d+$/.test(rawPort) || port > 65535) {
  errors.push(`PORT must be an integer 0-65535 (got "${rawPort}")`);
}

// ---- MONGODB_URI ---- (required, no default: it is a secret)
const mongodbUri = process.env.MONGODB_URI || "";

if (!mongodbUri) {
  errors.push("MONGODB_URI is required");
} else if (!/^mongodb(\+srv)?:\/\//.test(mongodbUri)) {
  errors.push('MONGODB_URI must start with "mongodb://" or "mongodb+srv://"');
}

// Report ALL problems at once, not one per restart.
if (errors.length > 0) {
  throw new Error(`Invalid environment configuration:\n  - ${errors.join("\n  - ")}`);
}

const env = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === "production",
  port,
  mongodbUri,
});

module.exports = { env };
