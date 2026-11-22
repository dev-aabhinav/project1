module.exports = {
  testEnvironment: "node",
  // Start ONE throwaway MongoDB for the whole run, stop it at the end.
  globalSetup: "<rootDir>/tests/globalSetup.js",
  globalTeardown: "<rootDir>/tests/globalTeardown.js",
  // Runs in every test worker BEFORE any app code is required (env.js reads env at require time).
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
};
