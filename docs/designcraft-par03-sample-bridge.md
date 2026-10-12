# DesignCraft PAR-03 server read-model slice

Updated 2026-10-11 for alpha.13. This is a verified experimental vertical slice, not a server-backed DesignCraft port.

## Alpha.15 bounded edit bridge (2026-10-12)

The reviewed variant now also routes a fresh `file.new` document and pointer-drawn text frames through the server-owned native session. It forwards only the known `frame.create` method, maps page coordinates, reads the current revision inside a serialized browser queue, and shows the server PNG at the acknowledged revision.

- Reviewed patch variant: `par-03-server-edit-v1`; source pin `a127c6d5c3576972bbd60445f26d893db071eef3`; patch SHA-256 `17a1967cd6834bc8f73c4250512af97b2e61b65aa8af4e689a49d134442d99a8`.
- Native evidence: [report](evidence/designcraft-par03-server-edit-native.json): owned runtime; `file.new` revision 1; `frame.create` revision 2; 612×792 render digest changes.
- Browser evidence: [report](evidence/designcraft-par03-server-edit.json) and [screenshot](evidence/designcraft-par03-server-edit.png): two rapid gestures serialize to revision 3 and refresh the server render, with no uncaught browser errors. Foreign session/invalid Origin/stale revision return 404/403/409.
- Build used the pinned original UI through `low-impact-build.py` (Cargo jobs 1, two-CPU affinity, nice 10). WASM SHA-256 `a282fc2cd0528e0af4aa2c7316f733a0aedb09cdec3526f3f8fff42ea35026f8`; native candidate SHA-256 `0144df33abe4c89519d03bc564c740c4a28e47307a465ec1b136b82c75a505e8`.

This remains a bridge experiment. The screenshot shows the upstream local `DesignApp` still on its welcome screen with “No document open”; the server PNG is displayed over the original UI shell and local panel state is not synchronized. Pointer gestures create fixed demo story text; they do not yet follow the original tool-selection workflow. A freshly compiled native candidate also rejected `doc.sample` with `Unsupported workspace layout method`, so this edit path starts with verified `file.new`; investigate the sample discrepancy before restoring that flow. Keep DesignCraft planned. Full action/state parity, save destination/retention, write ACK, reopen and recovery remain required.

## Source and build

- Original source: `storytold/designcraft` commit `a127c6d5c3576972bbd60445f26d893db071eef3` (UI and engine use the same pin).
- Reviewed UI variant: `par-03-server-read-model-v2`, patch [par-03-server-sample.patch](../patches/designcraft/a127c6d5/par-03-server-sample.patch), SHA-256 `a72bd8e7bb0302ddae7bd35ee8df6df6bb35ab8164b1c2973d436db99b87c3c2`.
- Build script: `npm run ui:designcraft:par03 -- <clean-pinned-checkout> <output-dir>`. It requires the exact source pin and a clean checkout, applies only the reviewed patch, then runs `trunk build --release` through the host low-impact wrapper. Toolchain used: Rust `1.99.0`, `wasm32-unknown-unknown`, Trunk `0.21.14`.
- Candidate WASM: 38,531,640 bytes; SHA-256 `a282fc2cd0528e0af4aa2c7316f733a0aedb09cdec3526f3f8fff42ea35026f8`. The Rust/WASM bytes are unchanged; the reviewed source change is the browser bridge.

## Verified behavior

Opening the original UI with `?serverSample&webgl` creates a same-origin Creative Workspace session and sends the allowlisted `doc.sample` operation. The native worker executes the original `file.newSample` command; arbitrary command IDs are not forwarded by this bridge. The response binds state revision `1` to a same-origin preview URL and a bounded document read model. The original canvas presentation now reflects the server-owned title `Quarterly — Spring Issue`, four pages and unsaved state alongside the server PNG (612×792). The original DesignApp still has its empty local Session; this does not synchronize its panels or turn its other handlers into server operations.

The isolated system-Chrome/Playwright run loaded the registered candidate package and owned native worker at a temporary localhost port. It reported `file.newSample`, revision `1`, title `Quarterly — Spring Issue`, four pages, dirty state `true`, and a 612×792 PNG; no browser errors occurred. Stale revision, foreign session and invalid Origin returned 409, 404 and 403. The report records the preview digest and session cleanup.

A separate live Codex In-app Browser check visibly rendered the original DesignCraft menu bar, tool rail, Properties/Pages/Layers panels and the same server page/read-model banner. Playwright's headless screenshot captured the server page and read-model values but omitted the original canvas chrome, so the old original-UI screenshot remains the saved visual reference and the new screenshot is limited to read-model/render evidence.

The read-model screenshot is [designcraft-par03-read-model-original-ui.png](evidence/designcraft-par03-read-model-original-ui.png); machine-readable results are in [designcraft-par03-read-model-browser.json](evidence/designcraft-par03-read-model-browser.json). Original UI context is preserved in [the earlier visual screenshot](evidence/designcraft-par03-original-ui.png). `npm run check`, `npm run release:validate`, `git diff --check`, the full Node suite (45/45), native worker smoke, and the browser guard/render smoke passed.

## Scope still pending

The original `DesignApp`, menus, tool IDs and browser shell remain upstream. Only `file.newSample` is sent to the server; only title/page-count/dirty fields from its read model are reflected in the canvas presentation. The `DesignApp` local `Session` remains empty. Editing, pointer/tool ordering, state synchronization across other commands, save/provider ACK, recovery, full feature parity, update staging and OS/browser acceptance remain pending. Keep DesignCraft planned and do not describe the original application as available.

The new candidate has not yet been built by GitHub Actions. Its local WASM build is development evidence only; do not claim a downloadable or cross-platform asset until the alpha.13 draft release assets and checksums are verified.
