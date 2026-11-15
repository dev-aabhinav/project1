const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name must be at most 50 characters"],
    },

    // Public handle used in URLs (/u/aabhinav). Stored lowercase so uniqueness is case-insensitive.
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_]{3,20}$/, "Username must be 3-20 letters, numbers or underscores"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email is too long"],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email is invalid"],
    },

    // Only the bcrypt hash is stored (M3), never the password itself.
    // select: false -> not returned by queries unless explicitly requested.
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    bio: {
      type: String,
      trim: true,
      maxlength: [160, "Bio must be at most 160 characters"],
      default: "",
    },

    avatarUrl: {
      type: String,
      default: null,
    },
  },
  {
    // Adds createdAt and updatedAt, set automatically per document.
    timestamps: true,

    // Shape of the user when sent as JSON in an API response.
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

const User = mongoose.model("User", userSchema);

module.exports = { User };
