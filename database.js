/**
 * AI assistance helped connect SQLite and migrate the earlier JSON accounts.
 * This module owns SQL only. Login and game rules stay in their own modules.
 * Reference: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md
 */
import Database from "better-sqlite3";
import {
  mkdirSync,
  readFileSync,
  copyFileSync,
  existsSync,
  constants,
} from "node:fs";
import { dirname } from "node:path";

export function openDatabase(databasePath, oldAccountsPath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  let database = new Database(databasePath);
  try {
    database.pragma("foreign_keys = ON");
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        salt TEXT NOT NULL,
        password_hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS progress (
        user_id TEXT PRIMARY KEY REFERENCES users(id),
        profile_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS migrations (
        name TEXT PRIMARY KEY
      );
    `);

    function findUser(id) {
      let row = database.prepare("SELECT * FROM users WHERE id = ?").get(id);
      if (!row) return null;
      return {
        name: row.name,
        salt: row.salt,
        passwordHash: row.password_hash,
      };
    }

    function createUser(id, account) {
      // Parameters keep user input separate from SQL instructions.
      database
        .prepare(
          "INSERT INTO users (id, name, salt, password_hash) VALUES (?, ?, ?, ?)",
        )
        .run(id, account.name, account.salt, account.passwordHash);
    }

    function loadProgress(id) {
      let row = database
        .prepare("SELECT profile_json FROM progress WHERE user_id = ?")
        .get(id);
      if (!row) return null;
      return JSON.parse(row.profile_json);
    }

    function saveProgress(id, profile) {
      database
        .prepare(
          `INSERT INTO progress (user_id, profile_json) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET profile_json = excluded.profile_json`,
        )
        .run(id, JSON.stringify(profile));
    }

    // Run once, in one transaction. An error rolls back every imported account.
    function migrateAccounts() {
      let done = database
        .prepare("SELECT name FROM migrations WHERE name = ?")
        .get("json-accounts-v1");
      if (done) return;
      if (oldAccountsPath && existsSync(oldAccountsPath)) {
        let old = JSON.parse(readFileSync(oldAccountsPath, "utf8"));
        if (
          !old ||
          !old.users ||
          Array.isArray(old.users) ||
          typeof old.users !== "object"
        ) {
          throw new Error(
            "Invalid old accounts file. No accounts were imported.",
          );
        }
        let backupPath = oldAccountsPath + ".before-sqlite.bak";
        if (!existsSync(backupPath))
          copyFileSync(oldAccountsPath, backupPath, constants.COPYFILE_EXCL);
        let ids = Object.keys(old.users);
        for (let i = 0; i < ids.length; i++) {
          let id = ids[i];
          let account = old.users[id];
          if (
            !account ||
            typeof account.name !== "string" ||
            typeof account.salt !== "string" ||
            typeof account.passwordHash !== "string"
          ) {
            throw new Error("Invalid old account. No accounts were imported.");
          }
          if (!findUser(id)) {
            createUser(id, account);
            if (account.progress) saveProgress(id, account.progress);
          }
        }
      }
      database
        .prepare("INSERT INTO migrations (name) VALUES (?)")
        .run("json-accounts-v1");
    }
    let migrate = database.transaction(migrateAccounts);
    migrate();

    function close() {
      database.close();
    }
    return { findUser, createUser, loadProgress, saveProgress, close };
  } catch (error) {
    database.close();
    throw error;
  }
}
