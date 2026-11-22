const { MongoMemoryServer } = require("mongodb-memory-server");

module.exports = async function globalSetup() {
  const mongod = await MongoMemoryServer.create();

  // e.g. "mongodb://127.0.0.1:41235/" -> each worker appends its own DB name (setupEnv.js).
  process.env.MONGO_TEST_BASE_URI = mongod.getUri();

  // Keep a handle so globalTeardown can stop it.
  globalThis.__MONGOD__ = mongod;
};
