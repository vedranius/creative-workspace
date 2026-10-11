# ORG-FX-UI — EffectCraft original UI preview

Updated: 2026-10-11. This is a runnable preview of the pinned original EffectCraft web app. Its native/shared UI and engine are compiled together to WASM. Document, composition, timeline, effects and rendering remain browser-local; this is not the server-backed port.

## Source and build

- Upstream: [storytold/effectcraft](https://github.com/storytold/effectcraft), clean detached checkout at `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/effectcraft`, commit `9a7d3e76991d5372448033b473dc12c2480a6a04`, version `0.8.0`.
- Original browser entry: `apps/effectcraft-web`; it runs the shared `effectcraft-ui-egui` and engine. No upstream patch was needed or copied into this repository. Upstream declares `MIT OR Apache-2.0` and ships both license texts.
- Build: Rust `1.99.0`, target `wasm32-unknown-unknown`, `wasm-bindgen` CLI `0.2.129`. Existing Cargo/Rust cache reused. `wasm-opt` was not installed; its optional optimization step was skipped.
- Release WASM: 60,271,793 bytes; SHA-256 `c3d087a2aba58c1b7703fd570ddd091f834dd3395a520bb6af541f0e157e5a41`.
- The low-impact build wrapper completed `cargo xtask web --serve 8819`. It limited the compile to one Cargo job, two allowed CPUs and nice 10. `target/web/dist` was previously the FilmCraft build; FilmCraft's static output was separately preserved in `work/original-ui/filmcraft-preview/dist` before this build.

Reproduce from the clean pinned checkout (use the wrapper for local builds on this host):

```sh
export CARGO_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/cargo
export RUSTUP_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/rustup
export CARGO_TARGET_DIR=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/target
export PATH=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/rustup/toolchains/1.99.0-x86_64-unknown-linux-gnu/bin:/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/cache/trunk/wasm-bindgen-0.2.129:$PATH
unset NO_COLOR
cd /home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/effectcraft
python3 /home/vedran/Documents/Codex/2026-10-10/da-x20/work/tools/low-impact-build.py cargo xtask web --serve 8819
```

Preview: [http://127.0.0.1:8819/?empty](http://127.0.0.1:8819/?empty). `cargo xtask web --serve` provides the original static app and COOP/COEP headers. `?empty` starts a blank local composition without restoring an earlier browser session. Existing previews on ports 8813–8817 were left running; 8818 was free at port selection.

## Browser proof

Codex In-app Browser loaded the pinned original WASM app at `http://127.0.0.1:8819/?empty&nosw`. Its screenshot showed the original menu bar and toolbar, Project/Effect Controls panels, Composition canvas, Preview/Properties panels and Timeline/Render Queue. The original File and Layer menus opened. The original Composition Settings dialog and Layer → New → Solid Settings dialog opened. The default composition (1920×1080, 29.97 fps) and a blue Solid layer were created through those original controls; the selected layer displayed transform handles, properties and a timeline row. These edits were confined to the blank local WASM preview project.

The CDP smoke was also run with upstream `apps/effectcraft-web/tests/smoke.mjs` using Chrome for Testing `151.0.7922.34`, headless SwiftShader and one temporary profile. It is **not green**: the page loaded and reported a 480×270 render frame (518,773 PNG bytes), but the test stopped at the frame-worker assertion. Both workers reported no WebGPU adapter; the page later showed its recoverable graphics-device-lost panel. This host result does not disprove the UI preview, which rendered in Codex In-app Browser, but the headless worker/GPU behavior remains unverified. The report and recovery-screen screenshot are in [the evidence folder](evidence/effectcraft-headless-webgpu-smoke-failure.json) and [device-loss screenshot](evidence/effectcraft-headless-webgpu-device-loss.png). Do not report the headless smoke as passed.

## Scope and next task

This proves that the pinned original EffectCraft interface builds and runs in a browser, with representative menus, composition/solid dialogs, selected layer, properties, composition canvas and timeline. It does not establish native/browser parity, server-owned processing, provider semantics, acknowledged saves, recovery/conflict behavior against a server, paired upstream updates, OS bundle support or product availability. Keep EffectCraft planned. The preview is not a server port. Next: continue the concrete DesignCraft PAR-03 `Session`/read-model/render seam in [the handoff](par-03a-handoff.md), then apply the server/provider/parity plan to the remaining original apps.
