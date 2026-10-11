# Releases and installation

Creative Workspace aims to let a lightweight laptop access a powerful self-hosted creative server through native browser interfaces. Original documents remain under explicitly selected file-provider permissions; rendering/editing runs on the server. No remote desktop transport is used. The current public release is 0.2.0-alpha.7. The new 0.2.0-alpha.10 candidate fixes original FilmCraft pending MKV/WebM import and adds a separate Actions-built original-UI preview archive and is deliberately draft-only until original-UI asset packaging and target/browser evidence are complete.

The current channel is **alpha**, for one user. Version 0.2.0-alpha.7 is published; Actions built the Linux x64, Windows x64 and Apple Silicon macOS bundles and passed all native bundle smokes. Each archive and its SHA256 sidecar is downloadable from [Releases](https://github.com/vedranius/creative-workspace/releases/tag/v0.2.0-alpha.7). Alpha.4 was not published because its macOS PhotoCraft smoke exposed a visual-change assertion race. Source archives automatically shown by GitHub are source code, not install bundles.

| Bundle | Requirements | Included native prototype engines |
| --- | --- | --- |
| linux-x64 `.tar.gz` | Linux x64, glibc 2.35+ | PhotoCraft, PdfCraft, VectorCraft, DesignCraft |
| win32-x64 `.zip` | Windows x64; Microsoft Visual C++ 2015–2022 x64 runtime | Same four editors |
| darwin-arm64 `.tar.gz` | Apple Silicon, macOS 14+ | Same four editors |

Support means the target Actions native smoke passed; broader format compatibility and manual browser picker acceptance remain unverified. Windows and macOS archives are unsigned. Intel Mac and Linux/Windows ARM builds are not yet offered. RapidRAW's own Linux build uses its separate CLI installer; it is not included or automatically attached by the portable launcher. Original UI previews for LightCraft, FilmCraft and EffectCraft are runnable, but their owned server/provider integrations remain pending and their engines are not bundled. Original WASM UI packages for all seven apps are separately registered, not included in these archives. This is not the complete planned suite.

Alpha.9 was not released: WASM compilation succeeded, but shallow Git diff ID formatting failed exact patch registration. Alpha.10 keeps exact validation using deterministic full IDs. The local alpha.9 test instance retains the same import behavior.

## Original UI previews in alpha.10

Build the original pinned upstream browser app, then use `npm run ui:install -- <app> <clean-source-checkout> <static-output>` (or the bundled Node with `scripts/install-original-ui.mjs`). Set `CW_ORIGINAL_UI_DIR` to the registration root when starting the studio; the default is `DATA_DIR/original-ui`. The dashboard offers only packages that pass identity, hash and confinement checks. See [instructions and evidence](studio-original-uis.md). Registration does not clone/build/execute arbitrary repositories. It requires a known original pin and preserves its licensing.

The original previews process locally in WASM; File Open/save/export use upstream browser host behavior. Shared server/laptop on-demand/hybrid/copy-first modes, destination-write acknowledgement and recovery are not integrated into these original UIs. A browser download or a preview's clean indicator is not evidence that the selected disk destination acknowledged a write. Keep original application availability pending until those paths pass acceptance.

`release/config.json` marks alpha.10 `draftOnly`; Actions still builds/checks each native target and verifies archive/checksum assets, then retains the GitHub Release draft. Do not turn it into a public complete-suite claim while original UI packaging/parity evidence is missing.

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

Check the workflow conclusion and actual eight assets for alpha.10 (three native prototype bundles, one FilmCraft browser preview and four SHA256 sidecars) on the release before telling users it is downloadable. A workflow file or successful gateway-only checks are insufficient. Review `bundle.json` and `evidence/` in each archive for exact pins, capability limits and acceptance evidence. Upstream engine versions are independent of the product version. Normal source builds continue to use pinned managed installers.
