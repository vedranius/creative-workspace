# Development handoff

Updated: 2026-10-11. Read this file, `../AGENTS.md`, and the relevant roadmap row before starting a bounded feature.

## Current milestone

- Completed: **VEC-01**, independent VectorCraft 0.8.0 server engine + original Rust JSONL shim, Node session adapter and own browser UI. SVG/native open, canvas creation, shape/freehand drawing, select/fill/stroke/move/delete/undo/redo, native save and SVG/PDF/PNG export/reopen work. Native Linux FUSE/laptop ACK/reopen and separate server output passed, originals preserved. **27 local tests**, locked install + shim fmt/clippy, isolated Chromium/mobile workflow passed.
- Next task: **DES-01**, audit a pinned DesignCraft source and choose the smallest actual native engine/browser open/edit/export/reopen adapter. Keep existing app sessions safe and prioritize creative apps over MCP/control-panel groundwork. Vector full tool parity, precise hit testing, text/pen handles, asset packaging and autosave remain separate follow-ups.
- Latest user steering: the user was frustrated that only PhotoCraft appeared in an isolated preview. Restore one clear studio with RapidRAW and the implemented apps, then build the remaining creative adapters. MCP stays supplementary/deferred; its endpoint remains unimplemented. Read `mcp-adapter-audit.md` only when returning to that task. REC-03 version-safe laptop replay remains pending.
- A completed save must mean the selected destination acknowledged it. Preserve uncertain outputs, surface recovery metadata after restart, and do not silently overwrite laptop originals.
- No other writer is assigned to this checkout. Read-only storage reviews completed. Hourly Codex continuation is active in the existing local conversation; this repo is not yet a saved Codex project, so do not invent a project ID for new repository threads.

## Working implementation and limits

Gateway: Node 24 ESM + `ws`; `src/server.js`, `src/storage-provider.js`, `src/vendor/storage/provider.js`. Owned RapidRAW relay identity is required. PhotoCraft has its own Rust CLI per session, `src/photocraft.js`, UI in `public/photocraft/`. PdfCraft uses `src/pdfcraft.js`, `public/pdfcraft/`, `engines/pdfcraft/native/` and `scripts/manage-pdfcraft.mjs`. VectorCraft mirrors this layout with `src/vectorcraft.js`, `public/vectorcraft/`, `engines/vectorcraft/` and its own installer/smoke. Common browser folder agent is in `public/storage/`.

RapidRAW, PhotoCraft, PdfCraft and VectorCraft native Linux flows work. PdfCraft stages only selected documents in a private per-session root because upstream automation has one root; its non-mutating export-copy method preserves undo and stays dirty until destination ACK. Server copies publish atomically under new names; laptop output uses an exclusive new file and common provider ACK/recovery. VectorCraft reads directly from its confined source root and stages only output; only a native save marks clean after ACK, exports alone retain dirty state. One document/session, 64 MB input/output, at most four sessions; multi-file exports refused before publication. Other four ArtCraft adapters remain pending. PDF open/export limit: 128 MB, eight documents/session. Full original UI parity, real user directory-picker permissions, stress, native Windows/macOS, multi-user and engine-enabled Docker remain unverified. Do not label pending adapters installed or fully supported.

