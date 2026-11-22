const { z } = require("zod");
const { username, paginationQuery, requiredString } = require("./common");

// /api/users/:username
const usernameParams = z.object({ username });

// GET /api/users/search?q=ama&limit=10
// q is an ALLOWLIST of username characters, so it is safe to put inside a regex later.
const searchQuery = z.object({
  q: requiredString("q")
    .trim()
    .toLowerCase()
    .min(1, "q is required")
    .max(20, "q must be at most 20 characters")
    .regex(/^[a-z0-9_]+$/, "q may only contain letters, numbers or underscores"),

  limit: z.coerce
    .number({ error: "limit must be a number" })
    .int("limit must be a whole number")
    .min(1, "limit must be at least 1")
    .max(20, "limit must be at most 20")
    .default(10),
});

// PATCH /api/users/me — only these fields are editable here (username/email/password are not).
const updateMeSchema = z
  .object({
    name: requiredString("Name")
      .trim()
      .min(1, "Name cannot be empty")
      .max(50, "Name must be at most 50 characters")
      .optional(),

    bio: requiredString("Bio").trim().max(160, "Bio must be at most 160 characters").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Send at least one of: name, bio",
  });

module.exports = { usernameParams, searchQuery, paginationQuery, updateMeSchema };
