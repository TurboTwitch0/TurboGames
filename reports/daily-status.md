# Daily TurboGames refresh

Checked at: 2026-11-04T18:43:19.595161+00:00

Result: **attention**.

| Check | Result |
| --- | --- |
| Existing catalog entries | 3099 |
| Local catalog/source/image problems | 0 |
| Required launcher resource problems | 0 |
| Inline JavaScript syntax failures | 0 |
| Fresh remote URL checks | 3552 / 3552 |
| Remote URLs requiring attention | 205 |
| Remote URLs deferred or skipped | 0 |

The existing catalog and local artwork mappings are rebuilt. No new games are imported.
Remote failures are reported for review and do not automatically remove a game or replace its code.

Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.
Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact.

## Remote issues (sample)

- library-source/emulated/psx/clgta.html: connection-error
- library-source/emulated/psx/clwipeout2097.html: connection-error
- library-source/emulated/psx/clfinalfantasyVIId2.html: connection-error
- library-source/emulated/psx/clfinalfantasyVIId3.html: connection-error
- library-source/emulated/psx/clpersona2.html: connection-error
- library-source/emulated/nds/clpokeblack.html: connection-error
- library-source/emulated/segasaturn/clsonicr.html: connection-error
- library-source/emulated/psx/clbushidoblade.html: connection-error
- library-source/html5-games/clnetattack.html: connection-error
- library-source/html5-games/clbottlecracks.html: connection-error
- library-source/emulated/psx/clquake2.html: connection-error
- library-source/html5-games/clUZG.html: connection-error
- library-source/html5-games/clmedalofhonor.html: connection-error
- library-source/emulated/psx/cldiablo.html: connection-error
- library-source/html5-games/clstickdefenders.html: connection-error
- library-source/html5-games/clgolfbattle.html: http-error (HTTP 400)
- library-source/html5-games/claftertheweek.html: http-error (HTTP 404)
- library-source/html5-games/clalienskyinvasion.html: http-error (HTTP 404)
- library-source/html5-games/clalienskyinvasion.html: http-error (HTTP 404)
- library-source/html5-games/clkartbros.html: http-error (HTTP 404)
- library-source/html5-games/clblumgirocket.html: http-error (HTTP 400)
- library-source/html5-games/clfallguys.html: http-error (HTTP 400)
- library-source/html5-games/clgorescriptclassic.html: http-error (HTTP 403)
- library-source/html5-games/clgorescriptclassic.html: http-error (HTTP 403)
- library-source/html5-games/clpleasedonttouchanything.html: http-error (HTTP 403)
- library-source/html5-games/clzombierush.html: http-error (HTTP 403)
- library-source/emulated/nes/clTheLoneRanger.html: http-error (HTTP 403)
- library-source/emulated/gba/clmmbn3b.html: connection-error
- library-source/emulated/gba/clmmbn4bm.html: connection-error
- library-source/emulated/gba/clmmbn4rs.html: http-error (HTTP 403)
