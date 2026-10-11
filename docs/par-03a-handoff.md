# PAR-03 handoff — bounded server read-model slice verified

Updated 2026-10-11 after the alpha.13 read-model browser/native slice.

## Alpha.13 Actions outcome (checked 2026-10-11 22:32 UTC)

GitHub Checks run `38178166902` succeeded on Ubuntu, macOS and Windows. Build/release run `38178166864` completed with failure in `original-designcraft` only: the pinned UI compiled successfully, then `scripts/install-original-ui.mjs` rejected the source diff as different from the reviewed patch (`Source differs from the exact reviewed integration patch`, `scripts/install-original-ui.mjs:24`). Its native and other original UI jobs completed successfully. GitHub identity was verified as `vedranius`; no `v0.2.0-alpha.13` tag/ref or release exists, and the latest release remains the `v0.2.0-alpha.10` draft. Do not claim an alpha.13 asset or publication.

Next release task: reproduce and isolate why the source diff changes between patch application and post-Trunk registration (the build itself completed); preserve byte-exact reviewed-patch verification while excluding no unreviewed source changes. Then rerun the Actions-built release pipeline and inspect its actual tag, draft assets and checksums before resuming the next original edit action.

## Completed slice

The pinned original DesignCraft UI at `a127c6d5c3576972bbd60445f26d893db071eef3` now has an explicitly reviewed `par-03-server-read-model-v2` variant. Its `?serverSample` bootstrap opens a same-origin session, sends only the allowlisted `doc.sample` operation, and presents server-owned document title, page count, dirty state and bounded PNG at the same revision over the original canvas. The owned native worker executes the exact upstream `file.newSample` command; revision advances 0→1. No arbitrary command ID is forwarded. The `DesignApp` local Session remains empty and other source action handlers remain unported.

- Patch: `patches/designcraft/a127c6d5/par-03-server-sample.patch`; SHA-256 `a72bd8e7bb0302ddae7bd35ee8df6df6bb35ab8164b1c2973d436db99b87c3c2`.
- Build: `npm run ui:designcraft:par03 -- <clean-pinned-checkout> <output-dir>`; Rust 1.99.0, `wasm32-unknown-unknown`, Trunk 0.21.14, low-impact build wrapper. Candidate WASM SHA-256 `a282fc2cd0528e0af4aa2c7316f733a0aedb09cdec3526f3f8fff42ea35026f8`.
- Native smoke reports the original `file.newSample`, 4-page document, 612×792 PNG, and digest `a0f4b28af9304e3d567037a2cd5ab305d08d14078848d6862d3d7cb0f3d981d5`. Browser reads title `Quarterly — Spring Issue`, 4 pages and `dirty:true`; invalid Origin/foreign session/stale revision return 403/404/409 with no browser errors. [Evidence and report](designcraft-par03-sample-bridge.md).

## Still incomplete

This is not a server-backed original app. Only `file.newSample` is routed and a few read-model fields reach the original canvas presentation. The original `DesignApp` still owns its empty local `Session`; tool handlers, pointer ordering, panels, edits, save, provider acknowledgement, recovery and most rendering remain unported. Keep DesignCraft planned. No OS bundle/browser/provider/full-parity claim.

## Next exact task

Next: implement one real original edit action against the server-owned DesignCraft Session. Preserve its upstream command ID and serialize pointer/tool events so stale reads cannot overwrite newer state. Show before/after revisions and a server render in the original UI. Continue to provider destination/retention and ACK/recovery, then complete DesignCraft before PhotoCraft → VectorCraft → PdfCraft → LightCraft → FilmCraft → EffectCraft. Do not touch `engines/filmcraft/` or claim availability before full original-function, provider, save/reopen and recovery acceptance.
