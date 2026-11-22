# Daily TurboGames refresh

Checked at: 2026-11-22T18:37:22.000366+00:00

Result: **attention**.

| Check | Result |
| --- | --- |
| Existing catalog entries | 3099 |
| Local catalog/source/image problems | 0 |
| Required launcher resource problems | 0 |
| Inline JavaScript syntax failures | 0 |
| Fresh remote URL checks | 3522 / 3522 |
| Remote URLs requiring attention | 173 |
| Remote URLs deferred or skipped | 0 |

The existing catalog and local artwork mappings are rebuilt. No new games are imported.
Remote failures are reported for review and do not automatically remove a game or replace its code.

Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.
Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact.

## Remote issues (sample)

- library-source/emulated/atarilynx/clscrapyarddog.html: http-error (HTTP 403)
- library-source/html5-games/clbadmondaysimulator (1).html: http-error (HTTP 403)
- library-source/html5-games/clklifur.html: http-error (HTTP 403)
- library-source/html5-games/cljustaplatformer.html: http-error (HTTP 403)
- library-source/html5-games/cljustaplatformer.html: http-error (HTTP 403)
- library-source/emulated/clXMenCOTAArcade.html: connection-error
- library-source/emulated/pokemon/clpokeemerald47.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokescrambledscarlet.html: http-error (HTTP 403)
- library-source/emulated/segaMD/clmonsterworld4.html: http-error (HTTP 403)
- library-source/emulated/segaMD/clsonicscorchedquest.html: http-error (HTTP 403)
- library-source/emulated/segaGG/clsonicchaos.html: http-error (HTTP 403)
- library-source/emulated/arcade/clfroggerarcade.html: http-error (HTTP 403)
- library-source/emulated/arcade/clMarvelSuperHeroesArcade.html: connection-error
- library-source/emulated/arcade/clXMenVSStreetFighter.html: connection-error
- library-source/emulated/nds/cladvancewarsdualstrike (1).html: connection-error
- library-source/emulated/nes/cl1942nes.html: http-error (HTTP 403)
- library-source/emulated/nes/cldarkwingduck.html: http-error (HTTP 403)
- library-source/emulated/nes/clroadrunnernes.html: http-error (HTTP 403)
- library-source/emulated/snes/cltmntturtlesintime.html: http-error (HTTP 403)
- library-source/emulated/segaGG/claxbattler.html: http-error (HTTP 403)
- library-source/emulated/segaMD/cldrrobotnikmbm.html: http-error (HTTP 403)
- library-source/emulated/segaMS/clphantasystar.html: http-error (HTTP 403)
- library-source/emulated/segaMD/clphantasystar3.html: http-error (HTTP 403)
- library-source/emulated/segaGG/clggshinobi2.html: http-error (HTTP 403)
- library-source/emulated/arcade/claof2.html: http-error (HTTP 403)
- library-source/emulated/arcade/clarmwrestarc.html: http-error (HTTP 403)
- library-source/emulated/arcade/clfatalfury.html: http-error (HTTP 403)
- library-source/emulated/arcade/cltmnt2arc.html: http-error (HTTP 403)
- library-source/html5-games/clgrowdenio.html: http-error (HTTP 403)
- library-source/html5-games/clcuttherope.html: http-error (HTTP 404)
