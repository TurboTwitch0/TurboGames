# Daily TurboGames refresh

Checked at: 2026-11-10T18:44:14.118484+00:00

Result: **attention**.

| Check | Result |
| --- | --- |
| Existing catalog entries | 3099 |
| Local catalog/source/image problems | 0 |
| Required launcher resource problems | 0 |
| Inline JavaScript syntax failures | 0 |
| Fresh remote URL checks | 3552 / 3552 |
| Remote URLs requiring attention | 174 |
| Remote URLs deferred or skipped | 0 |

The existing catalog and local artwork mappings are rebuilt. No new games are imported.
Remote failures are reported for review and do not automatically remove a game or replace its code.

Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.
Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact.

## Remote issues (sample)

- library-source/html5-games/cldoblox.html: http-error (HTTP 403)
- library-source/html5-games/cl10minutestildawn.html: http-error (HTTP 404)
- library-source/emulated/pokemon/clpokemonevolvedsfdgsdfs.html: connection-error
- library-source/emulated/gba/clpuyopuyofever.html: connection-error
- library-source/html5-games/clmelee.html: http-error (HTTP 404)
- library-source/html5-games/clbowmaster.html: http-error (HTTP 403)
- library-source/html5-games/clfindthealien.html: http-error (HTTP 403)
- library-source/html5-games/clharvestio.html: http-error (HTTP 403)
- library-source/html5-games/clyourturntodie.html: http-error (HTTP 403)
- library-source/html5-games/cldubstep.html: http-error (HTTP 404)
- library-source/html5-games/clspiralroll.html: http-error (HTTP 404)
- library-source/html5-games/clspiralroll.html: http-error (HTTP 404)
- library-source/html5-games/clspiralroll.html: http-error (HTTP 404)
- library-source/html5-games/clblockcraftshooter.html: http-error (HTTP 403)
- library-source/html5-games/clblazedrifter.html: http-error (HTTP 403)
- library-source/html5-games/cldeathchase.html: http-error (HTTP 403)
- library-source/html5-games/cldreadheadparkour.html: http-error (HTTP 404)
- library-source/html5-games/clfunnymadracing.html: http-error (HTTP 403)
- library-source/html5-games/clparkingfury.html: http-error (HTTP 403)
- library-source/html5-games/clparkingfury2.html: connection-error
- library-source/html5-games/clparkingfury3.html: http-error (HTTP 403)
- library-source/html5-games/clretropingpong.html: http-error (HTTP 403)
- library-source/html5-games/clretropingpong.html: http-error (HTTP 403)
- library-source/html5-games/clretropingpong.html: http-error (HTTP 403)
- library-source/html5-games/clstickfighter.html: http-error (HTTP 403)
- library-source/html5-games/clmari0.html: connection-error
- library-source/emulated/pokemon/clMoemon Emerald Vanilla+ (v1.1.0).html: http-error (HTTP 403)
- library-source/html5-games/clcandybox1.html: http-error (HTTP 403)
- library-source/html5-games/clkimjonguntilepuzzle.html: http-error (HTTP 404)
- library-source/emulated/gba/cllegostarwarsgba.html: connection-error
