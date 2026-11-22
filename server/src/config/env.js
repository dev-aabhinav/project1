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

// ---- JWT_SECRET ---- (required: signs every login token)
// The value in .env.example is for local development only.
const DEV_EXAMPLE_JWT_SECRET = "dev-only-secret-change-me-0123456789abcdef";
const jwtSecret = process.env.JWT_SECRET || "";

if (!jwtSecret) {
  errors.push("JWT_SECRET is required");
} else if (jwtSecret.length < 32) {
  errors.push("JWT_SECRET must be at least 32 characters");
} else if (nodeEnv === "production" && jwtSecret === DEV_EXAMPLE_JWT_SECRET) {
  errors.push("JWT_SECRET must not be the example value in production");
}

// ---- JWT_EXPIRES_IN ---- e.g. "15m", "12h", "1d"
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1d";

if (!/^\d+[smhd]$/.test(jwtExpiresIn)) {
  errors.push(`JWT_EXPIRES_IN must look like 15m, 12h or 1d (got "${jwtExpiresIn}")`);
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
  jwtSecret,
  jwtExpiresIn,
});

module.exports = { env };
