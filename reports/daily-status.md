# Daily TurboGames refresh

Checked at: 2026-11-06T18:09:59.638326+00:00

Result: **attention**.

| Check | Result |
| --- | --- |
| Existing catalog entries | 3099 |
| Local catalog/source/image problems | 0 |
| Required launcher resource problems | 0 |
| Inline JavaScript syntax failures | 0 |
| Fresh remote URL checks | 3552 / 3552 |
| Remote URLs requiring attention | 127 |
| Remote URLs deferred or skipped | 0 |

The existing catalog and local artwork mappings are rebuilt. No new games are imported.
Remote failures are reported for review and do not automatically remove a game or replace its code.

Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.
Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact.

## Remote issues (sample)

- library-source/html5-games/cltagcm.html: http-error (HTTP 403)
- library-source/html5-games/clUltimatecardrivingsimulator.html: http-error (HTTP 404)
- library-source/emulated/nds/clmariokartds.html: connection-error
- library-source/emulated/nds/clsuperscribblenauts.html: connection-error
- library-source/emulated/nes/clmariolostlevels.html: http-error (HTTP 403)
- library-source/emulated/nds/cldrawntolife.html: connection-error
- library-source/emulated/pokemon/clpokeelysiuma.html: connection-error
- library-source/emulated/pokemon/clpokeelysiumb.html: http-error (HTTP 403)
- library-source/emulated/gba/clchainofmemories.html: http-error (HTTP 403)
- library-source/emulated/gba/clpacmanworldg.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokecrown.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokeemeraldz.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokegschronicles.html: http-error (HTTP 403)
- library-source/emulated/n64/clnatsuki64.html: http-error (HTTP 403)
- library-source/emulated/dos/clquake.html: http-error (HTTP 403)
- library-source/html5-games/clfnfdusttale.html: http-error (HTTP 403)
- library-source/html5-games/clfnfanimation.html: http-error (HTTP 404)
- library-source/emulated/pokemon/clpolishedcrystal.html: http-error (HTTP 403)
- library-source/html5-games/cl10minutestildawn.html: http-error (HTTP 404)
- library-source/html5-games/clmelee.html: http-error (HTTP 404)
- library-source/html5-games/cldubstep.html: http-error (HTTP 404)
- library-source/html5-games/clspiralroll.html: http-error (HTTP 404)
- library-source/html5-games/clspiralroll.html: http-error (HTTP 404)
- library-source/html5-games/clspiralroll.html: http-error (HTTP 404)
- library-source/html5-games/clblockcraftshooter.html: http-error (HTTP 403)
- library-source/html5-games/cldreadheadparkour.html: http-error (HTTP 404)
- library-source/html5-games/clkimjonguntilepuzzle.html: http-error (HTTP 404)
- library-source/html5-games/cljustaplatformerE.html: http-error (HTTP 403)
- library-source/html5-games/clslopeplus.html: http-error (HTTP 403)
- library-source/html5-games/clslopeplus.html: http-error (HTTP 403)
