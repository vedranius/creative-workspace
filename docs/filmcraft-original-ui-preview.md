# ORG-FIL-UI — FilmCraft original UI preview

Date: 2026-10-11. This is a runnable browser preview of the pinned original FilmCraft app. The browser UI and processing engine come from the same upstream commit. The source build still owns its project, timeline, media, playback and export in local WASM/browser code; this is not the server-backed port.

## Source and reproducible build

- Upstream: [storytold/filmcraft](https://github.com/storytold/filmcraft), commit `4e2d0bc2d3646f9cf27ef7aa8b2095c6858c7efe`, version `0.6.0`; clean detached checkout at `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/filmcraft`.
- The original browser entry is `apps/filmcraft-web`; it uses the shared `filmcraft-ui-egui` and engine. The checkout declares `MIT OR Apache-2.0` and contains the corresponding license files. No upstream source patch was needed or copied into this repository.
- Toolchain: Rust `1.99.0`, target `wasm32-unknown-unknown`, `wasm-bindgen` CLI `0.2.129`. Existing Cargo/Rust caches were reused. The release WASM is 39,042,432 bytes, SHA-256 `e2aa63fdbe7807279bade6e3e77d3d016d4f41f078ec9940e41fb97d5d672bfa`. The low-impact wrapper limited this build to one Cargo job, two allowed CPUs and nice 10. `wasm-opt` was not installed, so the upstream optional optimization step was skipped.
- The output `work/original-ui/target/web/dist` is shared by the original-app build cache. LightCraft's stable output remains separately saved at `work/original-ui/lightcraft/dist/web`; do not serve LightCraft from the shared target directory.

Reproduce from the clean pinned checkout (the wrapper is required for local WASM builds on this host):

```sh
export CARGO_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/cargo
export RUSTUP_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/rustup
export CARGO_TARGET_DIR=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/target
export PATH=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/rustup/toolchains/1.99.0-x86_64-unknown-linux-gnu/bin:/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/cache/trunk/wasm-bindgen-0.2.129:$PATH
unset NO_COLOR
cd /home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/filmcraft
python3 /home/vedran/Documents/Codex/2026-10-10/da-x20/work/tools/low-impact-build.py cargo xtask web --serve 8818
```

`cargo xtask web --serve` builds the upstream `apps/filmcraft-web` into `target/web/dist`, verifies the CLI pin, and starts FilmCraft's localhost static server with COOP/COEP headers. The preview verified at [http://127.0.0.1:8818/?webgl](http://127.0.0.1:8818/?webgl). `?webgl` selects the original WebGL2 backend for this host's headless Chromium screenshot path. Generate a two-second H.264/AAC test clip beside `index.html` with:

```sh
ffmpeg -hide_banner -loglevel error -f lavfi -i testsrc2=size=320x180:rate=24 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 2 -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart -y /tmp/filmcraft-smoke.mp4
cp /tmp/filmcraft-smoke.mp4 /home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/target/web/dist/filmcraft-smoke.mp4
node apps/filmcraft-web/tests/smoke.mjs --url 'http://127.0.0.1:8818/?webgl' --media filmcraft-smoke.mp4 --chrome /home/vedran/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome --port 9339 --out /tmp/filmcraft-web-smoke
```

The upstream CDP smoke has no npm dependency. This repository keeps a compact report at [evidence/filmcraft-original-ui-report.json](evidence/filmcraft-original-ui-report.json).

## Browser proof

Google Chrome for Testing `151.0.7922.34`, viewport `1600×1000`, served from isolated localhost port `8818`. The server reported `crossOriginIsolated: true`; browser capabilities included WebCodecs AVC/VP9/AV1 and WebAudio. Chromium used SwiftShader software WebGL2 (`?webgl`), so measured rendering rates are not representative of a GPU-backed workstation.

- The original File menu opened and its Project Settings > General dialog rendered. The original Hand tool could be selected from the timeline tool rail. The demo canvas and multi-track timeline rendered in the same original FilmCraft interface.
- Demo playback advanced. A generated 320×180 H.264/AAC clip imported through the original browser bridge, opened as a sequence, and played. The smoke finished a 48-frame H.264 export (457,067 bytes; 1.04 s reported by the WebGPU/software run, 6.37 s in WebGL2/SwiftShader).
- Upstream import-bin gates all passed. Import-collision recovery preserved both same-named sources at distinct paths and recovered the project and sources. Modes and viewport-size checks completed. The smoke exited `ok: true`, with no Rust panic or uncaught JavaScript exception.
- Browser logs included software-rasterizer notices and the upstream web runner's unimplemented `SetTheme(Dark)` viewport-command warning; these did not fail the smoke. The WebGPU smoke also exited successfully, but its headless screenshots were black, so saved visual evidence uses WebGL2.

Screenshots:

- [Original canvas and timeline](evidence/filmcraft-original-ui-timeline.png)
- [Imported clip and sequence timeline](evidence/filmcraft-original-ui-imported-timeline.png)
- [Original File menu](evidence/filmcraft-original-ui-file-menu.png)
- [Project Settings dialog](evidence/filmcraft-original-ui-project-settings.png)
- [Selected Hand tool](evidence/filmcraft-original-ui-selected-tool.png)

## Scope and next step

This establishes that the pinned original FilmCraft browser UI can build and run, and demonstrates representative original menus, dialog, tool, canvas, timeline, playback, import, sequence creation and export in its local WASM mode. It does not establish native/browser feature parity, server-owned processing, server or laptop provider semantics, acknowledged saves, permission checks, recovery against a server, upstream staged updates, OS bundle support or product availability. Keep FilmCraft planned. Next preview: **ORG-FX-UI** (EffectCraft); then continue the concrete DesignCraft PAR-03 server Session/read-model/render seam.
