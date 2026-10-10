# Milestone 0.1 validation

Verified on the development Linux host:

- JavaScript syntax checks passed.
- Three automated suites passed: workspace traversal/symlink restrictions; release error/absence/compatibility states; authenticated API, persistence and origin checks.
- Browser flow saved a RapidRAW workspace and displayed the server directory.
- Real GitHub release checks returned results for all eight catalog repositories.
- Docker image built successfully from Node.js 24 Bookworm slim.
- Ephemeral Docker runtime returned 401 without authentication and 200 for health, workspace configuration and file browsing with authentication.
- Docker Compose configuration validated with an explicit authentication value.

The published GitHub CI run [38039052090](https://github.com/vedranius/creative-workspace/actions/runs/38039052090) passed the automated suites on Linux, Windows and macOS. The initial run caught a test assertion comparing an unnormalized temporary path with the canonical saved path; the assertion now resolves the expected path on all platforms.

The redesigned interface was visually checked at desktop and mobile sizes, including application search and mobile content width. The local service is available at `http://127.0.0.1:8788` while its development process remains running.

At this initial milestone, native creative processing and installation had not been tested. Later native-engine validation is recorded below. Full Windows/macOS engine workflows, multi-user identity, upgrade rollback and high-latency performance remain unverified.

## Local import milestone

Five local automated suites passed, including streaming size limits, folder hierarchy, no-overwrite conflicts, download, traversal restrictions and cleanup of failed transfers. A real browser file-chooser upload imported a generated laptop test file into the RapidRAW workspace. Original and uploaded bytes were compared. Upstream attribution links were verified in the browser. Cross-platform CI results for this milestone are available in GitHub Actions.

## First workspace-owned creative editor

- Built a new `cw-rapidraw-engine` from the pinned RapidRAW Web source with an independent Tauri identifier. The existing installed bridge was not used for the final integration.
- Runtime on loopback port 8791 has its own data/config/cache directories, relay, FUSE helper and photo workspace. Gateway readiness requires the workspace runtime identity plus an actual Rust backend response.
- Native backend smoke: opened a generated 960×640 PNG, changed exposure, returned different preview bytes, and exported a valid PNG (575,978 bytes).
- Browser smoke: opened the server photo folder, opened the generated image, changed exposure in the original React editor, and resumed the library after reload.
- Native FUSE smoke: requested 128 bytes from an 8 MiB generated source; only one 1 MiB block was fetched. A 47-byte server write reached the generated laptop-agent fixture and matched byte-for-byte.
- The FUSE test uses a protocol fixture, not an automated real browser directory-picker permission flow. The browser UI exposes the supported local-folder mode controls; real laptop-folder testing remains to be performed by selecting a folder.
- Seven gateway/storage tests passed locally, including rejecting an unrelated engine identity and foreign WebSocket origins.
- RapidRAW native runtime is currently verified on Linux with one shared editing session. PhotoCraft validation follows below.

## PhotoCraft and independent shared storage

- Built PhotoCraft 0.6.0 from pinned commit `29d5f791d52cd54e411611a609fbc56949e0c653` as a new Rust CLI engine. Each browser editing session has separate engine state and explicit read/write capabilities.
- Browser UI test reopened a two-layer `.pcraft`, applied brightness/contrast through the native engine, and saved a layered output with an available download link. Earlier browser brush strokes visibly changed the canvas and native history.
- Server smoke covered generated image open, changed preview bytes, layer creation, brush strokes, undo and native/PNG exports.
- Built the common `cw-filesystem-helper` independently of the RapidRAW runtime. Its native Linux mount test read a selected 12,677-byte PNG, changed the native preview and returned a 29,740-byte layered save to a generated laptop-agent fixture. Download matched the laptop bytes; reopening preserved two layers. An unrelated 8 MiB source was read zero times. A second session read from that laptop source while exporting only to the server.
- PhotoCraft UI exposes on-demand, hybrid and copy-first folder modes, separate output destination and server-retention choices. Pure on-demand sends `fill=false`. Browser controls, adjustments and the storage mode dialog were inspected live.
- Eleven automated tests passed locally: previous workspace/gateway coverage plus session deduplication/limits, overwrite/path protection, app-scoped share roots, concurrent share limits, active-session stop protection, destination permissions and malformed/foreign-origin WebSockets.
- Reproduce the native storage test using `node scripts/smoke-photocraft-local-folder.mjs` against a running workspace with PhotoCraft and the common helper installed. This generated protocol fixture does **not** verify browser directory-picker permissions on a real laptop. Hybrid stress cases, crash recovery and native Windows/macOS builds remain pending.

The adapter is a working browser prototype, with core tools and a discoverable command palette. It does not reproduce every original egui tool/dialog. Sessions and share registrations are in memory; save layered documents before restarting. Other ArtCraft adapters remain unimplemented.

## REC-01 — durable uncertain-save recovery

- Sixteen local gateway/provider tests passed. Added restart persistence, old-generation ACK protection, app-scoped downloads, invalid manifest/traversal/symlink rejection, failed write acknowledgement, actual WebSocket disconnect before ACK, and Stop before the copy-mode delayed sync. Imports do not become uncertain server outputs.
- Real PhotoCraft/FUSE success smoke confirms acknowledged layered saves clear their journal, reopen with two layers, match downloaded bytes and do not fetch an unrelated 8 MiB source.
- Real PhotoCraft/FUSE failure smoke acknowledges a generated temporary layered file, rejects its final rename and verifies the save fails. Engine cleanup cannot delete the uncertain output. After Stop and gateway restart, its 8,709-byte server copy is downloadable and reopens in a new native engine with two layers.
- The native fixture scripts use isolated test servers/binaries and do not restart the user's live editor. They do not test a real browser picker, sudden power loss, or hostile concurrent replacement of server-directory ancestors. Partial local writes are labelled possibly incomplete. Recovery UI and version-safe replay remain pending.
