const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/requireAuth");
const { HttpError } = require("../utils/httpError");
const { signupSchema, loginSchema, changePasswordSchema } = require("../validators/auth.schemas");
const { signup, login, me, changePassword } = require("../controllers/auth.controller");

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

/**
 * Per-IP rate limiter. Over the limit -> our standard { error } JSON with 429,
 * plus RateLimit and Retry-After headers so clients know when to retry.
 * State is kept in this process's memory (see notes: needs Redis with many instances).
 */
function makeLimiter({ windowMs, limit, message, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res, next) => next(new HttpError(429, message)),
  });
}

/**
 * Builds the /api/auth router. A function (not a module-level router) so every
 * createApp() call, e.g. one per test, gets its own fresh rate-limit counters.
 */
function createAuthRouter() {
  const router = express.Router();

  // Failed logins only (successful ones don't count): 10 per 15 min per IP.
  const loginLimiter = makeLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 10,
    skipSuccessfulRequests: true,
    message: "Too many login attempts. Please try again later.",
  });

  // Every signup costs a bcrypt hash: 10 per hour per IP.
  const signupLimiter = makeLimiter({
    windowMs: ONE_HOUR,
    limit: 10,
    message: "Too many sign-ups from this network. Please try again later.",
  });

  router.post("/signup", signupLimiter, validate(signupSchema), signup);
  router.post("/login", loginLimiter, validate(loginSchema), login);
  router.get("/me", requireAuth, me);
  router.patch("/password", requireAuth, validate(changePasswordSchema), changePassword);

  return router;
}

module.exports = { createAuthRouter };
