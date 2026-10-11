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
- Follow-up: seventeen local tests pass after correcting configured-root aliases found by macOS CI. Recovery downloads work with a trusted aliased base for both temporary and retained mirrors, while aliases inside either share namespace remain forbidden.

## REC-02 — browser recovery UI

- Homepage recovery lists all apps with a filter; PhotoCraft pins its app filter on inventory and download URLs. Browser checks covered failed, unacknowledged, possibly incomplete and unavailable copies, empty app selection, a globally invalid journal warning, and refresh.
- A generated server copy downloaded through the in-app browser's native file-link capability matched its 44 fixture bytes. This fixture is not an actual PhotoCraft document. The final UI uses native server attachment links for streaming, with no Blob buffering or forced `download` attribute. An optional availability check reports a copy removed after listing instead of saving an error response.
- Error markup remained plain text with zero injected image elements. The narrow dialog layout had no horizontal overflow. Desktop and narrow screenshots are saved in the task's outputs directory.
- All seventeen automated gateway/provider tests pass locally, including authenticated JS/CSS recovery assets, the `.recovered` attachment filename and missing-file failures without attachment headers. Earlier native-engine recovery evidence remains applicable; no engine rebuild was needed.
- The old port-8788 gateway was not restarted. Lazy loading preserves the main editor with an older running gateway and explains that recovery requires an updated server. A separate updated PhotoCraft preview on loopback port 8789 has independent data/workspaces; the existing RapidRAW relay is disabled there. Browser picker, native Windows/macOS engines, version-safe replay and multi-user ACL remain separate tasks.

## MCP-01 — command audit and gateway version foundation

- Eighteen local tests pass, adding serialized competing version checks, exact retry, legacy mutation invalidation, native revision reset, partial failure invalidation, observed native changes, invalid tokens and distinct state-conflict/file-exists codes.
- Installed PhotoCraft exposes 853 native command descriptions. A real 48×32 midtone fixture changed its preview through brightness/contrast; a competing stale undo returned 409/STATE_VERSION_CONFLICT. Exact retry did not mutate again. Returning to an earlier document with the same native revision still required a new gateway token. Undo restored the original preview, and a 7,438-byte layered output saved/reopened successfully.
- Browser test with generated documents: an external RPC added a layer, then a stale UI Add layer was rejected and refreshed without replay. A stale Save after external document replacement closed the dialog without an overwrite prompt. The original `.pcraft` remained byte-identical; the replacement document was not saved under the stale filename.
- All native/browser checks used separate temporary gateways and existing binaries. The user-facing 8788 and 8789 backends were left running their previous versions. Frontend compatibility is preserved when stateVersion is absent. Native async jobs are not atomically guarded across inspect/dispatch; first MCP tools must be synchronous and reject such jobs. The MCP endpoint, scoped grant and automatic AI/browser state push/poll remain unimplemented. See [audit](mcp-adapter-audit.md).

## PDF-01 — third functioning creative app and unified studio

- Built an independent `cw-pdfcraft-engine` embedding pinned PdfCraft 0.5.0 (`9ccf77bd`) through our original Rust stdio shim. No desktop UI/remote desktop/MCP transport is started. The locked installer and shim formatting/clippy checks passed.
- Real native PDF workflow passed: create/open, render, rotate, note, undo/redo, move/delete and restore pages, text extraction, save/reopen. Rotation changed the PNG; the new 1,089-byte PDF reopened with two pages, 90° rotation and its note. Original bytes remained unchanged.
- Common Linux FUSE/laptop fixture read 575 bytes from the selected PDF and zero from an unrelated 8 MiB source. New laptop output waited for ACK, matched download bytes and reopened. A separate server-destination session left the laptop output/original untouched. This is a protocol fixture, not a real browser directory-picker permission test.
- Browser workflow passed using an isolated Chromium profile and generated documents: actual studio launch link, blank PDF, rotation, note, save, download (1,118 bytes) and reopen with the note. Folder-mode dialog and narrow-screen layout passed, with no page errors or horizontal overflow. Screenshots and reports are under the task's outputs.
- Twenty-two automated tests passed, including PDF session isolation, paths/symlinks, stale tokens, request dedup, copy collisions, failed laptop ACK dirty state, gateway auth/Origin, share ownership/access/active-session protection and unrelated-engine rejection. Native PhotoCraft regression also passed after sharing the process helper.
- Updated studio runs at localhost:8792 with all three owned engines; available apps sort first and planned repos have explicit labels. Existing sessions on 8788/8789 were preserved. Five other ArtCraft adapters, full PDF tool parity, real user picker permissions, stress, native Windows/macOS, multi-user and engine-enabled Docker remain pending.

