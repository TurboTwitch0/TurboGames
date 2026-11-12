# Catalog artwork

All 3,099 catalog entries have a local image. The current collection contains 2,631 sourced images and 468 original TurboGames illustrations. Newly curated sourced covers use exact-title or creator metadata and were visually reviewed. Illustrations show game-related scenes or category objects with the complete game title and are not presented as official cover art.

The focused November cover repair replaces eleven illustrated placeholders with verified publisher/creator imagery or an actual game title-menu canvas. The Popular review covered 39 entries; A Different Snowgrave now uses its rendered title menu, and the DDLC64 entry uses the matching Doki Doki Mario 64 creator logo corroborated by its ROM filename. Other replacements include Celeste Classic 2, Roller Baller, Super Pickleball Adventure, and Scuba Bear. Existing sourced covers remain intact. The report is `reports/cover-quality-repair-2026-11-12.json`; each new record includes provenance and `fit: "contain"` so titles and artwork are not cut off. A blank BAS capture and the Snowgrave launch warning were rejected, rather than promoted to covers. This is a focused repair, not a claim that all remaining illustrations are official artwork or that every game has received a full playthrough.

`artwork.json` maps each catalog ID to an image path, `type`, source URL, and attribution. `artwork-emulator.json` records the carefully matched console covers imported from Libretro. Raster source images retain their aspect ratio against a blurred background. Game-screen captures are candidates only: the capture tools write into the ignored `.artwork-review/` folder and never update the live artwork manifest. Review a capture for a real title screen or gameplay before curating it into the catalog. When an exact-title image cannot be verified, the catalog uses an explicitly labeled original illustration instead of a loader, error, or blank capture.

Sources include the [GN Math cover catalog](https://github.com/gn-math/covers), [GN Math game metadata](https://github.com/gn-math/assets/blob/main/zones.json), [3kh0-lite project catalog](https://github.com/3kh0/3kh0-lite), [UGS game assets](https://github.com/bubbls/UGS-Assets), [Libretro thumbnails](https://github.com/libretro-thumbnails), exact game pages on [CrazyGames](https://www.crazygames.com/) and [Poki](https://poki.com/), official creator websites, and imagery referenced in the original game HTML. Each image's manifest record supplies its specific provenance. Artwork remains credited to the respective game creators and source repositories.

To rebuild or extend the artwork locally, install Python, Pillow, Node.js, Playwright, and Chromium, then run:

```sh
python3 tools/emulator_artwork.py
python3 tools/import_artwork.py --discover-web
node tools/capture_flash_artwork.cjs
node tools/capture_html5_artwork.cjs
node tools/capture_emulator_artwork.cjs
```

Use `python3 tools/import_artwork.py --offline` to preserve existing downloaded covers, merge emulator cover records, and regenerate illustrations without network requests. Source HTML is parsed as data; the importers never execute game JavaScript. Exact title and source metadata matching is used, with illustrated artwork for uncertain matches. Every fallback remains individually labeled as `illustrated` in the manifest.

## Delivery previews

Original curated images and their credit records remain unchanged. Run `python3 tools/optimize_covers.py` followed by `python3 tools/build_catalog.py` to generate and use smaller 384px WebP previews. `cover-thumbnails.json` records original SHA-256, source/preview bytes and dimensions. The catalog builder verifies that source hash before selecting a preview; a changed or missing preview falls back to its original art. Hashed preview files can be cached long term. Landscape artwork with `fit: "contain"` is displayed in full rather than cropping away logos or important content.
