> SQLite update: earlier descriptions below are historical. Current storage and run instructions are in README.md and SIMPLE-CODE-GUIDE.md. Accounts/progress now use data/pearlpop.sqlite; npm ci is required.

# Understand this basic game

This guide is for studying the code. It is not a script or transcript for the assessed video. The brief requires your own authentic explanation and allows acknowledged AI help for code, not for the video.

## Start with this flow

Browser opens -> auth.restoreSession -> server checks cookie -> sign in or home.
Home -> mode selection -> startGame -> loadQuestion -> answer -> feedback -> nextQuestion -> results.

The four themes are visible in different parts of this same working flow. You do not need submarine features to discuss them meaningfully.

## How the supplied Java sample maps to JavaScript

| Java example | This game | Difference |
| --- | --- | --- |
| Game.java | The question object | Holds the fish answer and image data returned by the service. The UI uses its own orange artwork for the answer count. |
| GameEngine.java | game-engine.js / GameEngine | Adds rounds, skips, timing and feedback status to the Java scoring idea. |
| GameServer.java | fish-api.js | Java reads CSV and image bytes; JavaScript fetches JSON asynchronously. |
| GameGUI.java | app.js | Swing buttons and ActionListener become HTML buttons and addEventListener. |
| LoginData.java | server-auth.mjs | The fixed example username/password is replaced by a server account store and password KDF. |
| LoginGUI.java | accountScreen and handleAccount in app.js, plus auth.js | The form sends credentials to a server endpoint and displays the result. |

## Read the modules in this order

1. game-engine.js: constructor, load, answer, resolve, next, result.
2. remaining, pause, resume and tick: how the 10-second timer is managed.
3. fish-api.js: fetchQuestion calls a service; parseQuestion checks its data.
4. storage.js: per-user browser saves, duplicate rewards and purchases.
5. auth.js: request, signup, login, rememberAccount, restoreSession, logout.
6. server-auth.mjs: createAccount, checkLogin, currentSession and handleAuth.
7. app.js: startGame, loadQuestion, answer, showOutcome, nextQuestion, finishGame.
8. Screen templates and CSS: the markup and appearance, separate from rules.

## Theme 1 - High cohesion and low coupling

High cohesion means related tasks stay together. GameEngine checks answers and updates the score, but it does not draw buttons or check passwords. server-auth.mjs groups account and session operations.

Low coupling means modules communicate through a small interface. app.js gives GameEngine a question and a number. It does not need to know how scrypt works. fish-api.js can change how it reads the service while returning the same question shape.

This separation is not zero coupling: the UI knows the engine's public methods and fields. Compare it with a single click handler that fetches data, hashes a password, draws fish and changes scores. That alternative saves file boundaries but makes testing and later changes harder.

## Theme 2 - Events

- submit calls handleAccount instead of reloading the page.
- click calls handleClick; data-action identifies the requested action.
- keydown calls handleKey for digit answers, P and Escape.
- visibilitychange pauses an active game when a tab is hidden.
- input and pointer events change zoom and panning.
- setInterval calls checkTimer; the engine's deadline decides whether time expired.
- HTTP data/end/error events in readBody collect and parse a login request.

A listener is registered once on document, not again on every new button. event.target.closest('[data-action]') finds a button even if a child element was clicked. This is event delegation. Compare it with attaching one listener to each button after each render.

## Theme 3 - Two examples of interoperability

1. Browser -> Marc Conrad's PHP Fish API, using HTTPS and JSON.
2. Browser -> this Node server's /api/auth endpoints, using JSON and a cookie.

The external response contains fish, question and chest. fish is the answer. question is the image information. chest is not the answer. This UI draws local SVG fish using the returned fish count, including in Focus Zoom. Base64 is an image encoding, not encryption.

fetchQuestion is asynchronous so the interface can keep responding while the network is busy. The AbortController cancels abandoned or slow requests. Errors show a retry state without consuming a round. There is no silent offline fallback in this supplied basic game.

A server proxy is an alternative that can centralize requests and hide an upstream address, but it adds server logic and a dependency. The supplied game calls the external service directly. Its local server is used for authentication and public files.

## Theme 4 - Real server checking and its limits

Registration:
1. The server validates the name and password length.
2. randomBytes creates a salt.
3. derivePassword calls Node's built-in scrypt.
4. writeAccounts saves name, salt and hash in data/accounts.json.

Login:
1. checkLogin finds the server account.
2. It derives a candidate key with the stored salt.
3. timingSafeEqual compares equal-length keys.
4. A correct password creates a random token and session entry.
5. The response sets an HttpOnly, SameSite=Lax cookie. Secure is added when configured for HTTPS.

Session restore:
The browser sends the cookie automatically. The server looks up the token and checks expiry. JavaScript cannot read an HttpOnly cookie through document.cookie. sessionStorage stores only a display/cache ID; it does not replace the server check.

Logout removes that token from this server and expires the cookie. Logging out in one independent browser does not invalidate another browser's token. Server restart clears in-memory sessions, so users log in again. Accounts remain on disk.

A salt makes identical passwords produce different stored hashes. scrypt is a password key-derivation function; the code does not decrypt passwords. PBKDF2 remains in auth.js only for migrating an older browser-local account after its password is checked.

There are still limits: local progress can be edited, the JSON file is for one server process, and no password reset or email verification exists. A database, HTTPS, server-validated progress and a more complete account lifecycle would be alternatives for a public product. Do not claim those are implemented.

## Timer and counting behavior

The engine uses a deadline timestamp instead of counting interval callbacks. pause stores remaining seconds and clears the deadline. resume creates a new deadline using the saved seconds. This prevents time spent paused from consuming the question time. The visible time is rounded up to a whole second.

After a correct answer, resolve changes status to feedback. A second click is ignored because answer requires playing status. A wrong answer keeps the same question and score. A timeout gives no point and the controller advances after a short message. The four-second idle reminder asks for an answer without changing the game result.

## Server helpers worth understanding

- Promise lets scrypt and HTTP-body events report a result later without blocking the event loop.
- Map is a built-in lookup table for session tokens and recent login attempts.
- readBody accepts JSON, limits its size and waits for all chunks. UTF-8 decoding handles a multi-byte character split across chunks.
- writeAccounts writes a temporary file then renames it so an unfinished write does not replace a valid account file.
- createAccount re-reads after asynchronous hashing so overlapping registrations do not overwrite another new account in the same process.
- Static files are restricted to dist; data/accounts.json cannot be downloaded as a public asset.

These are the harder parts where AI assistance is explicitly documented. They are standard Node/browser APIs, not third-party JavaScript libraries.

## Check your own understanding

- Trace one number-button click to the final saved result.
- Explain why the same question cannot score twice.
- Compare an HTTP request failure with a wrong answer.
- Explain which data is in the account file, session Map and localStorage.
- Explain why accounts can work across browsers while progress differs.
- Explain why setting a local explorer ID is not enough to authenticate to the server.
- Compare synchronous file storage with a database and state which one is actually used.
- Make a small change yourself, test it and keep genuine notes of your own work and tutor feedback.

No generated explanation can replace your understanding. The assessed video and any progress evidence must be authentic; do not fabricate authorship or development history.
