# PAR-03a handoff — bounded server sample bridge verified

Updated 2026-10-11 after the original UI/browser/native sample slice.

## Completed slice

The pinned original DesignCraft UI at `a127c6d5c3576972bbd60445f26d893db071eef3` now has an explicitly reviewed `par-03-server-sample-v1` variant. Its `?serverSample` browser bootstrap opens an owned same-origin server session, sends only the allowlisted `doc.sample` gateway operation, and displays the bounded server PNG over the original canvas presentation. The native worker executes the original upstream command ID `file.newSample`; state revision advances 0→1. It never forwards an arbitrary command ID.

- Patch: `patches/designcraft/a127c6d5/par-03-server-sample.patch`; SHA-256 `02f187a6e89d4d531485693844da8c8de0aa17f3945d10d878a2990639d04f7c`.
- Build: `npm run ui:designcraft:par03 -- <clean-pinned-checkout> <output-dir>`; Rust 1.99.0, `wasm32-unknown-unknown`, Trunk 0.21.14, low-impact build wrapper. Candidate WASM SHA-256 `a282fc2cd0528e0af4aa2c7316f733a0aedb09cdec3526f3f8fff42ea35026f8`.
- Native and real-browser results, guard checks, checksums and remaining limits: [PAR-03 sample bridge evidence](designcraft-par03-sample-bridge.md) and [browser report](evidence/designcraft-par03-browser.json).
- `npm run check`, `git diff --check`, all 45 Node tests, native worker smoke and one same-origin browser pass succeeded.

## Still incomplete

This is not a server-backed original app. Only `file.newSample` is routed. The original `DesignApp` still owns its empty local `Session`; tool handlers, pointer ordering, panels/read-model, edits, save, provider acknowledgement, recovery and most rendering remain unported. The sample PNG is presented over the original canvas area; no broader UI state parity is implied. Keep DesignCraft planned. No OS bundle/browser/provider/full-parity claim.

## Next exact task

Extend this pinned source bridge by connecting one original document read-model and one original user action to the owned server session while preserving the upstream action/command ID and serialized pointer ordering. Verify before/after state revisions and a new server render in the original browser UI, plus stale-revision, foreign-session and invalid-Origin rejection. Do not repeat the `file.newSample` proof, UI preview build, alpha.10 release verification, or edit `engines/filmcraft/`. Update availability only after original tools, save destination ACK, reopen/recovery and provider acceptance are independently evidenced.
