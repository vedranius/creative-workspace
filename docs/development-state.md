# Development handoff

Updated: 2026-10-10. Read this file, `../AGENTS.md`, and the relevant roadmap row before starting a bounded feature.

## Current milestone

- Completed: **REC-02**, native browser recovery dialog in the homepage and PhotoCraft, with app filters, file/folder/time, failed/unacknowledged/incomplete states, missing-copy warnings, optional availability checks and streaming browser downloads named `.recovered`. Downloads preserve the journal and do not replay saves. REC-01 (`ebf3c4e`, root-alias fix `8caf6f6`) remains the backend. Local checks and **17 tests** passed; generated browser download bytes, state/filter/error/refresh behavior and narrow layout were checked.
- Next task: **MCP-01**, bounded audit of actual PhotoCraft/RapidRAW commands, permissions, document revisions and browser-state synchronization; read `ai-assistant.md`. Specify the smallest implementable PhotoCraft MCP-02 prototype with real commands and acceptance checks. MCP is currently planned, not implemented. REC-03 version-safe replay remains pending; do not overwrite newer laptop content.
- Latest user steering: AI should control our editors through **MCP** from Claude/ChatGPT/Codex, with server engines doing the edit; an external subscription client need not call our paid API.
- A completed save must mean the selected destination acknowledged it. Preserve uncertain outputs, surface recovery metadata after restart, and do not silently overwrite laptop originals.
- No other writer is assigned to this checkout. Read-only storage reviews completed. Hourly Codex continuation is active in the existing local conversation; this repo is not yet a saved Codex project, so do not invent a project ID for new repository threads.

## Working implementation and limits

Gateway: Node 24 ESM + `ws`; `src/server.js`, `src/storage-provider.js`, `src/vendor/storage/provider.js`. Owned RapidRAW relay identity is required. PhotoCraft has its own Rust CLI per session, `src/photocraft.js`, browser UI in `public/photocraft/`. Common browser folder agent is in `public/storage/`.

RapidRAW and PhotoCraft native Linux flows work. PhotoCraft on-demand native smoke reads only the selected fixture, edits, saves/reopens a layered file on the laptop, and saves to server independently. Recovery backend and UI are implemented. Version-safe replay, browser directory-picker permission with a real user folder, background-fill stress, Windows native, macOS mounts, multi-user, cache quotas and the six other ArtCraft adapters remain pending. Current Docker packages the gateway only. Do not label pending adapters installed or fully supported.

Checks: `npm run check`, `npm test` (17 tests). Linux native smokes: `scripts/smoke-photocraft-local-folder.mjs`, `scripts/smoke-photocraft-recovery.mjs` (isolated gateway). Latest REC-01 baseline CI [38051979521](https://github.com/vedranius/creative-workspace/actions/runs/38051979521) passed Linux/Windows/macOS after the configured-root alias fix. REC-02 adds recovery-asset authentication and download-header/error assertions; verify this update's CI before further code changes. Gateway CI does not verify native engines on all OSes.

## Local development host

Repo: `/home/vedran/Documents/Codex/2026-10-10/da-x20/outputs/creative-workspace`.
Scratch/runtime: `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/`.
Gateway URL: `http://127.0.0.1:8788/`; PhotoCraft `/apps/photocraft/`; owned RapidRAW `/apps/rapidraw/` via loopback relay `8791`. Port `8780` belongs to the user's separate installation; never connect to or stop it.

Detached service records/logs are in `work/runtime/local-services/` outside the repository. Check recorded PIDs and command lines before stopping a process. The user may have an unsaved document: use a separate temporary test port and storage roots; restart the live service only when safe.

The live port-8788 process was left running its previous backend to protect the user's editor. Recovery requires a safe restart there; the lazy UI loader shows an explanation rather than breaking the existing app. Do not claim its new API is active on 8788.

Updated **PhotoCraft preview: `http://127.0.0.1:8789/apps/photocraft/`**. It has independent data/projects under `work/runtime/recovery-preview/`, with process metadata/logs in that directory and launcher `work/scripts/start-recovery-preview.mjs`. It uses existing own PhotoCraft/FUSE binaries; RapidRAW is deliberately disabled there so the existing relay remains separate. Treat this preview's documents as potentially unsaved too. Inspect its exact PID/command before stopping it. Temporary recovery UI fixtures were tested separately; browser screenshots and a compact report are under the task's outputs directory.

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
