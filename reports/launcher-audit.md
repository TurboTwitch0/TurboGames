# Launcher static audit

Static HTML scan of every imported launcher; remote runtime dependencies and game play not verified.

Imported launcher files: **3,114**.

| Result | Files |
| --- | ---: |
| source-template | 19 |
| structural-pass | 3,061 |
| missing-optional-local-resource | 30 |
| redirect | 4 |

A structural pass means the file is nonempty, does not contain recognized source error pages, and has no missing literal local resources. It does not confirm network availability, emulator compatibility, startup, or playability.

Full resource paths and external dependencies are in `launcher-audit.json`.
