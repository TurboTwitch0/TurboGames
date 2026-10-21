# Catalog repair progress — 2026-10-21

## Changes prepared locally

- Shared legacy Unity resolver preserves complete blob/data/HTTP asset URLs while keeping relative resolution unchanged. Read-only loader functions retain their original implementation.
- Antimatter Dimensions entry updated to a pinned current upstream build; its direct bundle URLs passed the HTTP audit.
- Exact game-asset matches reuse sourced artwork with donor provenance recorded in artwork.json.
- Blumgi Racers, Champion Island, South Park, Little Runmo, and Cyber Cars were moved to matching available sources.
- Monkey Mart now reports its forced Poki redirect as unavailable instead of showing a broken embedded page.

## Evidence and limits

- Catalog: 3,098 entries. Local audit found no missing required resources.
- Syntax scan: 8,496 classic scripts and 39 modules; no syntax failures.
- Remote audit: 3,536 literal dependencies checked; 122 failed URL checks. Some are optional portal scripts or temporary access failures, so this is not a count of broken games.
- Shared resolver: 88 retrieved real Unity loaders passed URL-resolution checks. This is not 88 complete game playthroughs.
- Original failing Unity launcher: failed before shared repair, started and entered fullscreen after repair. See shared-unity-check.json.
- Artwork: 2,733 sourced covers or verified title/game screens; 365 entries still use illustrations. See artwork-pending.json for the complete remaining list.
- This batch added 766 validated Flash, HTML5, and emulator captures, six more exact web images, and 15 identical-asset matches. Blank, loading, and error screens were rejected with a pixel-variation check.

## Pending

- Validate and repair remaining remote-source failures, including missing game files.
- Obtain exact artwork or usable gameplay screenshots for all remaining entries.
- Run broader gameplay checks; HTTP and syntax checks alone cannot establish playability.
- Confirm production deployment after the new GitHub commit is published.
