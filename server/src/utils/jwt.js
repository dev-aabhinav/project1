const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

// Pin ONE algorithm for both signing and verifying (see verifyAccessToken).
const ALGORITHM = "HS256";

/**
 * Creates a signed access token for a user.
 * Payload is deliberately tiny: anyone can READ a JWT, so no email/name/secrets in it.
 *   sub = user id (standard "subject" claim)
 *   tv  = token version; bumping it in the DB invalidates all older tokens
 */
function signAccessToken({ userId, tokenVersion }) {
  return jwt.sign({ tv: tokenVersion }, env.jwtSecret, {
    algorithm: ALGORITHM,
    subject: String(userId),
    expiresIn: env.jwtExpiresIn,
  });
}

/**
 * Verifies signature + expiry and returns the payload ({ sub, tv, iat, exp }).
 * Throws TokenExpiredError / JsonWebTokenError if the token is expired, tampered or malformed.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM] });
}

module.exports = { signAccessToken, verifyAccessToken };
