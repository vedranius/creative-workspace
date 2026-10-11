# Development handoff

Updated: 2026-10-11. Read this file, `../AGENTS.md`, and the relevant roadmap row before starting a bounded feature.

## Current milestone

- Completed: **LGT-01a**, owned LightCraft 0.6.0 native CPU worker (`9e6c4c6f`) and pinned installer. Twelve real controls, bounded canonical source hooks, SHA-256 guards, private new PNG/JPEG outputs, no adjacent XMP import/auto-write/model downloads. Synthetic Bayer DNG (no embedded JPEG) decode/edit/undo/redo/changed preview/JPEG export/fresh-worker JPEG reopen/PNG passed; original/XMP preserved, foreign paths and changed-source bytes rejected. Scoped fmt/clippy, two native tests and JS syntax checks passed.
- Next task: **LGT-01b**, native browser/session adapter over this existing worker. Read `engines/lightcraft/README.md`; reuse binary, no upstream rebuild. Add auth/Origin/source-share/session isolation, version/dedup guards, common file modes and output ACK. Persist editable recipes with validated source-relative path + original hash + engine pin + allowed numeric controls; reopen using an explicitly selected source folder, especially when recipe output is on server but original is on laptop. JPEG/PNG export does not mark clean; only ACKed editable recipe save calls internal `mark_saved`. Prove browser and real FUSE/agent save/reopen before availability.
- Availability remains **five**. LightCraft has no browser adapter/gateway endpoint yet, and its catalog entry stays planned. This bounded native foundation is not broad real-camera RAW validation or on-demand/browser acceptance. FilmCraft/EffectCraft remain pending.
- Latest user steering: the user was frustrated that only PhotoCraft appeared in an isolated preview. Restore one clear studio with RapidRAW and the implemented apps, then build the remaining creative adapters. MCP stays supplementary/deferred; its endpoint remains unimplemented. Read `mcp-adapter-audit.md` only when returning to that task. REC-03 version-safe laptop replay remains pending.
- A completed save must mean the selected destination acknowledged it. Preserve uncertain outputs, surface recovery metadata after restart, and do not silently overwrite laptop originals.
- Development now uses one new local Codex project session per bounded feature/update. Creative Workspace is a saved project for this checkout. The hourly standalone automation starts from a short repo handoff rather than this long conversation. One writer at a time; check active project sessions before editing. This original conversation coordinates only after dispatch. Read-only storage reviews completed.

## Working implementation and limits

Gateway: Node 24 ESM + `ws`; `src/server.js`, `src/storage-provider.js`, `src/vendor/storage/provider.js`. Owned RapidRAW relay identity is required. PhotoCraft has its own Rust CLI per session, `src/photocraft.js`, UI in `public/photocraft/`. PdfCraft uses `src/pdfcraft.js`, `public/pdfcraft/`, `engines/pdfcraft/native/` and `scripts/manage-pdfcraft.mjs`. VectorCraft and DesignCraft follow this layout with their own `src/<app>.js`, `public/<app>/`, `engines/<app>/` and installer/smoke. Common browser folder agent is in `public/storage/`.

RapidRAW, PhotoCraft, PdfCraft, VectorCraft and DesignCraft native Linux flows work. PdfCraft stages only selected documents in a private per-session root because upstream automation has one root; its non-mutating export-copy method preserves undo and stays dirty until destination ACK. Server copies publish atomically under new names; laptop output uses an exclusive new file and common provider ACK/recovery. VectorCraft reads directly from its confined source root and stages only output; only a native save marks clean after ACK, exports alone retain dirty state. One document/session, 64 MB input/output, at most four sessions; multi-file exports refused before publication. DesignCraft uses a pure memory importer after root/ZIP/resource checks, avoiding upstream file.open auto-loading of external fonts, links and merge sources. Native inputs/PDF/PNG outputs work, embedded PNG/JPEG only; one doc/session, four sessions, 64 MB expanded package/export, 64 pages. Other three ArtCraft adapters remain pending. PDF open/export limit: 128 MB, eight documents/session. Full original UI parity, real user directory-picker permissions, stress, native Windows/macOS, multi-user and engine-enabled Docker remain unverified. Do not label pending adapters installed or fully supported.

