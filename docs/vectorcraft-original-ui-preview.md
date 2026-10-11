# ORG-VC-UI — VectorCraft original UI preview

Date: 2026-10-11. This records a runnable isolated preview of the pinned upstream browser application. It does not establish a server-backed or accepted VectorCraft port.

## Source and build

- Upstream: [storytold/vectorcraft](https://github.com/storytold/vectorcraft), commit `96344f07617edb24ab22fa08430ad1389042811d`; clean detached checkout at `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/vectorcraft`.
- Browser entry: `apps/vectorcraft-web`, which runs the shared upstream `VectorcraftApp` from `vectorcraft-ui-egui`.
- Upstream build instructions are in `docs/development.md` and the root `README.md`: install/use Trunk and the `wasm32-unknown-unknown` target, then run `trunk build --release` from `apps/vectorcraft-web`. No upstream source patch was needed.
- Toolchain: Rust `1.99.0` (`b940084d7`), `wasm32-unknown-unknown`, Trunk `0.21.14`; shared isolated Cargo target cache under `work/original-ui/target`. Release compile completed in 6m 03s. Trunk's post-build font hook ran `cargo xtask web-fonts`.
- Generated WASM: 50 MiB, SHA-256 `3df66593734eb76190abd460168b7cce93087fdbcce9ebdb6d4baa7a95a82a86`.

Reproduce with the existing isolated toolchain and cache:

```sh
export CARGO_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/cargo
export RUSTUP_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/rustup
export CARGO_TARGET_DIR=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/target
export PATH=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/bin:$PATH
unset NO_COLOR
cd /home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/vectorcraft/apps/vectorcraft-web
trunk build --release
python3 -m http.server 8815 --bind 127.0.0.1 --directory /home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/vectorcraft/dist/web
```

Preview: [http://127.0.0.1:8815/](http://127.0.0.1:8815/). `favicon.ico` is an empty generated host resource to avoid a static-host favicon 404; upstream fonts are embedded and the font hook copies the upstream browser font assets. This preview is a separate localhost static server and does not restart or connect to any studio, engine, or user service.

## Browser evidence

Chromium for Testing `151.0.7922.34`, isolated browser context, viewport `1440×800`, device scale `1`. The original welcome screen rendered, then the original New Document preset dialog created an `Untitled-1` document. The File menu exposed the original New/Open/Save/Export/Document Setup/Print commands. Document Setup opened from the Properties panel. Right-clicking the Pen toolbar tool showed Pen Tool, Add Anchor Point Tool, Delete Anchor Point Tool, and Anchor Point Tool. An original Rectangle tool drag created a shape on the document canvas; Properties changed to rectangle transform, appearance, alignment, and quick actions.

No page errors, console errors, failed requests, or HTTP error responses remained after adding the optional empty favicon resource to the generated preview host. Screenshots are captured from the fresh Chromium context:

- [Original welcome and workspace](evidence/vectorcraft-original-ui-initial.png)
- [Original File menu](evidence/vectorcraft-original-ui-file-menu.png)
- [New Document dialog](evidence/vectorcraft-original-ui-new-document.png)
- [Document Setup dialog](evidence/vectorcraft-original-ui-document-setup.png)
- [Pen and node tool group](evidence/vectorcraft-original-ui-pen-tools.png)
- [Changed canvas and Rectangle properties](evidence/vectorcraft-original-ui-canvas-edit.png)

## Scope and next step

This preview owns document state, editing, and rendering inside the browser WASM app. Open/save use its browser file picker/download flows. No server processing, provider mode, acknowledged server save, real user folder permission, gateway auth/Origin/session/root isolation, or native-to-browser parity was tested. Keep VectorCraft product availability and server/provider integration pending. Next original UI preview: **ORG-PDF-UI**.
