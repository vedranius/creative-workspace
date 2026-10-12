# Changelog

Each completed product update receives a new SemVer, changelog entry and immutable Actions-built release. Engine source versions remain independently pinned.

## [0.2.0-alpha.17] — 2026-10-12 (draft release verified)

- Add a bounded server host-action route for the original DesignCraft `file.new` preset caller. It accepts only a single preset name, forwards that original parameter to the owned native worker, and returns the worker's command ID with the acknowledged revision, read model and server render.
- Verify exact preset forwarding and ACK/read-model response with a protocol fixture, the owned native worker, and Chromium (A4, revision 1, 595×842 server PNG, no browser errors). [Browser report](docs/evidence/designcraft-par03-file-new-browser.json).
- This is only the server action seam: the pinned original `DesignApp` caller and panels are not yet attached to it. Keep DesignCraft planned and the Actions release draft-only pending original UI/session synchronization, provider, save ACK, reopen and recovery.
- Checks `38206102465` and Build/release `38206102488` passed. Immutable tag `v0.2.0-alpha.17` points to `53445c8`; draft release `410203579` has five Actions archives and five verified SHA256 sidecars. [Release evidence](docs/evidence/creative-workspace-alpha17-release.md).

## [0.2.0-alpha.16] — 2026-10-12 (draft release verified)

- Refresh the full revisioned DesignCraft read model and its server render after every bridged `frame.create` response, including title, page count, dirty state and current revision.
- Verify exact pinned-source patch registration, native worker render changes, two ordered browser edits through revision 3, and 404/403/409 session/Origin/stale-revision guards with no Chromium errors. [Browser/native evidence](docs/evidence/designcraft-par03-read-model-v3-browser.json).
- Keep DesignCraft planned: the overlay does not synchronize the original local `DesignApp` Session or panels; original action dispatch, provider destination/retention, save ACK, reopen and recovery remain incomplete. The immutable Actions-built alpha.16 draft assets and checksums are verified. [Release evidence](docs/evidence/creative-workspace-alpha16-release.md).

## [0.2.0-alpha.15] — 2026-10-12 (draft candidate)

- Extend the pinned original DesignCraft PAR-03 bridge with `file.new` and `frame.create`; the original worker owns document creation, pointer edit ordering, state revisions and PNG rendering.
- Verify two rapid original-canvas gestures in Chromium (revision 1→3), changed server render digests, native worker execution, and session/Origin/stale-revision guards.
- Keep DesignCraft planned: its upstream local `DesignApp` state is not synchronized, and full tools, providers, acknowledged save/reopen and recovery remain incomplete. Keep the Actions-built cross-platform release as a draft. [Actions, tag, asset and checksum evidence](docs/evidence/creative-workspace-alpha15-release.md).

## [0.2.0-alpha.14] — 2026-10-11 (draft candidate)

- Fix the original UI exact-patch verifier to include new untracked files during comparison. The reviewed DesignCraft patch adds `server-bridge.js`; plain `git diff` omitted that file and caused alpha.13's Actions registration to fail after a successful Trunk build.
- Temporarily mark untracked paths intent-to-add only for the canonical diff, then restore the index. The reviewed patch bytes and SHA-256 remain unchanged; unrelated/unreviewed source changes still fail exact equality.
- Reproduced with checksum-pinned Trunk 0.21.14 on the exact DesignCraft pin. Low-impact optimized WASM build and original UI package registration succeeded after the fix. Alpha.14 Actions, browser/native smokes, draft release assets and uploaded checksums are verified; the draft remains unpublished pending full original-app/provider parity.

## [0.2.0-alpha.13] — 2026-10-11 (draft candidate)

- Bind the original DesignCraft canvas preview to the server-owned read model: display the upstream document title, page count and dirty state at the same state revision as the PNG.
- Verify the original `file.newSample` command, four-page sample and 612×792 server render in a browser; stale revision, foreign session and invalid Origin requests return 409, 404 and 403. No full DesignCraft or other ArtCraft port is claimed; keep the release draft.
- Add the hash-registered `par-03-server-read-model-v2` variant and one reproducible original UI build/browser evidence package.

## Documentation — 2026-10-11 (product version unchanged)

- Expand the repository overview with current original UI/server scope, file modes, installation, releases and all upstream authors/licenses. Add an original CW logo/banner, 14 actual studio/application screenshots, capture provenance and `LICENSE.md`; preserve the existing AGPL terms.
- Record the About description/topics for discovery; GitHub administration is unavailable to the current content-publication token.

