# Daily TurboGames refresh

Checked at: 2026-11-18T19:29:52.258438+00:00

Result: **attention**.

| Check | Result |
| --- | --- |
| Existing catalog entries | 3099 |
| Local catalog/source/image problems | 0 |
| Required launcher resource problems | 0 |
| Inline JavaScript syntax failures | 0 |
| Fresh remote URL checks | 3522 / 3522 |
| Remote URLs requiring attention | 247 |
| Remote URLs deferred or skipped | 0 |

The existing catalog and local artwork mappings are rebuilt. No new games are imported.
Remote failures are reported for review and do not automatically remove a game or replace its code.

Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.
Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact.

## Remote issues (sample)

- library-source/emulated/psx/clgta.html: connection-error
- library-source/emulated/psx/clwipeout2097.html: connection-error
- library-source/emulated/nds/clpokeblack.html: connection-error
- library-source/html5-games/clnetattack.html: connection-error
- library-source/html5-games/clbottlecracks.html: connection-error
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
- library-source/html5-games/clleapandavoid2.html: http-error (HTTP 403)
- library-source/emulated/gba/clmmbn3b.html: http-error (HTTP 403)
- library-source/emulated/gba/clmmbn4rs.html: connection-error
- library-source/emulated/arcade/clsimpsonsarcade.html: http-error (HTTP 403)
- library-source/emulated/gba/clFIFA07.html: connection-error
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
