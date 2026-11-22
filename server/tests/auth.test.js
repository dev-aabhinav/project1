const request = require("supertest");
const { createApp } = require("../src/app");
const { User } = require("../src/models/User");
const { startDB, clearDB, stopDB } = require("./helpers");

const VALID_USER = {
  name: "Aabhinav",
  username: "aabhinav",
  email: "a@x.com",
  password: "first-password",
};

let app;

beforeAll(startDB);
afterAll(stopDB);

beforeEach(async () => {
  await clearDB();
  app = createApp(); // fresh app = fresh rate-limit counters
});

async function signupAndLogin(overrides = {}) {
  const res = await request(app).post("/api/auth/signup").send({ ...VALID_USER, ...overrides });
  return res.body.token;
}

describe("POST /api/auth/signup", () => {
  test("creates the user: 201, user + token, no secrets in the response", async () => {
    const res = await request(app).post("/api/auth/signup").send(VALID_USER);

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: "Aabhinav", username: "aabhinav", email: "a@x.com" });
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.body.user).not.toHaveProperty("tokenVersion");
    expect(res.body.user).not.toHaveProperty("_id");
  });

  test("stores a bcrypt hash, never the plain password", async () => {
    await request(app).post("/api/auth/signup").send(VALID_USER);

    const stored = await User.findOne({ email: "a@x.com" }).select("+passwordHash").lean();

    expect(stored.passwordHash).not.toBe(VALID_USER.password);
    expect(stored.passwordHash).toMatch(/^\$2b\$04\$/); // bcrypt, cost 4 in tests
  });

  test("rejects a duplicate email in different letter case with 409", async () => {
    await request(app).post("/api/auth/signup").send(VALID_USER);

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...VALID_USER, username: "someone_else", email: "A@X.COM" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("email already exists");
  });

  test("returns 400 with per-field details for invalid input", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "", username: "a!", email: "nope", password: "short" });

    expect(res.status).toBe(400);
    const fields = res.body.details.map((d) => d.field).sort();
    expect(fields).toEqual(["email", "name", "password", "username"]);
  });

  test("ignores fields the client must not control (mass assignment)", async () => {
    await request(app)
      .post("/api/auth/signup")
      .send({ ...VALID_USER, tokenVersion: 99, passwordHash: "attacker-chosen" });

    const stored = await User.findOne({ email: "a@x.com" }).select("+passwordHash +tokenVersion").lean();

    expect(stored.tokenVersion).toBe(0);
    expect(stored.passwordHash).not.toBe("attacker-chosen");
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/signup").send(VALID_USER);
  });

  test("logs in with the right password (email is case-insensitive)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "A@X.com", password: VALID_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test("wrong password and unknown email give the SAME 401 response", async () => {
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@x.com", password: "wrong-password" });

    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@x.com", password: "wrong-password" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  test("rejects a NoSQL-injection object instead of a string (400)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: { $gt: "" }, password: VALID_USER.password });

    expect(res.status).toBe(400);
  });

  test("rate limit: 10 failed attempts allowed, the 11th gets 429 with Retry-After", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app).post("/api/auth/login").send({ email: "a@x.com", password: "wrong" });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app).post("/api/auth/login").send({ email: "a@x.com", password: "wrong" });

    expect(blocked.status).toBe(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
  });
});

describe("GET /api/auth/me", () => {
  test("401 without a token", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });

  test("returns the current user with a valid token", async () => {
    const token = await signupAndLogin();

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("a@x.com");
  });

  test("401 once the user no longer exists", async () => {
    const token = await signupAndLogin();
    await User.deleteMany({});

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/auth/password", () => {
  test("400 (not 401) when the current password is wrong", async () => {
    const token = await signupAndLogin();

    const res = await request(app)
      .patch("/api/auth/password")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "wrong-password", newPassword: "second-password" });

    expect(res.status).toBe(400);
    expect(res.body.details[0].field).toBe("currentPassword");
  });

  test("changing the password revokes old tokens and returns a working new one", async () => {
    const oldToken = await signupAndLogin();

    const change = await request(app)
      .patch("/api/auth/password")
      .set("Authorization", `Bearer ${oldToken}`)
      .send({ currentPassword: VALID_USER.password, newPassword: "second-password" });

    expect(change.status).toBe(200);

    const withOld = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${oldToken}`);
    const withNew = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${change.body.token}`);

    expect(withOld.status).toBe(401);
    expect(withNew.status).toBe(200);

    const oldPasswordLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@x.com", password: VALID_USER.password });

    const newPasswordLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@x.com", password: "second-password" });

    expect(oldPasswordLogin.status).toBe(401);
    expect(newPasswordLogin.status).toBe(200);
  });
});

describe("probes", () => {
  test("GET /api/health is 200 and GET /api/ready is 200 while the DB is connected", async () => {
    expect((await request(app).get("/api/health")).status).toBe(200);
    expect((await request(app).get("/api/ready")).status).toBe(200);
  });
});