## [0.2.0-alpha.12] — 2026-10-11 (draft candidate)

- Preserve the reviewed DesignCraft source patch bytes across Windows Git checkouts with an explicit LF attribute. Alpha.11 Linux/macOS checks passed locally/remotely, but its Windows test job exposed line-ending normalization in the new patch path.
- Keep the original UI pin and alpha.11 patch/tag/release untouched. Native and bundle jobs passed, but the original DesignCraft job failed exact reviewed-source diff registration after its WASM build (`Source differs from the exact reviewed integration patch`); `publish` was skipped. No alpha.12 tag or release exists, so it has no downloadable assets. Alpha.13 now regenerates the patch from the exact pinned source diff.

## [0.2.0-alpha.11] — 2026-10-11 (draft candidate)

- Add a reviewed DesignCraft original UI variant whose browser shell routes the representative `file.newSample` operation to the owned server worker and presents its bounded revisioned PNG in the original canvas area.
- Preserve the upstream source command ID; restrict this bridge to the one known operation. Verify an owned native worker, real browser render, invalid-Origin/foreign-session rejection and original menu/tool visibility.
- Add an Actions-built DesignCraft PAR-03 preview archive and browser evidence. The local DesignApp session, panels/read-model parity, other commands/tools, provider/save ACK, recovery, full OS/browser acceptance and complete creative-suite packaging remain pending. Keep the release draft.

## [0.2.0-alpha.10] — 2026-10-11 (draft candidate)

- Make reviewed original-UI Git patch validation deterministic across full/shallow repositories and Git formatting settings: full blob IDs, explicit prefixes/context/algorithm, exact known pin/diff/SHA256 checks retained.
- Reissue the original FilmCraft MKV/WebM pending-import fix and Actions browser-preview archive. Alpha.9 compiled the original WASM successfully but its shallow checkout used shorter Git diff IDs and registration failed; no alpha.9 release/tag was created. The protected local alpha.9 candidate has the same import behavior.
- Add source-diff regression coverage and preserve compiled CI cache even if later registration/browser QA fails. Server/provider/full original parity and complete creative-suite packaging remain pending; draft release only.

## [0.2.0-alpha.9] — 2026-10-11 (not released; patch registration failed)

- Fix deferred reads for single MKV/WebM Media Browser imports in the original FilmCraft UI: wait/retry, freeze the target path/bin, deduplicate repeated actions and cancel on project replacement. A queued response is explicitly pending, not import/save success.
- Keep pending metadata probes retryable instead of permanently caching an unreadable result. Bound retries; report real read errors and preserve partial-import errors.
- Register reviewed source patches as distinct immutable UI variants with exact pin/diff/SHA256 provenance; preserve original menus, tools and rendering. Existing live preview packages are not overwritten.
- Add reproducible FilmCraft WASM build and separate Actions-built original-UI preview archive. Native-prototype OS bundles and original server/provider/save parity retain their existing limits; keep the release draft.

## [0.2.0-alpha.8] — 2026-10-11 (draft)

- Make verified original upstream UI previews the studio's primary launchers, served on the same authenticated origin under `/original/<app>/`; keep limited legacy prototypes in collapsed links and preserve their routes/documents.
- Add explicit clean-source/pin registration, immutable per-app asset packages, checksum/path/symlink/budget checks, source licenses/attributions, scoped WASM/worker security headers and preview identity independent of native-engine health.
- Prevent shared build-output reuse from silently switching an application. Normalize only unresolved Trunk development reload metadata and PhotoCraft's optional empty served-font catalogue; retain original UI/engine code and expose LightCraft's missing optional Chinese font.
- Report the actual product version in health/settings and the studio. Original UI processing remains local WASM; original server/provider/save-ack parity is pending.
- Actions builds target assets but leaves alpha.8 draft: original WASM UI assets are not yet bundled/accepted on all targets. This is not a complete creative-suite release.

## [0.2.0-alpha.7] — 2026-10-11

- Correct the dashboard to distinguish original ArtCraft application ports from limited custom prototypes. Engine readiness no longer counts as original UI or full-functionality completion.
- PAR-03a original DesignCraft UI/server command and render bridge remains incomplete; this version is not a DesignCraft port or parity release. Published after the target CI and Actions asset checks passed; full original UI/server parity remains pending.

## [0.2.0-alpha.6] — 2026-10-11

