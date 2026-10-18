# Independent RapidRAW native shader reference

Compute-only test executable, not an application adapter or a desktop rebuild.
It compiles exact pinned original `image_processing.rs` structs and
`gpu_processing.rs` bind-group/high-precision pipeline excerpts, plus the full
original WGSL. `UPSTREAM.json` records source pin, paths, hashes and the two
expression-block wrappers. The native pipeline preserves
`HIGH_PRECISION_OUTPUT=1`, RGBA16F storage and the original effect order.

Original source: [CyberTimon/RapidRAW b39884b](https://github.com/CyberTimon/RapidRAW/tree/b39884b38d8f148caef6fd0d52afd264951be329),
AGPL-3.0. The unchanged [upstream license](../rapidraw-wasm-core/tests/reference/RapidRAW-LICENSE)
applies to these excerpts/shader. Dependencies keep their own licenses. This
test executable and its source are not an installable cross-platform bundle.

The separate native host creates bounded9×3 synthetic resources and performs
native wgpu29/Vulkan dispatch, padded readback and f16-bit reporting. It does
not import browser host functions. The original Tauri/AppState/cache,
preprocessing and full `process_and_get_dynamic_image_with_precision` function
are not compiled. Blur resources contain unchanged input, guided-filter
coefficients are neutral, masks are empty and the LUT is identity. All effects
except exposure are neutral. Input binary fractions are exactly representable
in both native f16 textures and browser f32 fixture textures; arbitrary input
quantization remains a separate gate.

Use the existing Rust1.99 toolchain/cache and the low-impact shared build lock:

```sh
cargo test --release --locked --manifest-path experiments/rapidraw-native-render-reference/Cargo.toml
cargo run --release --locked --manifest-path experiments/rapidraw-native-render-reference/Cargo.toml > native-reference.json
node scripts/smoke-rapidraw-webgpu.mjs "$WASM_DIR" browser-report.json native-reference.json
```

The browser comparison checks the source shader, dimensions, input hash and
every adjustment byte before comparing all324 f16 components. The declared
bound is at most one f16 representable step for RGB, exact alpha; no tolerance
for arbitrary effects is implied. Native reports include every output word,
frame hash and actual adapter identity. No private photograph is used.

For a repeatable software native adapter, pass the test Chromium distribution's
`vk_swiftshader_icd.json` using child-only `VK_DRIVER_FILES` and
`VK_ICD_FILENAMES`; do not change global Vulkan/driver configuration. The
Actions runner applies this explicitly and uploads the native/browser reports,
original excerpts, source metadata and upstream license. Missing adapters or
frame divergence fail, never skip as success. See the
[handoff and scope](../../docs/rapidraw-wasm-webgpu-native-handoff.md).

## RAW-developed input mode

The reference also accepts an explicitly bounded little-endian RGB-f32 file:

```sh
cargo run --release --locked --manifest-path experiments/rapidraw-native-render-reference/Cargo.toml -- --rgb-f32 INPUT.f32 512 384
```

It uses the exact original `to_rgba_f16` function on ImageRgb32F. The supplied
file must have exact length, finite values within±65504, valid axes and fit the
same64MiB combined neutral texture upload-payload cap; this is not total memory
protection. The core `develop_reference` example optionally writes original
native RGB samples as its fourth argument, exclusively creating a new file.
The Actions test derives that file from the hash-pinned CC0 DNG and compares
actual worker→f16 upload→full-shader browser output; it never supplies private
photographs. [Real RAW proof/scope](../../docs/rapidraw-wasm-raw-render-handoff.md).

## Original EightBit PNG reference

Add `--eight-bit --png-dir NEW_DIRECTORY` to the RGB input command to retain
the original unmodified EightBit shader, default HIGH_PRECISION_OUTPUT=0/dither,
RGBA8 storage/readback and original PNG branch. The PNG compressor is pinned
flate2=1.1.9 to match the original native/core lock. Files `frame-0.png` through
`frame-2.png` use create_new; existing output is refused. The JSON includes
actual RGBA8 words and PNG hashes. SixteenBit remains the separate source
pipeline for the high-precision fixture, not the normal native PNG export.
Source excerpt/name mappings and AGPL attribution remain in UPSTREAM.json.
