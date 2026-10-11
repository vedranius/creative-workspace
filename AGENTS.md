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
- Every completed feature/fix update is its own Creative Workspace SemVer release: update `package.json`, `package-lock.json`, `CHANGELOG.md`, project overview/goal/install/release docs, and release metadata consistently. Create a new version tag and GitHub Release; never rewrite a published tag/release. Keep upstream engine pins independent from the product version. First public release must be explicitly labeled prototype/prerelease.
- A bounded adapter foundation is not an availability claim: keep the catalog planned until native open/edit/save/reopen, browser permission and the required provider path are evidenced. LightCraft gateway endpoints alone do not satisfy this acceptance.
- Release assets must be built by GitHub Actions for their target OS. Do not present gateway-only Docker/source archives or locally built host binaries as complete cross-platform creative bundles. Bundle claims require platform-specific startup/health/smoke evidence, Node runtime, owned engines, platform/pin/capability manifest, licenses and SHA256 checksums; label unsupported or unverified engine/OS combinations clearly, and leave a release draft when evidence is incomplete.
- Before a first or subsequent release, inspect remote tags/releases and asset state, authenticate as `vedranius`, publish with a normal push, then verify Actions results and downloadable release assets. Use the documented private host helper; never print credential/config contents. If network/auth prevents verification, preserve a precise handoff and do not claim publication.
- Use small, reviewable changes; no fake progress indicators, invented engine capabilities, or automatic arbitrary GitHub code execution. Repo import requires an adapter contract and verified installation flow.
- Scheduled continuation selects one ready task. If another writer is active, continue that work only in its owner or defer. If usage or permissions stop work, preserve a precise next step instead of spawning retry loops.
- Keep sessions compact. Read relevant files, use focused verification and avoid repeated full audits without new evidence. Prefer one active worker; delegate only a clearly independent useful review.
