# Ruffle loading repair — October 19, 2026

## Cause and fix
The deployed _headers file allowed cross-origin requests for game assets but not vendor assets. The sandboxed game player has an opaque origin, so Ruffle's fetch of local WebAssembly was blocked. Added Access-Control-Allow-Origin: * to /vendor/*; the game sandbox stays isolated.

The local dev server previously sent this header on every response, hiding the deployment bug. It now reads the actual _headers rules.

## Verification
Before the change, Windows Doors produced zero canvases and the exact missing-CORS/Failed to load Ruffle WASM error reported by the user. After the change, Windows Doors and Douchebag Workout 2 rendered a canvas with no JavaScript errors. Orbit Breaker was also checked. Both Ruffle WASM variants were fetched from a real opaque browser frame, returned application/wasm and valid WASM signatures, and parent-document access remained blocked. These checks do not constitute full playthroughs of all Flash games.

## Deployment
The fix is in the workspace and downloadable patch. The live Netlify site requires redeployment by its owner. This corrects the shared Ruffle WASM loading failure; missing upstream game assets and school network restrictions remain separate limitations.
