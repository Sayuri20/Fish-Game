/*
 * AI assistance was used to refactor this client-side login module.
 * LoginData.java in FishGame26.zip uses a fixed example username/password.
 * Server login uses scrypt hashes and an HttpOnly session cookie.
 * The server checks all passwords; the browser only sends requests.
 */
import {
  readStore,
  writeStore,
  getUser,
  enableServerStorage,
  serverAction,
} from "./storage.js";

// AI assistance helped replace browser-only login with server-checked cookie sessions.
async function request(path, data) {
  let response;
  try {
    let options = {
      method: "GET",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    };
    if (data !== undefined) {
      options.method = "POST";
      options.body = JSON.stringify(data);
    }
    response = await fetch("/api/auth/" + path, options);
  } catch {
    throw new Error("Cannot connect. Start the game server and try again.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "Start this game using npm start, then open its server address.",
    );
  }
  if (!response.ok) {
    let message = "Sign-in failed.";
    if (typeof result.error === "string") {
      message = result.error;
    }
    let error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return result;
}
async function rememberAccount(user) {
  let data = readStore();
  // A display name is cached first; the full profile comes from SQLite.
  data.users[user.id] = { name: user.name };
  writeStore(data);
  sessionStorage.setItem("pearlpop.session", user.id);
  enableServerStorage(user.id);
  await serverAction(user.id, "read");
  return user.id;
}
export async function signup(name, password, confirm) {
  if (password !== confirm) throw new Error("Passwords do not match.");
  let result = await request("signup", { name: name, password: password });
  return result.user.id;
}
export async function login(name, password) {
  let result = await request("login", { name: name, password: password });
  return rememberAccount(result.user);
}
export async function restoreSession() {
  sessionStorage.removeItem("pearlpop.session");
  let result = await request("session");
  if (!result.user) return null;
  return rememberAccount(result.user);
}
export async function logout() {
  await request("logout", {});
  sessionStorage.removeItem("pearlpop.session");
}
export function currentUser() {
  let id = sessionStorage.getItem("pearlpop.session");
  if (id !== null && getUser(id) !== null) return id;
  return null;
}
