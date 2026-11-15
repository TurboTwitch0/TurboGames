# Daily TurboGames refresh

Checked at: 2026-11-15T17:51:46.019435+00:00

Result: **attention**.

| Check | Result |
| --- | --- |
| Existing catalog entries | 3099 |
| Local catalog/source/image problems | 0 |
| Required launcher resource problems | 0 |
| Inline JavaScript syntax failures | 0 |
| Fresh remote URL checks | 3522 / 3522 |
| Remote URLs requiring attention | 129 |
| Remote URLs deferred or skipped | 0 |

The existing catalog and local artwork mappings are rebuilt. No new games are imported.
Remote failures are reported for review and do not automatically remove a game or replace its code.

Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.
Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact.

## Remote issues (sample)

- library-source/emulated/n64/clsouthparkn64.html: connection-error
- library-source/emulated/pokemon/clpokefireemerald.html: connection-error
- library-source/emulated/pokemon/clpokerbynova.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokeretroplatinum.html: http-error (HTTP 403)
- library-source/emulated/arcade/clmspacmangalaga.html: http-error (HTTP 403)
- library-source/emulated/arcade/clSSF2Arcade.html: http-error (HTTP 403)
- library-source/emulated/arcade/clsuperstreetfighter2turbojp.html: http-error (HTTP 403)
- library-source/emulated/arcade/clXMenVSStreetFighter.html: connection-error
- library-source/emulated/n64/clnflblitzspecial.html: connection-error
- library-source/emulated/n64/clpapermarioblackpit.html: connection-error
- library-source/emulated/arcade/clnbajamte.html: http-error (HTTP 403)
- library-source/html5-games/clcuttherope.html: http-error (HTTP 404)
- library-source/flash/cltrollfacequest10.html: http-error (HTTP 403)
- library-source/flash/cltrollfacequest6.html: connection-error
- library-source/flash/cltrollfacequest7.html: http-error (HTTP 403)
- library-source/html5-games/clwaterworks.html: http-error (HTTP 403)
- library-source/html5-games/clbaconmaydie.html: http-error (HTTP 404)
- library-source/html5-games/clcreaturecardidle.html: http-error (HTTP 404)
- library-source/html5-games/clcreaturecardidle.html: http-error (HTTP 404)
- library-source/html5-games/clcreaturecardidle.html: http-error (HTTP 404)
- library-source/html5-games/clfunnyshooter2.html: http-error (HTTP 404)
- library-source/html5-games/clUltimatecardrivingsimulator.html: http-error (HTTP 404)
- library-source/emulated/n64/clnbalive2000.html: connection-error
- library-source/html5-games/clfnfanimation.html: http-error (HTTP 404)
- library-source/html5-games/cl10minutestildawn.html: http-error (HTTP 404)
- library-source/html5-games/clmelee.html: http-error (HTTP 404)
- library-source/html5-games/cldubstep.html: http-error (HTTP 404)
- library-source/html5-games/clspiralroll.html: http-error (HTTP 404)
- library-source/html5-games/clspiralroll.html: http-error (HTTP 404)
- library-source/html5-games/clspiralroll.html: http-error (HTTP 404)
