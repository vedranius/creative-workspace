# RWASM-02 — Quality and Speed developed pixels verified

## Native exposure-to-pixels checkpoint

Pinned RapidRAW `b39884b38d8f148caef6fd0d52afd264951be329` has a CPU `image_processing::apply_exposure` helper at `src-tauri/src/image_processing.rs`: zero stops returns the image; otherwise the helper calculates `exposure.exp2()` once and multiplies RGB channels. The helper is used by auto-analysis previews. The interactive editor has a separate path: `get_global_adjustments_from_json` converts the basic exposure control to stops and adds enabled baseline compensation; `shaders/shader.wgsl::apply_linear_exposure` multiplies linear RGB by `pow(2.0, exposure_adj)` after local contrast and before glow/halation/dehaze/white balance/tonal/color operations and tone mapping. The implementation in this checkpoint extracts the CPU helper's RGB operation only; it does not claim the GPU shader or the complete editor order.

Native tests compare the extracted operation against a pinned reference copy for eight synthetic stop values, and an optimized WASM build matches all72 output f32 bit patterns in a dedicated Chromium worker. The worker rejects five invalid/overflow inputs and reports no page errors or failed requests. Actions run [39072950782](https://github.com/vedranius/creative-workspace/actions/runs/39072950782) passed, and artifact `rapidraw-pixel-parity-39072950782` was downloaded and inspected for the 72-match exposure report. [Browser evidence](../evidence/rapidraw-wasm/exposure-pixels-browser.json). The test source is synthetic and contains no photo data.

Export is source-traced: `export_processing` sends `RenderRequest` to `process_and_get_dynamic_image_with_precision`, then calls the format encoder and metadata writer. This experimental probe has neither that renderer nor the export encoder, so this checkpoint verifies no exported file, browser download/write acknowledgment or UI adjustment contract. Next: bound a native/WASM render/export slice tied to the traced processing order; keep UI and complete export acceptance open.

## Completed checkpoint

The shared core uses the pinned original `RawDevelop::develop_intermediate` path and native `develop_internal` postprocessing: demosaic, crop, white balance/calibration, black/white rescale, clipped-pixel recovery, clamp and EXIF orientation. Output is an interleaved Float32Array from a dedicated WASM worker.

Pinned rawler PPG called `Instant::now()` solely for debug profiling, trapping on wasm32. The reviewed patch at `patches/rapidraw-rawler/a32bc1ff/ppg-wasm-profiling.patch` compiles out only that diagnostic on wasm32, preserving native profiling and all pixel math. `UPSTREAM.json` records original/patched file and patch hashes, source pin and LGPL license. The preparation script checks every identity, copies an explicit source allowlist to an empty staging tree, binds the staged crate/lock to the isolated decoder and supplies a feature marker. Shared Cargo sources and native installations are untouched. Default unprepared builds retain the explicit refusal; do not enable the feature manually in the source checkout.

An unpatched native byte-identical `raw_processing.rs` reference, extracted native probe and actual Chromium module worker match every RGB f32 bit for the CC0 raw.pixls.us Canon PowerShot A410 CHDK DNG:

- Quality: 2048×1536 RGB, SHA256 `f052bba0940702e068fb03d6a9f1cc78b9c57e7ff5758f1c460f28d11fb49e30`.
- Speed regression on the same patched WASM: 512×384 RGB, SHA256 `d9d7e96227a8346bd6599f1987aa4f30ee53403e4284a3161c62478507baf53a`.

[Quality evidence](evidence/rapidraw-wasm/quality-development-pixels.json) · [Speed evidence](evidence/rapidraw-wasm/quality-build-speed-regression.json). Pixel data is not committed. Native17/17, Node84/84, repo check, rustfmt/script syntax/diff checks pass. Both browser runs report no errors/failed requests. The new `RapidRAW pixel parity` Actions workflow runs on relevant pushes/PRs and manual dispatch. Its runner downloads only the fixture in `runtime-smoke.json`, verifies SHA256 and CC0 metadata, creates byte-identical native references, prepares the reviewed isolated decoder patch, builds with Rust1.99/wasm-bindgen0.2.129, then runs Quality and Speed in Chromium. Uploaded artifacts include both browser reports, provenance/license JSON, the actual patch, and RapidRAW license text. Local and GitHub Actions run [39072091869](https://github.com/vedranius/creative-workspace/actions/runs/39072091869) passed with identical hashes and no browser errors; its artifact was downloaded and inspected.

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
