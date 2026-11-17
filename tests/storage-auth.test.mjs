import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { testServer } from "./auth-client.mjs";
let service;
const realFetch = globalThis.fetch;
function memory() {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
}
globalThis.localStorage = memory();
globalThis.sessionStorage = memory();
const auth = await import("../dist/js/auth.js");
const store = await import("../dist/js/storage.js");
beforeEach(async () => {
  globalThis.fetch = realFetch;
  service = await testServer();
  globalThis.fetch = service.browser();
  globalThis.localStorage = memory();
  globalThis.sessionStorage = memory();
});
afterEach(async () => {
  globalThis.fetch = realFetch;
  await service.close();
});

test("signup/login use salted hashes and reject wrong passwords/duplicate names", async () => {
  await auth.signup("TestUser", "reef123", "reef123");
  const database = new Database(service.accountsPath + ".sqlite", {
    readonly: true,
  });
  const row = database
    .prepare("SELECT * FROM users WHERE id = ?")
    .get("testuser");
  database.close();
  const u = { passwordHash: row.password_hash, salt: row.salt };
  assert.ok(u.passwordHash);
  assert.ok(u.salt);
  assert.equal(JSON.stringify(u).includes("reef123"), false);
  await assert.rejects(auth.login("TestUser", "badpass"));
  await assert.rejects(auth.signup("testuser", "reef123", "reef123"));
  assert.equal(await auth.login("TESTUSER", "reef123"), "testuser");
  assert.equal(auth.currentUser(), "testuser");
  await auth.logout();
  assert.equal(auth.currentUser(), null);
});
test("per-user history, session rewards and daily rewards cannot duplicate", async () => {
  await auth.signup("UserOne", "reef123", "reef123");
  await auth.signup("UserTwo", "reef123", "reef123");
  await auth.login("UserOne", "reef123");
  const r = { id: "session1", score: 8, total: 10, incomplete: false };
  await store.serverAction("userone", "result", { result: r });
  await store.serverAction("userone", "result", { result: r });
  assert.equal(store.getUser("userone").pearls, 1);
  assert.equal(store.getUser("userone").history.length, 1);

  for (let i = 0; i < 5; i++) await store.serverAction("userone", "correct");
  assert.equal(await store.serverAction("userone", "claim"), true);
  assert.equal(await store.serverAction("userone", "claim"), false);
  assert.equal(store.getUser("userone").pearls, 2);
  await store.serverAction("userone", "result", {
    result: { ...r, id: "incomplete", incomplete: true },
  });
  await auth.login("UserTwo", "reef123");
  assert.equal(store.getUser("usertwo").history.length, 0);
  assert.equal(store.getUser("userone").pearls, 2);
});
test("unlock never overdrafts or charges twice", async () => {
  await auth.signup("TestUser", "reef123", "reef123");
  await auth.login("TestUser", "reef123");
  assert.equal(await store.serverAction("testuser", "unlock"), false);
  for (let i = 0; i < 3; i++) {
    await store.serverAction("testuser", "result", {
      result: { id: "run" + i, score: 8, total: 10, incomplete: false },
    });
  }
  assert.equal(await store.serverAction("testuser", "unlock"), true);
  assert.equal(await store.serverAction("testuser", "unlock"), false);
  assert.equal(store.getUser("testuser").pearls, 0);
  assert.equal(
    store.getUser("testuser").collection.filter((i) => i === "jelly").length,
    1,
  );
});
test("same credentials work in separate browsers and after a server restart", async () => {
  await auth.signup("CaptainOne", "reef123", "reef123");
  await auth.login("CaptainOne", "reef123");
  let browserOne = globalThis.fetch;
  let browserTwo = service.browser();
  globalThis.localStorage = memory();
  globalThis.sessionStorage = memory();
  globalThis.fetch = browserTwo;
  assert.equal(await auth.restoreSession(), null);
  assert.equal(await auth.login("CAPTAINONE", "reef123"), "captainone");
  assert.equal(await auth.restoreSession(), "captainone");
  await auth.logout();
  assert.equal(await auth.restoreSession(), null);
  globalThis.fetch = browserOne;
  assert.equal(await auth.restoreSession(), "captainone");
  await service.restart();
  assert.equal(await auth.restoreSession(), null);
  assert.equal(await auth.login("CaptainOne", "reef123"), "captainone");
});
test("browser data cannot create an account or replace saved server progress", async () => {
  store.writeStore({
    users: { fakecaptain: { name: "FakeCaptain", pearls: 9999 } },
  });
  await assert.rejects(auth.login("FakeCaptain", "reef123"));
  await auth.signup("RealCaptain", "reef123", "reef123");
  await auth.login("RealCaptain", "reef123");
  await store.serverAction("realcaptain", "result", {
    result: { id: "saved", score: 7, total: 10, incomplete: false },
  });
  let data = store.readStore();
  data.users.realcaptain.pearls = 9999;
  store.writeStore(data);
  await auth.login("RealCaptain", "reef123");
  assert.equal(store.getUser("realcaptain").pearls, 1);
});
test("rejects cross-site signup, oversized passwords and private data access", async () => {
  let response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://another-site.example",
    },
    body: JSON.stringify({ name: "Intruder", password: "reef123" }),
  });
  assert.equal(response.status, 403);
  await assert.rejects(
    auth.signup("CaptainTwo", "x".repeat(129), "x".repeat(129)),
  );
  assert.equal((await fetch("/data/accounts.json")).status, 404);
});

