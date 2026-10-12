# PAR-03 handoff — bounded server read-model slice verified

## Session/action bridge feasibility boundary (2026-10-12)

### Alpha.17 completed server-side action seam

The workspace gateway now accepts `method: "file.new"` only with `{ "preset": <string up to 100 characters> }`, forwards that exact original preset parameter through the owned native worker's `file.new` call, and returns the worker ACK, state revision, read model and bounded render. Protocol-fixture coverage rejects extra fields; actual native and Chromium smokes verified A4 at revision 1 with a 595×842 server PNG and zero browser errors ([browser report](evidence/designcraft-par03-file-new-browser.json)). This closes only the gateway contract: the upstream preset click still calls synchronous local `DesignApp::run`, and its local session/panels remain unsynchronized. Keep DesignCraft planned. Next attach that original caller through an asynchronous pending/ACK/error boundary and make the app consume acknowledged server state without local command execution.

Alpha.17's first Actions attempt `38204423605` completed all OS engine builds and the new browser A4 action smoke, but the existing browser edit smoke then hit 404 instead of its expected stale-revision 409: the shared test listener had replaced the primary session ID with the temporary preset-action session ID after that session was closed. Commit `53445c8` changed the listener to retain the first RPC session. Rerun Checks `38206102465` and Build/release `38206102488` passed. Immutable tag `v0.2.0-alpha.17` points to `53445c84ade1e272b3a8ed5f2b9c2aee22a861fa`; draft release `410203579` has five Actions archives and five checksum sidecars, all downloaded and verified. All three native bundle archive integrity checks passed. See [release evidence](evidence/creative-workspace-alpha17-release.md). Keep the draft; the upstream preset click, `DesignApp` session/panels, provider ACK, reopen/recovery and full original parity remain incomplete.

The next implementation cannot be a shell callback around one `DesignApp::run` call. At the pinned `a127c6d5` source, `DesignApp::run(&mut self, id, params)` is synchronous and immediately calls its concrete `self.session.execute`; `DesignApp` publicly owns `Session`, but panels, dialogs, menus, taskbar and canvas/tool code also read or execute against that same session directly (for example `crates/ui-egui/src/lib.rs:444,563-573`, `panels/layers.rs`, `panels/properties.rs`, `menus.rs`, `taskbar.rs`). The web runner constructs that local session in `apps/designcraft-web/src/web.rs:57-60`.

Therefore an async RPC wrapper at the existing `run()` boundary would either block the browser, report completion before the server ACK, or leave the original panels/tools reading stale local state. None is acceptable. Preserve the current server-owned worker and response guards; the next code slice must introduce a source-level session/action adapter that queues original action IDs and params, exposes pending/error/acknowledged states to the UI, and refreshes the session-backed read model only from an acknowledged server response. It must keep ordered actions and stale-revision rejection. Start with a non-destructive action whose real upstream caller is identified in the pinned UI, and prove the caller/action ID reaches the owned worker; do not add another custom pointer or sample path.

The prior native candidate at `/tmp/par03-designcraft-candidate/build/release/cw-designcraft-engine` is available, while its pinned upstream checkout `/home/vedran/Documents/Codex/2026-10-10/da-x20/work/designcraft` has pre-existing dirty `Cargo.lock` and untracked `apps/cw-designcraft-engine/`; preserve both. Do not rebuild or reset that checkout. This boundary note is evidence/planning only; it does not advance DesignCraft availability or replace the pending implementation.

### Next implementation boundary — actual original caller

The smallest real UI entry point identified for a server-owned document is the preset-card click in `crates/ui-egui/src/chrome.rs` (the New Document view, currently `app.run("file.new", {"preset": p.name})`). It goes through the documented `DesignApp::run` entry point, which immediately calls local `self.session.execute`; other surfaces still call `session.execute` directly. The native worker is a newline-delimited JSON request/response process with a 64 KB request limit and 32 MB response limit; its adapter exposes `new` and the real `frame.create` command, while the workspace gateway already serializes RPC requests and ACKs with state revisions.

