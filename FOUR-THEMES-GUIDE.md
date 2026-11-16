# Four themes: code study guide

This is a study reference, not an assessed video script. AI assistance helped with refactoring and this mapping. Explain the implementation in your own words after understanding and testing it.

## 1. Low coupling and high cohesion

Unit source: LowCouplingHighCohesionWeek2_AY2425.pptx, slides 2, 4, 11 and 35.
The lecture groups related responsibilities and uses clear interfaces between components. More files alone do not prove low coupling.

In this game:
- game-engine.js owns score, rounds, skips and timing. It does not read the DOM or SQL.
- fish-api.js owns the external URL, request and response parsing.
- database.js owns SQL. Authentication uses findUser/createUser/loadProgress/saveProgress instead of knowing SQL table details.
- server-auth.mjs owns password verification, sessions and authenticated progress actions.
- app.js owns screen markup and input handlers. It asks GameEngine to apply game rules.

Example: changing the database query does not require changing the answer buttons. Changing a colour does not require changing password verification. app.js is still the largest module because the existing screens and navigation are retained; this is a limitation rather than a claim of perfect independence.

Java connection: GameGUI uses GameEngine; GameEngine uses GameServer. The Java interface does not contain the HTTP decoding implementation.

## 2. Event-driven programming

Unit source: eventorientedProgramming_AY2627.pptx, slides 7, 11, 13, 14 and 19.
The browser dispatches events to registered handlers. Do not write a manual endless loop waiting for button presses.

In app.js, submit calls handleSubmit, click calls handleClick, keydown calls handleKey, visibilitychange pauses a running game, and setInterval calls checkTimer. The listeners are registered once. handleClick chooses an action using if/else. An answer goes through GameEngine before feedback is shown. A game status prevents a second answer scoring twice.

Java connection: addActionListener and actionPerformed correspond to addEventListener and the JavaScript handler. The Java button event carries an action command; the HTML button carries data-action/data-answer.

Study example: follow number button -> click event -> handleClick -> answer -> GameEngine.answer -> feedback. Then trace the keyboard path reaching the same answer function.

## 3. Interoperability

Unit source: InteroperabilityAY2627.pptx, slides 3-5 and 16.
The lecture identifies logic, location and protocol.

Location: API_URL in fish-api.js identifies Marc Conrad's Fish API.
Protocol: HTTPS transports a JSON response. question is image data, fish is the answer, and chest is not the fish answer. Base64 is an image encoding, not password encryption.
Logic: fetchQuestion requests the response and parseQuestion checks and converts it into the game's question object. Timeout/cancellation and invalid-data errors are handled. Existing orange fish artwork displays the returned count; the original API image is parsed but is not shown in the counting UI.

The browser also sends JSON to the Node account API. The server uses the better-sqlite3 driver to communicate with SQLite. The external Fish API remains the main external web-service example required for the game.

Java connection: GameServer.java uses a URL, CSV, Base64 and an integer solution. JavaScript uses fetch/JSON instead of the Java stream and CSV implementation. The purpose is the same but the response format differs.

## 4. Virtual identity

Unit source: CIS045-3_AY2627_VirtualIdentity.pptx, slides 3-6, 9-11 and 16.
The server must distinguish clients and resist someone pretending to be another user. HTTP is stateless, so a session maintains identity between requests.

Signup: auth.signup sends the name/password; server-auth validates input, derives a salted scrypt hash and calls database.createUser. The SQL primary key prevents duplicate account IDs.
Login: checkLogin obtains the saved account, derives the password key and compares it using timingSafeEqual. A random token is stored in the server session Map and sent in an HttpOnly cookie.
Later requests: cookieToken/currentSession identify the authenticated account. Progress uses that account ID from the session, not a user ID supplied by the browser.
Logout: the token is removed and the cookie expires. Restarting the server clears sessions but leaves SQLite accounts and progress intact.

Java connection: LoginData.checkPassword is a hardcoded example. LoginGUI passes the accepted player name to GameGUI. This game extends that idea with signup, stored hashes and HTTP sessions.

Alternative: the previous localStorage login was browser-local and editable. The simplified game now always verifies identity on the server. Browser cache cannot create an account or replace SQLite progress. Password hashes are not reversible encryption. HTTPS is needed for deployed password transport. IP address alone is not reliable user identity.

## Read the project in this order

1. game-engine.js: input, state change and result.
2. fish-api.js: URL, fetch, parseQuestion and failure handling.
3. app.js: follow one click and one timer callback, then one screen template.
4. auth.js: request, rememberAccount, signup, login, restoreSession, logout.
5. server-auth.mjs: password check, cookie session and progress route.
6. database.js: parameterised SELECT, INSERT and saved profile.
7. storage.js: display cache and save queue.

## Honest limits

The UI remains substantial because the requested screens, effects and navigation remain. Password crypto, fetch cancellation and the save queue use standard APIs that require learning. SQL stores one profile as JSON text to keep the schema small. Sessions are in memory; this design uses one Node server instance. Scores are field-validated but not independently verified by replaying gameplay. There is no password reset, MFA or live cross-device push update. Keep database backups and use persistent hosting disk/HTTPS for deployment.

Source materials used: the supplied assessment brief, the five supplied lecture decks, and FishGame26.zip by Marc Conrad. The brief requires authentic understanding and reflection, not merely showing four labels in the UI. Full source and truthful external/AI acknowledgements remain necessary.
