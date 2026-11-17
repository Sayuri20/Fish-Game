/*
 * AI assistance was used to rewrite these persistence functions using loops.
 * The browser keeps a display cache; the server owns shared progress.
 * Password verification belongs to server-auth.mjs.
 */
const STORE_KEY = "pearlpop.v1";

export function readStore() {
  let saved = localStorage.getItem(STORE_KEY);
  if (saved === null) {
    return { users: {} };
  }
  let data;
  try {
    data = JSON.parse(saved);
  } catch (error) {
    throw new Error("Saved account data could not be read.");
  }
  if (data === null || typeof data.users !== "object" || data.users === null) {
    throw new Error("Saved account data has an unexpected format.");
  }
  return data;
}

export function writeStore(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

export function getUser(id) {
  if (id === null || id === undefined) {
    return null;
  }
  let data = readStore();
  if (Object.hasOwn(data.users, id)) {
    return data.users[id];
  }
  return null;
}

export function dayKey(date) {
  if (date === undefined) {
    date = new Date();
  }
  return (
    date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()
  );
}

// I save progress on the server and keep a copy here to show on screen.
let onlineAccount = null;
let pendingSave = Promise.resolve();
export function enableServerStorage(id) {
  onlineAccount = id;
}
export async function serverAction(id, action, extra) {
  if (onlineAccount !== id) throw new Error("Please sign in again.");
  let body = { action: action };
  if (extra) Object.assign(body, extra);
  async function send() {
    let response = await fetch("/api/auth/progress", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    let result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error || "Progress could not be saved. Please try again.",
      );
    let data = readStore();
    result.profile.name = data.users[id].name;
    data.users[id] = result.profile;
    writeStore(data);
    return result.changed;
  }
  let saving = pendingSave.then(send, send);
  pendingSave = saving.catch(function () {});
  return saving;
}
