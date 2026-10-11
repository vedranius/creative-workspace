# PAR-03a handoff — implementation incomplete

Update 2026-10-11: original EffectCraft UI preview ORG-FX-UI is complete; the next bounded task is the server seam below. The EffectCraft preview did not change this implementation scope or acceptance.

Status: the dashboard correction is implemented; the original UI to server worker bridge is not. This is a handoff, not evidence of a server-backed DesignCraft port.

## Current code change

Creative Workspace cards now identify PhotoCraft, PdfCraft, VectorCraft and DesignCraft as limited custom prototypes with original application ports pending. The availability summary counts only original-port completion. Engine health remains independently visible through prototype launch links. Existing app routes and documents are preserved.

## Required next implementation

1. Use clean pinned upstream `a127c6d5c3576972bbd60445f26d893db071eef3` at `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/original-ui/designcraft` and the owned engine source at `engines/designcraft/native`.
2. Add a narrowly scoped server-worker operation for the original `file.newSample` command (preserve that ID), with revisioned state and bounded PNG rendering. Do not forward arbitrary upstream commands or filesystem operations.
3. Add an authenticated, same-origin browser RPC in the original `apps/designcraft-web` shell. Start the existing original `DesignApp` and keep its menu, panels, tools and command/action registries intact. Do not run the sample command against its local WASM Session. Deliver the server render into the original canvas presentation with a strict dimension/byte cap and revision identifier; expose unsupported UI paths as pending.
4. Save the source patch in this repository (for example `patches/designcraft/a127c6d5/`) and add a reproducible script that applies it to a clean checkout without altering upstream libraries. Include Rust/Trunk versions and exact build/serve commands.
5. Run the owned native worker and isolated original WASM build on a new candidate port only. In a real browser prove before/after worker revision, command ID, render dimensions/hash, unchanged original menu/tool UI, no browser errors, foreign-session rejection and invalid-Origin rejection. Existing user services and unsaved sessions must remain untouched.
6. After proof, update this handoff, validation evidence, roadmap and development state. Until then DesignCraft stays pending and no feature-completion claim is justified.

## Evidence gathered

- Upstream candidate checkout reports the required full commit and clean status before changes.
- The existing native engine binary is present at `work/runtime/designcraft/build/release/cw-designcraft-engine`.
- This turn did not modify upstream scratch files, build a new engine/UI, launch a candidate, or verify a server-backed command/render in a browser.
