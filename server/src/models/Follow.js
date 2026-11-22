const mongoose = require("mongoose");

/**
 * One document per follow: "follower follows following".
 * A separate collection instead of arrays inside User: documents stay tiny,
 * nothing grows without bound, and a popular user is never one hot document.
 */
const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    // Only createdAt matters: a follow is never edited, only created or deleted.
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// No duplicate follows (DB-enforced, race-proof). Also answers "does A follow B?".
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// "Followers of X, newest first" -> walk this index, no in-memory sort.
followSchema.index({ following: 1, _id: -1 });

// "Who X follows, newest first".
followSchema.index({ follower: 1, _id: -1 });

const Follow = mongoose.model("Follow", followSchema);

module.exports = { Follow };
