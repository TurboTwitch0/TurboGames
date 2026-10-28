# Daily TurboGames refresh

Checked at: 2026-10-28T17:13:43.129295+00:00

Result: **attention**.

| Check | Result |
| --- | --- |
| Existing catalog entries | 3099 |
| Local catalog/source/image problems | 0 |
| Required launcher resource problems | 0 |
| Inline JavaScript syntax failures | 0 |
| Fresh remote URL checks | 3550 / 3550 |
| Remote URLs requiring attention | 162 |
| Remote URLs deferred or skipped | 0 |

The existing catalog and local artwork mappings are rebuilt. No new games are imported.
Remote failures are reported for review and do not automatically remove a game or replace its code.

Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.
Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact.

## Remote issues (sample)

- library-source/emulated/psx/clpersona2.html: connection-error
- library-source/emulated/nds/clpokeblack.html: connection-error
- library-source/emulated/segasaturn/clsonicr.html: connection-error
- library-source/emulated/psx/clbushidoblade.html: connection-error
- library-source/html5-games/clnetattack.html: connection-error
- library-source/html5-games/clbottlecracks.html: connection-error
- library-source/emulated/psx/clquake2.html: connection-error
- library-source/html5-games/clUZG.html: connection-error
- library-source/html5-games/clmedalofhonor.html: connection-error
- library-source/html5-games/clstickdefenders.html: connection-error
- library-source/html5-games/clgolfbattle.html: http-error (HTTP 400)
- library-source/html5-games/claftertheweek.html: http-error (HTTP 404)
- library-source/html5-games/clalienskyinvasion.html: http-error (HTTP 404)
- library-source/html5-games/clalienskyinvasion.html: http-error (HTTP 404)
- library-source/html5-games/clblumgirocket.html: http-error (HTTP 400)
- library-source/html5-games/clfallguys.html: http-error (HTTP 400)
- library-source/html5-games/clgorescriptclassic.html: http-error (HTTP 403)
- library-source/html5-games/clgorescriptclassic.html: http-error (HTTP 403)
- library-source/emulated/gba/clmmbn3w.html: connection-error
- library-source/html5-games/clgetontop.html: http-error (HTTP 404)
- library-source/emulated/nes/clpopeyepapi.html: http-error (HTTP 404)
- library-source/html5-games/clblackjackhhhh.html: http-error (HTTP 404)
- library-source/html5-games/clblackjackhhhh.html: http-error (HTTP 404)
- library-source/html5-games/clblackjackhhhh.html: http-error (HTTP 404)
- library-source/html5-games/clblackjackhhhh.html: http-error (HTTP 404)
- library-source/html5-games/clblackjackhhhh.html: http-error (HTTP 404)
- library-source/html5-games/clidledice.html: http-error (HTTP 404)
- library-source/html5-games/cllittlealchemy2.html: http-error (HTTP 404)
- library-source/html5-games/cllittlealchemy2.html: http-error (HTTP 404)
- library-source/html5-games/cllittlealchemy2.html: http-error (HTTP 404)
