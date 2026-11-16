> SQLite update: earlier descriptions below are historical. Current storage and run instructions are in README.md and SIMPLE-CODE-GUIDE.md. Accounts/progress now use data/pearlpop.sqlite; npm ci is required.

# Changes from PearlPop-login-fixed.zip

- Used the supplied login-fixed ZIP as the baseline, not the older demo or racing game.
- Expanded client HTTP options and migration checks into explicit if/else blocks.
- Replaced the server's terse authentication handler with named helpers for account creation, password verification, cookies, attempt limits and session lookup.
- Used named callbacks for scrypt and HTTP data/end events instead of a promisify helper and asynchronous iteration.
- Retained scrypt salts/hashes, cookie protection, attempt limits, private account files, migration and restart behavior.
- Retained the supplied artwork, theme, screen markup, decorations, navigation, reminders and 10-second timeout flow.
- Corrected Focus Zoom to enlarge the same orange fish artwork.
- Formatted code and CSS without redesigning the screens.
- Added a code study guide, updated source acknowledgements and additional request-body tests.
- Default preview port is 3004 so an existing server on 3003 is left running.

AI assistance was used throughout this refactor, not only in isolated difficult sections. Existing comments are retained and focused comments explain current assistance. The original ZIP is unchanged. No real accounts or session tokens are included in the delivery ZIP.

Phone navigation: the existing five actions now fit in one bottom bar; Sign out no longer wraps over the question controls. Colors, actions and navigation destinations are unchanged.


Update: progress now saves to the server account file. Browser storage is a display cache. Existing browser progress imports once if that account has no server progress yet. Unused browser-only reward mutation functions were removed. See SIMPLE-CODE-GUIDE.md and README.md for limits.
