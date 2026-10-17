# CI-RUST-01 — direct pinned Rust setup, alpha.53

## Problem and resulting behavior

Alpha.52 Build/release run `38940743052` failed during GitHub runner action preparation: the macOS PhotoCraft job could not resolve `codeload.github.com` while fetching the remote Rust toolchain setup action. No repository build step ran in that job; dependent DesignCraft/publish jobs were skipped. Rerun requests through the existing PAT/integration were denied Actions-write permission. No denied rerun is repeated by this task.

The nine native/original-UI jobs now call `scripts/setup-ci-rust.mjs` after checkout and Node setup. It uses the runner's preinstalled official Rustup rather than a separately downloaded Rust action. Existing native Rust **1.95.0**, browser Rust **1.99.0**, engine/UI pins and build/cache flags stay unchanged. Missing pinned toolchains and the explicit WASM target get at most three download attempts with 2/4-second delays; each Rustup subprocess is capped at five minutes. Exact cached compiler versions are reused. The helper checks `rustc --version` and installed WASM libraries before appending a job-scoped `RUSTUP_TOOLCHAIN` to `GITHUB_ENV`; this controls subsequent Cargo/Trunk children even under upstream source directories. No global default or directory override is changed, and no different compiler is accepted as fallback. A failure stops before activation.

Rustup and official Rust distribution downloads still require network access when absent. GitHub checkout/Node/cache/artifact actions still require GitHub. This removes the observed Rust setup action dependency, not all possible network failures; it does not grant PAT Actions-write permission. A normal authorized source push runs the revised workflow on a fresh commit/version. A successful source test is not release or original-app acceptance.

## Validation and remaining evidence

Five deterministic setup tests cover cached pins, unrelated installed compilers, transient failures and bounded retries, exact WASM target installation, exhausted downloads without activation, version/library mismatch and invalid configuration. They use a command fixture and do not install local toolchains or prove real runner downloads. The focused five-test suite passes. The full local check/test pipeline is running on this host with severe scheduling/I/O delays; no full-suite result is claimed yet. Local verification has no native rebuild. The remote Checks/release gates must finish before acceptance; real Linux/macOS/Windows setup and clean original DesignCraft browser/native proof require the new Actions run.

Alpha.53 metadata is consistent across package/lock/overview/changelog/install/release guidance. Fresh immutable tag, draft and every Actions archive/checksum pair remain to be verified. Alpha.52 had no published tag/release; published prior versions are untouched. Keep alpha.53 draft and DesignCraft planned until full source/browser/provider acceptance. Preserve untracked `engines/filmcraft/`.

The user's alpha.51 test studio on **8795**, owned RapidRAW on **8791**, original user RapidRAW on **8780**, immutable UI packages and active user documents are protected. This task does not restart, rebuild or upgrade them. Local verification uses no native engine build.

## Next exact step

Inspect the fresh alpha.53 Checks and Build/release run at the committed source: all nine direct Rust setup steps, native matrix, clean exact-patch DesignCraft original browser, other original UI jobs and target bundle/publish checks. On success verify the immutable new tag/draft and freshly download/hash all Actions archive/checksum pairs; preserve draft status and document actual browser limits. If a failure occurs, record the exact job/step without inventing engine availability. Then resume original DesignCraft provider/write-ACK/reopen/recovery and remaining action parity, using separate roots and existing binaries. Do not treat a pending run as an Actions permission rejection or create retry sessions.

References: [Rustup override precedence](https://rust-lang.github.io/rustup/overrides.html), [explicit cross-compilation target installation](https://rust-lang.github.io/rustup/cross-compilation.html). CLI options were also inspected read-only on the existing host Rustup.
