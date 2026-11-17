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
  assert.doesNotMatch(
    node("#app").innerHTML,
    /COUNTING PRACTICE|START TIMED|START PRACTICE/,
  );
  for (const screen of ["history", "settings", "guide"]) {
    await click(screen);
    assert.match(node("#app").innerHTML, /Back to play/);
    assert.doesNotMatch(
      node("#app").innerHTML,
      /Timed mode|10 rounds|COUNTING PRACTICE/,
    );
  }
  await click("hub");
  assert.match(node("#app").innerHTML, /LET’S DIVE/);
  await click("start-practice");
  assert.doesNotMatch(node("#app").innerHTML, /START PRACTICE|YOUR ANSWER/);
  console.log(
    "UI smoke passed: main-game home, history, settings, survival guide; retired counting modes are unavailable.",
  );
} finally {
  await service.close();
  globalThis.fetch = originalFetch;
}
