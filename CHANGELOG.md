# Changelog

Each completed product update receives a new SemVer, changelog entry and immutable Actions-built release. Engine source versions remain independently pinned.

## [0.2.0-alpha.4] — 2026-10-11

- Add the LightCraft server session gateway for explicitly selected source roots, bounded photo open/edit/undo/redo/export and private previews.
- Add editable recipe save/load bound to the confined source-relative path, original SHA-256 and LightCraft 0.6.0 pin. Session version/dedup guards reject stale mutations; recipe save clears dirty state only after the chosen server or laptop destination acknowledges the new file. Image exports remain dirty.
- This is gateway groundwork only: no LightCraft browser editor, portable-bundle engine, real browser picker/FUSE acceptance or availability claim.
- Not released: macOS Actions smoke found a nondeterministic visual-change assertion after the valid concurrent undo winner. No alpha.4 tag or assets were published.

## [0.2.0-alpha.5] — 2026-10-11

- Make the native PhotoCraft version smoke compare a known paint stroke against the preview after either valid concurrent edit/undo winner. Stale-version rejection and exactly one concurrent winner remain required.
- Reissue the unpublished LightCraft gateway update under a fresh immutable version; the earlier alpha.4 candidate was not tagged or published.

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
