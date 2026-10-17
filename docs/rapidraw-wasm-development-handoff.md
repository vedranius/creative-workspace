# RWASM-02 — Quality and Speed developed pixels verified

## Completed checkpoint

The shared core uses the pinned original `RawDevelop::develop_intermediate` path and native `develop_internal` postprocessing: demosaic, crop, white balance/calibration, black/white rescale, clipped-pixel recovery, clamp and EXIF orientation. Output is an interleaved Float32Array from a dedicated WASM worker.

Pinned rawler PPG called `Instant::now()` solely for debug profiling, trapping on wasm32. The reviewed patch at `patches/rapidraw-rawler/a32bc1ff/ppg-wasm-profiling.patch` compiles out only that diagnostic on wasm32, preserving native profiling and all pixel math. `UPSTREAM.json` records original/patched file and patch hashes, source pin and LGPL license. The preparation script checks every identity, copies an explicit source allowlist to an empty staging tree, binds the staged crate/lock to the isolated decoder and supplies a feature marker. Shared Cargo sources and native installations are untouched. Default unprepared builds retain the explicit refusal; do not enable the feature manually in the source checkout.

An unpatched native byte-identical `raw_processing.rs` reference, extracted native probe and actual Chromium module worker match every RGB f32 bit for the CC0 raw.pixls.us Canon PowerShot A410 CHDK DNG:

- Quality: 2048×1536 RGB, SHA256 `f052bba0940702e068fb03d6a9f1cc78b9c57e7ff5758f1c460f28d11fb49e30`.
- Speed regression on the same patched WASM: 512×384 RGB, SHA256 `d9d7e96227a8346bd6599f1987aa4f30ee53403e4284a3161c62478507baf53a`.

[Quality evidence](evidence/rapidraw-wasm/quality-development-pixels.json) · [Speed evidence](evidence/rapidraw-wasm/quality-build-speed-regression.json). Pixel data is not committed. Native17/17, Node84/84, repo check, rustfmt/script syntax/diff checks pass. Both browser runs report no errors/failed requests. The new `RapidRAW pixel parity` Actions workflow runs on relevant pushes/PRs and manual dispatch. Its runner downloads only the fixture in `runtime-smoke.json`, verifies SHA256 and CC0 metadata, creates byte-identical native references, prepares the reviewed isolated decoder patch, builds with Rust1.99/wasm-bindgen0.2.129, then runs Quality and Speed in Chromium. Uploaded artifacts include both browser reports, provenance/license JSON, the actual patch, and RapidRAW license text. The complete local runner passed with the same hashes and no browser errors; the first remote Actions result is pending push.

## Reproduction

Use existing Rust1.99, wasm-bindgen0.2.129, low-impact build wrapper and shared build lock. Define `RAW_FILE` as the public fixture, `STAGE` as an empty private build directory, `ARTIFACT_DIR` as a private output directory and `CARGO_TARGET_DIR` as the existing cache. Generate the native reference/probe JSON against the **unpatched** source crate, once per mode (`fast`, `quality`).

```sh
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example develop_reference -- "$RAW_FILE" quality > "$NATIVE_REFERENCE_JSON"
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example develop_probe -- "$RAW_FILE" quality > "$NATIVE_PROBE_JSON"
node scripts/prepare-rapidraw-quality.mjs "$STAGE"
cargo build --release --locked --manifest-path "$STAGE/probe/Cargo.toml" --target wasm32-unknown-unknown --features quality-timer-compat
wasm-bindgen "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/cw_rapidraw_wasm_probe.wasm" --target web --out-dir "$ARTIFACT_DIR"
cp "$STAGE/quality-timer-compat.json" "$ARTIFACT_DIR/quality-timer-compat.json"
node scripts/smoke-rapidraw-development.mjs "$ARTIFACT_DIR" "$RAW_FILE" "$NATIVE_REFERENCE_JSON" "$NATIVE_PROBE_JSON" "$BROWSER_REPORT_JSON" quality
```

Repeat native reference/probe and smoke with `fast` to check the same prepared artifact's Speed output. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` for existing local QA tools. The browser harness validates artifact provenance and exact pixel digests; close the test browser/server after use (handled in `finally`). The final preparation script was also run against a second empty staging tree; resulting source/provenance match the built first tree.

## Limits and exact next task

This checkpoint is not a complete feature/release: product version/public demo remain unchanged, with no original React UI, exposure-on-pixels or export connection. Sensor output and estimated developed output are capped separately at64MiB; neither caps total decoder/intermediate allocation. The one authorized private RAF has sensor parity only and is rejected by the current developed-output budget. No private photos/paths/EXIF/previews were processed or committed for this task. Do not increase that limit as a shortcut.

Next: trace the native original exposure-to-developed-pixels boundary, preserve the original math, implement and compare that exposure effect against native output, then validate export. Do not add the private RAF to CI. Original React UI/public delivery remains subsequent work.

Work only on `codex/rapidraw-wasm-port` in its existing isolated worktree. Preserve untracked `experiments/rapidraw-wasm-core/target/`, protected studios and all user originals. Check the absolute coordinator before editing; immediate completion-driven successor policy is outside the repo at the documented runtime path.
