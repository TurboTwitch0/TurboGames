# Daily TurboGames refresh

Checked at: 2026-10-25T15:00:40.509264+00:00

Result: **attention**.

| Check | Result |
| --- | --- |
| Existing catalog entries | 3099 |
| Local catalog/source/image problems | 0 |
| Required launcher resource problems | 0 |
| Inline JavaScript syntax failures | 0 |
| Fresh remote URL checks | 3550 / 3550 |
| Remote URLs requiring attention | 190 |
| Remote URLs deferred or skipped | 0 |

The existing catalog and local artwork mappings are rebuilt. No new games are imported.
Remote failures are reported for review and do not automatically remove a game or replace its code.

Local structure, JavaScript parsing and HTTP availability are source health checks, not complete gameplay tests.
Full reports are attached to the GitHub Actions run as the daily-refresh-reports artifact.

## Remote issues (sample)

- library-source/emulated/bootleg/claction52nes.html: http-error (HTTP 403)
- library-source/emulated/gba/clFleurdeLis.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokecrystaladvanceredux.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokeemeraldextendedcut.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clheartandsoul1.2.1.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokemoonemerald.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokecrystalclear.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokepureblue.html: http-error (HTTP 403)
- library-source/emulated/pokemon/clpokewildindigo.html: connection-error
- library-source/emulated/gba/clkirbysdreamland2.html: http-error (HTTP 403)
- library-source/emulated/arcade/clStreetFighter2Arcade.html: http-error (HTTP 403)
- library-source/emulated/arcade/clSegaSonicTheHedgehog.html: http-error (HTTP 403)
- library-source/emulated/arcade/clXMenVSStreetFighter.html: http-error (HTTP 403)
- library-source/emulated/nes/cl100in1nes.html: http-error (HTTP 403)
- library-source/emulated/nes/clfamidashAlbum1.2.8.html: http-error (HTTP 403)
- library-source/emulated/nes/cliceclimber.html: http-error (HTTP 403)
- library-source/emulated/snes/cl100RoomsOfEnemies.html: http-error (HTTP 403)
- library-source/emulated/segaMS/clhangonsms.html: http-error (HTTP 403)
- library-source/emulated/segaMD/clshinobirevenge.html: http-error (HTTP 403)
- library-source/emulated/arcade/cldonkeykong.html: http-error (HTTP 403)
- library-source/emulated/arcade/clmariobrosarc.html: http-error (HTTP 403)
- library-source/emulated/arcade/clxmenarc.html: http-error (HTTP 403)
- library-source/html5-games/clcuttherope.html: http-error (HTTP 404)
- library-source/html5-games/clbloodmoney.html: http-error (HTTP 403)
- library-source/html5-games/clbaconmaydie.html: http-error (HTTP 404)
- library-source/html5-games/cldemonbluff.html: http-error (HTTP 403)
- library-source/html5-games/claviamastersbuggy.html: http-error (HTTP 403)
- library-source/html5-games/clbearsus.html: http-error (HTTP 403)
- library-source/html5-games/clcookieclickermodmenu.html: http-error (HTTP 404)
- library-source/html5-games/clcookieclicker.html: http-error (HTTP 403)
