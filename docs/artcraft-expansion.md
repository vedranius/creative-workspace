# All ArtCraft applications in Creative Workspace

User scope confirmed 2026-10-15: include **every Crafting App**, including office, CAD, audio and interface design. The [official lineup](https://getartcraft.com/apps) lists thirteen: PhotoCraft, VectorCraft, FilmCraft, LightCraft, PdfCraft, EffectCraft, DesignCraft, FigCraft, WordCraft, SoundCraft, DeckCraft, CADCraft and GridCraft. RapidRAW remains an additional independently owned integration. ArtCraft Launcher is the upstream desktop installer, not another document editor or our server installation engine.

## ART-ALL-01: catalog foundation

Alpha.40 adds the six missing entries to the actual studio/API catalog, categories/search, original-author/repository links, per-app server-folder configuration, shared copy-first upload/download and GitHub release checks. New entries remain `adapter-required` / `originalPort: pending`; they are neither installed engines nor accepted server adapters. No launch button, installer progress, cross-platform capability or working document editor is fabricated. Original DesignCraft Select All WIP from the user pause is preserved separately.

## Verified upstream candidates

GitHub release metadata and tag commit identities checked on 2026-10-15. Each listed release offers a web ZIP and `SHA256SUMS.txt`. These are **upstream candidates**, not Creative Workspace assets or adopted build pins; the digests below are GitHub asset metadata, not a claim that these ZIPs have been downloaded and independently verified. Review source, applicable upstream instructions, licensing and browser dependencies before adoption. Original UI and owned worker must use the same reviewed source pin.

| Project / original author | Purpose | Upstream release | Candidate source revision |
| --- | --- | --- | --- |
| [WordCraft — ArtCraft / storytold](https://github.com/storytold/wordcraft) | Office / word processing | [v0.7.0](https://github.com/storytold/wordcraft/releases/tag/v0.7.0) | `fc41918814f62645b6746ed68e71e8c2c2e85d6f` |
| [GridCraft — ArtCraft / storytold](https://github.com/storytold/gridcraft) | Office / spreadsheets | [v0.7.0](https://github.com/storytold/gridcraft/releases/tag/v0.7.0) | `d9d09f0baa912e88c5111107903fc8c640214b57` |
| [DeckCraft — ArtCraft / storytold](https://github.com/storytold/deckcraft) | Office / presentations | [v0.7.0](https://github.com/storytold/deckcraft/releases/tag/v0.7.0) | `d78e657e4cb1e490ceb5445785c052d9cf5ad963` |
| [CADCraft — ArtCraft / storytold](https://github.com/storytold/cadcraft) | CAD / drafting | [v0.7.0](https://github.com/storytold/cadcraft/releases/tag/v0.7.0) | `fc4e98315a8d771b5ab832f0ade0b5e7b106df7f` |
| [FigCraft — ArtCraft / storytold](https://github.com/storytold/figcraft) | Interface design / prototyping | [v0.6.0](https://github.com/storytold/figcraft/releases/tag/v0.6.0) | `833f0d2c27f0acbae5394848930ae531fc89c724` |
| [SoundCraft — ArtCraft / storytold](https://github.com/storytold/soundcraft) | Audio / recording / mixing | [v0.7.0](https://github.com/storytold/soundcraft/releases/tag/v0.7.0) | `3a28a657692c1b98b28c276d8f61df9471074f0f` |

| Original web asset | GitHub-reported SHA-256 (not locally verified) |
| --- | --- |
| `wordcraft-web-0.7.0.zip` | `98df7c68a0ac788a9ac0f531fd34c31ab7d89965abb4935f57168d287dab3189` |
| `gridcraft-web-0.7.0.zip` | `ad10af2baf9c7ed4ccbd81e32b37698f5075cdf4f26b726fee7fc7938a3a8d27` |
| `deckcraft-web-0.7.0.zip` | `4ab91994048c096fa356b7246c31098474d978ecd572e5b252dd825a287d1c40` |
| `cadcraft-web-0.7.0.zip` | `47df17081e31bc25ab586ba88156dc25e07962364c73513004b9c6113b575be7` |
| `figcraft-web-0.6.0.zip` | `a414970e3857f6613efd7f90bd4c8394e5d51b31c4cf1fa0352f87820695b9c4` |
| `soundcraft-web-0.7.0.zip` | `b735de61fbdc21716977ace2649709bd307de832eda2d848f94d1868acef7c45` |

**WordCraft ORG-WORD-UI implementation completed for alpha.42:** upstream revision `fc41918814f62645b6746ed68e71e8c2c2e85d6f` was independently checked out clean and built through its original `apps/wordcraft-web` Trunk entry. The release workflow built the browser archive and SHA256 sidecar from this exact pin; Build and release run 38777350723 passed and the downloadable release asset checksum was verified. The immutable registrar pin opens the original ribbon UI. See [WordCraft build/browser evidence](wordcraft-original-ui-preview.md). The catalog remains planned because browser-WASM processing is not a server-owned engine or provider adapter.

**GridCraft ORG-GRID-UI implementation completed for alpha.43:** upstream revision `d9d09f0baa912e88c5111107903fc8c640214b57` was independently checked out clean and built through its original `apps/gridcraft-web` Trunk entry. Chromium verified the original workbook sample, File backstage, Formula/Data ribbon, cell edit with dependent formula/chart updates, browser XLSX download and reopen by file drop. This remains browser-local WASM; server processing/provider/write acknowledgement/recovery and full parity are pending. See [GridCraft build/browser evidence](gridcraft-original-ui-preview.md). Keep its catalog status planned.

**DeckCraft ORG-DECK-UI implementation completed for alpha.44:** upstream revision `d78e657e4cb1e490ceb5445785c052d9cf5ad963` was independently checked out clean and built through its original `apps/deckcraft-web` Trunk entry. Chromium verified the original Home ribbon, eight-slide Northern Lights sample, slide thumbnails and canvas. This remains browser-local WASM; server-owned presentation state/actions/render/export, providers, real permission/write acknowledgement/recovery, native OS support and full parity are pending. Optional upstream `craft-fonts` was absent and the original UI uses system fonts in this preview. See [DeckCraft build/browser evidence](deckcraft-original-ui-preview.md). Keep its catalog status planned.

## Implementation queue and acceptance

Each row is a separate bounded feature/session. Only one writer/build/browser context uses the checkout at a time. Complete source/engine inventory, compile or verify the upstream original browser build, register an immutable package, browser-verify actual menus/tools/open/edit/save/reopen and capture screenshots. This is a clearly labelled browser-local preview until owned server processing is proven. Then implement the original shared UI action/state boundary with server-owned engine/document/render/export, providers, recovery and OS acceptance. Do not make a replacement HTML editor or use remote desktop. A web ZIP alone is not a server port.

| Task family, in initial order | Original interface / server acceptance focus |
| --- | --- |
| ORG-WORD-UI / SERVER / FILES | Original ribbon, styles, review and document layout. Verify pinned native/document formats; server layout/export, font/media resolution, open/edit/save-copy/reopen and source preservation. |
| ORG-GRID-UI / SERVER / FILES | Original workbook/sheet/formula UI. Server-owned calculation/recalculation and exports; multi-sheet edits, dependency updates, save/reopen, formats and bounds at the adopted pin. |
| ORG-DECK-UI / SERVER / FILES | Original slides, layouts and presenter controls. Server document/layout/render/export, linked fonts/media, slide navigation and save/reopen. Browser presentation displays document results. |
| ORG-CAD-UI / SERVER / FILES | Original drawing/tool/property UI. Server geometry, constraints/tessellation/render/export; units/precision, viewport interaction, representative format round-trips and bounded geometry. |
| ORG-FIG-UI / SERVER / FILES | Original layers/components/prototype UI. Server-owned design state/layout/render/export; linked assets/fonts, component updates and save/reopen. Collaboration is a separate acceptance task. |
| ORG-SOUND-UI / SERVER / FILES | Original edit/mix/transport UI. Server decode/DSP/mix/export, bounded media streaming, seek/sync and offline render. Browser microphone capture/playback requires explicit permissions; measure latency and do not promise WAN live monitoring. Audit plugin execution/isolation rather than automatically loading arbitrary plugins. |

Next ready original UI task: **ORG-CAD-UI**, followed by FigCraft → SoundCraft. Preserve the in-progress DesignCraft Select All slice and resume its existing source experiment separately. Preview expansion and server parity have separate milestones: after all six new original UI previews, resume DesignCraft server parity/provider recovery, then PhotoCraft → VectorCraft → PdfCraft → LightCraft → FilmCraft → EffectCraft → WordCraft → GridCraft → DeckCraft → CADCraft → FigCraft → SoundCraft. A concrete failure may reorder a ready independent slice, but cannot remove any app from scope.

## Common rules for every app

- Independent engine installation and process/session roots; original menus, tool/action IDs, dialogs, shortcuts and workflows. Browser controls/display are local; document processing/render/export belong to server acceptance.
- All four provider modes: server, laptop on-demand, hybrid and copy-first, verified separately. Select save destination and retention independently. Never report a successful laptop save before the browser write ACK; preserve uncertain output, refuse collisions/replay over newer local files and retain explicit recovery options.
- Auth/Origin/root/session isolation and payload/resource bounds. Source provenance, license notices and original-author repository links remain in packages and catalog.
- The existing update checker tracks each app's upstream releases. An available release does not mean compatible: verify UI/engine pins, protocols, commands, formats and providers together in staging; backup/rollback and unsaved session protection precede activation. Control-panel engine installation/update jobs remain separate roadmap work; adding a catalog entry does not implement them.
- Only GitHub Actions build downloadable target assets. Target OS/node/engine manifests, native startup/health/smokes, actual browser/provider proof, licensing and checksums precede bundle claims. Keep prereleases draft while evidence is incomplete. A gateway Docker image or upstream desktop/web download does not constitute a complete Creative Workspace bundle.

## Installation scope today

Run the versioned Creative Workspace studio as documented in [releases](releases.md). The six entries appear automatically and can have separate server folders and imported copies; GitHub checks cover them automatically. WordCraft and GridCraft have separately registered exact-pin browser previews that process documents/workbooks in browser WASM; neither has server/provider acceptance. The other four new entries still cannot launch an editor. Do not bypass registration with an arbitrary repository link or manually point them at an unrelated user's running service. Per-app guides record reviewed original UI registration, owned engine installation, available provider paths and verified OS limits.
