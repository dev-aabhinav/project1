const mongoose = require("mongoose");
const { connectDB, disconnectDB } = require("../src/config/db");

// Register all models before connectDB(), so their indexes (unique email...) get built.
require("../src/models");

async function startDB() {
  await connectDB();
}

/** Empty every collection but keep indexes, so each test starts from a clean state. */
async function clearDB() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

async function stopDB() {
  await mongoose.connection.dropDatabase();
  await disconnectDB();
}

module.exports = { startDB, clearDB, stopDB };
