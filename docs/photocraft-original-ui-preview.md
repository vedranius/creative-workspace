# ORG-PC-UI — PhotoCraft original UI preview

Date: 2026-10-11. This proves the pinned original browser UI is runnable as an isolated local-WASM preview. It is not a server-backed or accepted PhotoCraft port.

## Source and build

- Upstream: [storytold/photocraft](https://github.com/storytold/photocraft), commit `29d5f791d52cd54e411611a609fbc56949e0c653`, app `0.6.0`; clean detached checkout at `work/original-ui/photocraft`.
- Browser entry: `apps/photocraft-web`; it constructs the shared upstream `PhotocraftApp` from `photocraft-ui-egui`.
- Tools: Rust `1.99.0` (`b940084d7`), `wasm32-unknown-unknown`; Trunk `0.21.14`; Cargo target cache reused from `work/original-ui/target`. The build compiled the pinned source and completed `trunk build --release` (optimized `wasm-release`, including upstream Trunk `wasm-opt -Oz`). No upstream source changes or portability patch were needed.
- Output WASM: 24,466,010 bytes, SHA-256 `12b8378f2fb59f71e765533d7ea4e50b7105fd133fbe0d77036226f6cf47d76c`.

Reproduce from the clean checkout; `CARGO_HOME` and `RUSTUP_HOME` point to the isolated installed toolchain, so no tool or dependency download is required when its cache is present:

```sh
export CARGO_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/cargo
export RUSTUP_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/rustup
export CARGO_TARGET_DIR=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/target
export PATH=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/bin:$PATH
unset NO_COLOR  # this host exports NO_COLOR=1; Trunk treats that value as an invalid boolean
cd /home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/photocraft/apps/photocraft-web
trunk build --release
mkdir -p ../../dist/web/fonts
: > ../../dist/web/fonts/manifest.txt
: > ../../dist/web/favicon.ico
python3 -m http.server 8814 --bind 127.0.0.1 --directory "$PWD/../../dist/web"
```

The two empty files are generated preview-host resources: the upstream web host probes its optional served-font manifest, and browsers request a favicon. They silence expected static-host 404s; built-in PhotoCraft fonts remain bundled. The preview is at [http://127.0.0.1:8814/?webgl](http://127.0.0.1:8814/?webgl). Stop only this `http.server` process when finished.

## Browser evidence

Chromium for Testing `151.0.7922.34`, Playwright `1.62.1`, fresh isolated context, `1440×1000`, device scale `1`. Browser startup, upstream `PhotocraftApp`, dialogs and canvas interactions completed with zero console/page errors and zero failed HTTP resources. The original top-level menus visible in the browser are File, Edit, Image, Layer, Type, Select, Filter, View, Window and Help. Upstream `Tool::ALL` registers 53 tool IDs. Right-clicking the original Brush toolbar button opened its three-entry Brush Tool / Pencil Tool / Mixer Brush Tool group. The browser created an upstream 1920×1080 document and a real brush pointer gesture changed its canvas; the Layers panel showed the Background layer, alongside Properties/Adjustments and Color/Swatches/Gradients/Patterns panels.

Screenshots from the fresh browser contexts:

- [Original shell](../evidence/photocraft-original-ui-initial.png)
- [File menu](../evidence/photocraft-original-ui-file-menu.png)
- [New Document dialog](../evidence/photocraft-original-ui-new-document.png)
- [Original tool group](../evidence/photocraft-original-ui-tool-group.png)
- [Created canvas and panels](../evidence/photocraft-original-ui-canvas.png)
- [Canvas after an original brush gesture](../evidence/photocraft-original-ui-sample-canvas.png)

## Scope and next step

This WASM preview owns its document, editing and rendering in the browser. File Open uses the upstream browser picker and save/export uses a browser download. No real user directory permission, server processing, common provider mode, server save acknowledgement/recovery, gateway auth/Origin/session/root isolation or native-to-browser parity was tested. Keep PhotoCraft's product availability pending. The next bounded original UI preview is **ORG-VC-UI** for the pinned VectorCraft source; after the original UI preview sequence, continue the DesignCraft server Session/read-model/render seam.
