# Daily TurboGames refresh

Checked at: 2026-11-07T16:56:39.196355+00:00

Result: **attention**.

| Check | Result |
| --- | --- |
| Existing catalog entries | 3099 |
| Local catalog/source/image problems | 0 |
| Required launcher resource problems | 0 |
| Inline JavaScript syntax failures | 0 |
| Fresh remote URL checks | 3552 / 3552 |
| Remote URLs requiring attention | 189 |
| Remote URLs deferred or skipped | 0 |

The existing catalog and local artwork mappings are rebuilt. No new games are imported.
Remote failures are reported for review and do not automatically remove a game or replace its code.

Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.
Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact.

## Remote issues (sample)

- library-source/html5-games/clrh.html: http-error (HTTP 403)
- library-source/html5-games/clrh.html: http-error (HTTP 403)
- library-source/html5-games/clrh.html: connection-error
- library-source/html5-games/thiefpuzzle.html: http-error (HTTP 403)
- library-source/html5-games/clgta3.html: http-error (HTTP 403)
- library-source/html5-games/clDigOutofPrison.html: http-error (HTTP 404)
- library-source/html5-games/clmonkeymart.html: http-error (HTTP 404)
- library-source/html5-games/clmonkeymart.html: http-error (HTTP 404)
- library-source/html5-games/clmonkeymart.html: http-error (HTTP 404)
- library-source/html5-games/clsnipershot.html: http-error (HTTP 404)
- library-source/html5-games/clobbycart.html: http-error (HTTP 403)
- library-source/html5-games/clBFDIBranches.html: http-error (HTTP 404)
- library-source/html5-games/clBFDIBranches.html: http-error (HTTP 404)
- library-source/html5-games/clprismarine.html: http-error (HTTP 404)
- library-source/html5-games/clprismarine.html: http-error (HTTP 404)
- library-source/html5-games/clprismarine.html: http-error (HTTP 404)
- library-source/html5-games/clprismarine.html: http-error (HTTP 404)
- library-source/html5-games/clredvsbluewar.html: http-error (HTTP 404)
- library-source/html5-games/FunkinForHire.html: http-error (HTTP 403)
- library-source/html5-games/clfnfdocumic.txtv3.html: http-error (HTTP 404)
- library-source/html5-games/ConfrontingYourself.html: http-error (HTTP 404)
- library-source/html5-games/clmattv3.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokemonsaiph2.html: connection-error
- library-source/emulated/gba/clmegamanbattlechipchallenge.html: http-error (HTTP 404)
- library-source/emulated/gba/clmegamanbn5tc.html: http-error (HTTP 404)
- library-source/emulated/gba/clmegamanbn5tp.html: http-error (HTTP 404)
- library-source/emulated/gba/clmegamanbn6cf.html: http-error (HTTP 404)
- library-source/emulated/gba/clmegamanbn6cg.html: http-error (HTTP 404)
- library-source/emulated/segaMD/clOutrunGenesis.html: http-error (HTTP 404)
- library-source/emulated/segaMD/clSonic1TheSuperChallenges.html: http-error (HTTP 404)
