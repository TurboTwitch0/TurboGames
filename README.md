# TurboGames

TurboGames is a static, searchable library with **3,099 games and apps**, square cover images, category tabs, and an isolated fullscreen player. No package install or build step is needed.

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
