# ORG-LGT-UI — LightCraft original UI preview

Date: 2026-10-11. This records a runnable browser preview of the pinned original LightCraft app. The browser UI and engine both come from the same upstream commit; the app still processes and stores everything locally in WASM/OPFS. This is not a server-backed or accepted LightCraft port.

## Source and build

- Upstream: [storytold/lightcraft](https://github.com/storytold/lightcraft), commit `9e6c4c6fc9c7a7f192ce846c00ceb531e0f64dda` (`0.6.0`), clean detached checkout at `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/lightcraft`. The upstream source is dual licensed under MIT or Apache-2.0 (`LICENSE-MIT`, `LICENSE-APACHE`); no upstream source was copied into this repository. The separate owned LightCraft checkout contains ongoing LGT-01c work and was left untouched.
- Browser entry: `apps/lightcraft-web`, which runs the same `crates/ui-egui` UI and `lightcraft-engine` as the desktop app. No upstream source patch was needed.
- Upstream instructions: `AGENTS.md`, `docs/web.md`, and `apps/lightcraft-web/index.html`. The source recipe is `cargo xtask web`, which checks the pinned `wasm-bindgen` CLI, compiles `lightcraft-web` for WASM, generates the web bindings, copies the original shell/worker, and creates compressed assets.
- Toolchain: Rust `1.99.0` (`b940084d7`), `wasm32-unknown-unknown`, `wasm-bindgen 0.2.129`, and the shared target/cache at `work/original-ui`. Release build completed in 2m 19s; emitted `lightcraft_web_bg.wasm` is 21,177,477 bytes, SHA-256 `d60c279413f01512c36351330970e66ecedf5567e334f43d0435760b54df2d57`. Upstream emitted unused/dead-code warnings; the build succeeded. No `wasm-opt` pass ran.

Reproduce from the clean detached checkout with the existing isolated tools and cache:

```sh
export CARGO_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/cargo
export RUSTUP_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/rustup
export CARGO_TARGET_DIR=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/target
export PATH=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/rustup/toolchains/1.99.0-x86_64-unknown-linux-gnu/bin:/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/cache/trunk/wasm-bindgen-0.2.129:$PATH
cd /home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/lightcraft
cargo xtask web
python3 -m http.server 8817 --bind 127.0.0.1 --directory /home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/target/web
```

Preview URL: [http://127.0.0.1:8817/](http://127.0.0.1:8817/). The temporary static server served only the generated source build; no studio service or other preview was restarted.

## Browser evidence

Playwright `1.64.0` drove Chromium for Testing `151.0.7922.34` in fresh isolated contexts at `1440×1000`, device scale `1`. The app created its generated demo library with 24 photos and seven albums. The original File menu was opened, and `New Album…` opened the original modal. The right-hand Crop tool showed the original crop overlay and crop/geometry controls. Dragging the original Exposure slider changed `light.exposure` from `0` to `0.88` in `develop.get`; `library.info` advanced to sequence `1`, and the visible image became brighter. This interaction used the upstream application UI and WASM engine in an ephemeral browser context. The Codex In-app Browser on this host reported `WebGL isn't supported`; the proof screenshots and interaction evidence are from real Chromium for Testing instead.

The page had no JavaScript exceptions or failed requests. The upstream shell requested the optional `lightcraft_zh_hans.otf`, which is absent because `CRAFT_FONTS_DIR` was not available; that request returned HTTP 404 and LightCraft warned that Chinese-only glyphs may appear as boxes. English UI, panels, generated photos and the edit worked. The browser's visible warning also notes that OPFS persistence may be removed when browser storage is low. The missing font should be included in a future reproducible build when its licensed `craft-fonts` source is available.

- [Original app and demo canvas](evidence/lightcraft-original-ui-initial.png)
- [File menu](evidence/lightcraft-original-ui-file-menu.png)
- [New Album dialog](evidence/lightcraft-original-ui-new-album-dialog.png)
- [Crop tool and overlay](evidence/lightcraft-original-ui-crop-tool.png)
- [Exposure edit in the original Develop panel](evidence/lightcraft-original-ui-exposure-edit.png)
- [Machine-readable browser report](evidence/lightcraft-original-ui-browser-report.json)

## Scope and next step

This preview proves that the pinned original LightCraft browser app builds and runs. It does not prove server-owned processing, gateway auth/Origin/session/root guards, a common file provider, acknowledged server or laptop saves, recovery/conflict handling, real folder permissions, native-to-browser feature parity, upstream staged updates, or OS bundle support. Keep LightCraft planned in the catalog. The next original UI preview is **ORG-FIL-UI** (FilmCraft), then **ORG-FX-UI** (EffectCraft); after that continue the concrete DesignCraft PAR-03 server Session/read-model/render seam.
