import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "../server.mjs";
export async function testServer() {
  let directory = await mkdtemp(join(tmpdir(), "pearlpop-auth-"));
  let accountsPath = join(directory, "accounts.json");
  let server;
  let base;
  let realFetch = globalThis.fetch;
  async function start() {
    server = createServer({ accountsPath });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = "http://127.0.0.1:" + server.address().port;
  }
  await start();
  function browser() {
    let cookie = "";
    return async function fetchFromBrowser(path, options = {}) {
      let response = await realFetch(new URL(path, base), {
        ...options,
        headers: { ...options.headers, Cookie: cookie },
      });
      let next = response.headers.get("set-cookie");
      if (next) cookie = next.split(";")[0];
      return response;
    };
  }
  return {
    browser,
    accountsPath,
    async restart() {
      await new Promise((resolve) => server.close(resolve));
      await start();
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await rm(directory, { recursive: true, force: true });
    },
  };
}
