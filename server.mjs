/*
 * AI assistance was used to simplify this Node.js development server.
 * Node built-in modules serve the game and persistent account API.
 */
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, relative, extname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

import { openDatabase } from "./database.js";
import { createAuthHandler } from "./server-auth.mjs";

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ttf": "font/ttf",
};

async function handleRequest(request, response, handleAuth) {
  try {
    let url = new URL(request.url, "http://localhost");
    let authRequest = await handleAuth(request, response, url.pathname);
    if (authRequest) {
      return;
    }
    let name = decodeURIComponent(url.pathname);
    if (name === "/") {
      name = "/index.html";
    }
    let path = resolve(root, "." + name);
    let location = relative(root, path);
    // Here I only allow files from the public folder.
    if (location.startsWith("..") || isAbsolute(location)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    let file = await stat(path);
    if (!file.isFile()) {
      throw new Error("Not a file");
    }
    let contentType = contentTypes[extname(path)];
    if (contentType === undefined) {
      contentType = "application/octet-stream";
    }
    let contents = await readFile(path);
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });
    response.end(contents);
  } catch (error) {
    response.writeHead(404);
    response.end("Not found");
  }
}

export function createServer(options) {
  if (options === undefined) {
    options = {};
  }
  let accountsPath = fileURLToPath(
    new URL("./data/accounts.json", import.meta.url),
  );
  if (options.accountsPath !== undefined) {
    accountsPath = options.accountsPath;
  }
  let databasePath = fileURLToPath(
    new URL("./data/pearlpop.sqlite", import.meta.url),
  );
  if (options.accountsPath !== undefined)
    databasePath = accountsPath + ".sqlite";
  if (options.databasePath !== undefined) databasePath = options.databasePath;
  let database = openDatabase(databasePath, accountsPath);
  let handleAuth = createAuthHandler(
    database,
    process.env.SECURE_COOKIES === "true",
  );
  let server = http.createServer(function (request, response) {
    handleRequest(request, response, handleAuth);
  });
  server.on("close", function () {
    database.close();
  });
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let port = 3004;
  if (process.env.PORT !== undefined) {
    port = Number(process.env.PORT);
  }
  let server = createServer();
  server.listen(port, function () {
    console.log("PearlPop basic game: http://localhost:" + port);
    console.log("Press Ctrl+C to stop.");
  });
}
