import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../server.mjs";
test("local start command serves HTML, module, CSS and original design assets", async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    for (const path of [
      "/",
      "/styles.css",
      "/js/app.js",
      "/assets/reef.svg",
      "/assets/fish.svg",
      "/assets/hero-fish.svg",
      "/assets/fonts/nunito-bold.ttf",
    ]) {
      const res = await fetch(base + path);
      assert.equal(res.status, 200, path);
      assert.ok((await res.arrayBuffer()).byteLength > 100, path);
    }
    assert.equal((await fetch(base + "/missing")).status, 404);
  } finally {
    server.close();
  }
});
