const bcrypt = require("bcrypt");
const { env } = require("../config/env");

// bcrypt silently ignores everything after the first 72 BYTES of a password.
// Validation rejects longer passwords with a friendly 400; this is the last guard.
const BCRYPT_MAX_BYTES = 72;

/**
 * Hashes a plain-text password with a fresh random salt.
 * Runs on libuv's thread pool, so it does not block the event loop.
 */
async function hashPassword(plain) {
  if (Buffer.byteLength(plain, "utf8") > BCRYPT_MAX_BYTES) {
    throw new Error(`Password longer than ${BCRYPT_MAX_BYTES} bytes reached hashPassword`);
  }

  return bcrypt.hash(plain, env.bcryptRounds);
}

/**
 * Checks a plain-text password against a stored hash.
 * The salt and cost are read from the hash itself.
 */
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { hashPassword, verifyPassword, BCRYPT_MAX_BYTES };
