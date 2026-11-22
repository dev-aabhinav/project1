const mongoose = require("mongoose");
const { User } = require("../models/User");
const { verifyAccessToken } = require("../utils/jwt");
const { HttpError } = require("../utils/httpError");

// One message for every token failure: don't tell an attacker WHICH check failed.
const INVALID_TOKEN = "Invalid or expired token";

/**
 * Protects a route. Expects "Authorization: Bearer <jwt>".
 * On success sets req.user to the CURRENT user document from the DB.
 * On any failure responds 401.
 */
async function requireAuth(req, res, next) {
  // 1. Header present and in the "Bearer <token>" format? (scheme is case-insensitive)
  const header = req.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    throw new HttpError(401, "Authentication required");
  }

  // 2. Signature valid and not expired?
  let payload;

  try {
    payload = verifyAccessToken(match[1]);
  } catch {
    throw new HttpError(401, INVALID_TOKEN);
  }

  // 3. Does the user still exist? (guard: sub must be an ObjectId, else findById throws a CastError)
  if (!mongoose.isValidObjectId(payload.sub)) {
    throw new HttpError(401, INVALID_TOKEN);
  }

  const user = await User.findById(payload.sub).select("+tokenVersion");

  // 4. Was the token issued before the last "log out everywhere" (e.g. password change)?
  if (!user || user.tokenVersion !== payload.tv) {
    throw new HttpError(401, INVALID_TOKEN);
  }

  req.user = user;
  next();
}

module.exports = { requireAuth };
