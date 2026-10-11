# Releases and installation

Creative Workspace aims to let a lightweight laptop access a powerful self-hosted creative server through native browser interfaces. Original documents remain under explicitly selected file-provider permissions; rendering/editing runs on the server. No remote desktop transport is used. The current published version is 0.2.0-alpha.6.

The current channel is **alpha**, for one user. Version 0.2.0-alpha.6 is published; Actions built the Linux x64, Windows x64 and Apple Silicon macOS bundles and passed all native bundle smokes. Each archive and its SHA256 sidecar is downloadable from [Releases](https://github.com/vedranius/creative-workspace/releases/tag/v0.2.0-alpha.6). Alpha.4 was not published because its macOS PhotoCraft smoke exposed a visual-change assertion race. Source archives automatically shown by GitHub are source code, not install bundles.

| Bundle | Requirements | Included working editors |
| --- | --- | --- |
| linux-x64 `.tar.gz` | Linux x64, glibc 2.35+ | PhotoCraft, PdfCraft, VectorCraft, DesignCraft |
| win32-x64 `.zip` | Windows x64; Microsoft Visual C++ 2015–2022 x64 runtime | Same four editors |
| darwin-arm64 `.tar.gz` | Apple Silicon, macOS 14+ | Same four editors |

Support means the target Actions native smoke passed; broader format compatibility and manual browser picker acceptance remain unverified. Windows and macOS archives are unsigned. Intel Mac and Linux/Windows ARM builds are not yet offered. RapidRAW's own Linux build uses its separate CLI installer; it is not included or automatically attached by the portable launcher. LightCraft has a browser preview and gateway recipe groundwork, but no real browser/FUSE acceptance or bundled engine; FilmCraft/EffectCraft remain unavailable. This is not the complete planned suite.

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

Check the workflow conclusion and actual six assets on the release before telling users it is downloadable. A workflow file or successful gateway-only checks are insufficient. Review `bundle.json` and `evidence/` in each archive for exact pins, capability limits and acceptance evidence. Upstream engine versions are independent of the product version. Normal source builds continue to use pinned managed installers.
