# Library repair report

Updated **463 distinct imported launcher files** through these repair manifests.

Static structural scan plus upstream source response/signature checks and non-executing JavaScript syntax checks; browser smoke tests are reported separately by the main task.

| Manifest | Repaired entries |
| --- | ---: |
| `flash-repairs.json` | 403 |
| `html-launcher-repairs.json` | 18 |
| `cdn-repairs.json` | 8 |
| `placeholder-repairs.json` | 7 |
| `drive-warning-repairs.json` | 2 |
| `turbowarp-split-repairs.json` | 3 |
| `launcher-audit-syntax-repairs.json` | 44 |
| `remote-dependency-repairs.json` | 3 |

## Checks

All 3,114 imported HTML launcher files received a static structural scan. The catalog JavaScript syntax check has **0 failures**.

All three recovered TurboWarp project ZIP archives passed full CRC validation before their data was split for hosting.

## Recovered creator source

Windows Doors was recovered from its [original creator](https://benrbray.com/game/windows-doors.html). The local SWF was fully decompressed and validated. The creator notes minor Ruffle window dragging and scrollbar limitations.

## Limits

- Reachable source files and valid JS syntax do not establish complete startup or gameplay compatibility.
- External game assets still depend on original hosts. Remote audit includes optional publishers, source templates, and multipart URL prefixes; those failures do not each indicate a broken game.
- Large recovered TurboWarp projects are split into <=20MiB local files. Their project ZIP archives were fully CRC-checked, but still need substantial browser memory.
