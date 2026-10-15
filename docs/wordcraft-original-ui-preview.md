# WordCraft original browser UI preview — alpha.41

**Upstream:** [storytold/wordcraft v0.7.0](https://github.com/storytold/wordcraft/releases/tag/v0.7.0), exact source commit `fc41918814f62645b6746ed68e71e8c2c2e85d6f`. The checkout at `build/wordcraft-source/repo` was clean at this commit. Source inspection covered upstream `AGENTS.md`, repository README, `apps/wordcraft-web/Trunk.toml`, its Cargo manifest, web packaging instructions, root license files, `NOTICE`, `ATTRIBUTION.md` and the separate `docs/brand/LICENSE-brand.txt`.

WordCraft is a clean-room Rust application; its code is MIT OR Apache-2.0. The built-in ArtCraft marks have a separate trademark license and were preserved unchanged with their license in package provenance. The upstream web entry is a static browser WASM app; it does not contain server processing. Upstream instructions identify `trunk build --release` in `apps/wordcraft-web`, with relative `./` asset URLs and WebGPU/WebGL2 rendering.

## Build and registration

The source was built from the pinned, clean checkout with upstream Trunk, the existing Rust 1.99/wasm target cache, one Cargo job, the low-impact host wrapper (two CPUs, niceness 10), and a separate output/target directory. `wasm-opt` completed; the resulting hashed WASM asset is 39,840,834 bytes. No upstream source edits or patch were applied. `scripts/install-original-ui.mjs` registered it under a separate staging root and created per-file SHA256 entries. The product pin is immutable; package root: `wordcraft/fc41918814f62645b6746ed68e71e8c2c2e85d6f`.

Build asset hashes:

- `index.html`: `b652a5ce6db086a0c2b91c75d357b9d00ed17672f1b0a633650fd7095a1a05b8`
- `wordcraft-web-7dd8f2cec3fee975.js`: `bcf168738f6d86c4812c8c736fb8b0382b37ec5b70c12c90d44285bd226a2d5b`
- `wordcraft-web-7dd8f2cec3fee975_bg.wasm`: `2ff802d0065f90c0ab92848e2beb7a580ec1030ffeb3d9eab05a168c8a419a2a`

## Isolated browser evidence

One isolated Chromium 151.0.7922.173 Playwright context opened the registered package via the Creative Workspace gateway on a new process, port `8801`, data root and workspace root. It loaded `?sample`, showed the original Home ribbon and two-page Studio Handbook, opened File backstage, edited a paragraph with the original text UI, saved a DOCX through WordCraft's browser download fallback, then used the original File > Open browser input to reopen that DOCX. The saved DOCX contains `Browser QA edit`; the reopened original UI displayed the handbook as Saved and 364 words. No uncaught page or console errors were recorded.

The Playwright harness supplied the already downloaded DOCX through WordCraft's original browser file input; this confirms the UI's browser open/edit/save/reopen flow, but does not prove native OS folder-picker permission or real laptop folder-provider semantics. The original web code explicitly runs document edit/layout/render/save locally in browser WASM. No server processing, server provider, laptop write acknowledgement, recovery, native desktop OS support, cross-browser acceptance or full WordCraft parity is claimed. Keep the WordCraft adapter planned.

- Original sample/ribbon and document: [screenshot](evidence/wordcraft-original-ui.png)
- Original File backstage: [screenshot](evidence/wordcraft-original-ui-file-menu.png)
- Edited document: [screenshot](evidence/wordcraft-original-ui-edited.png)
- Reopened saved document: [screenshot](evidence/wordcraft-original-ui-reopened.png)
- Machine-readable source/build/browser report: [evidence JSON](evidence/wordcraft-original-ui.json)
- Edited DOCX SHA256: `5ce792f9078ce4465cf63d5c361892f060b22733391b1abe182082e17a41b45f`

Actions build/archive and its release checksum are separate; local build bytes are not presented as release assets. The release workflow will build the browser preview archive from this same clean pin.
