# Backrooms 3D Multiplayer — Level 0

The separate arcade entry is library-source/html5-games/clbackrooms3dmultiplayer.html.
The original clbackrooms.html game stays in the catalog.

This version uses the bundled Three.js renderer for actual 3D rooms, ceiling fixtures,
flooring, doors and characters. Wallpaper, carpet and ceiling textures are generated
locally with deterministic canvas code. The scene has no external texture or model
downloads. Audio is generated locally after a player presses a button.

- world.js: seeded, connected rooms, geometry, collision and fluorescent lighting.
- materials.js: local material textures.
- game.js: first person controls, rendering, sound, enemy navigation, menus and chat UI.
- multiplayer.js: PeerJS room protocol, validated state, chat and disconnect cleanup.

Rooms support up to eight players. PeerJS's public signaling service introduces
the browsers; player traffic then uses WebRTC data channels. The host must stay
connected. A network that blocks WebRTC, or a NAT that needs a TURN relay, may
prevent a remote player from joining. No TURN service is configured. Solo mode
uses the same environment without a room connection.

Modules need Access-Control-Allow-Origin: * for the arcade's sandboxed srcdoc
iframe. The development server, Netlify headers and Vercel config include it for
this game's module directory and bundled vendor files.
