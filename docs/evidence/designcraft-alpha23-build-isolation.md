# DesignCraft alpha.23 build isolation evidence

## CI failure and fix

Build/release run [38301345701](https://github.com/vedranius/creative-workspace/actions/runs/38301345701) passed its contract, native jobs, and three OS bundles. The `original-designcraft` job compiled the optimized pinned UI successfully, then failed at the post-build exact-source assertion; publish was skipped. The patch passed the pre-build assertion. No `v0.2.0-alpha.22` tag or release was created.

The original source and reviewed patch remain verified byte-for-byte. `scripts/build-designcraft-host-ui.mjs` now copies the checked checkout to a unique disposable build directory, builds there, removes that copy, and verifies the canonical source checkout again. A focused test mutates the copy's lock metadata and confirms the reviewed source remains unchanged. The source-diff guard is still exact.

## Local build and browser proof

- Pinned DesignCraft commit: `a127c6d5c3576972bbd60445f26d893db071eef3`.
- Reviewed Undo patch SHA256: `e86632a24c2966d9f618973b254ef17cde4b60f86f58e8210d532c35487701e7`.
- Trunk 0.21.14 optimized build passed through `low-impact-build.py` (one Cargo job, two-CPU affinity, nice 10); process priority remained nice 10. The disposable source directory was removed after completion.
- Candidate WASM SHA256: `ee7fffc4c3838aa98128492292e251220c4331bd156ceb019ba8f3d2cd1d27d9`.
- The local candidate archive was produced while package metadata still read alpha.22; it is a local build artifact, not an Actions release asset.
- Chromium used the current worker from `build/original-ui/target/release`. The original A4 card sends `file.new` at revision 1; the original Rectangle Tool sends `frame.create` at revision 2; original Ctrl+Z sends `edit.undo` at revision 3. The canonical A4 snapshot and server render return after undo. Unbridged commands are blocked, injected preview failure leaves the mirror unhydrated, and there are no uncaught browser errors.

Browser report: [JSON](designcraft-alpha23-build-isolation-browser.json) · [screenshot](designcraft-alpha23-build-isolation-browser.png).

## Scope

This is a build-pipeline fix for an unregistered DesignCraft candidate. It does not add app behavior or activate a package. File-provider integration, separate save destination and retention, laptop write acknowledgement, save/reopen, recovery and complete original-app parity remain required; keep DesignCraft planned and the alpha.23 release draft-only.
