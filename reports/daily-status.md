# Daily TurboGames refresh

Checked at: 2026-11-14T17:16:26.019419+00:00

Result: **attention**.

| Check | Result |
| --- | --- |
| Existing catalog entries | 3099 |
| Local catalog/source/image problems | 0 |
| Required launcher resource problems | 0 |
| Inline JavaScript syntax failures | 0 |
| Fresh remote URL checks | 3522 / 3522 |
| Remote URLs requiring attention | 335 |
| Remote URLs deferred or skipped | 0 |

The existing catalog and local artwork mappings are rebuilt. No new games are imported.
Remote failures are reported for review and do not automatically remove a game or replace its code.

Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.
Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact.

## Remote issues (sample)

- library-source/html5-games/ImpostorTaintedFate.html: http-error (HTTP 403)
- library-source/html5-games/UnknownSufferingReanimated.html: connection-error
- library-source/html5-games/VlooGuy.html: http-error (HTTP 403)
- library-source/html5-games/Vs. Among Us Skeld Symphony.html: connection-error
- library-source/html5-games/clfnfbsidesredux.html: http-error (HTTP 403)
- library-source/html5-games/clfnfdocumic.txtv3.html: http-error (HTTP 404)
- library-source/html5-games/ConfrontingYourself.html: http-error (HTTP 404)
- library-source/html5-games/clfnfskyreborn.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokemonsaiph.html: connection-error
- library-source/emulated/gba/clmegamanbattlechipchallenge.html: http-error (HTTP 404)
- library-source/emulated/gba/clmegamanbn5tc.html: http-error (HTTP 404)
- library-source/emulated/gba/clmegamanbn5tp.html: http-error (HTTP 404)
- library-source/emulated/gba/clmegamanbn6cf.html: http-error (HTTP 404)
- library-source/emulated/gba/clmegamanbn6cg.html: http-error (HTTP 404)
- library-source/emulated/segaMD/clOutrunGenesis.html: http-error (HTTP 404)
- library-source/emulated/segaMD/clSonic1TheSuperChallenges.html: http-error (HTTP 404)
- library-source/emulated/segaMD/clSnowBrosGenesis.html: http-error (HTTP 404)
- library-source/emulated/segaMD/clSonicClassics.html: http-error (HTTP 404)
- library-source/emulated/n64/clsm64oot.html: http-error (HTTP 404)
- library-source/emulated/nds/clmmsfd.html: http-error (HTTP 404)
- library-source/emulated/nds/clmmsfl.html: http-error (HTTP 404)
- library-source/emulated/nds/clmmsfp.html: http-error (HTTP 404)
- library-source/emulated/nds/clmmsf2zxn.html: http-error (HTTP 404)
- library-source/emulated/nds/clmmsf2zxs.html: http-error (HTTP 404)
- library-source/emulated/nds/clmmsf3ba.html: http-error (HTTP 404)
- library-source/emulated/nds/clmmsf3rj.html: http-error (HTTP 404)
- library-source/emulated/nes/cltheimmortalnes.html: http-error (HTTP 404)
- library-source/emulated/snes/cljunglebooksnes.html: http-error (HTTP 404)
- library-source/emulated/snes/clmauimallard.html: http-error (HTTP 404)
- library-source/flash/cltanktrouble.html: http-error (HTTP 404)
