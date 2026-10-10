# Development handoff

Updated: 2026-10-11. Read this file, `../AGENTS.md`, and the relevant roadmap row before starting a bounded feature.

## Current milestone

- Completed: **PDF-01**, independent PdfCraft 0.5.0 engine + own Rust JSONL sidecar, Node session adapter and native browser UI. Create/open/render/rotate/move/delete/note/undo/redo/text/export/reopen work. Common folder modes and separate output destinations are integrated; selected-file FUSE/laptop save/reopen and server output passed. **22 local tests**, native PDF and PhotoCraft regressions, locked installer + shim fmt/clippy, and isolated browser/mobile workflow passed.
- Next task: **VEC-01**, audit the pinned VectorCraft source and implement the smallest actual native engine/browser open/edit/export/reopen workflow, retaining common file-provider modes and attribution. Prefer working creative apps over extra MCP/control-panel infrastructure. Do not mark a catalog entry available until native + browser evidence exists.
- Latest user steering: the user was frustrated that only PhotoCraft appeared in an isolated preview. Restore one clear studio with RapidRAW and the implemented apps, then build the remaining creative adapters. MCP stays supplementary/deferred; its endpoint remains unimplemented. Read `mcp-adapter-audit.md` only when returning to that task. REC-03 version-safe laptop replay remains pending.
- A completed save must mean the selected destination acknowledged it. Preserve uncertain outputs, surface recovery metadata after restart, and do not silently overwrite laptop originals.
- No other writer is assigned to this checkout. Read-only storage reviews completed. Hourly Codex continuation is active in the existing local conversation; this repo is not yet a saved Codex project, so do not invent a project ID for new repository threads.

## Working implementation and limits

Gateway: Node 24 ESM + `ws`; `src/server.js`, `src/storage-provider.js`, `src/vendor/storage/provider.js`. Owned RapidRAW relay identity is required. PhotoCraft has its own Rust CLI per session, `src/photocraft.js`, UI in `public/photocraft/`. PdfCraft uses `src/pdfcraft.js`, `public/pdfcraft/`, `engines/pdfcraft/native/` and `scripts/manage-pdfcraft.mjs`. Common browser folder agent is in `public/storage/`.

RapidRAW, PhotoCraft and PdfCraft native Linux flows work. PdfCraft stages only selected documents in a private per-session root because upstream automation has one root; its non-mutating export-copy method preserves undo and stays dirty until destination ACK. Server copies publish atomically under new names; laptop output uses an exclusive new file and common provider ACK/recovery. Other five ArtCraft adapters remain pending. PDF open/export limit: 128 MB, eight documents/session. Full original UI parity, real user directory-picker permissions, stress, native Windows/macOS, multi-user and engine-enabled Docker remain unverified. Do not label pending adapters installed or fully supported.

Checks: `npm run check`, `npm test` (22 tests); `scripts/smoke-pdfcraft.mjs` (own installed PDF/FUSE binaries, isolated server); previous PhotoCraft smokes remain. Latest baseline CI [38086890058](https://github.com/vedranius/creative-workspace/actions/runs/38086890058) passed MCP-01 on Linux/Windows/macOS. Verify PDF-01's latest commit CI before further changes. Gateway CI does not verify native engines on all OSes. Browser scratch test is under `work/browser-qa/pdfcraft-ui.mjs`; reports/screenshots are in the task's outputs. Browser tests use a fresh profile and generated PDFs, not personal files. No real directory picker permission was automated.

## Local development host

Repo: `/home/vedran/Documents/Codex/2026-10-10/da-x20/outputs/creative-workspace`.
Scratch/runtime: `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/`.
**Canonical current studio: `http://127.0.0.1:8792/`**. RapidRAW `/apps/rapidraw/` uses owned relay `8791`; PhotoCraft `/apps/photocraft/`; PdfCraft `/apps/pdfcraft/`. Available editors sort first; dashboard clearly shows `3 available · 5 planned` and MAIN STUDIO. Port `8780` belongs to the user's separate installation; never connect to or stop it.

The current studio's process metadata/logs are in `work/runtime/creative-studio/`; launcher `work/scripts/start-creative-studio.mjs`. Its independent state was initialized from the old studio configuration and points at the existing allowed application workspaces. Do not overwrite that state from the legacy service. Its new sessions can contain user work: inspect PID/command and save state before any restart.

Detached service records/logs are in `work/runtime/local-services/` outside the repository. Check recorded PIDs and command lines before stopping a process. The user may have an unsaved document: use a separate temporary test port and storage roots; restart the live service only when safe.

**Legacy 8788** was left running its previous backend to protect an open PhotoCraft session; RapidRAW was verified ready there and its browser landing page opened. Do not advertise it as the latest portal or restart it blindly. New features are active on 8792.

**Isolated legacy PhotoCraft preview 8789** deliberately disables RapidRAW, which caused the user's confusion. It has independent data under `work/runtime/recovery-preview/` and open sessions; keep it intact until their work is saved. Direct the user to 8792, not this preview. Do not silently delete or migrate its documents.

Existing native binaries, avoid needless rebuilds:

- `work/runtime/photocraft/build/release/photocraft-cli`
- `work/runtime/storage/build/release/cw-filesystem-helper`
- `work/runtime/rapidraw/build/release/cw-rapidraw-engine`
- `work/runtime/pdfcraft/build/release/cw-pdfcraft-engine`

Use `CW_PHOTOCRAFT_BINARY`, `CW_PDFCRAFT_BINARY` and `CW_FUSE_BINARY` with these absolute paths for isolated tests. RapidRAW launcher uses `CW_RUNTIME_DIR=.../work/runtime/rapidraw`, `CW_RAPIDRAW_SOURCE=.../work/rapidraw-web`, `CW_RAPIDRAW_WORKSPACE=<repo>/workspaces/photography`. PdfCraft pinned source is `work/pdfcraft`, with our shim copied into `apps/cw-pdfcraft-engine`; upstream library code is unchanged. Native source revisions and licensing are in manifests/engine READMEs.

## Publication and credentials

Remote: `https://github.com/vedranius/creative-workspace.git`, branch `main`. Publication is authorized. Use secure existing `gh` authentication if available; never put tokens in prompts, files committed to Git, URLs or tool output. The connector previously selected a different account: verify CLI identity before a write. Local private credential paths and service details live outside this public repo.

Local git commits may use `git -c user.name=Codex -c user.email=codex@users.noreply.github.com commit ...` without changing global identity. Do not force push. Re-read status before staging and do not include unrelated user changes.

## Next handoff template

Replace the current milestone section after each bounded task with: task ID/status; final commit; changed behavior; checks and evidence; material limitations; next ready task. Keep this document compact. Keep runtime IDs and secrets out of public handoffs.