test("JSON login handles Unicode passwords and rejects malformed or oversized bodies", async () => {
  const password = "reef-\u2603-123";
  await auth.signup("UnicodeCaptain", password, password);
  assert.equal(await auth.login("UnicodeCaptain", password), "unicodecaptain");
  for (const body of [
    "{",
    "null",
    JSON.stringify({ name: "LargeBody", password: "x".repeat(9000) }),
  ]) {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
    });
    assert.equal(response.status, 400);
  }
});

test("server progress survives empty browser storage and restart, and isolates users", async () => {
  await auth.signup("SharedCaptain", "reef123", "reef123");
  await auth.login("SharedCaptain", "reef123");
  for (let i = 0; i < 5; i++)
    await store.serverAction("sharedcaptain", "correct");
  const result = { id: "shared-run", score: 8, total: 10, incomplete: false };
  await store.serverAction("sharedcaptain", "result", { result });
  await store.serverAction("sharedcaptain", "result", { result });
  assert.equal(await store.serverAction("sharedcaptain", "claim"), true);
  assert.equal(await store.serverAction("sharedcaptain", "claim"), false);
  await store.serverAction("sharedcaptain", "settings", {
    settings: { sound: false, reducedMotion: true },
  });
  globalThis.fetch = service.browser();
  globalThis.localStorage = memory();
  globalThis.sessionStorage = memory();
  await auth.login("SharedCaptain", "reef123");
  assert.equal(store.getUser("sharedcaptain").pearls, 2);
  assert.equal(store.getUser("sharedcaptain").history.length, 1);
  assert.equal(store.getUser("sharedcaptain").settings.sound, false);
  await service.restart();
  await auth.login("SharedCaptain", "reef123");
  assert.equal(store.getUser("sharedcaptain").pearls, 2);
  await auth.signup("OtherCaptain", "reef123", "reef123");
  await auth.login("OtherCaptain", "reef123");
  assert.equal(store.getUser("othercaptain").pearls, 0);
  let response = await fetch("/api/auth/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "result",
      result: { ...result, score: 999 },
    }),
  });
  assert.equal(response.status, 400);
  await auth.logout();
  response = await fetch("/api/auth/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "read" }),
  });
  assert.equal(response.status, 401);
});

test("expedition progress and reef purchases persist without duplicate rewards", async () => {
  await auth.signup("RescueCaptain", "reef123", "reef123");
  await auth.login("RescueCaptain", "reef123");
  await store.serverAction("rescuecaptain", "captain", { captain: "turtle" });
  const result = {
    id: "rescue-one",
    captain: "turtle",
    score: 200,
    rivalScore: 150,
    correct: 3,
    completed: true,
  };
  await store.serverAction("rescuecaptain", "expedition", { result });
  await store.serverAction("rescuecaptain", "expedition", { result });
  assert.equal(store.getUser("rescuecaptain").pearls, 4);
  await store.serverAction("rescuecaptain", "restore", { spot: 2 });
  await store.serverAction("rescuecaptain", "restore", { spot: 2 });
  assert.equal(store.getUser("rescuecaptain").pearls, 2);
  await assert.rejects(
    store.serverAction("rescuecaptain", "restore", { spot: -1 }),
  );
  globalThis.fetch = service.browser();
  globalThis.localStorage = memory();
  globalThis.sessionStorage = memory();
  await auth.login("RescueCaptain", "reef123");
  assert.equal(store.getUser("rescuecaptain").rescue.captain, "turtle");
  assert.deepEqual(store.getUser("rescuecaptain").rescue.restored, [2]);
  assert.equal(store.getUser("rescuecaptain").rescue.deepest, 2);
});

test("survival pearls and result persist across browsers and cannot pay twice", async () => {
  await auth.signup("Survivor", "reef123", "reef123");
  await auth.login("Survivor", "reef123");
  const result = {
    id: "survival-one",
    score: 170,
    pearls: 24,
    lives: 1,
    level: 4,
    correct: 3,
    stuns: 2,
    completed: true,
  };
  await store.serverAction("survivor", "survival", { result });
  await store.serverAction("survivor", "survival", { result });
  assert.equal(store.getUser("survivor").pearls, 24);
  assert.equal(store.getUser("survivor").rescue.runs.length, 1);
  await assert.rejects(
    store.serverAction("survivor", "survival", {
      result: { ...result, id: "bad", lives: 0 },
    }),
  );
  await assert.rejects(
    store.serverAction("survivor", "survival", {
      result: { ...result, id: "bad2", pearls: 999 },
    }),
  );
  globalThis.fetch = service.browser();
  globalThis.localStorage = memory();
  globalThis.sessionStorage = memory();
  await auth.login("Survivor", "reef123");
  assert.equal(store.getUser("survivor").rescue.runs[0].lives, 1);
  assert.equal(store.getUser("survivor").pearls, 24);
});