- Add a native browser preview for the existing LightCraft gateway: browse the selected source, open photos and hash-bound recipes, edit using ranges exposed by the pinned engine, undo/redo, save editable recipes and export image copies.
- Keep LightCraft planned and excluded from portable bundles until real browser permission and Linux FUSE/agent open/edit/save/reopen acceptance passes. Recipe save ACK and export dirty-state behavior remain enforced by the gateway.
- Published as an immutable prerelease after all target native builds, smoke checks and bundle archive checks succeeded. Linux, Windows and macOS assets each include a SHA256 sidecar.

## [0.2.0-alpha.5] — 2026-10-11

- Make the native PhotoCraft version smoke compare a known paint stroke against the preview after either valid concurrent edit/undo winner. Stale-version rejection and exactly one concurrent winner remain required.
- Reissue the unpublished LightCraft gateway update under a fresh immutable version; the earlier alpha.4 candidate was not tagged or published.

## [0.2.0-alpha.4] — 2026-10-11

- Add the LightCraft server session gateway for explicitly selected source roots, bounded photo open/edit/undo/redo/export and private previews.
- Add editable recipe save/load bound to the confined source-relative path, original SHA-256 and LightCraft 0.6.0 pin. Session version/dedup guards reject stale mutations; recipe save clears dirty state only after the chosen server or laptop destination acknowledges the new file. Image exports remain dirty.
- This is gateway groundwork only: no LightCraft browser editor, portable-bundle engine, real browser picker/FUSE acceptance or availability claim.
- Not released: macOS Actions smoke found a nondeterministic visual-change assertion after the valid concurrent undo winner. No alpha.4 tag or assets were published.

## [0.2.0-alpha.3] — 2026-10-11

- Make the native PhotoCraft concurrent-version smoke accept either valid race winner while requiring exactly one mutation and a 409 for the stale request. Alpha.2's Linux/Windows checks and all native builds passed, but its macOS bundle smoke exposed an ordering assumption in the test; no alpha.2 release was published.
- Repeat the real native PhotoCraft edit/undo race locally and preserve save/reopen verification.

## [0.2.0-alpha.2] — 2026-10-11

- Normalize Windows CRLF Cargo lockfiles before adding our pinned shim package; preserve dependency pins and keep `--locked`. First native Actions attempt exposed VectorCraft/DesignCraft lockfile failures; alpha.1 was not released.
- Include managed build scripts, release sources and tests in portable archives alongside the gateway and shim sources.

## [0.2.0-alpha.1] — 2026-10-11 (not released; target build failed)

### Added

- GitHub Actions native build pipeline for Linux x64, Windows x64 and macOS Apple Silicon. Separate pinned PhotoCraft, PdfCraft, VectorCraft and DesignCraft builds feed portable bundles with Node 24, licenses, source attribution, capability manifests and SHA256 checksums.
- Publication waits for actual native document open/edit/save/reopen and bundled-launcher health checks on every target. A failure prevents public release; duplicate published versions are refused.
- Portable start scripts and installation/upgrade instructions; users do not need Node, npm or Rust to run the four bundled editors.
- Version consistency validation across package/lockfile/README/changelog/tag, plus release rules inherited by subsequent feature sessions and automation.

### Existing creative prototype included

- Browser-native PhotoCraft layered editing, PdfCraft document editing, VectorCraft illustration and DesignCraft publication layout with server processing, separate workspace roots and upstream attribution.
- File imports, explicit server/laptop destinations, common provider modes, acknowledgement-based save handling and durable recovery for uncertain outputs.
- LightCraft native CPU foundation and guarded recipe format; its browser adapter remains pending.

### Limits

- Alpha, single-user. The portable bundle includes four editors, without RapidRAW or the native folder mount helper. RapidRAW remains a separate owned Linux installation; on-demand/hybrid mounts require a separate verified helper. Upload and copy-first work without that helper.
- FilmCraft/EffectCraft and the LightCraft browser UI remain planned. Docker currently packages the gateway. Full format parity, user browser permissions, native installer signing and Intel Mac packaging remain follow-up tasks.
- CI verifies generated native documents and startup. It does not establish real directory-picker permission or broad camera/media compatibility.

## [0.1.0] — unreleased development baseline

- Independent Linux RapidRAW installation and browser proxy with runtime identity verification.
- Four ArtCraft native engine/browser adapter prototypes, shared storage providers, save recovery and session version protection.
- No downloadable product release was published for this baseline.