Checks: `npm run check`, `npm test` (27 tests); `scripts/smoke-vectorcraft.mjs` with own Vector/FUSE binaries; shim fmt/clippy. Previous PDF/Photo native proofs remain; gateway regression suite passed. PDF-01 CI [38090307626](https://github.com/vedranius/creative-workspace/actions/runs/38090307626) passed on Linux/Windows/macOS. Verify VEC-01's latest commit CI before further changes. CI checks the gateway, not native engines on all OSes. Scratch browser test is `work/browser-qa/vectorcraft-ui.mjs`; reports/screenshots are in the task outputs. Generated documents and isolated browser profile only; real directory-picker permission was not automated. Sandbox Node tests initially crashed under denied socket access; the authorized isolated tests outside that sandbox passed. No permission blocker remains.


## Local development host

Repo: `/home/vedran/Documents/Codex/2026-10-10/da-x20/outputs/creative-workspace`.
Scratch/runtime: `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/`.
**Canonical current studio: `http://127.0.0.1:8792/`**. RapidRAW `/apps/rapidraw/` uses owned relay `8791`; PhotoCraft `/apps/photocraft/`; PdfCraft `/apps/pdfcraft/`; VectorCraft `/apps/vectorcraft/`. Available editors sort first; dashboard clearly shows `4 available · 4 planned` and MAIN STUDIO. Port `8780` belongs to the user's separate installation; never connect to or stop it.

The current studio's process metadata/logs are in `work/runtime/creative-studio/`; launcher `work/scripts/start-creative-studio.mjs`. Its independent state was initialized from the old studio configuration and points at the existing allowed application workspaces. Do not overwrite that state from the legacy service. Its new sessions can contain user work: inspect PID/command and save state before any restart. VEC-01 refreshed this same port only after confirming zero Photo sessions, no active shares and only our saved generated PDF test; that test was closed without discard. Legacy services and the separate owned RapidRAW engine remained running.

Detached service records/logs are in `work/runtime/local-services/` outside the repository. Check recorded PIDs and command lines before stopping a process. The user may have an unsaved document: use a separate temporary test port and storage roots; restart the live service only when safe.

**Legacy 8788** was left running its previous backend to protect an open PhotoCraft session; RapidRAW was verified ready there and its browser landing page opened. Do not advertise it as the latest portal or restart it blindly. New features are active on 8792.

**Isolated legacy PhotoCraft preview 8789** deliberately disables RapidRAW, which caused the user's confusion. It has independent data under `work/runtime/recovery-preview/` and open sessions; keep it intact until their work is saved. Direct the user to 8792, not this preview. Do not silently delete or migrate its documents.

Existing native binaries, avoid needless rebuilds:

- `work/runtime/photocraft/build/release/photocraft-cli`
- `work/runtime/storage/build/release/cw-filesystem-helper`
- `work/runtime/rapidraw/build/release/cw-rapidraw-engine`
- `work/runtime/pdfcraft/build/release/cw-pdfcraft-engine`
- `work/runtime/vectorcraft/build/release/cw-vectorcraft-engine`

Use `CW_PHOTOCRAFT_BINARY`, `CW_PDFCRAFT_BINARY`, `CW_VECTORCRAFT_BINARY` and `CW_FUSE_BINARY` with these absolute paths for isolated tests. RapidRAW launcher uses `CW_RUNTIME_DIR=.../work/runtime/rapidraw`, `CW_RAPIDRAW_SOURCE=.../work/rapidraw-web`, `CW_RAPIDRAW_WORKSPACE=<repo>/workspaces/photography`. PdfCraft pinned source is `work/pdfcraft`, with our shim copied into `apps/cw-pdfcraft-engine`; upstream library code is unchanged. Vector pinned source is `work/vectorcraft` (`96344f07`), shim copied into `apps/cw-vectorcraft-engine`; source libraries unchanged. Native source revisions and licensing are in manifests/engine READMEs.

## Publication and credentials

Remote: `https://github.com/vedranius/creative-workspace.git`, branch `main`. Publication is authorized. Use secure existing `gh` authentication if available; never put tokens in prompts, files committed to Git, URLs or tool output. The connector previously selected a different account: verify CLI identity before a write. Local private credential paths and service details live outside this public repo.

Local git commits may use `git -c user.name=Codex -c user.email=codex@users.noreply.github.com commit ...` without changing global identity. Do not force push. Re-read status before staging and do not include unrelated user changes.

## Next handoff template

Replace the current milestone section after each bounded task with: task ID/status; final commit; changed behavior; checks and evidence; material limitations; next ready task. Keep this document compact. Keep runtime IDs and secrets out of public handoffs.
