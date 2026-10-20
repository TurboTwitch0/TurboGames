# Placeholder launcher repairs

Seven placeholder pages were replaced with launchers or original game HTML. Six original Google Drive links returned HTTP 404; GD Wave was recovered from its original public download confirmation form.

Game scripts were not executed as part of this repair. HTTP availability and file signatures establish that source files are retrievable, not that every game completes loading or supports every browser.

- **library-source/flash/cldouchebagworkout.html** — Restored matching Flash SWF through standard Ruffle player. SWF returned HTTP 200 and CWS signature. Source: https://raw.githubusercontent.com/brickyosu/ugs-files-sorted/ad5667281e90e7b118ce6c35d2a423c3cb84a137/D/cldouchebagworkout.html
- **library-source/flash/clsuperstacker2.html** — Replaced inaccessible original with matching Super Stacker 2 SWF. SWF returned HTTP 200 and CWS signature. Source: https://github.com/coollittledude21/Super-Stacker-2/tree/053f3c7362d787487583f25c02a288ca25a741d2
- **library-source/html5-games/clarewethereyet.html** — Restored matching Unity launcher with responsive sizing. Unity build manifest returned HTTP 200. Source: https://raw.githubusercontent.com/brickyosu/ugs-files-sorted/ad5667281e90e7b118ce6c35d2a423c3cb84a137/A/clarewethereyet.html
- **library-source/html5-games/clcountersnipe.html** — Restored matching Flash SWF through Ruffle, removing the upstream bogus embed URL. SWF returned HTTP 200 and CWS signature. Source: https://raw.githubusercontent.com/brickyosu/ugs-files-sorted/ad5667281e90e7b118ce6c35d2a423c3cb84a137/C/clcountersnipe.html
- **library-source/html5-games/cldoomgallery.html** — Restored matching Construct launcher and pinned upstream asset base. Removed service-worker registration because a cross-origin game base cannot register a service worker for this local site. Main module returned HTTP 200. Source: https://raw.githubusercontent.com/brickyosu/ugs-files-sorted/ad5667281e90e7b118ce6c35d2a423c3cb84a137/D/cldoomgallery.html
- **library-source/html5-games/clgdwaveover100mb.html** — Recovered original 121,121,169-byte TurboWarp HTML by following Drive public warning form. Full HTML present; no Drive warning/error page. Source: https://drive.google.com/file/d/1qJ5PdyAl9GRMxpn-0NrcDH6Ap68ASqWi/view
- **library-source/html5-games/clshogunshowdown.html** — Replaced statically.io URLs returning HTTP 403. Unity loader/framework, data and WASM verified HTTP 200 with CORS. Normalized build files through blob URLs to handle misleading .gz names and missing server Content-Encoding. Source: https://raw.githubusercontent.com/brickyosu/ugs-files-sorted/ad5667281e90e7b118ce6c35d2a423c3cb84a137/S/clshogunshowdown.html

Previous placeholders are preserved in `/tmp/TurboGames-placeholder-backups`. External game assets still require internet access.
