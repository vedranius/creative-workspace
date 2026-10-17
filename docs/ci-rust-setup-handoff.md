# CI-RUST-01 — alpha.53 setup fix and clean-browser failure

## Alpha.53 result

Checks `38988515259` passed on product commit `30b135dbb57f81fcae0430774b05ef2b1dfdef40`. Build/release `38988515273` completed with failure; publish was skipped. The direct pinned Rustup setup worked: the nine actual setup steps passed, including the macOS PhotoCraft step that failed in alpha.52 setup. The native matrix and original UI builds advanced without a Rust setup failure.

The clean DesignCraft browser smoke failed at Backspace while waiting 10 seconds for revision 9. Its browser trace showed `text.delete` was sent; the native worker returned no matching ACK. The source patch had added the original command to the upstream DesignCraft engine mirror, but the independent owned adapter at `engines/designcraft/native/src/main.rs` had a separate `COMMANDS` allowlist that omitted it. The source/UI unit tests passed because they did not execute that owned-native allowlist. The release workflow stopped before publish. Remote inspection found no `v0.2.0-alpha.53` tag or release; the latest published release remains alpha.51 draft. This is a concrete code/acceptance failure, not an Actions permission issue. No rerun or retry was made.

## Alpha.54 correction in progress

`engines/designcraft/native/src/main.rs` now includes `text.delete`. Alpha.54 also adds an exact-pin original DesignCraft recovery entry that opens the existing shared `/api/storage/recovery` inventory and retained-output download. No new recovery API was introduced. Local original-page Chromium confirms an unacknowledged retained record is findable and downloads the exact bytes. The provider chooser and recovery manifest are fixtures, not OS folder-permission evidence. Original DesignApp Save a Copy is still not wired through the owned server session, so end-to-end original save-failure recovery remains open.

Local `npm run check`, `npm test` (79/79), release validation and `git diff --check` pass. The optimized exact-pin WASM build and original-page recovery browser smoke pass. The host only has Rust 1.99/1.98, not the required native Rust 1.95, so no local native rebuild was claimed. Use the release Actions native job, which sets up the checked-in exact 1.95 pin, to build and verify `text.delete` against the worker.

## Next exact steps

Push the alpha.54 candidate as a fresh product version. Verify Checks and Build/release, especially all native setup/build jobs, the clean DesignCraft browser text.delete proof, the recovery-entry smoke, other original UI jobs, and target bundles. Only after success, verify the immutable alpha.54 tag and draft, freshly download every Actions archive and checksum sidecar, and validate each pair. Keep DesignCraft planned and the release draft while real folder permission, laptop ACK/recovery, original Save a Copy, reopen and full parity remain incomplete.

Preserve alpha.51 test studio **8795**, owned RapidRAW **8791**, user RapidRAW **8780**, immutable packages/workspaces and `engines/filmcraft/`. Do not restart those sessions.

References: [Rustup override precedence](https://rust-lang.github.io/rustup/overrides.html), [explicit cross-compilation target installation](https://rust-lang.github.io/rustup/cross-compilation.html).
