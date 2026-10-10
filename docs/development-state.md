# Development handoff

Updated: 2026-10-10. Read this file, `../AGENTS.md`, and the relevant roadmap row before starting a bounded feature.

## Current milestone

- Completed: **REC-01**, implementation commit `ebf3c4e`. Durable generation-scoped journal, authenticated inventory/download after restart, preserved failed final rename, and safe Stop before delayed copy sync. Local checks and all **16 tests** passed. Real PhotoCraft/FUSE success and failed-rename recovery/reopen fixtures passed.
- Next task: **REC-02**, native browser recovery UI using `GET /api/storage/recovery?app=photocraft` and `/api/storage/recovery/<id>/output`. Show filename/folder, timestamp, uncertain/possibly incomplete state, availability and download; do not automatically replay or overwrite laptop originals. REC-03 handles version conflicts.
- Latest user steering: AI should control our editors through **MCP** from Claude/ChatGPT/Codex, with server engines doing the edit. Read `ai-assistant.md`. MCP is currently planned, not implemented. After REC-02, start bounded **MCP-01** command/auth/revision audit before extending full PhotoCraft UI; an external subscription client need not call our paid API.
- A completed save must mean the selected destination acknowledged it. Preserve uncertain outputs, surface recovery metadata after restart, and do not silently overwrite laptop originals.
- No other writer is assigned to this checkout. Read-only storage reviews completed. Hourly Codex continuation is active in the existing local conversation; this repo is not yet a saved Codex project, so do not invent a project ID for new repository threads.

## Working implementation and limits

Gateway: Node 24 ESM + `ws`; `src/server.js`, `src/storage-provider.js`, `src/vendor/storage/provider.js`. Owned RapidRAW relay identity is required. PhotoCraft has its own Rust CLI per session, `src/photocraft.js`, browser UI in `public/photocraft/`. Common browser folder agent is in `public/storage/`.

RapidRAW and PhotoCraft native Linux flows work. PhotoCraft on-demand native smoke reads only the selected fixture, edits, saves/reopens a layered file on the laptop, and saves to server independently. Recovery backend is implemented; recovery UI, version-safe replay, browser directory-picker permission with a real user folder, background-fill stress, Windows native, macOS mounts, multi-user, cache quotas and the six other ArtCraft adapters remain pending. Current Docker packages the gateway only. Do not label pending adapters installed or fully supported.

Checks: `npm run check`, `npm test` (16 tests). Linux native smokes: `scripts/smoke-photocraft-local-folder.mjs`, `scripts/smoke-photocraft-recovery.mjs` (isolated gateway). Latest known baseline CI: [38049475981](https://github.com/vedranius/creative-workspace/actions/runs/38049475981), gateway tests passed on Linux/Windows/macOS. Verify the new commit's CI before further code changes. This does not verify native engines on those OSes.

## Local development host

Repo: `/home/vedran/Documents/Codex/2026-10-10/da-x20/outputs/creative-workspace`.
Scratch/runtime: `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/`.
Gateway URL: `http://127.0.0.1:8788/`; PhotoCraft `/apps/photocraft/`; owned RapidRAW `/apps/rapidraw/` via loopback relay `8791`. Port `8780` belongs to the user's separate installation; never connect to or stop it.

Detached service records/logs are in `work/runtime/local-services/` outside the repository. Check recorded PIDs and command lines before stopping a process. The user may have an unsaved document: use a separate temporary test port and storage roots; restart the live service only when safe.

REC-01 was tested on isolated temporary gateways. The live port-8788 process was left running its previous backend to protect the user's editor. The new API becomes available on a safe restart; coordinate this with REC-02 deployment rather than silently restarting an unsaved session. Do not claim it is active in the live browser yet.

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
