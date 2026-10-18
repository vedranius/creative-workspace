# Latest rendered PNG checkpoint — 2026-10-18

Source tracing confirms original PNG selects EightBit/dither (SixteenBit is16-bit TIFF). Three actual RAW-derived RGBA8 PNGs now match native byte-for-byte with decode/completed download and six malformed refusals. [Current source/proof/next task](rapidraw-wasm-rendered-png-handoff.md). Remaining preprocessing/camera metadata/original UI/providers/full acceptance remain open. Prior43431e2 hosted raw-frame report was downloaded and verifies2,359,296 exact f16 components.

# Real public RAW Speed renderer slice — 2026-10-18

## Actual connected behavior

The existing actual RAW module worker now feeds the renderer in the test flow:
hash-pinned public CC0 Canon DNG → original Speed development → original RGB32F
to RGBA16F upload → explicit original exposure mapping → full pinned
high-precision WGSL → async RGBA16F readback. The original shader is unchanged;
`HIGH_PRECISION_OUTPUT=1` remains set. This is an experimental proof flow, not
a public UI/editor or a new worker render command exposed to users.

`renderer_upload.rs` extracts only the original `gpu_processing::to_rgba_f16`
RGB32F branch, using the same pinned half2.7.1 conversion and alpha1. The full
unchanged original function (plus type imports) is retained independently in
native references; hashes/source pin/AGPL attribution are recorded. The WASM
API and JS host bound shape, axes and input/output buffers at64MiB and refuse
nonfinite/out-of-range (±65504) values. Native values within that admitted
domain retain original rounding, including signed zero/subnormal/tie cases.
The other DynamicImage branches are not claimed as a WASM upload API.

The neutral resource factory now accepts actual Uint16Array f16 words, creates
RGBA16F input/blur fixtures and keeps guided coefficients RGBA32F. It refuses
simultaneous f32/f16 inputs, malformed/nonfinite words and combined upload
payloads over64MiB. This accounts for payloads, **not total CPU/GPU/intermediate
memory**. Existing sensor/developed-output limits are unchanged.

## Evidence

[Browser report](evidence/rapidraw-wasm/raw-speed-render.json) records actual
sandboxed Chromium151/SwiftShader and the existing module worker, not a device
double. Three512×384 frames at -1/0/+1 stops compare **2,359,296/2,359,296 f16
components exactly**, with exact alpha, developed-RGB hash, f16 input hash and
all45,232 adjustment bytes. Each frame contains1,572,864 bytes. No GPU/page/
network errors. [Compact independent native summary](evidence/rapidraw-wasm/raw-native-render-summary.json)
records all three native frame hashes and the full native reference SHA256.
The large native output-word JSON stays in test scratch/Actions evidence.

The native RGB file comes from the unchanged pinned `raw_processing.rs`
reference, not the extracted probe; its RGB hash remains
`d9d7e96227a8346bd6599f1987aa4f30ee53403e4284a3161c62478507baf53a`.
The independent native shader harness uses the exact original conversion
function on ImageRgb32F. Browser worker pixels and WASM conversion must match
both hashes before comparison. The public fixture digest/CC0 provenance is
checked before serving it on loopback; private inputs are not admitted by this
proof. No private photograph/original/live service/demo was touched.

Core native tests30/30, native reference source/ABI1/1, focused host12/12, repo check, format/syntax/diff checks
pass. The first local browser launch timed out while it and npm were visibly
waiting for disk I/O. After npm completed and that context closed, one
cache-reusing final browser test passed, without a rebuild/security change.
Prior da37854 [parity39108228207](https://github.com/vedranius/creative-workspace/actions/runs/39108228207)
passed; its downloaded report verifies324 exact synthetic components. Fresh
real-RAW Actions results remain pending this source push.

## Reproduce

Use existing Rust1.99, wasm-bindgen0.2.129, caches, the shared low-impact build
lock and the short disk-backed QA TMPDIR. The core native `develop_reference`
example accepts an optional fourth argument for RGB-f32 output after its
optional PNG output; both use `create_new` and refuse existing destinations:

```sh
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example develop_reference -- PUBLIC.dng fast NEW.png NEW.f32
cargo run --release --locked --manifest-path experiments/rapidraw-native-render-reference/Cargo.toml -- --rgb-f32 NEW.f32 512 384 > native-reference.json
node scripts/smoke-rapidraw-webgpu.mjs "$WASM_DIR" browser-report.json native-reference.json PUBLIC.dng
```

Use the test Chromium's SwiftShader ICD in the native child for software
comparison. The Actions runner already builds the required artifacts,
generates original RGB/native frames sequentially, compares the browser and
uploads reports, full native words, original conversion/source excerpts and
license/provenance. It asserts actual software adapter identity. Missing
capability/divergence fails, never skips. No global driver/security changes.

## Limits and next ready task

Only one licensed Bayer DNG in Speed mode and neutral remaining effects are
verified here. Exposure UI values -0.8/0/+0.8 map to -1/0/+1 stops; baseline
marker is absent/disabled and camera exposure inputs are explicitly supplied
as sceneReferred=true, dngBaseline=0, highlightPreservation=0. **Camera/as-shot
metadata is not extracted.** Original guided-filter/blur/effect preprocessing,
white-balance/full settings, masks/LUTs, Quality renderer resources, original
React UI, complete native engine/export and common-provider acceptance remain
open. The private RAF development budget stays unchanged. No new installable
editor release, product version/tag or public-demo update is claimed.

Next: trace the pinned post-render high-precision output conversion and connect
the native PNG branch **after** the actual renderer. Compare final native/
browser PNG bytes, decode and completed download, preserving exact native
quantization, color-space handling, ICC/DPI and allocation guards. Do not reuse
pre-render developed pixels as edited exports or silently substitute CPU
exposure math. Keep remaining original UI/preprocessing/provider gates explicit.

Continue in MAIN on `codex/rapidraw-wasm-port`; no new chat/writer while
permission inheritance differs. A's approval-waiting checkout remains untouched.
