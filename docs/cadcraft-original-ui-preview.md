# ORG-CAD-UI — original CADCraft v0.7.0 browser preview

The unchanged original `storytold/cadcraft` web application builds from exact clean source pin `fc4e98315a8d771b5ab832f0ade0b5e7b106df7f`. Its web entry is `apps/cadcraft-web`; source attribution, MIT/Apache license texts and ArtCraft brand terms are preserved in the immutable per-pin registration manifest. The static archive is browser WASM content, not a server CAD adapter.

## Build and registration

`npm run ui:cadcraft:build -- <pinned-source> <static-output> <package-root>` builds the upstream Trunk release output, verifies the exact clean source revision, registers it under a new immutable package directory and creates a separate browser-preview archive plus SHA256 sidecar. The local build used Rust 1.99.0, Trunk 0.21.14, existing Cargo cache and `python3 /home/vedran/Documents/Codex/2026-10-10/da-x20/work/tools/low-impact-build.py`; observed `trunk`, `cargo`, and `wasm-opt` ran at nice 10. One Cargo job was used. The optimized WASM is 22,546,717 bytes, SHA-256 `f221b19a2dfc3939782a39081f53cf3826c1350ed8a332ad145db5097b968c92`.

## Browser evidence

One isolated Chromium 151 context opened `/original/cadcraft/?webgl&sample` from an isolated Creative Workspace server on port 8896. It rendered the original bracket drawing, File menu and full original drafting layout. The original command line accepted `CIRCLE 22,3 1`; the added circle remained visible after `Ctrl+S` downloaded `Bracket.dxf` and the original File > Open reopened that download. The download was 41,311 bytes with SHA-256 `a994f126a601f311d6d02c14b468446bdf9142511ac61424a76c9d1c5990a236`. Chromium recorded zero page errors, console errors or failed requests. The automated browser supplied the file to the original browser chooser; this is not real OS permission or laptop-provider evidence.

- [Original sample drawing](evidence/cadcraft-original-sample.png)
- [Original File menu](evidence/cadcraft-original-file-menu.png)
- [Edit, save and reopened drawing](evidence/cadcraft-original-edit-save-reopen.png)
- [Build and browser report with hashes](evidence/cadcraft-original-ui-preview.json)

## Acceptance boundary

CAD commands, geometry, rendering and file conversion execute locally in browser WASM. No owned server engine, server action/state/render/export bridge, common provider, real browser permission, destination write acknowledgement, recovery, native OS support, staged engine/UI activation or complete original menu/tool/dialog parity is claimed. Keep CADCraft planned until its separate server/provider acceptance passes, including units/precision, representative format round-trips, bounds, save/reopen and all four provider paths.
