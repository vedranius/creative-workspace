# RapidRAW WASM PNG codec checkpoint — 2026-10-18

## Verified local result

The full public-fixture runner passed both original pixel modes, PNG bytes, browser decode/download and exposure regression. Quality output is2048×1536, 15,823,705bytes, SHA256 `f339e40cd74692a02afbc52b2e487930ff452293398a1d530eda7f8964013866`; Speed is512×384, 1,032,380bytes, SHA256 `173420c1a8a03539c6b70f54e020f2165808cd6e3a1723e7b8240e4a48f39862`. Both contain RGB16, the original sRGB ICC and300DPI. Browser download streams match the native file bytes, all8 invalid PNG cases reject, and both modes report zero page errors/failed requests. [Local evidence bundle](evidence/rapidraw-wasm/png-codec/). Final-source Actions verification remains pending until the normal source push.

## Source and behavior

This is the native export **encoding boundary**, separate from the renderer. `src/png_export.rs` preserves the pinned `export_processing.rs` PNG branch: RGB-f32 becomes RGB16, `PngEncoder` embeds the original sRGB ICC profile, and optional DPI inserts the original `pHYs` chunk with the original CRC implementation. The pin is RapidRAW `b39884b38d8f148caef6fd0d52afd264951be329`; source/excerpt/ICC hashes and exact native compression versions are in the experiment's `UPSTREAM.json`. Original code is AGPL-3.0; the 736-byte ICC profile is CC0-1.0, with upstream attribution in `assets/README.md`.

The native reference harness compiles independent, byte-identical original branch/helper excerpts from `tests/reference/`; it does not call the production encoder. Tests check excerpt identities, shared/reference source equivalence, exact native bytes, RGB16 decode, ICC preservation, five DPI settings and malformed-input refusal. PNG/compression versions match the pinned native lock: image0.25.10, png0.18.1, flate2 1.1.9, fdeflate0.3.7, crc32fast1.5.0, miniz_oxide0.8.9, bitflags2.13.1, adler2 2.0.1 and simd-adler32 0.3.10.

`encode_rgb32f_png(width, height, pixels, dpi)` is a shared native/WASM operation. It accepts finite RGB pixels only, requires matching dimensions, caps axes at32768 and input RGB-f32 bytes at64MiB. The encoder writer bounds encoded output at64MiB. These are individual buffer limits, not a total allocator/decoder-intermediate memory cap. No automatic source-file overwrite, filesystem path or EXIF metadata copy exists in this operation.

The experimental real RAW worker accepts `output: "codec-png"` and optional integer DPI0–65535. Its default remains float-pixel output. The codec mode develops through original rawler Speed/Quality and then encodes those pixels; its response explicitly states that native GPU rendering/tone mapping is not connected. The result is a codec proof, not the original editor's final rendered photograph. Do not label it full export parity or publish it as a replacement editor.

## Verification and reproduction

The focused Actions workflow now includes original native Quality/Speed pixel comparisons, PNG-byte parity for both modes, browser PNG decode and completed browser download byte/hash comparison, plus exposure regression. A downloaded Blob reaching the browser's download manager is not proof of a common-provider laptop write ACK or OS folder permission. The smoke accepts only the SHA256-pinned public CC0 Canon DNG; private RAFs are not used.

Use the existing compiler/cache and low-impact wrapper with the shared build lock. Locally set PATH/RUSTC to Rust1.99 and wasm-bindgen0.2.129, `PLAYWRIGHT_MODULE`/`CHROMIUM_PATH` to existing QA tools and `CARGO_TARGET_DIR` to the existing external cache. Run:

```sh
node scripts/ci-rapidraw-pixel-parity.mjs /absolute/private/evidence-directory
```

The runner fetches only the pinned public fixture, stages the reviewed timer-only decoder, compiles original native references and the WASM core, compares both pixel and PNG hashes in dedicated Chromium workers and removes its temporary build/input/download files. Output evidence includes licenses, source/patch/profile provenance and JSON reports, with no private images. An explicit CARGO_TARGET_DIR is respected, so local builds reuse the host cache; otherwise the target is temporary. Actions uses pinned Rust1.99, wasm-bindgen0.2.129 and Playwright1.55.

For an individual native PNG reference:

```sh
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example develop_reference -- "$PUBLIC_DNG" quality "$NATIVE_PNG"
node scripts/smoke-rapidraw-png.mjs "$WASM_DIR" "$PUBLIC_DNG" "$NATIVE_PNG" "$REPORT_JSON" quality
```

The optional native example output is a codec-only image made from original developed RGB; no renderer is invoked. Private originals, protected studios, existing user services and the public Pages demo remain untouched.

## Next actual implementation

Port the **original renderer**, rather than adding more substitute CPU adjustments. The pinned `src-tauri/src/gpu_processing.rs` exports `process_and_get_dynamic_image_with_precision`; the native export uses that result before the codec. It currently couples Tauri/AppState/cache, synchronous device polling and desktop display ownership. Browser adaptation must supply asynchronous device/readback/host boundaries while retaining the original WGSL and adjustment data layout.

Start with an independent owned browser WebGPU compute path for `src-tauri/src/shaders/shader.wgsl`, preserving the entire shader and its14 bindings, exact `AllAdjustments` layout, source/profile/license hashes and explicit browser capability checks. Use a bounded public/neutral fixture and native-reference render comparison. No GPU, unsupported limits or shader validation must produce an honest unsupported result; do not silently use CPU analysis helpers or substitute rendering algorithms. Native host readback using synchronous `Device::poll(Wait)` must become an async browser completion path. Keep extended effects/masks/LUT/preview16-bit format, full adjustment parity and original React UI as explicit open gates. A shader compilation alone is not a functioning renderer.

Continue only on `codex/rapidraw-wasm-port`, with one active writer. Preserve the private RAF's current allocation refusal, untracked local target directory, all live documents/services and completion-driven successor policy. This unfinished experimental branch does not bump the installable product version or publish a release/demo editor.
