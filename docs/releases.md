# Releases and installation

Alpha.32 is the current draft candidate. It registers the exact pinned Type Tool caret/typing UI patch in the source guard and adds its sequential ACK/browser proof to Actions. Real laptop folder permission/write ACK, uncertain-output recovery, and remaining original action parity are pending; keep DesignCraft planned. Alpha.31 provider evidence and mocked-permission limits are recorded in [the provider handoff](evidence/designcraft-par03-provider-browser.md). Verify alpha.32 Actions and its immutable draft assets before making a release claim.

Creative Workspace aims to let a lightweight laptop access a powerful self-hosted creative server through native browser interfaces. Original documents remain under explicitly selected file-provider permissions; rendering/editing runs on the server. No remote desktop transport is used. The latest published public release is 0.2.0-alpha.7. Alpha.26–alpha.32 contain bounded DesignCraft candidates and corrections; none is a completed original-app port. Keep all drafts until full original-app/server/provider parity is accepted. See the current [PAR-03 handoff](par-03a-handoff.md), [alpha.29 evidence](evidence/designcraft-par03-redo.md), [alpha.28](evidence/creative-workspace-alpha28-release.md), [alpha.27](evidence/creative-workspace-alpha27-release.md), and [alpha.26](evidence/creative-workspace-alpha26-release.md).

