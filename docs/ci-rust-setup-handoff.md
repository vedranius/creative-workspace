# CI-RUST-01 — alpha.54 verified draft

## Alpha.54 result

Checks `38998538182` and Build/release `38998538184` passed on product commit `1921a1ef37f7f6c4d5728d1902a5da15be91915d`. Authenticated CLI identity was `vedranius`. Immutable tag `v0.2.0-alpha.54` points to this commit; GitHub Release is a draft prerelease.

All Linux, Windows and macOS native/bundle jobs passed. The clean exact-pin DesignCraft job built the original UI, passed its upstream action tests, and verified the original worker/browser sequence: Select All, Deselect All, Clear/Undo/Redo, Text Tool `text.delete`, shared recovery entry and the final preset/server-canvas candidate. The recovery smoke generated an actual `.designcraft` server copy through the owned worker, assigned a synthetic unacknowledged journal state, then confirmed the original page could list and download byte-identical output through the existing recovery API. Browser errors and failed responses were zero. [Browser report and screenshot](evidence/designcraft-par03-recovery-entry.md); [release evidence](evidence/creative-workspace-alpha54-release.md).

All three platform bundles and nine original-UI preview archives are Actions-built. The draft contains 12 archives and 12 SHA256 sidecars. All 12 downloaded pairs passed `sha256sum -c`, and the SHA-256 hashes of all 24 downloaded files matched GitHub's asset digests.

## Failures corrected during the candidate

- Alpha.53 run `38988515273` failed in the clean DesignCraft browser test because the owned native adapter's `COMMANDS` allowlist omitted `text.delete`. Its publish was skipped; no alpha.53 tag/release exists. Alpha.54 adds the command to `engines/designcraft/native/src/main.rs`.
- Initial alpha.54 run `38993209224` passed Checks, native builds and bundles, then failed before DesignCraft compilation because the build script referenced a host-only private `low-impact-build.py` path. The script now uses the checksum-pinned Trunk binary on `PATH`, with optional host overrides.
- Alpha.54 run `38994281058` passed WASM compilation and upstream action tests, but the existing Edit > Clear browser smoke timed out at its fixed menu click. Added a screenshot and request/ACK diagnostics. On final run `38998538184`, the original menu action passed; the screenshot confirms Clear was the intended menu item and worker revision advanced. All later DesignCraft browser checks passed.

## Remaining DesignCraft acceptance

Keep DesignCraft planned and the release draft-only. The recovery journal state and provider chooser remain fixtures. Original DesignApp Save a Copy is not yet wired through the owned server session. Real OS folder permission, laptop write acknowledgement and uncertain-output recovery, reopen and complete original-app parity remain open. Next bounded task: wire original Save a Copy through the common provider contract and verify real permission/write ACK/reopen/recovery.

Preserve alpha.51 studio **8795**, owned RapidRAW **8791**, user RapidRAW **8780**, immutable packages/workspaces and `engines/filmcraft/`. Do not restart protected sessions.
