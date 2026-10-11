# PAR-02 — DesignCraft original UI browser preview

Date: 2026-10-11. This is an isolated runnable/source feasibility proof, not a completed ArtCraft port.

## Pinned source and build

- Upstream: `storytold/designcraft`, commit `a127c6d5c3576972bbd60445f26d893db071eef3`, app version `0.5.0`.
- Built from a clean detached worktree at `work/original-ui/designcraft`. The prior source checkout and its local engine shim were left untouched. The upstream UI required no source patch.
- Isolated toolchain: Rust `1.99.0`, target `wasm32-unknown-unknown`; Trunk `0.21.14` from the [official Linux release](https://github.com/trunk-rs/trunk/releases/download/v0.21.14/trunk-x86_64-unknown-linux-gnu.tar.gz), verified against its [published SHA-256](https://github.com/trunk-rs/trunk/releases/download/v0.21.14/trunk-x86_64-unknown-linux-gnu.tar.gz.sha256): `f2b4680cd239693a646a2795e4633c625328d7b2a044fbe749fa3a2fe9e7036b`.
- `trunk build --release` completed. Trunk used the upstream `wasm-opt -Oz` setting. Output WASM: 37 MiB, SHA-256 `4815ea941e39dcaf818cde8494d9d13779639face6ae97a6fcae9568ca3d755a`.
- The source worktree remained clean after building. No native engine rebuild or Creative Workspace adapter change was made.

## Browser proof

Trunk serves the pinned app locally at [http://127.0.0.1:8813/?sample&webgl](http://127.0.0.1:8813/?sample&webgl). Chromium for Testing `151.0.7922.34` with Playwright `1.62.1` loaded it at a fixed `1440×1000` viewport, device scale `1`, using a fresh isolated browser context. The `sample` query opens the upstream sample document in the upstream WASM `Session`; `webgl` selects the app's WebGL path. The page reported no JavaScript or console errors.

At this upstream pin, the shared native source declares nine menu headings (File, Edit, Layout, Type, Object, Table, View, Window, Help), 37 unique tool IDs in 21 tool groups. The browser screenshots show those menu headings, the sample canvas and original side panels, the shared File menu and Document Setup dialog, and the Pen group flyout with its four registered tools. This compares the visible browser source UI with its shared upstream registries; it is a focused visual check, not an exhaustive parity inventory or a native-app screenshot comparison.

- [Sample canvas and original chrome](evidence/designcraft-original-ui-a127c6d5-sample.png)
- [File menu](evidence/designcraft-original-ui-a127c6d5-file-menu.png)
- [Document Setup dialog](evidence/designcraft-original-ui-a127c6d5-document-dialog.png)
- [Pen tool group flyout](evidence/designcraft-original-ui-a127c6d5-tool-flyout.png)

## Remaining work

The preview is not integrated into the Creative Workspace gateway. The browser app still constructs and owns `Session`, document state, commands, pointer-tool effects and rendering in WASM. Its current file services use a browser picker and download shell; this does not prove user-granted folder permissions, provider modes, destination acknowledgement, save recovery, server execution, authenticated Origin/session/root isolation or native-to-browser functional parity. Keep DesignCraft planned and do not describe this as the accepted server-backed application.

Next: PAR-03 replaces the concrete `Session`/document read-model/renderer boundary with a server-owned backend while preserving original tool, command and action IDs and workflows. Future upstream updates must pin and stage the original UI and engine together from one verified revision, rebase the small portability/backend patch set, run UI/format/provider/parity checks, package the compatible set through Actions, and protect unsaved sessions with rollback.