The current channel is **alpha**, for one user. Version 0.2.0-alpha.7 is published; Actions built the Linux x64, Windows x64 and Apple Silicon macOS bundles and passed all native bundle smokes. Each archive and its SHA256 sidecar is downloadable from [Releases](https://github.com/vedranius/creative-workspace/releases/tag/v0.2.0-alpha.7). Alpha.17 adds the DesignCraft preset-only `file.new` server action seam; its native and Chromium smoke evidence is in [the PAR-03 reports](evidence/designcraft-par03-file-new-native.json) and [release verification](evidence/creative-workspace-alpha17-release.md). The five alpha.17 archives and checksums are verified; keep the draft because the original UI/session and provider/save parity remain incomplete. Alpha.4 was not published because its macOS PhotoCraft smoke exposed a visual-change assertion race. Source archives automatically shown by GitHub are source code, not install bundles.

| Bundle | Requirements | Included native prototype engines |
| --- | --- | --- |
| linux-x64 `.tar.gz` | Linux x64, glibc 2.35+ | PhotoCraft, PdfCraft, VectorCraft, DesignCraft |
| win32-x64 `.zip` | Windows x64; Microsoft Visual C++ 2015–2022 x64 runtime | Same four editors |
| darwin-arm64 `.tar.gz` | Apple Silicon, macOS 14+ | Same four editors |

Support means the target Actions native smoke passed; broader format compatibility and manual browser picker acceptance remain unverified. Windows and macOS archives are unsigned. Intel Mac and Linux/Windows ARM builds are not yet offered. RapidRAW's own Linux build uses its separate CLI installer; it is not included or automatically attached by the portable launcher. Original UI previews for LightCraft and EffectCraft remain separately registered; FilmCraft and DesignCraft have separate Actions preview jobs. Their owned server/provider integrations remain incomplete; none of these are included in the native prototype bundles. This is not the complete planned suite.

Alpha.9 was not released: WASM compilation succeeded, but shallow Git diff ID formatting failed exact patch registration. Alpha.10 keeps exact validation using deterministic full IDs. The local alpha.9 test instance retains the same import behavior.

## Original UI previews

### Alpha.16 DesignCraft response/read-model refresh

The `par-03-server-read-model-v3` preview applies each `frame.create` server response as one revisioned model/render update, including title, pages, dirty state and the preview image. The exact pinned UI was rebuilt and registered locally, and native/Chromium evidence verifies two ordered edits reach revision 3 with changed PNG bytes and 404/403/409 guards. This remains an overlay bridge: the original local `DesignApp` still says “No document open.” Provider, acknowledged save, reopen, recovery, and original action dispatch are incomplete. Alpha.16 Actions checks, immutable tag, draft release, ten assets and checksums are verified; keep `draftOnly`. See [handoff](par-03a-handoff.md) and [release evidence](evidence/creative-workspace-alpha16-release.md).

Build the original pinned upstream browser app, then use `npm run ui:install -- <app> <clean-source-checkout> <static-output>` (or the bundled Node with `scripts/install-original-ui.mjs`). Set `CW_ORIGINAL_UI_DIR` to the registration root when starting the studio; the default is `DATA_DIR/original-ui`. The dashboard offers only packages that pass identity, hash and confinement checks. See [instructions and evidence](studio-original-uis.md). Registration does not clone/build/execute arbitrary repositories. It requires a known original pin and preserves its licensing.

### DesignCraft PAR-03 sample bridge (alpha.13 historical)

The earlier sample bridge used original DesignCraft pin `a127c6d5c3576972bbd60445f26d893db071eef3` plus `par-03-server-read-model-v2`. It ran only the allowlisted `file.newSample` operation and reflected a few revisioned read-model fields. Alpha.16 supersedes that preview with `par-03-server-read-model-v3`; the original local `DesignApp` Session, other handlers, provider, save ACK, recovery and full parity remain incomplete. Keep DesignCraft planned and the release draft. See [bridge scope and evidence](designcraft-par03-sample-bridge.md).

### Alpha.15 DesignCraft edit bridge candidate

Alpha.15 uses the same pinned DesignCraft UI, with patch variant `par-03-server-edit-v1`. In `/original/designcraft/?serverEdit`, `file.new` creates a server-owned session and pointer gestures invoke allowlisted `frame.create` in browser order. Build/release run `38188391442` and Checks `38188391413` passed, as did follow-up Checks `38188396149`. Immutable tag `v0.2.0-alpha.15` points to `42cb3b0`; draft prerelease `410031237` has five Actions-built archives plus five checksum sidecars, all downloaded and verified. [Release evidence](evidence/creative-workspace-alpha15-release.md). The original local `DesignApp` still reports no document open, so this is not a complete server-backed editor; keep `draftOnly`.

The original previews process locally in WASM; File Open/save/export use upstream browser host behavior. Shared server/laptop on-demand/hybrid/copy-first modes, destination-write acknowledgement and recovery are not integrated into these original UIs. A browser download or a preview's clean indicator is not evidence that the selected disk destination acknowledged a write. Keep original application availability pending until those paths pass acceptance.

`release/config.json` keeps alpha.18 `draftOnly`; Actions run `38240276900` built and checked each native target, separate FilmCraft/DesignCraft preview archives, browser/native evidence and checksums. All five archives and sidecars are verified in [the alpha.18 release report](evidence/creative-workspace-alpha18-release.md). Alpha.18 adds bounded canonical DesignCraft document-snapshot transport; it does not synchronize the original UI or complete provider/save parity. Do not turn it into a public complete-suite claim while original UI packaging/parity evidence is missing.

The current project version is `0.2.0-alpha.30` (DesignCraft copy-first filename preservation). Session-scoped imports retain the selected browser filename in the acknowledged server read model while bytes remain stored under an exclusive UUID-prefixed path. Gateway regression and repo verification are pending; Actions run `38373397503` confirmed original A4/edit/Undo/Redo/Undo through revision 5, then failed when Open reported the internal storage prefix as the document name. No tag or assets exist for alpha.30 yet. Keep the release draft and DesignCraft planned pending browser proof, provider ACK, save/reopen recovery and full original-app parity.

## FilmCraft original UI preview archive

Alpha.9's separate `filmcraft-original-ui.tar.gz` and SHA256 sidecar contain the original FilmCraft shared UI/engine at its existing source pin plus the exact reviewed MKV import patch, source/license provenance and registration manifest. Actions builds WASM on Linux and tests the original UI in Chromium. This is a browser preview archive, not a native engine or complete OS creative bundle; other browsers/OS combinations and server/provider/save acknowledgement are not accepted yet.

Extract it into a **new** original-UI root and start Creative Workspace with `CW_ORIGINAL_UI_DIR` pointing there. The FilmCraft variant has a distinct `<original-pin>-<patch-hash>` directory; never overwrite an older immutable package or reload an unsaved live page. Other original apps need their own registered packages in that root. From source, use `npm run ui:filmcraft:build -- <clean-pinned-filmcraft-checkout> <output-assets> <package-root>` with Rust 1.99.0/wasm32 and wasm-bindgen 0.2.129; the script applies only the known reviewed patch and rejects unrelated source changes. It does not fetch or execute arbitrary GitHub repos.

The single-MKV/WebM Media Browser hook returns `{pending:true}` while its original status bar shows loading. Completion/failure is reflected in the actual project and `filmcraft.info().mediaImport`; pending is never a save acknowledgement. Folder/batch/image-sequence imports retain their upstream behavior. See [scope, regression evidence and handoff](filmcraft-mkv-import-handoff.md).

## Start

1. Download and verify SHA256 (`sha256sum` on Linux, `shasum -a 256` on macOS, `Get-FileHash -Algorithm SHA256` on Windows).
2. Extract into a writable folder. Run `start.cmd` on Windows, `start.command` on macOS, or `./start.sh` on Linux.
3. Open `http://127.0.0.1:8788`. Save user work before stopping the terminal. A conflict on port 8788 fails startup; choose a free `PORT` explicitly.

The bundle contains the runtime and gateway dependency; no compiler or package installation is required. `data/` stores gateway state and `workspaces/` stores project files, alongside the launcher by default. `DATA_DIR` and `WORKSPACE_ROOTS` can point to separate writable locations. Paths with spaces are supported. Engine binaries are selected from this bundle, separately from mutable application data.

Upload or copy-first laptop workflows work without a mount helper. On-demand/hybrid mounting requires a separately installed helper and host-specific prerequisites; the package explicitly reports that capability unavailable when no helper exists. Choose a save destination separately from source mode. Browser permission and acknowledged writes still govern laptop saves.

For external access set `HOST`, `WORKSPACE_AUTH=user:password` and allowed roots, then terminate HTTPS in a reverse proxy or Cloudflare Access. Authentication is required beyond loopback; Access does not replace the application's auth/root checks. Credentials belong in the runtime environment, never inside the archive or repository. See [storage modes](storage-modes.md).

## Upgrade

Save all documents, stop the old service and back up `data/` plus project files. Extract the new version into a separate folder. Set `DATA_DIR` and `WORKSPACE_ROOTS` to the existing backed-up directories, or copy them while both instances are stopped. Start the new version and reopen a known document. Keep the old bundle and backup until verification succeeds. No automatic migration or rollback is claimed yet; never unpack a release over a running installation.

## Maintainer release flow

For each completed feature/fix choose a new alpha SemVer, update `package.json`, both root lockfile versions, README's version, this overview if behavior changes, `CHANGELOG.md`, and the compact handoff. Run `npm run release:validate`, `npm run check`, and the relevant tests. Push the normal commit to `main`. The release workflow validates metadata, refuses existing version tags, builds pinned engines on each target, assembles licensed bundles, runs actual native smokes with the embedded Node, and uploads archives/checksums. Concurrent-version tests must accept either request ordering while still proving that one mutation succeeds and stale writes are rejected. Only when all targets pass does Actions create an immutable tag and publish a prerelease. Failed builds produce no public download claim; fix with a new version if any tag was already created. Never force-update a published version.

Alpha.10 verified eight assets historically (three native prototype bundles, one FilmCraft browser preview and four SHA256 sidecars). For alpha.11, verify the workflow and all ten actual assets (three native prototype bundles, FilmCraft and DesignCraft preview archives, and five SHA256 sidecars) before reporting the draft candidate. A workflow file or successful gateway-only checks are insufficient. Review `bundle.json` and `evidence/` in each archive for exact pins, capability limits and acceptance evidence. Upstream engine versions are independent of the product version. Normal source builds continue to use pinned managed installers.

Alpha.21 failed the host-canvas post-build guard because its reviewed patch used abbreviated Git blob headers while verification emits full IDs; no tag/release was created. Alpha.22 preserves the same source file bytes, updates the exact digest, and checks immediately after patch application before compiling. Installation scope remains the same isolated candidate archive; do not activate it in a live studio or claim downloads before Actions/tag/six archive/checksum verification.

Alpha.24 is a new single-file copy-first original Open candidate, using streamed shared transfers and an input path bound to the same server session. Installation still requires a separate candidate root; no live studio replacement or full adapter claim. Verify the new Actions tag/draft and six archive/checksum pairs before download claims. See [Open workflow scope](designcraft-file-open.md).

Alpha.25 corrected the macOS fixture path expectation without changing Open/UI/engine behavior. Alpha.24 Checks `38314217460` failed solely on the `/var` versus `/private/var` assertion; alpha.25 then passed and its draft/assets were verified below.

Alpha.25 publication verification completed on 2026-10-13: Checks `38314679443` passed all three OS; Actions Build/release `38314678319` succeeded after alpha.24 `38314217910`. Immutable tag `v0.2.0-alpha.25` points to `83276a95f1006ca42c460b1fc519d4bba489b19e`. Publish job `115045406673` verified all six archive/checksum pairs and created the prerelease draft; public unauthenticated listing omits draft details. Alpha.26 extends the isolated DesignCraft candidate with original File → Save a Copy… to a new server-workspace path. It remains draft-only and unregistered; verify its own Actions, immutable tag, draft and all six asset pairs independently.
