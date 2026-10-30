# TurboGames

TurboGames is a static, searchable library with **3,099 games and apps**, square cover images, category tabs, and an isolated fullscreen player. No package install or build step is needed.

## Brand and launch assets

The original **Find your next play** identity uses shared tokens in `brand.css`, native SVG icons, and logo assets in `assets/brand/`. The landing page previews the existing Orbit Breaker game; its Play and Save actions use the same player and library as the catalog. Loading, recovery, empty collections, mobile browsing, and the Google Sites helper share the same visual system. Motion respects the device's reduced-motion setting.

The homepage's manual featured rotation stages Orbit Breaker, Little Match, and 2048 using existing artwork, perspective cards, and restrained lighting. Choose a side card, use Previous/Next or the named selectors, or swipe horizontally on touch screens. When the stage has focus, Left/Right, Home/End, and Enter are available. Play, Save, and Browse Games follow the selected title. There is no autoplay; vertical scrolling remains native, and reduced motion uses a flat 2D presentation. Collection and embedded views continue to bypass the stage.

Persistent **Saved** and **Recent** shortcuts keep the browser-local library reachable from the sticky header, including on phones. Desktop collection views use a category sidebar with actual catalog counts; smaller screens and Google Sites retain horizontally scrollable categories. The shared library updates across tabs. Navigation styles live in `library.css`.

The exportable [brand and launch kit](outputs/turbogames-brand-kit/README.md) includes a [downloadable ZIP](outputs/turbogames-brand-kit/TurboGames-brand-kit.zip), a visual style guide, SVG/PNG logos, 1200×630 landscape artwork, 1080×1350 portrait artwork, actual desktop/mobile captures, and launch copy. Its [asset manifest](outputs/turbogames-brand-kit/asset-manifest.json) lists public download URLs, dimensions, and SHA-256 hashes. Product screenshots and existing game artwork retain their source attribution; promotion copy describes browser-local libraries and varying title availability accurately.

Regenerate the kit with `python3 tools/export_brand_kit.py --capture-url http://127.0.0.1:8002/` while the local server runs. Run `node tools/brand-check.cjs` for focused keyboard, preview, favorite synchronization, loading/recovery, reduced-motion, and narrow-layout checks in addition to the discovery checks below.

For the latest showcase-only export delta, use `--showcase-only --baseline-commit 0adee80` with that generator command. The [showcase update manifest](outputs/turbogames-brand-kit/showcase-update.json) lists changed public exports and checksums, including the current mobile stage preview. `node tools/showcase-check.cjs` validates manual selection, selected actions, keyboard/touch, reduced motion, and narrow/embedded layouts.

## Find a title and return to it

**Play by category** adds Action, Adventure & RPG, Arcade, Puzzle & Strategy,
Racing, Sports, Horror, and Rhythm alongside the existing collection tabs.
Categories combine with search, Saved/Recent, source type, sorting, and availability.
Their counts reflect the current collection and other filters. Share or bookmark
`/?view=all&genre=racing` to reopen the category. **All genres** includes every
catalog title, including titles without a confident genre classification.
The maintained rules and explicit metadata support live in `game-categories.js`;
the daily catalog refresh retains this separate classification layer.
Run `node --test tools/category-model.test.cjs` for classification regressions.

Search within a category or choose **All** to search the full catalog. Search tolerates punctuation and accents, supports multiple words, and keeps the query when switching categories. The collection can be sorted by title or filtered to hide entries with missing sources.

**Pick for me** previews a random title from the current results before opening anything. Play, Save, and Another pick use the same catalog and library; another pick avoids repeating the current title when alternatives exist. Known missing sources are excluded, but this is not a compatibility or gameplay guarantee. Changing a filter dismisses the old preview. Arcade, Racing, Puzzle, and Mario shortcuts run real full-catalog searches.

Active search, availability, and sorting chips can be removed independently. A scoped search offers **Search all titles** without losing the query or other filters. The search field also has a keyboard-accessible clear button. On returning to the homepage, **Jump back in** surfaces up to three recently opened titles with their existing covers and links to the full Recent collection. No account, cloud sync, or new game is added.

Use the heart on a card to keep it in **Saved**. **Recent** lists the last 24 successfully opened game pages. These lists stay in the current browser profile; no account is required. If browser storage is blocked or full, the current tab keeps its latest game saves and library changes until it closes.

Collection filters are preserved in the URL, such as `/?view=games&q=mario&sort=title-asc`. A game opens at `/?play=orbit-breaker`, so it can be bookmarked or linked from the TurboUniverse hub. Browser Back returns to the collection, Forward reopens the game, and closing a direct game link clears its play parameter. Failed game-page downloads offer a retry; known missing sources explain the problem and offer a return to browsing.

