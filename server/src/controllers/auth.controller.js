const { User } = require("../models/User");
const { hashPassword, verifyPassword } = require("../utils/password");
const { signAccessToken } = require("../utils/jwt");
const { HttpError } = require("../utils/httpError");

// Same message whether the email is unknown or the password is wrong (no user enumeration).
const INVALID_CREDENTIALS = "Invalid email or password";

// When the email doesn't exist we still run one bcrypt comparison against this dummy hash,
// so the response takes about as long as for a real user (no timing-based enumeration).
// Created lazily once, with the same cost factor as real hashes.
let dummyHashPromise = null;

function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("dummy-password-used-only-for-timing");
  }

  return dummyHashPromise;
}

function issueToken(user) {
  return signAccessToken({ userId: user._id, tokenVersion: user.tokenVersion });
}

/** POST /api/auth/signup  body: { name, username, email, password } (already validated) */
async function signup(req, res) {
  const { name, username, email, password } = req.body;

  const passwordHash = await hashPassword(password);

  // Duplicate email/username -> MongoDB E11000 -> toHttpError -> 409. No "find first" race.
  const user = await User.create({ name, username, email, passwordHash });

  res.status(201).json({ user, token: issueToken(user) });
}

/** POST /api/auth/login  body: { email, password } (already validated) */
async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+passwordHash +tokenVersion");

  // Always run exactly one bcrypt comparison, user or not.
  const hashToCheck = user ? user.passwordHash : await getDummyHash();
  const passwordOk = await verifyPassword(password, hashToCheck);

  if (!user || !passwordOk) {
    throw new HttpError(401, INVALID_CREDENTIALS);
  }

  res.status(200).json({ user, token: issueToken(user) });
}

/** GET /api/auth/me  (requireAuth already loaded the current user) */
function me(req, res) {
  res.status(200).json({ user: req.user });
}

/** PATCH /api/auth/password  body: { currentPassword, newPassword } (already validated) */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  const current = await User.findById(req.user._id).select("+passwordHash");

  if (!(await verifyPassword(currentPassword, current.passwordHash))) {
    // 400, not 401: the user IS authenticated; a 401 would make the frontend log them out.
    throw new HttpError(400, "Current password is incorrect", [
      { field: "currentPassword", message: "Current password is incorrect" },
    ]);
  }

  const newHash = await hashPassword(newPassword);

  // One atomic update: new hash AND tokenVersion + 1, so every older token stops working.
  const updated = await User.findOneAndUpdate(
    { _id: current._id },
    { $set: { passwordHash: newHash }, $inc: { tokenVersion: 1 } },
    { returnDocument: "after" }
  ).select("+tokenVersion");

  // A fresh token with the new version keeps THIS device logged in.
  res.status(200).json({ message: "Password changed", token: issueToken(updated) });
}

module.exports = { signup, login, me, changePassword };