## VEC-01 — working server-backed VectorCraft browser adapter

- Built the independent `cw-vectorcraft-engine` from pinned VectorCraft 0.8.0 (`96344f07`), using its native Headless backend through our original MIT/Apache Rust shim. The upstream library code is unchanged; no desktop or public MCP server starts. The locked installer and scoped fmt/clippy checks passed.
- Native Linux proof: generated SVG open, rectangle/ellipse/star/polygon/path creation, select/colour/transform, undo/redo/delete, document preview changes, native/SVG/PDF/PNG export and native/SVG reopen. Originals stayed byte-identical; separate native read/write root checks reject private files and unsupported file commands.
- Generated laptop WebSocket agent + real FUSE: selected SVG read **154 bytes**, unrelated 8 MiB file **zero**, native output ACK/download/reopen matched, and a separate server-output session kept the laptop original. Real browser directory-picker permissions are not automated.
- **27 Node tests** passed, including isolation, deduplication/stale-version protection, payload/parameter/path restrictions, failed laptop ACK remaining dirty, protected share ownership/auth/Origin, collision/original preservation, unrelated runtime identity and refusing incomplete multi-file exports before publication. Initial sandbox socket-dependent test execution crashed; the authorized isolated execution passed.
- Fresh Chromium profile: actual SVG upload, star/drag rectangle/freehand, colour/move/undo/redo, native save/download/reopen, 4 available / 4 planned dashboard, three folder modes and 390 px mobile layout without horizontal overflow or JS errors. Browser testing caught and fixed overlapping session transitions; freehand paths have no fill. Reports/screenshots remain outside the public repo under task outputs.
- Live studio remains **localhost:8792**, now with RapidRAW, PhotoCraft, PdfCraft and VectorCraft. It was refreshed after checking all existing studio work was saved and consisted solely of our generated PDF proof; legacy 8788/8789 sessions and the owned RapidRAW service were preserved. Full upstream tool parity, text/pen controls, linked-asset packaging/fidelity, autosave, stress, native Windows/macOS, multi-user and engine-enabled Docker remain pending.

## DES-01 — native DesignCraft browser publication editor

- Independent DesignCraft 0.5.0 engine (`a127c6d5`) and original MIT/Apache stdio shim; no desktop/MCP transport starts. Upstream source libraries unchanged. Pure memory native-format import bypasses upstream file.open's automatic external fonts, linked files and data-merge reads. Canonical roots, ZIP expansion/entry count, page/item/story/image budgets and an explicit command allowlist constrain the adapter.
- Native Linux: create two-page publication, text/shape frames, typography, overset detection and resize/reflow, story replacement, select/move/undo/redo/delete, native/PDF/PNG export and native reopen. Originals stayed byte-identical; native read/write root escape and unsupported file commands were refused. Two Rust safety regressions passed (compressed ZIP over budget and external input); scoped fmt/clippy and locked native build passed.
- Generated laptop agent + actual FUSE: selected native package **3,290 bytes**, unrelated 8 MiB file **zero**; acknowledged laptop output/download/reopen matched and a separate server-output session left the laptop original unchanged. Real directory-picker permission is not automated.
- **32 gateway/provider tests** passed, including isolation, stale/deduplicated requests, path/parameter restrictions, collision/original preservation, failed ACK staying dirty, auth/Origin/share ownership and refusing multi-file incomplete output.
- Fresh Chromium: actual publication creation, text frames/type/story edit, draft retention across selection and inclusion in Save, resize/overset, move/undo/redo, counted native frame creation from pointer drawing, native save/download/upload/reopen, PDF download, page navigation, three folder modes and 390 px mobile layout without horizontal overflow/JS errors. Initial QA accessed a typography field before a text frame existed; corrected the test to follow the visible UI sequence. Screenshots/reports are in task outputs, outside the public repo.
- Same live studio **localhost:8792**, now five ready apps: RapidRAW, PhotoCraft, PdfCraft, VectorCraft, DesignCraft. It was refreshed only after proving no document in the sole empty VectorCraft session, zero other editing sessions/shares, and closing that empty session without discard. Legacy services and RapidRAW engine remained running. Linked-only/other media assets fail explicitly; full tool parity, IDML, image placement, document fonts/data merge, autosave, stress, native Windows/macOS, multi-user and engine-enabled Docker remain pending.

