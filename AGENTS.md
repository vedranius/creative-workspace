# Creative Workspace development

Start with `docs/development-state.md` and the relevant row of `docs/roadmap.md`. Work on one bounded roadmap task and save a compact handoff when done.

## Product invariants

- Native browser interfaces with server processing; no VNC, remote desktop or streaming desktop UI. Document previews are permitted.
- Own independent engine installations. Never attach to or modify an existing user RapidRAW Web service. Managed RapidRAW must pass the workspace runtime identity check.
- Every adapter uses common file-provider semantics: server, laptop on-demand, hybrid, copy-first. Save destination and retention are explicit separate choices. Respect browser permission and server capability checks.
- Never report laptop save success before write acknowledgement. Preserve uncertain outputs. Do not replay saves over newer local content or silently overwrite originals.
- Root and session isolation, Origin/auth enforcement, bounded payloads, and upstream attribution/licensing must survive new features.
- A catalog entry is not a functioning adapter. Mark implementation and OS support according to evidence.

## Workflow

- Inspect git status and running development work before editing. One active writer per checkout. Do not overwrite unrelated edits.
- User authorized autonomous development, local testing, normal commits/publication to `vedranius/creative-workspace`, and new feature/update sessions. Follow host tool requirements for thread creation; use an actual saved project ID for repository tasks, never an unrelated project.
- Prefer existing native binaries for gateway changes. Run `npm run check` and relevant tests; use `npm test` for changed provider/gateway behavior. Native builds only when needed. Do not restart a live session with unsaved work.
- New adapter acceptance: real engine open/edit/save/reopen plus browser verification. Distinguish protocol fixtures from real browser permission checks.
- After meaningful changes update docs, handoff and evidence, then commit and check CI. Do not force-push or alter global git identity. Never expose or commit credentials.
- Use small, reviewable changes; no fake progress indicators, invented engine capabilities, or automatic arbitrary GitHub code execution. Repo import requires an adapter contract and verified installation flow.
- Scheduled continuation selects one ready task. If another writer is active, continue that work only in its owner or defer. If usage or permissions stop work, preserve a precise next step instead of spawning retry loops.
- Keep sessions compact. Read relevant files, use focused verification and avoid repeated full audits without new evidence. Prefer one active worker; delegate only a clearly independent useful review.
