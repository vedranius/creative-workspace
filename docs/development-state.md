# Development handoff

Updated: 2026-10-10. Read this file, `../AGENTS.md`, and the relevant roadmap row before starting a bounded feature.

## Current milestone

- Completed: **MCP-01**, audit plus PhotoCraft `stateVersion`/`expectedVersion` foundation. Queue-scoped stale-token rejection, exact request retries, legacy/failed mutation invalidation, and browser refresh without replay. Stale Save closes its dialog; `STATE_VERSION_CONFLICT` cannot trigger an `OUTPUT_EXISTS` overwrite retry. **18 local tests** passed. Real native adjustment/undo/save/reopen and two-controller browser/save-conflict fixtures passed. Read `mcp-adapter-audit.md` for specific commands, limitations and the prototype contract.
- Next task: **MCP-02a**, session-scoped expiring/revocable grant, typed gateway dispatch, and stdio SDK adapter for server-only open/inspect/preview/brightness-contrast/undo/save-copy. Use the audited small contract; no generic engine.execute or arbitrary paths. Verify through a real SDK/Inspector and browser refresh. **MCP endpoint remains unimplemented.** MCP-02b adds concrete AI-client setup; remote OAuth and laptop MCP are later gates. REC-03 version-safe laptop replay remains pending.
- Latest user steering: AI should control our editors through **MCP** from Claude/ChatGPT/Codex, with server engines doing the edit; an external subscription client need not call our paid API.
- A completed save must mean the selected destination acknowledged it. Preserve uncertain outputs, surface recovery metadata after restart, and do not silently overwrite laptop originals.
- No other writer is assigned to this checkout. Read-only storage reviews completed. Hourly Codex continuation is active in the existing local conversation; this repo is not yet a saved Codex project, so do not invent a project ID for new repository threads.

## Working implementation and limits

Gateway: Node 24 ESM + `ws`; `src/server.js`, `src/storage-provider.js`, `src/vendor/storage/provider.js`. Owned RapidRAW relay identity is required. PhotoCraft has its own Rust CLI per session, `src/photocraft.js`, browser UI in `public/photocraft/`. Common browser folder agent is in `public/storage/`.

RapidRAW and PhotoCraft native Linux flows work. PhotoCraft on-demand native smoke reads only the selected fixture, edits, saves/reopens a layered file on the laptop, and saves to server independently. Recovery backend/UI (REC-02 commit `d7f574b`) and gateway session-version guard are implemented. MCP transport, automatic AI/browser state push/poll, version-safe laptop replay, browser directory-picker permission with a real user folder, background-fill stress, Windows native, macOS mounts, multi-user, cache quotas and the six other ArtCraft adapters remain pending. Current Docker packages the gateway only. Do not label pending adapters installed or fully supported.

Checks: `npm run check`, `npm test` (18 tests). Linux native smokes: `scripts/smoke-photocraft-local-folder.mjs`, `scripts/smoke-photocraft-recovery.mjs`, `scripts/smoke-photocraft-versions.mjs` (isolated gateways). Latest baseline CI [38085757846](https://github.com/vedranius/creative-workspace/actions/runs/38085757846) passed REC-02 on Linux/Windows/macOS. Verify MCP-01's latest commit CI before further code changes. Gateway CI does not verify native engines on all OSes. Native jobs completing between inspect and dispatch are not an atomic transaction: the first MCP grant must refuse async jobs/dispatch. Request dedup is bounded (~100 retained requests), not durable.

## Local development host

Repo: `/home/vedran/Documents/Codex/2026-10-10/da-x20/outputs/creative-workspace`.
Scratch/runtime: `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/`.
Gateway URL: `http://127.0.0.1:8788/`; PhotoCraft `/apps/photocraft/`; owned RapidRAW `/apps/rapidraw/` via loopback relay `8791`. Port `8780` belongs to the user's separate installation; never connect to or stop it.

Detached service records/logs are in `work/runtime/local-services/` outside the repository. Check recorded PIDs and command lines before stopping a process. The user may have an unsaved document: use a separate temporary test port and storage roots; restart the live service only when safe.

The live port-8788 process was left running its previous backend to protect the user's editor. Recovery and version guards require a safe restart there; the lazy recovery loader explains older-server support and frontend mutation tokens remain optional when stateVersion is absent. Do not claim these new APIs are active on 8788.

**PhotoCraft preview: `http://127.0.0.1:8789/apps/photocraft/`** runs the REC-02 backend with independent data/projects under `work/runtime/recovery-preview/`, process metadata/logs in that directory and launcher `work/scripts/start-recovery-preview.mjs`. It uses existing own PhotoCraft/FUSE binaries; RapidRAW is disabled there. Treat its documents as potentially unsaved too; inspect exact PID/command before stopping. It was not restarted for MCP-01. New version guards were checked on isolated temporary gateways instead. Browser screenshots and compact reports are under the task's outputs directory.

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
