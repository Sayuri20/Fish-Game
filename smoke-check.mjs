import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
Object.defineProperty(globalThis, "crypto", { value: webcrypto });
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
const handlers = {};
const nodes = {};
const ticks = [];
const timers = [];
function node(key) {
  return (nodes[key] ??= {
    innerHTML: "",
    textContent: "",
    style: {},
    value: "2",
    classList: { add() {}, remove() {}, toggle() {} },
    showModal() {},
    addEventListener() {},
  });
}
globalThis.document = {
  hidden: false,
  body: { classList: { remove() {}, toggle() {} } },
  querySelector: node,
  addEventListener: (k, v) => (handlers[k] = v),
};
globalThis.window = { scrollTo() {}, addEventListener() {} };
globalThis.setInterval = (f) => ticks.push(f);
globalThis.setTimeout = (f, ms) => {
  timers.push({ f, ms });
  return timers.length;
};
globalThis.clearTimeout = () => {};
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({
    fish: 5,
    question: "data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  }),
});
const { testServer } = await import("./tests/auth-client.mjs");
// The smoke test uses the actual HTTP account API and a deterministic fish reply.
const realFetch = globalThis.fetch;
globalThis.fetch = originalFetch;
const service = await testServer();
const accountFetch = service.browser();
globalThis.fetch = (path, options) =>
  String(path).includes("marcconrad")
    ? realFetch(path, options)
    : accountFetch(path, options);
try {
  const auth = await import("./dist/js/auth.js");
  await auth.signup("Tester", "reef123", "reef123");
  await auth.login("Tester", "reef123");
  await import("./dist/js/app.js");
  async function click(action) {
    await handlers.click({
      preventDefault() {},
      target: { closest: () => ({ disabled: false, dataset: { action } }) },
    });
  }
  assert.match(node("#app").innerHTML, /Sign out/);
  for (const screen of [
    "modes",
    "reef",
    "history",
    "settings",
    "guide",
    "daily",
  ]) {
    await click(screen);
    assert.match(node("#app").innerHTML, /Back to play/);
  }
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  await click("start-timed");
  assert.match(node("#app").innerHTML, /00:10/);
  assert.equal(
    (node("#app").innerHTML.match(/class="fish-arrival"/g) || []).length,
    5,
  );
  assert.doesNotMatch(
    node("#app").innerHTML,
    /LIVE API|offline demo|Fish API by/,
  );
  await click("zoom");
  assert.match(node("#app").innerHTML, /class="zoom-fish"/);
  assert.doesNotMatch(node("#app").innerHTML, /zoomed-api/);
  await click("close-zoom");

  now += 5000;
  ticks[0]();
  assert.match(node("#answer-message").textContent, /choose a number/);
  now += 6000;
  ticks[0]();
  assert.match(node("#app").innerHTML, /dialog/);
  const advance = timers.find((t) => t.ms === 1200);
  assert.ok(advance);
  await advance.f();
  // Wait for the async fetch chain triggered by the timeout callback.
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.match(node("#app").innerHTML, /02 \/ 10/);
  await click("modes");
  assert.match(node("#app").innerHTML, /dialog/);
  Date.now = realNow;
  console.log(
    "UI smoke passed: screen navigation, five cartoon fish, idle reminder, 10-second timeout auto-advance, leave confirmation.",
  );
} finally {
  await service.close();
  globalThis.fetch = originalFetch;
}
