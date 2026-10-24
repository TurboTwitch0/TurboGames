# Daily TurboGames refresh

Checked at: 2026-10-24T20:59:31.817944+00:00

Result: **attention**.

| Check | Result |
| --- | --- |
| Existing catalog entries | 3099 |
| Local catalog/source/image problems | 0 |
| Required launcher resource problems | 0 |
| Inline JavaScript syntax failures | 0 |
| Fresh remote URL checks | 3550 / 3550 |
| Remote URLs requiring attention | 117 |
| Remote URLs deferred or skipped | 0 |

The existing catalog and local artwork mappings are rebuilt. No new games are imported.
Remote failures are reported for review and do not automatically remove a game or replace its code.

Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.
Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact.

## Remote issues (sample)

- library-source/html5-games/clantipathy.html: http-error (HTTP 404)
- library-source/html5-games/clorigamiking.html: http-error (HTTP 404)
- library-source/html5-games/clfearassessment.html: http-error (HTTP 404)
- library-source/html5-games/clcarcrash3.html: http-error (HTTP 404)
- library-source/html5-games/cljourneydownhill.html: http-error (HTTP 403)
- library-source/html5-games/cljourneydownhill.html: http-error (HTTP 403)
- library-source/html5-games/clmakesureitsclosed.html: http-error (HTTP 404)
- library-source/html5-games/clretrobowl.html: http-error (HTTP 404)
- library-source/html5-games/clretrobowl.html: http-error (HTTP 404)
- library-source/html5-games/clapesvshelium.html: http-error (HTTP 404)
- library-source/html5-games/clbaldisbasics.html: http-error (HTTP 404)
- library-source/html5-games/cljailbreakobbbobob.html: http-error (HTTP 400)
- library-source/html5-games/clgrindcraft.html: http-error (HTTP 404)
- library-source/flash/clthisistheonlylevel.html: http-error (HTTP 404)
- library-source/html5-games/clmariovsluigi.html: http-error (HTTP 404)
- library-source/html5-games/clgdbreeze.html: http-error (HTTP 404)
- library-source/html5-games/clblockblast.html: http-error (HTTP 404)
- library-source/html5-games/clomegalayers.html: http-error (HTTP 403)
- library-source/html5-games/clAdventureCapatalist.html: http-error (HTTP 404)
- library-source/html5-games/clclashofvikings.html: http-error (HTTP 403)
- library-source/flash/clrocketjump.html: http-error (HTTP 404)
- library-source/html5-games/clancientsins.html: http-error (HTTP 400)
- library-source/html5-games/clsupersantakicker.html: http-error (HTTP 404)
- library-source/html5-games/clkanyezone.html: connection-error
- library-source/emulated/psx/clgta.html: connection-error
- library-source/emulated/psx/clwipeout2097.html: connection-error
- library-source/emulated/psx/clfinalfantasyVII.html: connection-error
- library-source/emulated/psx/clfinalfantasyVIId2.html: connection-error
- library-source/emulated/psx/clpersona2.html: connection-error
- library-source/emulated/nds/clpokeblack.html: connection-error
