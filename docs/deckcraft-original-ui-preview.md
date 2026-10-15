# ORG-DECK-UI — original DeckCraft v0.7.0 preview

Reviewed upstream `storytold/deckcraft` at immutable commit `d78e657e4cb1e490ceb5445785c052d9cf5ad963`. The clean checkout builds through its original `apps/deckcraft-web` Trunk entry. It retains the original `SlideApp` and `Session`; no replacement editor or source patch is used. The upstream code is MIT OR Apache-2.0, and its separate ArtCraft mark terms are preserved in package provenance.

The optimized WebAssembly build completed with Rust 1.99.0, target `wasm32-unknown-unknown`, Trunk 0.21.14, and `wasm-opt -Oz`. Its static files were registered into a new immutable package root under the exact upstream pin. The registry reports `processing: browser` and `serverIntegrated: false`.

Chromium 151 opened the registered package through an isolated Creative Workspace server on port 8895. The original Home ribbon, slide thumbnails/navigation, eight-slide “Northern Lights” sample, canvas, notes/status area and Present control rendered; page and console errors were zero. Evidence report: [browser JSON](evidence/deckcraft-original-ui-browser.json); screenshots: [original presentation UI](evidence/deckcraft-original-ui.png) and [File backstage](evidence/deckcraft-original-ui-file-menu.png). Build hashes and source/licence hashes are in the report.

Upstream `README.md` documents optional `craft-fonts` in a sibling checkout. It was not present for this build; the original app therefore uses system fonts. The URL supports `?blank`, `?show` and `?webgl`; browser hosting needs WebGPU or WebGL2. This preview does not verify actual laptop file permission or folder writes.

DeckCraft remains planned. The browser WASM owns presentation state, editing, media decode, rendering and conversion. No owned server engine/action/state/render/export or common file-provider paths are connected; real browser permissions, destination write ACK/recovery, native OS support, cross-browser verification, and full original tool/action/dialog/format parity remain pending. Do not make a server availability claim from this preview.
