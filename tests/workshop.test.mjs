import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { RescueEngine } from "../dist/js/rescue-engine.js";
import { testServer } from "./auth-client.mjs";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

test("workshop bonuses are single-use, pause-safe and remain spent across levels", () => {
  const g = new RescueEngine();
  assert.equal(g.equipBonus("unknown"), false);
  assert.equal(g.equipBonus("bubbles"), true);
  assert.equal(g.equipBonus("slow"), false);
  g.paused = true;
  assert.equal(g.useBonus(), false);
  g.paused = false;
  assert.equal(g.useBonus(), true);
  assert.equal(g.ammo, 12);
  assert.equal(g.useBonus(), false);
  g.status = "level-complete";
  g.nextLevel();
  assert.equal(g.useBonus(), false);
  assert.equal(g.ammo, 12);
});
test("magnet pulls good items only and expires after eight active seconds", () => {
  const g = new RescueEngine();
  g.enemy.stun = 100;
  g.items = [
    { id: 100, type: "shell", x: 35, y: 50 },
    { id: 101, type: "puffer", x: 35, y: 50 },
    { id: 102, type: "shield", x: 35, y: 50 },
  ];
  g.equipBonus("magnet");
  g.useBonus();
  g.tick(0.1);
  assert.ok(g.items.find((i) => i.type === "shell").x < 35);
  assert.equal(g.items.find((i) => i.type === "puffer").x, 35);
  assert.equal(g.items.find((i) => i.type === "shield").x, 35);
  const timer = g.magnetTime;
  g.paused = true;
  g.tick(5);
  assert.equal(g.magnetTime, timer);
  g.paused = false;
  for (let i = 0; i < 80; i++) g.tick(0.1);
  assert.equal(g.magnetTime, 0);
});
test("slow venom affects existing and newly fired poison, then returns to normal", () => {
  const g = new RescueEngine();
  g.enemy.stun = 100;
  g.items = [];
  g.poison = [{ id: 100, x: 60, y: 10, dx: -10, dy: 0, active: true }];
  g.equipBonus("slow");
  g.useBonus();
  g.tick(0.5);
  assert.equal(g.poison[0].x, 58);
  g.slowTime = 0;
  g.tick(0.5);
  assert.equal(g.poison[0].x, 53);
  g.slowTime = 1;
  g.enemy.stun = 0;
  g.fireTimer = 0;
  g.tick(0.01);
  assert.ok(g.poison.length >= 2);
});
test("cleaner collects nearest two plastics, awards normal rewards and caps hearts", () => {
  const g = new RescueEngine();
  g.lives = 2;
  g.items = [
    { id: 100, type: "bottle", x: 60, y: 50 },
    { id: 101, type: "bag", x: 40, y: 50 },
    { id: 102, type: "bag", x: 70, y: 70 },
    { id: 103, type: "puffer", x: 30, y: 50 },
  ];
  g.equipBonus("cleaner");
  g.useBonus();
  assert.equal(g.lives, 3);
  assert.equal(g.pearls, 2);
  assert.equal(g.trash, 2);
  assert.deepEqual(
    g.items.map((i) => i.id),
    [102, 103],
  );
  assert.equal(g.useBonus(), false);
});

test("server owns bonus prices, one prepared slot and persisted single-use loadouts", async () => {
  const service = await testServer();
  let client = service.browser();
  async function call(path, data) {
    const r = await client("/api/auth/" + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return { status: r.status, ...(await r.json()) };
  }
  async function action(action, extra = {}) {
    return call("progress", { action, ...extra });
  }
  try {
    await call("signup", { name: "WorkshopQA", password: "reef123" });
    await call("login", { name: "WorkshopQA", password: "reef123" });
    assert.equal(
      (await action("workshop-buy", { bonus: "bubbles" })).status,
      400,
    );
    assert.equal(
      (await action("workshop-buy", { bonus: "unknown" })).status,
      400,
    );
    await action("survival", {
      result: {
        id: "fund-fixture",
        score: 100,
        pearls: 60,
        lives: 1,
        level: 0,
        correct: 1,
        stuns: 0,
        completed: false,
      },
    });
    let r = await action("workshop-buy", { bonus: "bubbles", price: 0 });
    assert.equal(r.status, 200);
    assert.equal(r.profile.pearls, 56);
    assert.equal(
      (await action("workshop-buy", { bonus: "magnet" })).status,
      400,
    );
    await service.restart();
    client = service.browser();
    await call("login", { name: "WorkshopQA", password: "reef123" });
    r = await action("read");
    assert.equal(r.profile.rescue.workshop.prepared, "bubbles");
    assert.equal(r.profile.pearls, 56);
    r = await action("workshop-launch", { diveId: "dive-one" });
    assert.equal(r.profile.rescue.workshop.prepared, null);
    assert.equal(r.profile.rescue.workshop.active.bonus, "bubbles");
    r = await action("workshop-launch", { diveId: "dive-one" });
    assert.equal(r.profile.rescue.workshop.active.bonus, "bubbles");
    assert.equal(
      (await action("workshop-use", { diveId: "fake-dive" })).status,
      400,
    );
    r = await action("workshop-use", { diveId: "dive-one" });
    assert.equal(r.profile.rescue.workshop.active.used, true);
    r = await action("workshop-use", { diveId: "dive-one" });
    assert.equal(r.changed, false);
    assert.equal(r.profile.pearls, 56);
    await action("workshop-launch", { diveId: "dive-two" });
    assert.equal(
      (await action("workshop-use", { diveId: "dive-two" })).status,
      400,
    );
    for (const bonus of ["magnet", "slow", "cleaner"]) {
      assert.equal((await action("workshop-buy", { bonus })).status, 200);
      r = await action("workshop-launch", { diveId: "dive-" + bonus });
      assert.equal(r.profile.rescue.workshop.active.bonus, bonus);
      assert.equal(
        (await action("workshop-use", { diveId: "dive-" + bonus })).status,
        200,
      );
    }
    const stranger = service.browser();
    const forbidden = await stranger("/api/auth/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "workshop-use", diveId: "dive-cleaner" }),
    });
    assert.equal(forbidden.status, 401);
  } finally {
    await service.close();
  }
});
