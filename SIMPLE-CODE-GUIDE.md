# Understanding this version

AI assistance was used to refactor and connect the supplied game. Use this guide to study the implementation and explain it in your own words.

Read in this order:
1. game-engine.js: game rules, score, timer and pause.
2. fish-api.js: fetch a question and check the returned data.
3. storage.js: cache a profile and send a named action to the server.
4. auth.js: register, login, restore a cookie session and logout.
5. server-auth.mjs: look up the account in SQLite, verify a password, find a session and save progress.
6. app.js: show screens and react to clicks and keyboard events.

## Following one login
The form calls login in auth.js. The browser sends JSON to the Node server. The server derives a password key using scrypt and compares it with the saved hash. If it matches, the server creates a random session token and sends an HttpOnly cookie. The browser then requests the account profile. storage.js keeps a display copy, and app.js shows it.

## Following one save
app.js calls serverAction with correct, result, claim, unlock or settings. The server finds the user from the cookie, never from a user ID supplied in the body. It applies the action and saves the profile in SQLite. The browser receives the updated profile and updates its cache. A Promise queue sends this browser's actions in order.

## Four themes
Low coupling/high cohesion: separate game rules, UI, external API and account persistence.
Events: clicks, keydown, network callbacks and timer callbacks trigger work.
Interoperability: JSON and HTTP connect JavaScript to the external Fish service and the Node server.
Virtual identity: username/password verification establishes identity and a cookie maintains the session.

## Limits you should understand
SQLite stores accounts in users and one JSON profile per user in progress. database.js uses ? placeholders so data is not treated as SQL. A foreign key links each profile to a real account. The migration uses a transaction: either all old accounts import or none do. migrations records completion so old data cannot replace newer progress after restart. The connection closes with the HTTP server.

The server validates save fields but does not replay a whole game to verify scores. Browser-only account migration has been removed. Existing SQLite progress remains. A different device needs the same hosted server. HTTPS and persistent storage/backups are needed when deploying.

Explain what each function receives, what it changes and what it returns. Ask for an explanation of any line you do not understand rather than memorising a presentation script.


## SQLite functions
openDatabase opens the file and creates missing tables.
findUser receives an ID and returns the saved account or null.
createUser inserts an account; the primary key prevents duplicate IDs.
loadProgress reads and parses the saved profile.
saveProgress inserts a new profile or updates the existing one.
close releases the connection when the server closes.

Password hashing stays in server-auth.mjs, not in the database module. JSON.stringify converts a JavaScript profile into text for SQLite; JSON.parse converts it back.


For the current academic mapping and source references, read FOUR-THEMES-GUIDE.md. The client no longer hashes passwords or registers old browser-only accounts automatically.
