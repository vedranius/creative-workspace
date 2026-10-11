# DesignCraft PAR-03 bounded server sample bridge

Updated 2026-10-11. This is a verified experimental vertical slice, not a server-backed DesignCraft port.

## Source and build

- Original source: `storytold/designcraft` commit `a127c6d5c3576972bbd60445f26d893db071eef3` (UI and engine use the same pin).
- Reviewed UI variant: `par-03-server-sample-v1`, patch [par-03-server-sample.patch](../patches/designcraft/a127c6d5/par-03-server-sample.patch), SHA-256 `02f187a6e89d4d531485693844da8c8de0aa17f3945d10d878a2990639d04f7c`.
- Build script: `npm run ui:designcraft:par03 -- <clean-pinned-checkout> <output-dir>`. It requires the exact source pin and a clean checkout, applies only the reviewed patch, then runs `trunk build --release` through the host low-impact wrapper. Toolchain used: Rust `1.99.0`, `wasm32-unknown-unknown`, Trunk `0.21.14`.
- Candidate WASM: 38,531,640 bytes; SHA-256 `a282fc2cd0528e0af4aa2c7316f733a0aedb09cdec3526f3f8fff42ea35026f8`.

## Verified behavior

Opening the original UI with `?serverSample&webgl` creates an authenticated same-origin Creative Workspace session and sends the allowlisted `doc.sample` operation. The native worker executes the original `file.newSample` command; arbitrary command IDs are not forwarded by this bridge. The response binds state revision `1` to a same-origin preview URL. The browser loads the server PNG (612×792) into the original DesignCraft canvas presentation and shows its command ID and revision.

The isolated browser run used `http://127.0.0.1:8821/original/designcraft/?serverSample&webgl`, a fresh Codex In-app Browser tab, and the owned candidate worker. The original File, Edit, Layout, Type, Object, Table, View, Window and Help menus and the original toolbars/panels remained visible. The image reported `file.newSample`, revision `1`, width `612`, height `792`; no browser console errors occurred. The native smoke reported `ownedRuntime:true`, the same command and revision, a four-page sample, and PNG SHA-256 `a0f4b28af9304e3d567037a2cd5ab305d08d14078848d6862d3d7cb0f3d981d5`. Gateway rejection checks returned 404 for a foreign session and 403 for an invalid Origin. Session cleanup returned `{closed:true}` and the isolated service returned to zero active DesignCraft sessions before shutdown.

The real-browser screenshot is [designcraft-par03-original-ui.png](evidence/designcraft-par03-original-ui.png); machine-readable results are in [designcraft-par03-browser.json](evidence/designcraft-par03-browser.json). Verification: `npm run check`, `git diff --check`, full `npm test` (45/45), and `CW_DESIGNCRAFT_BINARY=/absolute/path/to/cw-designcraft-engine node scripts/smoke-designcraft-par03-server-sample.mjs` passed.

## Scope still pending

The original `DesignApp`, menus, tool IDs and browser shell remain upstream. This first slice sends only `file.newSample` to the server. The upstream `DesignApp` still has an empty local `Session`; its other source actions are not server-bridged, its panels/read-model do not yet reflect the server document, and the bounded PNG is presented over the original canvas area. Editing, pointer/tool ordering, state synchronization, save/provider ACK, recovery, full feature parity, update staging and OS/browser acceptance remain pending. Keep DesignCraft planned and do not describe the original application as available.

This WASM UI is not yet packaged as a new Actions-built release asset. The integration patch/build recipe and browser proof are committed source evidence only; do not claim cross-platform bundle availability.
