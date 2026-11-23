const { User } = require("../models/User");
const { Follow } = require("../models/Follow");
const { HttpError } = require("../utils/httpError");

// Fields anyone logged in may see about ANOTHER user. Never email, hash or tokenVersion.
const PUBLIC_FIELDS = "name username bio avatarUrl createdAt";

/** Plain object with only public fields (works for lean objects and documents). */
function toPublicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    username: user.username,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
  };
}

/** Loads a user by username or throws 404. */
async function findUserOr404(username) {
  const user = await User.findOne({ username }).select(PUBLIC_FIELDS).lean();

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  return user;
}

/** GET /api/users/search?q=ama&limit=10  -> usernames STARTING with q */
async function searchUsers(req, res) {
  const { q, limit } = req.valid.query;

  // q is allowlisted to [a-z0-9_], so it is safe inside a regex.
  // An anchored (^), case-sensitive prefix regex can use the unique username index.
  const users = await User.find({ username: { $regex: `^${q}` } })
    .sort({ username: 1 })
    .limit(limit)
    .select(PUBLIC_FIELDS)
    .lean();

  res.status(200).json({ users: users.map(toPublicUser) });
}

/** GET /api/users/:username -> public profile + counts + relationship to me */
async function getProfile(req, res) {
  const user = await findUserOr404(req.valid.params.username);

  // Three independent queries -> run them in parallel, not one after another.
  const [followerCount, followingCount, iFollow] = await Promise.all([
    Follow.countDocuments({ following: user._id }),
    Follow.countDocuments({ follower: user._id }),
    Follow.exists({ follower: req.user._id, following: user._id }),
  ]);

  res.status(200).json({
    user: { ...toPublicUser(user), createdAt: user.createdAt },
    followerCount,
    followingCount,
    isFollowing: Boolean(iFollow),
    isMe: user._id.equals(req.user._id),
  });
}

/** PATCH /api/users/me  body: { name?, bio? } (already validated) */
async function updateMe(req, res) {
  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $set: req.valid.body },
    // runValidators: Mongoose does NOT validate update queries unless asked (defence in depth).
    { returnDocument: "after", runValidators: true }
  );

  // My own profile: the full toJSON shape (includes my email) is fine here.
  res.status(200).json({ user: updated });
}

/** POST /api/users/:username/follow  -> 201 if newly followed, 200 if already following */
async function followUser(req, res) {
  const target = await findUserOr404(req.valid.params.username);

  if (target._id.equals(req.user._id)) {
    throw new HttpError(400, "You cannot follow yourself");
  }

  try {
    await Follow.create({ follower: req.user._id, following: target._id });
  } catch (err) {
    // Unique index hit: already following. Following twice = still following once (idempotent).
    if (err.code === 11000) {
      return res.status(200).json({ following: true });
    }

    throw err;
  }

  res.status(201).json({ following: true });
}

/** DELETE /api/users/:username/follow -> 204 whether or not I was following (idempotent) */
async function unfollowUser(req, res) {
  const target = await findUserOr404(req.valid.params.username);

  await Follow.deleteOne({ follower: req.user._id, following: target._id });

  res.status(204).end();
}

/**
 * Shared cursor-paginated list.
 *   filterField:  field that must equal the target user ("following" for followers list)
 *   otherField:   field holding the users to return ("follower" for followers list)
 */
async function listFollows(req, res, filterField, otherField) {
  const target = await findUserOr404(req.valid.params.username);
  const { limit, cursor } = req.valid.query;

  const filter = { [filterField]: target._id };

  // Cursor = _id of the last Follow on the previous page; continue strictly after it.
  if (cursor) {
    filter._id = { $lt: cursor };
  }

  // Fetch ONE extra row: if it exists, there is another page.
  const rows = await Follow.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate(otherField, PUBLIC_FIELDS)
    .lean();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  res.status(200).json({
    users: page
      .filter((row) => row[otherField] !== null) // the other user was deleted
      .map((row) => toPublicUser(row[otherField])),
    nextCursor: hasMore ? String(page[page.length - 1]._id) : null,
  });
}

/** GET /api/users/:username/followers?limit=&cursor= */
function listFollowers(req, res) {
  return listFollows(req, res, "following", "follower");
}

/** GET /api/users/:username/following?limit=&cursor= */
function listFollowing(req, res) {
  return listFollows(req, res, "follower", "following");
}

module.exports = {
  searchUsers,
  getProfile,
  updateMe,
  followUser,
  unfollowUser,
  listFollowers,
  listFollowing,
};
