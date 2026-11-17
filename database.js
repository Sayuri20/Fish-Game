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
      // I use parameters so user input is separate from the SQL query.
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

    // I import the old accounts together so a failed import saves none of them.
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

    function leaderboard(currentId) {
      const rows = database
        .prepare(
          "SELECT users.id, users.name, progress.profile_json FROM users JOIN progress ON users.id = progress.user_id",
        )
        .all();
      const scores = [];
      for (const row of rows) {
        const profile = JSON.parse(row.profile_json);
        const rescue = profile.rescue || {};
        const runs = rescue.runs || [];
        if (runs.length === 0 && rescue.bestScore === undefined) continue;
        let best = rescue.bestScore || 0;
        for (const run of runs) if (run.score > best) best = run.score;
        scores.push({
          name: row.name,
          score: best,
          isYou: row.id === currentId,
        });
      }
      scores.sort(function (a, b) {
        return b.score - a.score || a.name.localeCompare(b.name);
      });
      let rank = null;
      for (let i = 0; i < scores.length; i++) {
        scores[i].rank = i + 1;
        if (scores[i].isYou) rank = i + 1;
      }
      return { leaders: scores.slice(0, 10), rank: rank, total: scores.length };
    }

    function close() {
      database.close();
    }
    return {
      findUser,
      createUser,
      loadProgress,
      saveProgress,
      leaderboard,
      close,
    };
  } catch (error) {
    database.close();
    throw error;
  }
}
