# Development handoff

Updated: 2026-10-10. Read this file, `../AGENTS.md`, and the relevant roadmap row before starting a bounded feature.

## Current milestone

- Baseline commit: `51308a5` (native PhotoCraft adapter and independent laptop-folder modes).
- Next task: **REC-01**, durable pending-laptop-write journal and recovery inventory. Do not automatically replay writes: local version conflict handling is REC-03.
- A completed save must mean the selected destination acknowledged it. Preserve uncertain outputs, surface recovery metadata after restart, and do not silently overwrite laptop originals.
- No other writer is assigned to this checkout. Read-only review agents may inspect it.

## Working implementation and limits

Gateway: Node 24 ESM + `ws`; `src/server.js`, `src/storage-provider.js`, `src/vendor/storage/provider.js`. Owned RapidRAW relay identity is required. PhotoCraft has its own Rust CLI per session, `src/photocraft.js`, browser UI in `public/photocraft/`. Common browser folder agent is in `public/storage/`.

RapidRAW and PhotoCraft native Linux flows work. PhotoCraft on-demand native smoke reads only the selected fixture, edits, saves/reopens a layered file on the laptop, and saves to server independently. Browser directory-picker permission with a real user folder, background-fill stress, Windows native, macOS mounts, multi-user, durable recovery, cache quotas and the six other ArtCraft adapters remain pending. Current Docker packages the gateway only. Do not label pending adapters installed or fully supported.

Checks: `npm run check`, `npm test` (11 baseline tests). Linux native smoke: `scripts/smoke-photocraft-local-folder.mjs`. Most recent baseline CI: [38049475981](https://github.com/vedranius/creative-workspace/actions/runs/38049475981), gateway tests passed on Linux/Windows/macOS. This does not verify native engines on those OSes.

## Local development host

Repo: `/home/vedran/Documents/Codex/2026-10-10/da-x20/outputs/creative-workspace`.
Scratch/runtime: `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/`.
Gateway URL: `http://127.0.0.1:8788/`; PhotoCraft `/apps/photocraft/`; owned RapidRAW `/apps/rapidraw/` via loopback relay `8791`. Port `8780` belongs to the user's separate installation; never connect to or stop it.

Detached service records/logs are in `work/runtime/local-services/` outside the repository. Check recorded PIDs and command lines before stopping a process. The user may have an unsaved document: use a separate temporary test port and storage roots; restart the live service only when safe.

Existing native binaries, avoid needless rebuilds:

- `work/runtime/photocraft/build/release/photocraft-cli`
- `work/runtime/storage/build/release/cw-filesystem-helper`
- `work/runtime/rapidraw/build/release/cw-rapidraw-engine`

The live gateway uses `CW_PHOTOCRAFT_BINARY` and `CW_FUSE_BINARY` with these absolute paths. RapidRAW launcher uses `CW_RUNTIME_DIR=.../work/runtime/rapidraw`, `CW_RAPIDRAW_SOURCE=.../work/rapidraw-web`, `CW_RAPIDRAW_WORKSPACE=<repo>/workspaces/photography`. Native source revisions are in engine manifests. PhotoCraft upstream Rust has not been changed.

## Publication and credentials

Remote: `https://github.com/vedranius/creative-workspace.git`, branch `main`. Publication is authorized. Use secure existing `gh` authentication if available; never put tokens in prompts, files committed to Git, URLs or tool output. The connector previously selected a different account: verify CLI identity before a write. Local private credential paths and service details live outside this public repo.

Local git commits may use `git -c user.name=Codex -c user.email=codex@users.noreply.github.com commit ...` without changing global identity. Do not force push. Re-read status before staging and do not include unrelated user changes.

## Next handoff template

Replace the current milestone section after each bounded task with: task ID/status; final commit; changed behavior; checks and evidence; material limitations; next ready task. Keep this document compact. Keep runtime IDs and secrets out of public handoffs.
