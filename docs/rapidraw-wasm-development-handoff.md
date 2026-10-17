# RWASM-02 — first developed pixels verified

## Completed slice

`experiments/rapidraw-wasm-core/src/development.rs` now runs the pinned `RawDevelop::develop_intermediate` path and the original `develop_internal` postprocessing for the native Speed demosaic mode. It preserves rawler demosaic, crop, white balance and calibration, native black/white rescaling, clipping recovery, clamp and EXIF orientation. The output is an interleaved `Float32Array` from a dedicated WASM worker. Both sensor and estimated developed output remain capped at 64 MiB; this is not a cap on all decoder or intermediate allocations.

A byte-identical copy of pinned `raw_processing.rs` is compiled in `examples/develop_reference.rs` against the same pinned rawler library. Its only host substitutions are the desktop types unused by development and the original `apply_orientation` mapping. Native RapidRAW Speed mode and the extracted native probe match every RGB f32 bit for the public CC0 Canon PowerShot A410 CHDK DNG: 512×384, 3 components. Chromium ran the optimized WASM in a dedicated module worker and independently hashed the returned pixel buffer in-browser; the hash matches the pinned native reference exactly. Pixel data is not included in the committed evidence. See [browser evidence](evidence/rapidraw-wasm/raw-development-pixels.json).

## Known WASM limitation

The native default Quality Bayer path enters rawler PPG, whose pinned implementation calls `std::time::Instant::now()`. That call panics on `wasm32-unknown-unknown`. The WASM host now returns an explicit unsupported error before entering PPG; it does not fall back silently. Keep native Speed available and do not claim Quality parity. The next step is to identify a source-faithful target-specific timer compatibility path that leaves PPG pixel arithmetic unchanged, or record that limitation if none is available.

This does not apply exposure to pixels, connect the original React UI, export, establish camera-format availability, or complete RWASM-02. The scalar exposure-stops gate remains separate. Continue only on `codex/rapidraw-wasm-port`; product version and public availability remain unchanged.

## Reproduction

Set `RAW_FILE` to the already licensed public Canon DNG and `ARTIFACT_DIR` to a private temporary directory. Use the existing Rust 1.99/cache and low-impact build limits from the prior handoff.

```sh
cargo test --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example develop_reference -- "$RAW_FILE" fast
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example develop_probe -- "$RAW_FILE" fast
cargo build --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --target wasm32-unknown-unknown
wasm-bindgen "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/cw_rapidraw_wasm_probe.wasm" --target web --out-dir "$ARTIFACT_DIR"
node scripts/smoke-rapidraw-development.mjs "$ARTIFACT_DIR" "$RAW_FILE" "$NATIVE_REFERENCE_JSON" "$NATIVE_PROBE_JSON" "$BROWSER_REPORT_JSON"
```
