const { z } = require("zod");

// Same rule as the User model: 3-20 lowercase letters, digits or underscores.
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const USERNAME_MESSAGE = "Username must be 3-20 letters, numbers or underscores";

// A string field with accurate messages: missing -> "X is required", wrong type -> "X must be a string".
function requiredString(label) {
  return z.string({
    error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be a string`),
  });
}

const username = requiredString("Username").trim().toLowerCase().regex(USERNAME_REGEX, USERNAME_MESSAGE);

// A MongoDB ObjectId as a 24-character hex string (used as a pagination cursor).
const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, "Invalid cursor");

// ?limit=&cursor= for list endpoints. Query values arrive as STRINGS, so limit is coerced.
const paginationQuery = z.object({
  limit: z.coerce
    .number({ error: "limit must be a number" })
    .int("limit must be a whole number")
    .min(1, "limit must be at least 1")
    .max(50, "limit must be at most 50")
    .default(20),

  cursor: objectIdString.optional(),
});

module.exports = { USERNAME_REGEX, USERNAME_MESSAGE, requiredString, username, objectIdString, paginationQuery };
