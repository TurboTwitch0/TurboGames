# TurboGames update status

## October 21: artwork and player update

The confirmed Ruffle WASM CORS failure remains fixed through cross-origin headers for `/vendor/*`. The local server uses the same `_headers` rules as production. Before/after browser checks reproduced the failure and confirmed two Flash games start after the fix; both WASM variants load from isolated frames. See `ruffle-cors-fix.md`.

- **3,098 catalog entries**, each with a local square cover image.
- **2,733 sourced images or verified game screens** and **365 original illustrated covers**. See ARTWORK.md and artwork.json for provenance.
- **488 distinct source launchers repaired**, plus shared player compatibility fixes. Includes all 403 broken Flash $1 paths, seven missing-file pages, original creator files, malformed inline scripts, bad CDN paths and emulator configuration errors.
- **19 source templates omitted** from the playable catalog. Original template files remain in the source collection.
- **28 entries still need source assets** from a removed upstream repository. They are marked Needs source. Exact URLs and checks are in unavailable-game-sources.json. No unrelated game was substituted.

## Google Sites

Open **google-sites.html** after extracting the ZIP. Host the complete TurboGames folder on an HTTPS host, paste that hosted address into the helper, and copy the generated code into Google Sites → Insert → Embed → Embed code. The compact arcade uses ?embed=1. Google Sites does not host or unpack this ZIP itself.

## Checks completed

- Every catalog source path and image path exists locally.
- All inline classic and module scripts passed syntax parsing: **0 failures**.
- UI checks passed for images, paging, isolated storage/cookies/IndexedDB, local-save persistence, fullscreen or its new-tab fallback, Google Sites embed code and mobile overflow.
- Browser render/start-screen checks covered Orbit Breaker, 2048, Windows Doors, Hextris, Tetris and Colorbox Mustard. Five showed game canvases; 2048 uses DOM tiles. These are not complete game playthroughs.
- Recovered TurboWarp archives passed full ZIP CRC validation. Data is split into files no larger than 20 MiB.
- Broad HTTP dependency checks and emulator multipart boundary checks are recorded in the other audit reports. Optional resources and multipart prefixes are distinguished from game data where known.

## Practical limits

Not every game received a full playthrough. External game hosts can change or become unavailable. Some managed cloud-browser requests could not be fully tested because it does not trust the environment proxy CA; automatic approval review rejected modifying its persistent trust store because that would broadly change HTTPS trust. TLS verification remained enabled for source checks through the existing trusted HTTP client.

The isolated IndexedDB fallback is temporary. Use game Save State / Export Save controls for emulator progress you want to keep after closing a game. LocalStorage and cookies are saved separately per game by the arcade.

Windows Doors' creator notes minor Ruffle window dragging/scrollbar limitations. Large games still require enough browser memory and a host/deployment method that accepts the full library size.
