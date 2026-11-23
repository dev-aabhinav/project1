const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/requireAuth");
const { HttpError } = require("../utils/httpError");
const { usernameParams, searchQuery, paginationQuery, updateMeSchema } = require("../validators/user.schemas");
const {
  searchUsers,
  getProfile,
  updateMe,
  followUser,
  unfollowUser,
  listFollowers,
  listFollowing,
} = require("../controllers/users.controller");

const ONE_HOUR = 60 * 60 * 1000;

/**
 * Builds the /api/users router. Every route requires login (members-only app).
 * A function so each createApp() (each test) gets fresh rate-limit counters.
 */
function createUsersRouter() {
  const router = express.Router();

  // All routes below need a logged-in user.
  router.use(requireAuth);

  // Per USER (not per IP): these routes are authenticated, and many users can share an IP.
  const followLimiter = rateLimit({
    windowMs: ONE_HOUR,
    limit: 200,
    keyGenerator: (req) => String(req.user._id),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res, next) => next(new HttpError(429, "Too many follow actions. Please slow down.")),
  });

  const params = validate(usernameParams, "params");

  // Specific paths FIRST: otherwise "/:username" would capture "search" as a username.
  router.get("/search", validate(searchQuery, "query"), searchUsers);
  router.patch("/me", validate(updateMeSchema), updateMe);

  router.get("/:username", params, getProfile);
  router.post("/:username/follow", followLimiter, params, followUser);
  router.delete("/:username/follow", followLimiter, params, unfollowUser);
  router.get("/:username/followers", params, validate(paginationQuery, "query"), listFollowers);
  router.get("/:username/following", params, validate(paginationQuery, "query"), listFollowing);

  return router;
}

module.exports = { createUsersRouter };
