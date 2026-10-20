# Unity startup and fullscreen repair

- Reproduced the exact Yandere Simulator Unity alert from the user: `Script error.` followed by a DataView bounds error. The upstream customized loader appended `Build/` to the merged `blob:null/...` data URL, fetching a 404 page instead of game data.
- Yandere now preserves blob/data URLs in its Module URL resolver and resolves other build resources against the actual Build directory. It passes the JSON manifest blob URL as UnityLoader's second argument and reports failed part downloads instead of merging error responses.
- Fullscreen now targets an ordinary inner player div, because the Fullscreen API rejects dialog elements. The title bar and controls remain in fullscreen; closing the dialog exits it.
- Browser before/after check: old game failed; repaired game initialized and displayed its 3D scene with zero JS errors and zero HTTP failures. Actual fullscreen entry and exit passed. This is a startup check, not a full playthrough.
- Browser checks used the real remote Unity assets, downloaded through a TLS-verifying client and served temporarily on localhost to avoid the managed browser's proxy CA limitation. No TLS verification was disabled. Remote assets were not added to the repository.
- Reproduce with `python3 tools/unity-fixture-server.py --download`, then `node tools/check-unity-fullscreen.cjs`. Before-fixture code comes from commit d196755. See unity-fullscreen-check.json for observations.
