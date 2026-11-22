// Test configuration. Set BEFORE app code loads; dotenv never overrides variables already set.
process.env.NODE_ENV = "test";
process.env.BCRYPT_ROUNDS = "4"; // minimum cost: ~1 ms per hash instead of ~143 ms
process.env.JWT_SECRET = "test-only-secret-0123456789abcdef0123456789";
process.env.JWT_EXPIRES_IN = "1h";

// One database per Jest worker, so test files running in parallel never share data.
process.env.MONGODB_URI = `${process.env.MONGO_TEST_BASE_URI}huddle_test_${process.env.JEST_WORKER_ID}`;
