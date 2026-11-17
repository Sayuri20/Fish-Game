import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  RescueEngine,
  LEVEL_SECONDS,
  ZONES,
  CHARACTERS,
} from "../dist/js/rescue-engine.js";
if (!globalThis.crypto) globalThis.crypto = webcrypto;
function pickup(game, type) {
  const item = game.items.find((item) => item.type === type);
  game.player.x = item.x;
  game.player.y = item.y;
  return game.collect(item.id);
}
test("three characters and five distinct depths", () => {
  assert.equal(CHARACTERS.length, 3);
  assert.equal(ZONES.length, 5);
  assert.equal(new RescueEngine(Math.random, "mermaid").character, "mermaid");
});
test("combat begins immediately; pause freezes time, attacks and movement", () => {
  const g = new RescueEngine(() => 0.5);
  g.tick(0.5);
  assert.equal(g.elapsed, 0.5);
  g.paused = true;
  g.tick(20);
  g.move(1, 1, 1);
  assert.equal(g.elapsed, 0.5);
  assert.equal(g.player.x, 15);
});
test("correct optional fish count grants exactly ten seconds of venom immunity", () => {
  const g = new RescueEngine();
  g.invulnerable = 0;
  g.boostTokens = 1;
  g.load({ answer: 5 });
  assert.equal(g.answerNumber(4), "wrong");
  assert.equal(g.shield, 0);
  assert.equal(g.answerNumber(5), "correct");
  assert.equal(g.shield, 10);
  assert.equal(g.hurt(), false);
  assert.equal(g.answerNumber(5), "ignored");
  assert.equal(g.load({ answer: 5 }), false);
  g.enemy.stun = 100;
  g.items = [];
  g.tick(9);
  assert.equal(g.shield, 1);
  assert.equal(g.hurt(), false);
  g.tick(1);
  assert.equal(g.shield, 0);
  assert.equal(g.hurt(), true);
  assert.equal(g.lives, 2);
});
test("every two plastic pickups restore one heart with maximum three", () => {
  const g = new RescueEngine();
  g.lives = 1;
  pickup(g, "bottle");
  assert.equal(g.lives, 1);
  pickup(g, "bag");
  assert.equal(g.lives, 2);
  g.lives = 3;
  g.items = [
    { id: 100, type: "bag", x: g.player.x, y: g.player.y },
    { id: 101, type: "bottle", x: g.player.x, y: g.player.y },
  ];
  g.collect(100);
  g.collect(101);
  assert.equal(g.lives, 3);
  assert.equal(g.collect(101), false);
});
test("poisonous fish deduct points and pearls without negative balances", () => {
  const g = new RescueEngine();
  g.score = 20;
  g.pearls = 3;
  pickup(g, "puffer");
  assert.equal(g.score, 10);
  assert.equal(g.pearls, 1);
  g.items.push({ id: 100, type: "puffer", x: g.player.x, y: g.player.y });
  g.collect(100);
  assert.equal(g.pearls, 0);
  assert.equal(g.score, 0);
});
test("seahorses reward ten points, a pearl and three shots", () => {
  const g = new RescueEngine();
  pickup(g, "seahorse");
  assert.equal(g.score, 10);
  assert.equal(g.pearls, 1);
  assert.equal(g.ammo, 9);
});
test("gun cooldown and ammunition prevent unlimited shots", () => {
  const g = new RescueEngine();
  for (let i = 0; i < 6; i++) {
    assert.equal(g.shoot(), true);
    assert.equal(g.shoot(), false);
    g.tick(0.33);
  }
  assert.equal(g.ammo, 0);
  assert.equal(g.shoot(), false);
  g.givePearls(1);
  assert.equal(g.ammo, 3);
});
test("bubble shots intercept poison and defeat jellyfish", () => {
  const g = new RescueEngine();
  g.shots = [{ id: 100, x: 40, y: 40, active: true }];
  g.poison = [{ id: 101, x: 41, y: 40, dx: 0, dy: 0, active: true }];
  g.tick(0.01);
  assert.equal(g.poison.length, 0);
  g.enemy.health = 1;
  g.shots = [{ id: 102, x: 86, y: 39, active: true }];
  g.tick(0.01);
  assert.equal(g.enemy.health, 0);
  assert.equal(g.status, "level-complete");
});
test("surviving 30 seconds with one heart advances all five levels without quotas", () => {
  const g = new RescueEngine();
  g.lives = 1;
  for (let level = 0; level < 5; level++) {
    g.enemy.stun = 100;
    g.items = [];
    g.tick(LEVEL_SECONDS - 0.1);
    assert.equal(g.status, "playing");
    g.tick(0.1);
    assert.equal(g.status, level === 4 ? "won" : "level-complete");
    if (level < 4) assert.equal(g.nextLevel(), true);
  }
  assert.equal(g.result().completed, true);
  assert.equal(g.result().level, 4);
  assert.equal(g.correct, 0);
});
test("deeper levels launch single faster poison shots", () => {
  const a = new RescueEngine();
  const b = new RescueEngine();
  b.level = 4;
  b.beginLevel();
  a.fireTimer = 0;
  b.fireTimer = 0;
  a.tick(0.01);
  b.tick(0.01);
  assert.equal(a.poison.length, 1);
  assert.equal(b.poison.length, 1);
  assert.ok(
    Math.hypot(b.poison[0].dx, b.poison[0].dy) >
      Math.hypot(a.poison[0].dx, a.poison[0].dy),
  );
  assert.ok(b.enemy.health > a.enemy.health);
});
test("zero hearts ends game and cannot advance", () => {
  const g = new RescueEngine();
  for (let i = 0; i < 3; i++) {
    g.invulnerable = 0;
    g.hurt();
  }
  assert.equal(g.status, "lost");
  assert.equal(g.nextLevel(), false);
  assert.equal(g.hurt(), false);
});

