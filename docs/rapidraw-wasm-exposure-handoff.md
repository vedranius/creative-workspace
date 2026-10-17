# RWASM-02 original exposure compensation

The shared probe now contains the **unchanged** native `RawExposure` / `BaselineOptions` types and compensation formula from RapidRAW `b39884b38d8f148caef6fd0d52afd264951be329`. The original full `src-tauri/src/baseline_exposure.rs` is retained byte-identically in `experiments/rapidraw-wasm-core/tests/reference/`, with its original AGPL license and recorded SHA-256 in `UPSTREAM.json`. Only the native reference's desktop `AppSettings` type is stubbed; its compensation and settings adapter are original code.

The wrapper accepts finite values and preserves the native baseline/highlight toggles. Disabled baseline exposure also disables the DNG offset, as in native RapidRAW. Nonfinite values or an overflowing result produce an error at the host boundary. No finite normal-range equation is replaced.

## Verification

- Native: 14 tests pass (9 existing decoder, 5 exposure). The exposure tests check original source hash, byte-identical extracted formula, settings behavior, 144 exact f32 bit-pattern matches and rejection of invalid inputs/overflow.
- Native reference executable: `examples/exposure_reference.rs` generates the expected 144-case JSON matrix from the original module, independently of the extracted implementation.
- WASM: optimized Rust 1.99.0 build and matching wasm-bindgen 0.2.129 web glue.
- Browser: `scripts/smoke-rapidraw-exposure.mjs` runs the actual WASM calculation in one dedicated Chromium worker; all 144 results match native f32 bits. Ten invalid inputs/overflow cases are rejected; zero page errors or failed requests. [Exact artifact/hash evidence](evidence/rapidraw-wasm/exposure-compensation.json).
- Workspace: `npm run check`, 84 Node tests, Rust formatting, script syntax and diff check pass.

The harness serves only generated JS/WASM and a numeric matrix on loopback, terminates its worker, and closes its QA browser/server. It reads no photographs and does not touch the public demo or protected services. Existing unrelated experimental `target/` remains untracked and must not be committed or cleaned as part of this task.

## Reproduce

Use existing Rust 1.99/cache and low-impact build limits; do not reinstall tools or change global defaults. From the isolated port worktree:

```sh
cargo test --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --lib --tests
cargo run --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example exposure_reference > /private/qa-artifact/exposure-reference.json
cargo build --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --target wasm32-unknown-unknown --release
wasm-bindgen /private/target/wasm32-unknown-unknown/release/cw_rapidraw_wasm_probe.wasm --target web --out-dir /private/qa-artifact
# Set PLAYWRIGHT_MODULE, CHROMIUM_PATH and short disk-backed TMPDIR to existing host tools.
node scripts/smoke-rapidraw-exposure.mjs /private/qa-artifact /private/qa-report.json
```

## Next concrete work

This slice returns **compensation stops only**. It does not develop RAW pixels, parse camera exposure metadata, change image exposure, connect original React UI or export. Do not call it a completed RapidRAW port or add it to the public demo as an editor.

Advance the original `raw_processing::develop_internal` / `RawDevelop::develop_intermediate` path in the shared crate. Preserve native demosaic, rescale, clipping, crop/orientation and color behavior; use the same pinned original sources as native pixel reference. Start with a small licensed RAW fixture, then the already permitted single private RAF copy. Keep preflight/worker/resource limits. Publish no private input, preview, EXIF or personal paths. Require a developed-pixel comparison before moving to pixel exposure/export, and preserve original UI architecture. Scalar compensation parity is not developed-image parity.

The product version/public availability stays unchanged for this unfinished experimental port. Continue only on `codex/rapidraw-wasm-port`; main's server suite and its coordinator stay independent. Update the **absolute private port coordinator** with owner/task at start and release it with exact commit/next step at the end, so the five-minute automation can continue.
