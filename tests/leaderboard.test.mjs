import test from "node:test";
import assert from "node:assert/strict";
import { testServer } from "./auth-client.mjs";
test("shared leaderboard ranks one best per account and retains a best beyond recent history", async () => {
  const service = await testServer();
  try {
    const anonymous = service.browser();
    assert.equal((await anonymous("/api/auth/leaderboard")).status, 401);
    const clients = {};
    async function post(client, path, data) {
      const r = await client("/api/auth/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      assert.equal(r.ok, true, await r.clone().text());
      return r.json();
    }
    for (const name of ["Coral", "Lagoon", "Abyss", "NewCaptain"]) {
      const client = service.browser();
      clients[name] = client;
      await post(client, "signup", { name, password: "test-pass-78" });
      await post(client, "login", { name, password: "test-pass-78" });
    }
    async function save(name, score, id) {
      await post(clients[name], "progress", {
        action: "survival",
        result: {
          id,
          score,
          pearls: 0,
          lives: 1,
          level: 0,
          correct: 0,
          stuns: 0,
          completed: false,
        },
      });
    }
    await save("Coral", 500, "coral-best");
    await save("Abyss", 300, "abyss-best");
    await save("Lagoon", 300, "lagoon-best");
    for (let i = 0; i < 31; i++) await save("Coral", 10, "recent-" + i);
    const response = await clients.Coral("/api/auth/leaderboard");
    const board = await response.json();
    assert.deepEqual(
      board.leaders.map((r) => r.name),
      ["Coral", "Abyss", "Lagoon"],
    );
    assert.deepEqual(
      board.leaders.map((r) => r.score),
      [500, 300, 300],
    );
    assert.equal(board.rank, 1);
    assert.equal(board.total, 3);
    assert.equal(board.leaders[0].isYou, true);
    assert.deepEqual(Object.keys(board.leaders[0]).sort(), [
      "isYou",
      "name",
      "rank",
      "score",
    ]);
    await service.restart();
    const client = service.browser();
    await post(client, "login", { name: "Coral", password: "test-pass-78" });
    const persisted = await (await client("/api/auth/leaderboard")).json();
    assert.equal(persisted.leaders[0].score, 500);
  } finally {
    await service.close();
  }
});