Do not wire only the preset click to an async fetch and leave the original app showing an empty local document. The first acceptable source patch must establish an explicit asynchronous host-action lifecycle at the UI/session boundary (pending, acknowledged response, error), route the original `file.new` ID and preset params to the owned server worker, and make the original UI consume the returned document/read-model without executing a duplicate local mutation. Keep the current worker request bounds, session/Origin guards, ordering and expected-revision checks. Add a focused native assertion that the request retains `file.new` and its preset, plus browser evidence that the original preset card causes the worker ACK and that the original UI shows the acknowledged document. Preserve the pinned checkout's dirty files; build only in a disposable clean checkout with the low-impact wrapper.

## Alpha.16 server response/read-model refresh candidate (2026-10-12)

Patch variant `par-03-server-read-model-v3` applies the complete response after `frame.create`: source command ID, server state revision, document title, page count, dirty state, and server preview URL are refreshed together. The canvas image metadata and status banner now reflect the same latest revision after edits.

- Exact pinned source patch SHA-256: `8aef8238c49ada00ac085f25b0fa5b35da18eed5e90247a17aa181c81e1536eb`; `git apply --check` and exact source registration pass.
- Rebuilt original WASM for pin `a127c6d5c3576972bbd60445f26d893db071eef3` with the low-impact wrapper; registration succeeded into a disposable package root.
- Native worker: `file.new` revision 1, `frame.create` revision 2, 612×792 bounded PNG and changed digest.
- Chromium: two serialized pointer-created `frame.create` operations reach revision 3; title `Server Edit Test`, 1 page, dirty=true, image and banner revision 3; foreign session/Origin/stale revision return 404/403/409; zero uncaught errors. [Browser JSON](evidence/designcraft-par03-read-model-v3-browser.json), [native JSON](evidence/designcraft-par03-read-model-v3-native.json), [screenshot](evidence/designcraft-par03-read-model-v3.png).
- Local verification: `npm run check`, `npm test` 46/46 and `git diff --check` pass. The first browser attempt caught a truncated JS sidecar during patch regeneration; the complete source diff was regenerated, rebuilt and the passing run above uses that corrected exact patch.

This is a shell-side response refresh only. The screenshot still shows the upstream `DesignApp` saying “No document open”; its actual Session, panels, original command/tool dispatch and rendering are unsynchronized. It is not DesignCraft availability. No file provider destination/retention, laptop write ACK, reopen or recovery is accepted. Keep release draft-only.

Next exact task: implement the source-level session/action adapter described above: queue one real original UI action ID asynchronously, process it in the server-owned Session, then apply its acknowledged revision/read-model to the original UI without advancing a local engine Session. Build and browser-verify an isolated reviewed source patch and assert the original caller/action ID in the native worker evidence. Preserve `engines/filmcraft/` and all protected runtime sessions.

### Alpha.16 release gate

Product version is `0.2.0-alpha.16`. Checks `38194170672` and Build/release `38194170670` passed. GitHub account `vedranius` verified. Immutable tag `v0.2.0-alpha.16` points to `3f51e7d721bc0432bc42a5fbd7ff52df52809175`; draft prerelease `RE_kwDOVDgEq84YcV1b` contains five Actions archives and five checksum sidecars, all downloaded and verified. See [release evidence](evidence/creative-workspace-alpha16-release.md). Keep the draft because original `DesignApp` state/action/provider/save/recovery parity is incomplete.

## Alpha.15 edit slice and draft release verified (2026-10-12)

Added reviewed DesignCraft `par-03-server-edit-v1`: `file.new`, then serialized pointer-created `frame.create`, with revisioned server PNG over the original UI shell. Native proof reaches revision 2 and changes render digest. Chromium sends two rapid gestures, reaches revision 3 and verifies same-origin guards (404 foreign session, 403 invalid Origin, 409 stale revision), with zero uncaught errors. Evidence: [native report](evidence/designcraft-par03-server-edit-native.json), [browser report](evidence/designcraft-par03-server-edit.json), [screenshot](evidence/designcraft-par03-server-edit.png). Local `npm run check`, full `npm test` 46/46, release validation, native smoke, browser smoke and `git diff --check` passed. Optimized UI/native local builds used the low-impact wrapper.

Critical limitation: upstream `DesignApp` remains visibly on “No document open” while a server PNG is overlaid; local page/panel/session state and native tool selection are not wired through. Pointer creates a fixed demo story. Keep the catalog planned. A freshly built worker rejected the older `doc.sample` route (`Unsupported workspace layout method`); preserve that finding rather than claiming the prior route revalidated. No provider/save destination/retention ACK/reopen/recovery parity.

