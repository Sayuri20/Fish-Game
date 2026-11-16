# SQLite update validation

20 automated tests passed, plus the simulated-DOM UI smoke check. Tests cover scoring/timer rules, signup/login, password hashes, independent browser cookie jars, cross-browser shared progress, restart persistence, duplicate rewards, account isolation and unauthenticated requests.

SQLite tests cover exact JSON backup, one-time import, rollback after invalid legacy data, unique IDs, foreign keys and parameterised lookup. Existing real accounts were migrated and password hashes/salts compared without printing private values. SQLite integrity_check returned ok. The running game returned HTTP 200 on port 3004.

No visual assets, CSS or UI templates were changed by this database integration. The smoke check uses deterministic Fish responses and is not proof of live external API availability or production security. Browser sessions are intentionally reset by a server restart. Private data, logs and installed dependencies are excluded from the source ZIP.

Simplification update: 20 tests plus UI smoke passed. The retired legacy-login test was replaced with a test that browser data cannot create an account or replace server progress. Existing SQL migration tests remain. UI CSS/assets and screen templates are unchanged.
