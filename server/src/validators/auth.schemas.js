const { z } = require("zod");
const { BCRYPT_MAX_BYTES } = require("../utils/password");

// A string field with accurate messages: missing -> "X is required", wrong type -> "X must be a string".
function requiredString(label) {
  return z.string({
    error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be a string`),
  });
}

// New passwords (signup, change password). Login does NOT use this rule.
const newPassword = requiredString("Password")
  .min(8, "Password must be at least 8 characters")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= BCRYPT_MAX_BYTES,
    `Password must be at most ${BCRYPT_MAX_BYTES} bytes`
  );

const email = requiredString("Email")
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .pipe(z.email("Email is invalid"));

const signupSchema = z.object({
  name: requiredString("Name")
    .trim()
    .min(1, "Name is required")
    .max(50, "Name must be at most 50 characters"),

  username: requiredString("Username")
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, "Username must be 3-20 letters, numbers or underscores"),

  email,

  password: newPassword,
});

const loginSchema = z.object({
  email,
  // Any non-empty string: don't reveal or enforce the CURRENT password policy at login.
  password: requiredString("Password").min(1, "Password is required"),
});

const changePasswordSchema = z
  .object({
    currentPassword: requiredString("Current password").min(1, "Current password is required"),
    newPassword,
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });

module.exports = { signupSchema, loginSchema, changePasswordSchema };
