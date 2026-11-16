import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../database.js";

test("JSON migration backs up exactly, preserves progress and runs only once", () => {
  const folder = mkdtempSync(join(tmpdir(), "pearlpop-sqlite-"));
  const oldPath = join(folder, "accounts.json");
  const dbPath = join(folder, "game.sqlite");
  const old = JSON.stringify({
    users: {
      captain: {
        name: "Captain",
        salt: "salt",
        passwordHash: "hash",
        progress: { pearls: 7 },
      },
    },
  });
  writeFileSync(oldPath, old);
  let database;
  try {
    database = openDatabase(dbPath, oldPath);
    assert.equal(database.findUser("captain").name, "Captain");
    assert.equal(database.loadProgress("captain").pearls, 7);
    assert.equal(readFileSync(oldPath + ".before-sqlite.bak", "utf8"), old);
    database.saveProgress("captain", { pearls: 9 });
    database.close();
    database = openDatabase(dbPath, oldPath);
    assert.equal(database.loadProgress("captain").pearls, 9);
    assert.throws(() =>
      database.createUser("captain", {
        name: "Other",
        salt: "s",
        passwordHash: "h",
      }),
    );
    assert.equal(database.findUser("captain' OR 1=1 --"), null);
    assert.throws(() => database.saveProgress("unknown", { pearls: 100 }));
    assert.equal(readFileSync(oldPath, "utf8"), old);
  } finally {
    if (database) database.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test("invalid migration rolls back all users and can be retried after correction", () => {
  const folder = mkdtempSync(join(tmpdir(), "pearlpop-sqlite-"));
  const oldPath = join(folder, "accounts.json");
  const dbPath = join(folder, "game.sqlite");
  try {
    writeFileSync(
      oldPath,
      JSON.stringify({
        users: {
          good: { name: "Good", salt: "s", passwordHash: "h" },
          bad: {},
        },
      }),
    );
    assert.throws(() => openDatabase(dbPath, oldPath), /Invalid old account/);
    writeFileSync(
      oldPath,
      JSON.stringify({
        users: { fixed: { name: "Fixed", salt: "s", passwordHash: "h" } },
      }),
    );
    const database = openDatabase(dbPath, oldPath);
    assert.equal(database.findUser("good"), null);
    assert.equal(database.findUser("fixed").name, "Fixed");
    database.close();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
