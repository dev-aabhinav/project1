// env.js THROWS on bad config instead of calling process.exit(1).
// That is exactly what makes this test possible: a process.exit would kill the test runner.

function loadEnvWith(overrides) {
  const saved = { ...process.env };
  Object.assign(process.env, overrides);

  try {
    let env;
    jest.isolateModules(() => {
      ({ env } = require("../src/config/env"));
    });
    return env;
  } finally {
    process.env = saved;
  }
}

test("missing MONGODB_URI is rejected with a clear message", () => {
  expect(() => loadEnvWith({ MONGODB_URI: "" })).toThrow("MONGODB_URI is required");
});

test("all problems are reported at once", () => {
  expect(() => loadEnvWith({ PORT: "abc", JWT_SECRET: "short" })).toThrow(
    /PORT must be an integer[\s\S]*JWT_SECRET must be at least 32 characters/
  );
});

test("production refuses the example JWT secret and a low bcrypt cost", () => {
  expect(() =>
    loadEnvWith({
      NODE_ENV: "production",
      JWT_SECRET: "dev-only-secret-change-me-0123456789abcdef",
      BCRYPT_ROUNDS: "8",
    })
  ).toThrow(/example value in production[\s\S]*at least 10 in production/);
});

test("valid config produces a frozen object", () => {
  const env = loadEnvWith({});

  expect(env.nodeEnv).toBe("test");
  expect(env.bcryptRounds).toBe(4);
  expect(Object.isFrozen(env)).toBe(true);
});
