# PearlPop basic game with SQLite

## Run in VS Code

Open this folder in VS Code, then run:

```sh
npm ci
npm start
```

Open http://localhost:3004/. Node.js and npm are needed. The SQLite driver is installed by npm ci; no separate database server, account, password or connection string is needed. This version was tested using Node 20.12.2. start-windows.bat installs missing dependencies and starts the same server. Use PORT to choose another port if needed.

## Database and old accounts

The server creates data/pearlpop.sqlite automatically. database.js creates three tables:

| Table | Purpose |
| --- | --- |
| users | Unique account ID, display name, salt and scrypt password hash |
| progress | One saved profile per user, linked by a foreign key |
| migrations | Records the one-time JSON import |

To keep the code small, history, pearls, collection, daily goal and settings are stored as JSON text in the profile row. This is a deliberate simple schema, not a separate SQL table for every feature.

On first start, existing data/accounts.json is imported in one transaction. The exact original is preserved as data/accounts.json.before-sqlite.bak and the original JSON is left unchanged. A migration marker prevents old data replacing newer progress on subsequent starts. Invalid legacy data stops startup rather than silently dropping accounts. New accounts and progress go only to SQLite.

Keep the whole data folder private. Do not include it in source submissions. Stop the server before copying the database for a backup; copy data/pearlpop.sqlite to a safe location. The source ZIP intentionally contains no real accounts or database. Extracting it creates a new empty database, so preserve your existing data folder when updating an installation.

## How the game works

Registered users only. Practice has no timer; Timed Dive allows 10 seconds per question, automatically advancing after timeout feedback. Ten rounds, two skips, orange illustrated fish, keyboard answers, focus zoom, an idle reminder, bubbles and swimming decorations, original colours/navigation, daily rewards, reef unlocks, history and personal best are retained.

The server verifies passwords and sends a random HttpOnly, SameSite cookie. Session records are in memory: restarting requires login again, but accounts and progress remain in SQLite. localStorage is a display cache and never proves identity. All browsers must connect to the same server to share accounts. Another browser refreshes or logs in to load current progress; this is not live push synchronisation.

Browser-only login and automatic browser profile imports were removed to keep authentication simple. Existing SQLite accounts and progress are retained. The one-time server JSON-to-SQLite import remains to protect older server data.

## Code map

| File | Responsibility |
| --- | --- |
| server.mjs | HTTP routing and starting/closing the database |
| database.js | SQL tables, find/create user, load/save profile, legacy import |
| server-auth.mjs | Password checks, sessions and progress actions |
| dist/js/auth.js | Login forms' server requests and session restoration |
| dist/js/storage.js | Profile display cache and ordered save requests |
| dist/js/game-engine.js | Score, timer, pause and game rules |
| dist/js/fish-api.js | External Fish API request and response validation |
| dist/js/app.js | Screens, navigation and input events |
| dist/js/audio.js | Feedback sound |

## Four assignment themes

Low coupling/high cohesion: database SQL is separate from authentication, external API, game rules and UI.
Event-driven programming: clicks, keyboard events, timer callbacks and network events trigger behaviour.
Interoperability: HTTP/JSON connects the browser, Node server and external Fish API; SQL connects Node to SQLite.
Virtual identity: password verification establishes the user, the cookie maintains the session, and the database stores that user's profile.

Read SIMPLE-CODE-GUIDE.md to study the flow. Do not present code you have not understood as independent work. AI assistance was used for refactoring, SQLite integration, migration and tests. Source comments and THIRD-PARTY-NOTICES.md acknowledge it.

## Checks and deployment limits

npm test runs unit/integration tests and a simulated-DOM smoke check with deterministic Fish responses. The new database tests cover migration, backup, rollback, parameter binding and foreign keys. UI files were not changed by the SQLite integration.

For online use, host this Node server with HTTPS and persistent local disk for data/pearlpop.sqlite. Set SECURE_COOKIES=true under HTTPS. SQLite is on the server, not each player's device. Keep one application instance for this simple design; memory sessions are not shared between instances. Password reset, email verification, MFA and server-authoritative gameplay/anti-cheat are not implemented. The server validates score fields but does not independently replay a game to prove a score. The external Fish API needs connectivity.


## Simplified academic version

Read FOUR-THEMES-GUIDE.md for the lecture and Java-to-JavaScript mapping. Browser PBKDF2 and automatic browser-only account/profile import were removed. Login always checks the server. Settings toggles share one clear save function. The game rules, UI markup/assets and server password/session protections are retained.
