# Screenshot provenance

The [README gallery](../README.md#screenshots) uses actual browser captures, not design mockups or replacement editor images. All captures were made on 2026-10-11. A screenshot establishes only the visible surface at its recorded build; it does not prove every original function, save acknowledgement, format, OS or server-provider path.

## Studio and RapidRAW

[Capture report](evidence/readme/capture.json): Creative Workspace `0.2.0-alpha.12`, Chrome for Testing `151.0.7922.34`, Playwright, one isolated 1600×1000 context, full-page PNGs. A temporary loopback gateway used separate state, copied immutable verified UI packages and a generated `README-demo.txt` inside a temporary demo root. No user file was imported or edited, and no live studio was restarted. Native ArtCraft prototypes were intentionally not started. GitHub update statuses are actual unchecked states, not simulated release results; recovery is genuinely empty in this demo.

| Capture | Visible behavior |
| --- | --- |
| [studio](evidence/readme/studio.png) | Eight catalog cards, original project credits, seven original-UI launch links and owned RapidRAW status. |
| [laptop import](evidence/readme/laptop-import.png) | Actual file/folder selection dialog, destination choice and upload limit. No directory permission or transfer was performed. |
| [server files](evidence/readme/server-files.png) | A generated demo file in an application-specific root; download UI. |
| [updates](evidence/readme/updates.png) | Eight upstream repositories and distinct unchecked state; no automatic compatible update claim. |
| [settings](evidence/readme/settings.png) | Authentication, update schedule, temporary allowed root and CLI installation scope. |
| [save recovery](evidence/readme/save-recovery.png) | Actual shared recovery dialog with zero records; not proof that another live editor has no unsaved work. |
| [RapidRAW](evidence/readme/rapidraw.png) | Original web welcome screen through the independently owned identity-checked adapter. Only read-only loading; no Continue Session, file choice, edit or save. The welcome photograph is upstream artwork credited in the UI to Timon Käch, not a user document. |

The existing owned RapidRAW service was used for read-only identity/settings and welcome-screen loading. The user's separate RapidRAW Web service was not contacted. The temporary documentation gateway and browser were closed after capture.

## Original ArtCraft interfaces

These are the actual original Rust/egui/WASM interfaces. The older custom HTML prototypes do not appear as app screenshots in the gallery.

| App | Upstream pin | README capture | Evidence and scope |
| --- | --- | --- | --- |
| PhotoCraft | `29d5f791d52cd54e411611a609fbc56949e0c653` | [Original welcome/tool panels](evidence/studio-original-ui/photocraft.png) | [Source/build/browser proof](photocraft-original-ui-preview.md); browser-local preview. |
| VectorCraft | `96344f07617edb24ab22fa08430ad1389042811d` | [Original welcome/presets and tool panels](evidence/vectorcraft-original-ui-canvas-edit.png) | [Source/build/browser proof](vectorcraft-original-ui-preview.md); browser-local preview. |
| PdfCraft | `9ccf77bdf685bc3cb0f545865c9f9b3e97ab5025` | [Demo annotation](evidence/pdfcraft-original-ui-annotation.png) | [Source/build/browser proof](pdfcraft-original-ui-preview.md); browser-local preview. |
| DesignCraft | `a127c6d5c3576972bbd60445f26d893db071eef3` + `par-03-server-sample-v1` | [Server-generated sample](evidence/designcraft-par03-original-ui.png) | [Bounded bridge evidence](designcraft-par03-sample-bridge.md); only sample command/render is server-backed. |
| LightCraft | `9e6c4c6fc9c7a7f192ce846c00ceb531e0f64dda` | [Generated exposure edit](evidence/lightcraft-original-ui-exposure-edit.png) | [Source/build/browser proof](lightcraft-original-ui-preview.md); browser-local preview, optional CJK font missing. |
| FilmCraft | `4e2d0bc2d3646f9cf27ef7aa8b2095c6858c7efe` + `mkv-pending-v1` | [Upstream demo timeline](evidence/studio-original-ui/filmcraft.png) | [Eight-case original-UI regression](filmcraft-mkv-import-handoff.md); browser-local upstream demo, not server media/render acceptance. The separate [Actions MKV capture](evidence/filmcraft-mkv-alpha10-original-ui.png) shows a synthetic imported bin item, not a populated sequence. |
| EffectCraft | `9a7d3e76991d5372448033b473dc12c2480a6a04` | [Upstream intro composition](evidence/studio-original-ui/effectcraft.png) | [Source/build/browser proof and GPU limitation](effectcraft-original-ui-preview.md); the rendered demo does not erase the separate headless GPU-worker failure. |

Each upstream application is credited and linked in the README. Screenshots retain its visual identity, demo artwork and applicable rights; see [licensing](../LICENSE.md). More menus/dialogs/tool screenshots and machine-readable reports remain in `docs/evidence/` and the individual evidence guides.

## CW identity

[Logo](brand/logo.svg) and [README banner](brand/banner.svg) are original vector assets created for Creative Workspace. They contain no upstream logo or proprietary font dependency. The mark combines an open blue C, dark W and rising orange arrow; cream/blue/orange matches the studio. Accessible SVG titles/descriptions are included. They are project assets under AGPL-3.0-only.

## Maintenance

When an accepted feature or upstream pin changes a visible surface, refresh the relevant screenshot in an isolated context with generated/demo content and update this provenance record. Keep the README version, capability matrix, release scope and links consistent. Do not replace screenshots with fabricated ready/update/save-success states, expose private user media or restart an unsaved live session for documentation.
