# ORG-PDF-UI — PdfCraft original UI preview

Date: 2026-10-11. This is a runnable isolated preview of the pinned upstream browser application, not a server-backed or accepted PdfCraft port.

## Source and build

- Upstream: [storytold/pdfcraft](https://github.com/storytold/pdfcraft), commit `9ccf77bdf685bc3cb0f545865c9f9b3e97ab5025`; clean detached checkout at `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/pdfcraft`.
- Browser entry: `apps/pdfcraft-web`; it constructs the shared upstream `PdfCraftApp` from `pdfcraft-ui-egui`.
- Upstream instructions: `AGENTS.md`, `CLAUDE.md`, `docs/development.md`, `packaging/web/README.md`, and `apps/pdfcraft-web/Trunk.toml`. The app's startup `?file=<URL>` path fetches a same-origin or CORS-enabled PDF into the original WASM UI.
- Toolchain: Rust `1.99.0` (`b940084d7`), target `wasm32-unknown-unknown`, Trunk `0.21.14`; Cargo cache and target directory reused from `work/original-ui`. `trunk build --release` completed successfully; Rust release compilation took 4m 30s and `wasm-opt` then completed. The emitted WASM is 34,974,666 bytes with SHA-256 `2bc98b7b1dceb6a48f859d3805fb152894cf7924ad519624be98588b79524cbe`. Upstream emitted five existing dead-code warnings across `pdfcraft-render` and `pdfcraft-ui-egui`.
- No upstream source patch was needed. An empty `favicon.ico` was added only to the generated static host after the browser's optional favicon request initially returned 404.

Reproduce with the existing isolated toolchain and cache:

```sh
export CARGO_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/cargo
export RUSTUP_HOME=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/rustup
export CARGO_TARGET_DIR=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/target
export PATH=/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/toolchain/bin:$PATH
unset NO_COLOR
cd /home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/pdfcraft/apps/pdfcraft-web
trunk build --release
cp /home/vedran/Documents/Codex/2026-10-10/da-x20/outputs/creative-workspace/docs/evidence/pdfcraft-original-ui-sample.pdf ../../dist/web/sample.pdf
touch ../../dist/web/favicon.ico
cd ../../dist/web
python3 -m http.server 8816 --bind 127.0.0.1
```

Preview: [http://127.0.0.1:8816/?file=sample.pdf](http://127.0.0.1:8816/?file=sample.pdf). The preview is a separate static server; no studio, native engine, other preview, or user service was restarted or contacted.

## Browser evidence

Playwright `1.64.0` drove Chromium for Testing `151.0.7922.34` in a fresh isolated context at `1440×1000`, device scale `1`. Chromium used its SwiftShader WebGL path. The browser loaded the generated one-page `sample.pdf` through the upstream `?file=` route. The page contains only contributor-created text and vector shapes; its SHA-256 is `42962525aca44020f35c9f52cb42e4aff9d4de79a81b5ef1ca3084273f517cd6`.

The original `Menu` exposed File, Edit, Pages, View and Help; the File submenu showed the pinned app commands. `File > Document properties` opened the original dialog with Description, Initial View, Security, Fonts and Advanced tabs. The original sticky-note tool placed and posted “Browser annotation proof” on the generated page; the Comments panel showed one note and the document tab showed unsaved changes. This is a real original UI interaction in the browser, not a static screenshot mockup.

Final browser runs had no page errors, console errors, failed requests or HTTP error responses. The host returned 200 for the HTML, JavaScript, WebAssembly, fixture PDF and optional empty favicon. No unsupported content was encountered in the simple one-page fixture; this does not test complex PDF features or establish general rendering coverage. Screenshots and machine-readable browser details:

- [Rendered original PDF page](evidence/pdfcraft-original-ui-sample.png)
- [Original menu and File submenu](evidence/pdfcraft-original-ui-file-menu.png)
- [Document Properties dialog](evidence/pdfcraft-original-ui-document-properties.png)
- [Posted sticky-note annotation](evidence/pdfcraft-original-ui-annotation.png)
- [Browser report](evidence/pdfcraft-original-ui-browser-report.json)
- [Synthetic one-page PDF fixture](evidence/pdfcraft-original-ui-sample.pdf)

## Scope and next step

PdfCraft's document state, annotation edit and render all ran locally inside the upstream browser WASM application. The static server only served files. The observed load route was a same-origin URL; open/save otherwise use the app's browser picker/download flows. No Creative Workspace server processing, gateway auth/Origin/session/root isolation, common provider mode, acknowledged save, real folder permission, native-to-browser parity, large/complex-PDF coverage, or product availability was established. Keep PdfCraft pending in the catalog.

Next original UI preview: **ORG-FIL-UI** (FilmCraft); LightCraft preview evidence is in [its handoff](lightcraft-original-ui-preview.md).
