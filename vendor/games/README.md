# Existing game core snapshots

These files are dependencies of existing catalog entries, copied from the exact
sources already used by their launchers. Hosting the core locally removes those
startup requests to outside CDNs. It adds no new game or replacement identity.

- `2048/`: the existing ovolve/2048-AI fork, its JavaScript, styles and fonts.
  Its MIT license is retained in `LICENSE.txt`. Creator credits and links remain
  in the launcher. Legacy third-party analytics and the Tweet widget are not
  needed to play and are not loaded by the local launcher.
- `hextris/`: the existing pinned Hextris distribution with its dependencies.
  Two missing control SVGs and the GPL license come from the original Hextris
  project. The existing game code and creator links are retained.
- `block-blast/`: the same existing Block Blast Puzzle1.1 Unity build, loader,
  compressed framework/WebAssembly/data and template assets. About10.3MB total;
  WebGL support and enough memory are still required. No game code was replaced.
- `bloons/`, `run/`: the same SWF files referenced by the original catalog
  launchers. Their game content and credits are unchanged. Flash still loads the
  shared local Ruffle runtime; first use and the game's own preloader can take
  longer than loading the small launcher page.

Each directory's `PROVENANCE.json` records exact URLs, sizes and SHA-256 hashes.
Source artwork, game and trademark rights remain with their creators; these
snapshots do not assert new ownership or a new license over either SWF.

`node tools/runtime-reliability-check.cjs` tests the real isolated player with
outside game hosts blocked: actual tile moves in 2048, start/rotate/pause in
Hextris, and local SWF/Ruffle activation. The local Block Blast build is also checked for successful Unity initialization
with all outside hosts blocked. Settled Flash menu screenshots were
also reviewed; runtime metadata alone is not a full game playthrough.
