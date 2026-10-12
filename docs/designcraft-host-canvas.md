# DesignCraft original UI server action candidate

Creative Workspace alpha.26 extends the bounded candidate based on upstream DesignCraft `a127c6d5c3576972bbd60445f26d893db071eef3`. It retains the original `DesignApp` and its A4 welcome-screen preset card. This is an unregistered partial port; DesignCraft remains planned.

The actual preset click queues original `file.new` and its preset parameters. The owned gateway/worker creates the document and returns a revisioned canonical snapshot, dirty state and bounded server PNG. The browser validates the ACK, snapshot and same-session preview before hydrating a read-only original UI mirror. The original canvas displays the server PNG as an egui texture; its local document renderer and pointer/tool path are bypassed. Image decoding and displaying the preview remain browser presentation work.

The alpha.21 candidate extends this document action with the original Rectangle Tool edit and Undo paths described in the [PAR-03 handoff](par-03a-handoff.md#original-edit-undo-candidate-2026-10-12-not-accepted). Other original commands and tools remain blocked instead of running locally.

## Original Save Copy

The original File → Save a Copy… dialog now submits upstream `file.saveACopy` to the owned worker. The user sees and must confirm an explicit server workspace path and `Keep in workspace` retention. The native worker writes into a unique private staging directory; the gateway checks the bounded regular file and native byte count, then atomically creates the new workspace path without replacing an existing output. It returns success only after the final server write acknowledges the same byte count. The original file name and dirty state remain unchanged; the command never calls `mark_saved`.

Laptop output is rejected with `WRITE_ACK_REQUIRED` because the browser file system access API has no write-ACK flow here. Temporary/managed retention is rejected. This slice does not prove interrupted-write recovery, laptop permissions, folder modes or full app parity. The exact cumulative source pin, patch and limits are recorded in the [candidate manifest](../engines/original-ui/designcraft/host-canvas.json) and [source patch](../patches/designcraft/a127c6d5/par-03-save-copy-candidate.patch).

## Original Rectangle Tool edit candidate

The separate [PAR-03 `frame.create` candidate](par-03a-handoff.md#current-edit-action-candidate-2026-10-12-not-accepted) keeps the original `DesignApp` and adds one real edit path: original Rectangle Tool `M` shortcut + drag → ordered server `frame.create` → ACKed canonical mirror and server PNG. Build and behavior evidence are in the [native/build report](evidence/designcraft-par03-frame-create-candidate-native.json) and [Chromium report/screenshot](evidence/designcraft-par03-frame-create-candidate-browser.json). Exact pin, patch SHA and limitations are in the [candidate manifest](../engines/original-ui/designcraft/frame-create-candidate.json).

This candidate is not registered or activated. Other original actions/tools, provider paths, destination ACK/save/reopen/recovery and complete parity remain unfinished; catalog and release availability stay planned.

## Alpha.21 edit and Undo extension

The alpha.26 Actions candidate uses the cumulative [Save Copy manifest](../engines/original-ui/designcraft/host-canvas.json). The original Open browser smoke selects a native file, edits/undoes it, submits Save Copy through the original shortcut/dialog, checks the `file.saveACopy` HTTP ACK and retained server output, verifies the active document remains dirty with its original filename, rejects a target collision, and reopens the retained bytes through the original chooser. It also proves cancellation and failed/oversized input handling. Laptop save, other retention modes, recovery and complete original parity remain pending.

## Reproduce without touching a live studio

Use a new clean checkout at the exact upstream pin, Rust 1.99.0 with `wasm32-unknown-unknown`, and checksum-pinned Trunk 0.21.14. `npm run ui:designcraft:host -- <clean-source> <new-assets>` checks the exact reviewed cumulative source patch/digest before and after building. The Actions candidate manifest is [host-canvas.json](../engines/original-ui/designcraft/host-canvas.json). It remains separate from the registered immutable original-UI package.

Run `scripts/smoke-designcraft-file-open-candidate.mjs` with `CW_DESIGNCRAFT_UI_ASSETS`, `CW_DESIGNCRAFT_BINARY`, and `CW_PLAYWRIGHT_MODULE`; optionally set `CW_BROWSER_EXECUTABLE`, `CW_PAR03_REPORT` and `CW_PAR03_SCREENSHOT`. It uses one disposable loopback gateway, one owned native worker and a real Chromium context; it clicks the original chooser, uses the original File Save Copy shortcut/dialog, checks gateway receipts and server bytes, and reopens the retained copy through the original chooser. It never writes back to the selected laptop source. This remains browser simulation of the original UI, not real user-granted folder permission testing.

## Local evidence (2026-10-12)

- Original A4 card center `[778,467]` at 1440×1000 caused actual `file.new` and preset `A4`; ACK revision 1, canonical snapshot 6,873 bytes, 595×842 server PNG.
- Original canvas/panels are visible; screenshot pixel gate counts 524,966 bright pixels and at least 64 distinct colors. Unbridged gestures/shortcuts do not generate another RPC or advance the revision. An injected 503 preview failure leaves revision 0 and no hydrated/rendered mirror.
- No uncaught browser errors on the successful path or page exceptions in the failure path. [Report](evidence/designcraft-par03-host-canvas.json) · [Screenshot](evidence/designcraft-par03-host-canvas.png).
- Local candidate WASM SHA256: `09563e9daa73ab7a630b95ed701331ea95bee86ab16e4d05a801fbf16316ac97`. `npm run check`, 48/48 `npm test`, release validation and exact source-diff/digest checks pass.
- Initial QA exposed two environment issues: Chromium Unix-socket paths exceeded the limit with the long project TMPDIR, and the old SwiftShader launch flag produced a uniformly dark screenshot. A short symlink to disk-backed scratch and ANGLE/SwiftShader launch flags fixed them; visual pixel validation now rejects the dark result. Local bytes are not release assets.

![Original DesignCraft server-owned A4 canvas](evidence/designcraft-par03-host-canvas.png)

## Alpha.26 Save Copy evidence (2026-10-13)

The exact cumulative candidate source patch is SHA256 `373f47736bbd6878e2ee79c9bba46bbb4a5cdf32aca973fbc270bb6ae0af994e`. The optimized local WASM build passes with SHA256 `7546ee5a72619e8acbcd7525bf300c929bd6cc6c64177e1c415222a1189a8560`; the native worker build passes through the low-impact wrapper with SHA256 `1d91d883afd1038f017e982f3364b49c44b3d4c723ec810f83cc302bd6544785`. `npm run check`, release validation and the full Node suite pass (53/53). The real worker/browser report verifies original Open → edit/Undo → File Save a Copy → ACKed server output → original chooser reopen; the selected input remains unchanged and the browser reports no errors. See [native/build evidence](evidence/designcraft-save-copy-native.json), [browser report](evidence/designcraft-save-copy-browser.json) and [screenshot](evidence/designcraft-save-copy-browser.png).

This is local candidate evidence. Alpha.26 tag, Actions checks, draft and six downloadable archive/checksum pairs are not yet verified. Keep the candidate separate from registered UI packages and the DesignCraft catalog planned.

## Installation and release scope

Alpha.26 is configured to build a separate `designcraft-host-canvas-candidate.tar.gz` archive and SHA256 sidecar covering Open, A4, frame creation/Undo and server-retained Save Copy. This is a review artifact, not a registered editor or a complete cross-platform creative bundle. Do not copy it over a running original-UI installation. Keep the release draft because laptop destination acknowledgement, alternate retention, recovery and full app parity remain incomplete. The candidate stays unregistered and does not make DesignCraft available.

Local build/QA uses a disk-backed temporary directory and the host low-impact wrapper (one Cargo job, at most two CPUs, nice 10). Previously downloaded release archives were preserved on disk to free about 1.1 GB of `/tmp` tmpfs. Protected application services and documents were not restarted.

Next: add the common provider's supported folder modes and browser-acknowledged laptop output, then recovery and broader editor parity. The current candidate is separate from the registered package and must not be copied over a live workspace.

Alpha.20's immutable draft release is verified: its tag points to `ee69c299aa6aee0d5bb907f132b87a0e8f5d4f6a`, with six Actions-built archive/checksum pairs verified after download; see [release evidence](evidence/creative-workspace-alpha20-release.md). Alpha.21 is a separate candidate and does not modify alpha.20.