The existing player has a **Save for later** heart and a **Share** panel. Shared links contain the current title only, without the user's collection search or embed settings. Copy uses the browser's clipboard API; when copying is unavailable, the real link stays selected for manual copying. Escape closes Share before closing the game. Phone controls use two rows so the title and six 44px controls fit; landscape switches to a compact toolbar. Fullscreen labels follow the actual browser state. Player styles live in `player-tools.css`.

Run `node tools/ui-check.cjs` and `node tools/discovery-check.cjs` against the local development server on port 8002 to check discovery, browser navigation, game storage, fullscreen, Google Sites embedding, and mobile layout. Set `TURBO_TEST_URL` to check another deployment.

Run `node tools/quick-play-check.cjs` for the focused recent shelf, scoped preview, favorites, filter controls, quick searches, focus recovery, keyboard/touch, reduced-motion, and narrow/embedded layout checks. Its report is `reports/quick-play-check.json` by default.

Run `node tools/library-navigation-check.cjs` and `node tools/player-tools-check.cjs` for the persistent library shortcuts, real category counts, cross-tab updates, player favorites, native/manual link copying, fullscreen state, focus recovery, and phone/landscape layout checks. Both support `TURBO_TEST_URL` and `TURBO_REPORT_PATH` for checking a deployment without changing committed local reports.

## Daily GitHub refresh

The [Daily catalog refresh workflow](https://github.com/TurboTwitch0/TurboGames/actions/workflows/daily-refresh.yml) runs every day at 11:23 UTC (morning in Central Time). It checks the existing library and rebuilds the catalog using the local artwork mappings. It does not import new games.

Each run validates local game files and cover images, scans launcher resources, parses inline JavaScript, and makes fresh checks of external script/frame/asset URLs. Remote checks have a ten minute budget and rotate their starting point daily; deferred URLs are counted in the report. Network reachability and syntax checks do not confirm complete gameplay.

The workflow commits the refreshed catalog and a compact [daily status report](reports/daily-status.md) to main. Full reports are available in the run's **daily-refresh-reports** artifact for 14 days. Failed remote URLs are reported for review; no game code is automatically replaced. Invalid local sources or syntax errors fail the run before its commit.

To refresh now, open **GitHub → Actions → Daily catalog refresh → Run workflow**. The workflow uses the repository's built-in GitHub token; no extra service or paid account is needed. Commits use a normal push, so a conflicting change to main is preserved and the refresh can be rerun.

To run the same checks locally:

    python3 tools/daily_refresh.py

Use --offline for local checks only, or --remote-limit 20 for a small remote smoke check. Python 3.10+ and Node.js 22+ are required by the refresh tools.

## Google Sites

Start with **[GOOGLE-SITES.md](GOOGLE-SITES.md)**. Host the extracted TurboGames folder on an HTTPS static website host, open **google-sites.html**, and paste your hosted address to generate the Google Sites embed code. Google Sites embeds the hosted arcade; it cannot host the ZIP itself.

## Run locally

From this folder:

```sh
python3 tools/dev-server.py --port 8000
```

Open <http://127.0.0.1:8000>. This server includes the CORS headers needed by isolated players loading local split game assets. The supplied `_headers` file provides those headers on Netlify.

## Deploy from GitHub to Netlify

Import `TurboTwitch0/TurboGames` into Netlify using branch `main`. Leave the build command empty and set the publish directory to `.`. The repository root already contains `index.html` and `netlify.toml`; no nested TurboGames folder is needed for a GitHub deployment.

Keep `_headers` in the published root. It includes the Ruffle WASM CORS fix required by the isolated Flash player. Uploading to GitHub alone does not update a manually deployed Netlify site; connect the existing Netlify project to this repository to enable automatic deployments.

## Advertising

An optional, labeled AdSense display placement is prepared but disabled. See **MONETIZATION.md** for account approval, public ad IDs, consent requirements and activation. No advertising revenue is active until those steps are complete.

## Images and repaired sources

Every catalog entry has a local image: sourced artwork where available and original illustrated covers for other titles. Attribution and repeatable import scripts are described in **ARTWORK.md**.

The update repairs hundreds of launcher bugs, replaces missing files from verified sources, and includes local Ruffle 0.7.1. Detailed evidence and remaining limitations are in **reports/FINAL-STATUS.md** and the adjacent repair manifests.

Some launchers still need assets from third-party hosts. Entries whose removed asset host was confirmed unavailable have a **Needs source** badge; they are retained in the collection, rather than replaced with a different game. Their exact URLs are listed in **reports/unavailable-game-sources.json**.

LocalStorage and cookies are saved separately for each game. IndexedDB compatibility in isolated game frames is temporary: use the game's **Save State / Export Save** controls to retain emulator progress across closing the game.
