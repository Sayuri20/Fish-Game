/*
 * AI assistance was used to rewrite the supplied server login in clearer steps.
 * This module owns password verification, progress actions and cookie sessions.
 * Cryptography uses Node's built-in scrypt, randomBytes and timingSafeEqual.
 * Reference: https://nodejs.org/api/crypto.html
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function newProfile() {
  return {
    pearls: 0,
    history: [],
    daily: {},
    collection: ["shell", "star"],
    settings: { sound: true, reducedMotion: false },
  };
}

// The server checks result fields before storing them.
function checkResult(result) {
  if (!result || typeof result.id !== "string" || result.id.length > 100) {
    throw new Error("Invalid game result.");
  }
  if (
    !Number.isInteger(result.score) ||
    result.score < 0 ||
    result.score > 10 ||
    result.total !== 10 ||
    typeof result.incomplete !== "boolean"
  ) {
    throw new Error("Invalid score.");
  }
  if (JSON.stringify(result).length > 4096) {
    throw new Error("Result is too large.");
  }
  return result;
}

function todayKey() {
  let today = new Date();
  return (
    today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate()
  );
}

const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;

function reply(response, status, data, cookie) {
  let headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  if (cookie !== undefined) {
    headers["Set-Cookie"] = cookie;
  }
  response.writeHead(status, headers);
  response.end(JSON.stringify(data));
}

// AI assistance was used because request data arrives through network events.
// The limit prevents a client sending an unlimited amount of login data.
function readBody(request) {
  return new Promise(function (resolve, reject) {
    let contentType = request.headers["content-type"];
    if (
      typeof contentType !== "string" ||
      !contentType.startsWith("application/json")
    ) {
      request.resume();
      reject(new Error("Send JSON data."));
      return;
    }
    let body = "";
    let failed = false;
    request.setEncoding("utf8");
    request.on("data", function (chunk) {
      if (failed) {
        return;
      }
      body = body + chunk;
      if (Buffer.byteLength(body) > 65536) {
        failed = true;
        body = "";
        reject(new Error("Request is too large."));
      }
    });
    request.on("end", function () {
      if (failed) {
        return;
      }
      try {
        let data = JSON.parse(body);
        if (data === null || typeof data !== "object") {
          throw new Error("Send a JSON object.");
        }
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", function (error) {
      reject(error);
    });
    request.on("aborted", function () {
      reject(new Error("Request was cancelled."));
    });
  });
}

function cookieToken(request) {
  let header = request.headers.cookie;
  if (typeof header !== "string") {
    return null;
  }
  let parts = header.split(";");
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i].trim();
    if (part.startsWith("pearlpop_session=")) {
      return part.slice(17);
    }
  }
  return null;
}

// AI assistance was used to call a standard password KDF, not invent a hash.
function derivePassword(password, salt) {
  return new Promise(function (resolve, reject) {
    scrypt(password, salt, 64, function (error, key) {
      if (error !== null) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

export function createAuthHandler(database, secureCookies) {
  if (secureCookies === undefined) {
    secureCookies = false;
  }
  // Map is a built-in lookup table. Each server instance owns these sessions.
  let sessions = new Map();
  let attempts = new Map();

  function makeCookie(token, maxAge) {
    let text = "pearlpop_session=" + token;
    text = text + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + maxAge;
    if (secureCookies) {
      text = text + "; Secure";
    }
    return text;
  }

  function currentSession(token) {
    let session = sessions.get(token);
    if (session === undefined) {
      return null;
    }
    if (session.expires <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    return session;
  }

  function removeExpiredSessions() {
    function checkSession(value, key) {
      if (value.expires <= Date.now()) {
        sessions.delete(key);
      }
    }
    sessions.forEach(checkSession);
  }

  function allowAttempt(address) {
    let attempt = attempts.get(address);
    if (attempt === undefined || attempt.until <= Date.now()) {
      attempt = { count: 0, until: Date.now() + 15 * 60 * 1000 };
      attempts.set(address, attempt);
    }
    if (attempt.count >= 40) {
      return false;
    }
    attempt.count = attempt.count + 1;
    return true;
  }

  function validName(name, id) {
    if (!/^[a-zA-Z0-9_ ]{3,20}$/.test(name)) {
      return false;
    }
    if (id === "__proto__" || id === "constructor" || id === "prototype") {
      return false;
    }
    return true;
  }

  async function createAccount(response, name, id, password) {
    if (database.findUser(id) !== null) {
      reply(response, 409, { error: "That explorer name is already taken." });
      return;
    }
    let salt = randomBytes(16).toString("hex");
    let key = await derivePassword(password, salt);
    // Another signup may have completed while password hashing was running.
    if (database.findUser(id) !== null) {
      reply(response, 409, { error: "That explorer name is already taken." });
      return;
    }
    database.createUser(id, {
      name: name,
      salt: salt,
      passwordHash: key.toString("hex"),
    });
    reply(response, 201, { user: { id: id, name: name } });
  }

  async function checkLogin(request, response, id, password) {
    let account = database.findUser(id);
    let salt = "unregistered-account";
    let expected = Buffer.alloc(64);
    if (account !== null) {
      salt = account.salt;
      expected = Buffer.from(account.passwordHash, "hex");
    }
    // A dummy derivation keeps an unknown name from returning immediately.
    let candidate = await derivePassword(password, salt);
    let correct = false;
    if (account !== null && expected.length === candidate.length) {
      correct = timingSafeEqual(expected, candidate);
    }
    if (!correct) {
      reply(response, 401, {
        error: "Explorer name or password is incorrect.",
      });
      return;
    }
    removeExpiredSessions();
    if (sessions.size >= 10000) {
      reply(response, 503, { error: "Please try again later." });
      return;
    }
    attempts.delete(request.socket.remoteAddress);
    let user = { id: id, name: account.name };
    let token = randomBytes(32).toString("hex");
    sessions.set(token, { user: user, expires: Date.now() + SESSION_AGE });
    reply(response, 200, { user: user }, makeCookie(token, SESSION_AGE / 1000));
  }

  async function handleAuth(request, response, path) {
    if (!path.startsWith("/api/auth/")) {
      return false;
    }
    try {
      let token = cookieToken(request);
      let session = currentSession(token);
      if (request.method === "GET" && path === "/api/auth/session") {
        let user = null;
        if (session !== null) {
          user = session.user;
        }
        reply(response, 200, { user: user });
        return true;
      }
      if (request.method !== "POST") {
        reply(response, 405, { error: "Method not allowed." });
        return true;
      }
      let origin = request.headers.origin;
      if (
        origin !== undefined &&
        new URL(origin).host !== request.headers.host
      ) {
        reply(response, 403, { error: "Open the game from its own address." });
        return true;
      }
      if (path === "/api/auth/logout") {
        sessions.delete(token);
        reply(response, 200, { ok: true }, makeCookie("", 0));
        return true;
      }
      if (path === "/api/auth/progress") {
        if (session === null) {
          reply(response, 401, { error: "Please sign in again." });
          return true;
        }
        let body = await readBody(request);
        let profile = database.loadProgress(session.user.id);
        if (!profile) profile = newProfile();
        let changed = false;
        if (body.action === "correct") {
          let day = todayKey();
          if (!profile.daily[day])
            profile.daily[day] = { correct: 0, claimed: false };
          profile.daily[day].correct++;
        } else if (body.action === "result") {
          let result = checkResult(body.result);
          let exists = false;
          for (let item of profile.history)
            if (item.id === result.id) exists = true;
          if (!exists) {
            profile.history.unshift(result);
            profile.history = profile.history.slice(0, 100);
            if (result.incomplete === false) profile.pearls++;
          }
        } else if (body.action === "claim") {
          let day = todayKey();
          let goal = profile.daily[day];
          if (goal && goal.correct >= 5 && !goal.claimed) {
            goal.claimed = true;
            profile.pearls++;
            changed = true;
          }
        } else if (body.action === "unlock") {
          if (!profile.collection.includes("jelly") && profile.pearls >= 3) {
            profile.pearls -= 3;
            profile.collection.push("jelly");
            changed = true;
          }
        } else if (body.action === "settings") {
          if (
            !body.settings ||
            typeof body.settings.sound !== "boolean" ||
            typeof body.settings.reducedMotion !== "boolean"
          )
            throw new Error("Invalid settings");
          profile.settings = {
            sound: body.settings.sound,
            reducedMotion: body.settings.reducedMotion,
          };
        } else if (body.action !== "read") {
          throw new Error("Unknown action");
        }
        database.saveProgress(session.user.id, profile);
        reply(response, 200, { profile: profile, changed: changed });
        return true;
      }
      if (path !== "/api/auth/signup" && path !== "/api/auth/login") {
        reply(response, 404, { error: "Not found." });
        return true;
      }
      if (!allowAttempt(request.socket.remoteAddress)) {
        reply(response, 429, {
          error: "Too many attempts. Try again in 15 minutes.",
        });
        return true;
      }
      let body = await readBody(request);
      let name = "";
      let password = "";
      if (typeof body.name === "string") {
        name = body.name.trim();
      }
      if (typeof body.password === "string") {
        password = body.password;
      }
      let id = name.toLowerCase();
      if (!validName(name, id)) {
        reply(response, 400, {
          error: "Use 3 to 20 letters, numbers, spaces or underscores.",
        });
        return true;
      }
      if (password.length < 6 || password.length > 128) {
        reply(response, 400, {
          error: "Choose a password with 6 to 128 characters.",
        });
        return true;
      }
      if (path === "/api/auth/signup") {
        await createAccount(response, name, id, password);
      } else {
        await checkLogin(request, response, id, password);
      }
    } catch (error) {
      if (!response.headersSent) {
        reply(response, 400, {
          error:
            "Could not complete the request. Check your connection and try again.",
        });
      }
    }
    return true;
  }
  return handleAuth;
}
