# Sources and assistance

AI assistance was used to refactor this game, server authentication, tests and documentation. File headers and focused comments acknowledge that assistance. The code is not presented as entirely unaided student authorship, and no invented debugging history is included.

Baseline: user-supplied PearlPop-login-fixed.zip, including its login fix, UI, CSS, SVG artwork and prior AI acknowledgements.

Teaching reference: Marc Conrad's FishGame26.zip supplied with the assignment (Game.java, GameEngine.java, GameServer.java, GameGUI.java, LoginData.java, LoginGUI.java). These inform the separation of concerns and API mapping; they are not runtime dependencies.

Fish API: https://marcconrad.com/uob/fish/
Protocol: https://marcconrad.com/uob/fish/doc.php
Node cryptography: https://nodejs.org/api/crypto.html
Browser PBKDF2 for legacy migration: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveBits

Nunito fonts: see FONT-OFL.txt. No third-party JavaScript library is shipped. Testing uses Node built-ins; browser inspection used a development tool outside the packaged runtime.

The CIS045-3_AY2627_SEM1_Assessment.docx brief allows acknowledged AI code assistance but requires an authentic student video and genuine progress evidence. No tutor presentation or unaided authorship is claimed.


SQLite integration: AI assistance helped write database.js, migration and tests. better-sqlite3 is an external MIT-licensed Node driver (https://github.com/WiseLibs/better-sqlite3). SQLite provides the embedded database engine. Its use avoids custom database code; this version no longer has zero external dependencies.

AI assistance was used to simplify login, remove browser-only compatibility code, consolidate settings saves, and produce the code study/theme mapping. These changes do not claim independent authorship.

Reef Rescue update: AI assistance was used for expedition rules, rival behaviour, input/pause handling, SQLite progress actions, tests and illustrated art. The transparent sprite atlas was generated with the built-in image-generation tool. The original orange fish, fonts and teaching-code acknowledgements remain.

Jellyfish Survival: AI assistance helped implement the enemy, poison/bubble collisions, resource/life goals, touch/keyboard input and tests. New jellyfish/starfish/conch/venom art was generated and re-composed into a square transparent atlas using the built-in image-generation tool.

Workshop equipment images (workshop-bubbles.png, workshop-magnet.png, workshop-slow.png and workshop-cleaner.png) were generated with AI image assistance as transparent game assets.

The replacement villain sprite jellyfish-villain-v2.png was generated with AI image assistance as a transparent game asset.

The revised transparent jellyfish-villain-v3.png artwork was generated with AI image assistance.

The approved Tidekeeper, Finflash and Pearlwave designs were adapted into captains-v2.png with AI image assistance. Original character IDs and gameplay rules are retained.
