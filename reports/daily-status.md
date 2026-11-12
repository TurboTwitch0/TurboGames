# Daily TurboGames refresh

Checked at: 2026-11-12T19:01:32.591173+00:00

Result: **attention**.

| Check | Result |
| --- | --- |
| Existing catalog entries | 3099 |
| Local catalog/source/image problems | 0 |
| Required launcher resource problems | 0 |
| Inline JavaScript syntax failures | 0 |
| Fresh remote URL checks | 3522 / 3522 |
| Remote URLs requiring attention | 156 |
| Remote URLs deferred or skipped | 0 |

The existing catalog and local artwork mappings are rebuilt. No new games are imported.
Remote failures are reported for review and do not automatically remove a game or replace its code.

Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.
Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact.

## Remote issues (sample)

- library-source/html5-games/clbaconmaydie.html: http-error (HTTP 404)
- library-source/html5-games/clcreaturecardidle.html: http-error (HTTP 404)
- library-source/html5-games/clcreaturecardidle.html: http-error (HTTP 404)
- library-source/html5-games/clcreaturecardidle.html: http-error (HTTP 404)
- library-source/html5-games/clfunnyshooter2.html: http-error (HTTP 404)
- library-source/html5-games/cltommorowandyesterday.html: http-error (HTTP 403)
- library-source/html5-games/clUltimatecardrivingsimulator.html: http-error (HTTP 403)
- library-source/emulated/gba/clsonicadvance2sp.html: connection-error
- library-source/emulated/n64/clmaddennfl2001.html: connection-error
- library-source/emulated/n64/clmadden99.html: connection-error
- library-source/emulated/n64/cltripleplay2000.html: connection-error
- library-source/emulated/pokemon/clpokemonclover.html: connection-error
- library-source/emulated/nds/clmariokartds.html: connection-error
- library-source/emulated/pokemon/cllastfirered.html: connection-error
- library-source/emulated/n64/clglover.html: connection-error
- library-source/emulated/n64/clNBAhangtime.html: connection-error
- library-source/emulated/nds/clbackyardbaseball10.html: connection-error
- library-source/emulated/n64/clnflblitz.html: connection-error
- library-source/emulated/pokemon/clpokemonquetzal.html: connection-error
- library-source/emulated/nds/clsuperscribblenauts.html: connection-error
- library-source/emulated/nes/clmariolostlevels.html: http-error (HTTP 403)
- library-source/emulated/nds/cldrawntolife.html: connection-error
- library-source/emulated/pokemon/clpokeelysiuma.html: connection-error
- library-source/emulated/gba/clchainofmemories.html: connection-error
- library-source/emulated/n64/clnbalive2000.html: connection-error
- library-source/emulated/pokemon/clpokedreamstone.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokefuseddimension.html: connection-error
- library-source/emulated/pokemon/clpokeemeraldz.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokeemeraldenhanced.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokegschronicles.html: connection-error