Patch: [par-03-server-sample.patch](../patches/designcraft/a127c6d5/par-03-server-sample.patch), SHA-256 `17a1967cd6834bc8f73c4250512af97b2e61b65aa8af4e689a49d134442d99a8`.

Commits: feature `1ced95f`, registration guard/identity-test correction `ff18e81`, deterministic active-worker fixture correction `42cb3b0`, handoff `fdbc69f`. Checks `38188391413` passed; documentation follow-up Checks `38188396149` passed. Build/release `38188391442` passed the contract, all 12 native target jobs, three native-prototype bundles/smokes, FilmCraft regression, DesignCraft exact patch build/browser regression, and publish. Immutable `v0.2.0-alpha.15` points to `42cb3b0`; prerelease draft ID `410031237` has five Actions archives and five SHA256 sidecars. All ten were downloaded and verified. [Release evidence](evidence/creative-workspace-alpha15-release.md). Keep it draft.

### Alpha.15 CI corrections (2026-10-12)

Initial Actions attempts `38188284157` and `38188319890` failed on stale patch registration and a fixture that chose the wrong session worker. `ff18e81` corrected the patch ID guard/test; `42cb3b0` made the worker assertion deterministic. Final Actions runs above pass.

Critical limit and next task: the original local `DesignApp` still visibly says “No document open”; the image overlays the original UI shell and pointer creates fixed demo story text rather than using the original tool-selection workflow. The upstream session, read-model panels, and actions are not synchronized. A freshly compiled worker rejected old `doc.sample` with `Unsupported workspace layout method`; this candidate uses verified `file.new`. Keep DesignCraft planned. Next connect the actual upstream `DesignApp` read-model/original action dispatch to the server-owned Session, then complete provider destination/retention, acknowledged save/reopen and recovery before moving to PhotoCraft. Do not claim DesignCraft availability.

Updated 2026-10-11 after the alpha.13 read-model browser/native slice.

## Alpha.14 Actions outcome (2026-10-11)

Checks `38184007149` passed on Windows, macOS and Linux. Build/release `38184007123` passed: all 12 target-native jobs, original FilmCraft browser regression, DesignCraft pinned UI build/registration, DesignCraft server-worker/browser verification, all three bundles and publish. The pinned DesignCraft patch was registered after Trunk without relaxing its exact SHA-256/diff check.

Authenticated GitHub as `vedranius`. Immutable `v0.2.0-alpha.14` points to `95d04cead4eb30d8d34cb65cc2c453d0bccbdea9`. Draft prerelease release ID `RE_kwDOVDgEq84YcAK_` has five Actions-built archives and five SHA256 sidecars. Downloaded all ten assets and verified every archive with `sha256sum -c`. Keep the draft: full original app parity, providers, acknowledged save/reopen and recovery remain incomplete. [Release evidence](evidence/creative-workspace-alpha14-release.md).

Next bounded DesignCraft PAR-03 action: connect one original edit operation to the server-owned Session; preserve upstream action ID and serialized pointer ordering; show before/after state revisions and server render in the original canvas. Then continue provider destination/retention and ACK/recovery. Do not claim DesignCraft availability.

## Alpha.14 release-fix candidate (2026-10-11)

Alpha.13 Build/release `38178166864` failed after Trunk successfully compiled the pinned original DesignCraft UI. Cause: the reviewed patch adds untracked `server-bridge.js`, but plain `git diff HEAD` omits untracked files, so registration compared an incomplete diff and rejected it. The patch itself and SHA-256 were correct.

`scripts/original-ui-source.mjs` now marks untracked paths intent-to-add only while collecting the canonical diff, then resets those intent entries. `install-original-ui.mjs` and the DesignCraft build script use this shared exact-diff helper. A regression test confirms the new file is included and remains untracked afterward. Reproduced the full optimized WASM build and original UI packaging locally with checksum-verified Trunk 0.21.14 through `low-impact-build.py`; package registration succeeded and the patch hash stayed `a72bd8e7bb0302ddae7bd35ee8df6df6bb35ab8164b1c2973d436db99b87c3c2`. This local artifact is not a release asset.

Alpha.14 must run through Actions. Verify Checks and all build jobs, then confirm the actual immutable tag, draft prerelease, ten target archive/checksum assets, and checksums. Keep the release draft; only then continue the next original DesignCraft edit action. DesignCraft remains planned.

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