## LGT-01a/01b — LightCraft native and gateway foundation, browser acceptance pending

- Owned `cw-lightcraft-engine`, pinned LightCraft 0.6.0 `9e6c4c6f`; original MIT/Apache worker with unchanged upstream libraries. Direct in-memory photo construction avoids upstream filesystem import/adjacent XMP reads. Canonical/bounded regular-file hooks and SHA-256 checks feed the native decoder; fresh loads reject changed originals. CPU selected, no desktop/MCP/model download started. Private outputs use exclusive creation; twelve typed controls and strict output types/ranges.
- Contributor-original 128×96 uncompressed Bayer DNG without embedded JPEG decoded/developed; changed PNG previews, exposure/contrast/vibrance, undo/redo, JPEG export, fresh-worker JPEG reopen/PNG passed. Original and adjacent XMP stayed unchanged before the intentional source-change guard test. Foreign read/write paths, output collisions, unsupported controls and same-size source changes were rejected.
- Two native regression/contract tests passed, plus scoped fmt/clippy, locked installer and JS syntax checks. Existing gateway code is unchanged; 32-test CI baseline remains. Report outside the repo: `outputs/lightcraft-native-foundation-proof.json`. This does not prove broad camera RAW calibration, native Windows/macOS, browser permissions or on-demand saving.
- Five existing apps remain available on 8792; no live service was restarted. The gateway foundation is implemented; browser UI plus native/FUSE/browser evidence are still required before marking LightCraft available.
- Gateway fixture validation: open a selected source; edit; export while retaining dirty state; persist an editable recipe; reopen it from the selected destination while resolving its original beneath the selected source root; reject changed source bytes and destination collisions. A successful recipe write calls `mark_saved` only after destination ACK. This is protocol-fixture evidence, not a real browser permission or FUSE test.
## LGT-01b browser preview (0.2.0-alpha.6)

- Added browser asset/API fixture coverage for the LightCraft preview and the pinned engine's control-range metadata. Gateway fixture coverage also verifies hash-bound recipe load/save, server ACK behavior, stale source rejection, auth/Origin and failed laptop ACK.
- The UI supports selected folder modes, photo/recipe browsing, native controls, undo/redo, recipe save and image-copy export. In an isolated real-browser run against the existing workspace-owned Linux worker, a generated PNG opened, a control edit changed the preview, recipe save ACK cleared dirty, recipe reopen restored the value, and JPEG export kept later edits dirty. This was server-workspace browser evidence, not a real browser permission or FUSE acceptance.
- Real browser permission, Linux FUSE/agent open/edit/save/reopen and reconnect/recovery checks remain required before LightCraft can be marked available.

Published alpha.6 Actions acceptance:

- Checks [38115244155](https://github.com/vedranius/creative-workspace/actions/runs/38115244155) and Build and release [38115244135](https://github.com/vedranius/creative-workspace/actions/runs/38115244135) succeeded for commit `82a98491bcfc7ca3d1310117622c72bd1ff66b43`.
- All twelve target-specific native builds and three OS open/edit/save/reopen plus archive smokes passed. The Linux x64, Windows x64 and Apple Silicon macOS archives and their three SHA256 sidecars were published; all six URLs returned HTTP 200 and the sidecar values match GitHub's asset digests.