test("two floating shields spawn at 3 and 18 seconds, never more", () => {
  const g = new RescueEngine();
  g.enemy.stun = 100;
  g.items = [];
  g.tick(2.9);
  assert.equal(g.shieldDrops, 0);
  g.tick(0.1);
  assert.equal(g.shieldDrops, 1);
  g.tick(15);
  assert.equal(g.shieldDrops, 2);
  g.tick(11);
  assert.equal(g.shieldDrops, 2);
  assert.equal(g.items.filter((i) => i.type === "shield").length, 2);
});
test("shield pickups require swimming nearby and supply the counting booster", () => {
  const g = new RescueEngine();
  assert.equal(g.load({ answer: 2 }), false);
  g.items.push({ id: 200, type: "shield", x: 50, y: 28 });
  assert.equal(g.collect(200), false);
  g.player = { x: 50, y: 28 };
  assert.equal(g.collect(200), true);
  assert.equal(g.boostTokens, 1);
  assert.equal(g.load({ answer: 2 }), true);
  assert.equal(g.answerNumber(2), "correct");
  assert.equal(g.boostTokens, 0);
  assert.equal(g.shield, 10);
});
test("killing the final jellyfish wins before the deadline", () => {
  const g = new RescueEngine();
  g.level = 4;
  g.beginLevel();
  g.enemy.health = 1;
  g.shots = [{ id: 100, x: 86, y: 39, active: true }];
  g.tick(0.01);
  assert.equal(g.status, "won");
  assert.ok(g.elapsed < 30);
  assert.equal(g.enemy.health, 0);
});

test("all five levels steadily increase attacks while pacing rewards and hazards over thirty seconds", () => {
  let previousAttacks = 0;
  let previousSpeed = 0;
  for (let level = 0; level < 5; level++) {
    const g = new RescueEngine(() => 0.5);
    g.level = level;
    g.beginLevel();
    g.shield = 100; // Isolate spawn/attack pacing from player skill and damage.
    const drops = [];
    const spawn = g.spawnItem.bind(g);
    g.spawnItem = function (type) {
      const created = spawn(type);
      if (created)
        drops.push({
          type,
          time: this.elapsed,
          item: { ...this.items[this.items.length - 1] },
        });
      return created;
    };
    let attacks = 0;
    for (let frame = 0; frame < 600; frame++) {
      g.tick(0.05);
      for (const event of g.events) if (event.kind === "attack") attacks++;
      g.events = [];
      assert.ok(g.items.length <= 14);
    }
    assert.ok(attacks > previousAttacks);
    assert.ok(g.poisonSpeed > previousSpeed);
    previousAttacks = attacks;
    previousSpeed = g.poisonSpeed;
    const good = drops.filter((drop) => drop.type !== "puffer");
    const bad = drops.filter((drop) => drop.type === "puffer");
    assert.equal(good.length, 9);
    assert.equal(bad.length, 2 + level);
    assert.ok(good.some((drop) => drop.time >= 24));
    assert.ok(
      good.filter((drop) => drop.type === "bag" || drop.type === "bottle")
        .length >= 4,
    );
    assert.equal(g.shieldDrops, 2);
    for (const drop of drops) {
      assert.ok(drop.item.x >= 24 && drop.item.x <= 70);
      assert.ok(drop.item.y >= 26 && drop.item.y <= 76);
    }
  }
});

test("fresh pickups spread across the water and old pickups expire", () => {
  const g = new RescueEngine(() => 0.5);
  const originalIds = g.items.map((item) => item.id);
  assert.ok(new Set(g.items.map((item) => item.x)).size >= 4);
  assert.ok(new Set(g.items.map((item) => item.y)).size >= 3);
  g.enemy.stun = 100;
  for (let i = 0; i < 240; i++) g.tick(0.05);
  assert.ok(!g.items.some((item) => originalIds.includes(item.id)));
  assert.ok(g.items.some((item) => item.type === "shield"));
});

test("venom damage restores one jellyfish health, capped at the level maximum", () => {
  for (let level = 0; level < 5; level++) {
    const g = new RescueEngine();
    g.level = level;
    g.beginLevel();
    const maximum = 8 + level * 3;
    g.enemy.health = maximum - 2;
    g.invulnerable = 0;
    g.poison = [
      { id: 900, x: g.player.x, y: g.player.y, dx: 0, dy: 0, active: true },
    ];
    g.tick(0.01);
    assert.equal(g.lives, 2);
    assert.equal(g.enemy.health, maximum - 1);
    assert.equal(g.hurt(), false);
    assert.equal(g.enemy.health, maximum - 1);
    g.enemy.health = maximum;
    g.invulnerable = 0;
    g.hurt();
    assert.equal(g.enemy.health, maximum);
  }
});

test("shield-blocked venom cannot heal the jellyfish", () => {
  const g = new RescueEngine();
  g.enemy.health = 3;
  g.invulnerable = 0;
  g.shield = 10;
  g.poison = [
    { id: 901, x: g.player.x, y: g.player.y, dx: 0, dy: 0, active: true },
  ];
  g.tick(0.01);
  assert.equal(g.lives, 3);
  assert.equal(g.enemy.health, 3);
});

test("movement respects the available responsive arena bounds", () => {
  const g = new RescueEngine();
  g.bounds = { left: 20, right: 70, top: 30, bottom: 70 };
  g.move(-1, -1, 10);
  assert.deepEqual(g.player, { x: 20, y: 30 });
  g.move(1, 1, 10);
  assert.deepEqual(g.player, { x: 70, y: 70 });
});