Checks: `npm run check`; `scripts/smoke-lightcraft-native.mjs` with the own Light binary; scoped shim fmt/clippy + two Rust source/control tests. Last gateway baseline: 32 Node tests and DES-01 CI [38095551067](https://github.com/vedranius/creative-workspace/actions/runs/38095551067) passed Linux/Windows/macOS. LGT-01a changes no gateway/provider behavior; commit `aa58845` CI [38106013262](https://github.com/vedranius/creative-workspace/actions/runs/38106013262) passed the gateway suite on Linux/Windows/macOS. Previous browser/native/FUSE proofs remain. Native engine verified on Linux only. Native fixture report is in task outputs; no user photos used.

## Local development host

Repo: `/home/vedran/Documents/Codex/2026-10-10/da-x20/outputs/creative-workspace`.
Scratch/runtime: `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/`.
**Canonical current studio: `http://127.0.0.1:8792/`**. RapidRAW `/apps/rapidraw/` uses owned relay `8791`; PhotoCraft `/apps/photocraft/`; PdfCraft `/apps/pdfcraft/`; VectorCraft `/apps/vectorcraft/`; DesignCraft `/apps/designcraft/`. Available editors sort first; dashboard clearly shows `5 available · 3 planned` and MAIN STUDIO. Port `8780` belongs to the user's separate installation; never connect to or stop it.

The current studio's process metadata/logs are in `work/runtime/creative-studio/`; launcher `work/scripts/start-creative-studio.mjs`. Its independent state was initialized from the old studio configuration and points at the existing allowed application workspaces. Do not overwrite that state from the legacy service. Its new sessions can contain user work: inspect PID/command and save state before any restart. DES-01 refreshed this same port only after confirming zero Photo/PDF sessions, no shares and one empty VectorCraft session with no document. That empty session was closed without discard; queued dirty work would have prevented closure. Legacy services and the owned RapidRAW engine stayed running.

Detached service records/logs are in `work/runtime/local-services/` outside the repository. Check recorded PIDs and command lines before stopping a process. The user may have an unsaved document: use a separate temporary test port and storage roots; restart the live service only when safe.

**Legacy 8788** was left running its previous backend to protect an open PhotoCraft session; RapidRAW was verified ready there and its browser landing page opened. Do not advertise it as the latest portal or restart it blindly. New features are active on 8792.

**Isolated legacy PhotoCraft preview 8789** deliberately disables RapidRAW, which caused the user's confusion. It has independent data under `work/runtime/recovery-preview/` and open sessions; keep it intact until their work is saved. Direct the user to 8792, not this preview. Do not silently delete or migrate its documents.

Existing native binaries, avoid needless rebuilds:

- `work/runtime/photocraft/build/release/photocraft-cli`
- `work/runtime/storage/build/release/cw-filesystem-helper`
- `work/runtime/rapidraw/build/release/cw-rapidraw-engine`
- `work/runtime/pdfcraft/build/release/cw-pdfcraft-engine`
- `work/runtime/vectorcraft/build/release/cw-vectorcraft-engine`
- `work/runtime/designcraft/build/release/cw-designcraft-engine`
- `work/runtime/lightcraft/build/release/cw-lightcraft-engine` (native foundation only)

Use `CW_PHOTOCRAFT_BINARY`, `CW_PDFCRAFT_BINARY`, `CW_VECTORCRAFT_BINARY`, `CW_DESIGNCRAFT_BINARY`, `CW_LIGHTCRAFT_BINARY` and `CW_FUSE_BINARY` with these absolute paths for isolated tests. RapidRAW launcher uses `CW_RUNTIME_DIR=.../work/runtime/rapidraw`, `CW_RAPIDRAW_SOURCE=.../work/rapidraw-web`, `CW_RAPIDRAW_WORKSPACE=<repo>/workspaces/photography`. PdfCraft pinned source is `work/pdfcraft`, with our shim copied into `apps/cw-pdfcraft-engine`; upstream library code is unchanged. Vector pinned source is `work/vectorcraft` (`96344f07`), shim copied into `apps/cw-vectorcraft-engine`; source libraries unchanged. Design source is `work/designcraft` (`a127c6d5`), original shim in `apps/cw-designcraft-engine`; upstream libraries unchanged. Light source is `work/lightcraft` (`9e6c4c6f`), original shim under `apps/cw-lightcraft-engine`; decoder/engine libraries unchanged. Native source revisions/licensing are in manifests/engine READMEs.

## Publication and credentials

Remote: `https://github.com/vedranius/creative-workspace.git`, branch `main`. Publication is authorized. Use secure existing `gh` authentication if available; never put tokens in prompts, files committed to Git, URLs or tool output. The connector previously selected a different account: verify CLI identity before a write. Local private credential paths and service details live outside this public repo.

Local git commits may use `git -c user.name=Codex -c user.email=codex@users.noreply.github.com commit ...` without changing global identity. Do not force push. Re-read status before staging and do not include unrelated user changes.

## Next handoff template

Replace the current milestone section after each bounded task with: task ID/status; final commit; changed behavior; checks and evidence; material limitations; next ready task. Keep this document compact. Keep runtime IDs and secrets out of public handoffs.
