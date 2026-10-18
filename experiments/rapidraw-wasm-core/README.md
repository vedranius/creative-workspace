# RapidRAW browser renderer host boundary

`webgpu-renderer.js` dispatches the pinned RapidRAW `shader.wgsl` main entry
with all 14 original bindings and accepts the upstream `AllAdjustments` Pod
bytes unchanged. It uses the same `rgba16float` storage-format substitution and
`HIGH_PRECISION_OUTPUT=1` specialization as the pinned native high-precision pipeline and maps the output asynchronously,
returning tightly packed RGBA16F rows. The caller must provide textures and
samplers from RapidRAW's existing preprocessing stages; this module does not
replace those stages or calculate adjustment packing itself.

The copied `shader.wgsl` is from `CyberTimon/RapidRAW` commit
`b39884b38d8f148caef6fd0d52afd264951be329`, path
`src-tauri/src/shaders/shader.wgsl`, SHA-256
`9ecb4cc31b8ce4a12f439f69935ed0c8c27f58b52501929e0dc41d22e85ca178`.
It is distributed under the upstream AGPL-3.0 license; see
`tests/reference/RapidRAW-LICENSE`.

`renderer_adjustments.rs` copies the pinned `repr(C)`/Pod field layout and
provides a finite, source-layout neutral/exposure fixture constructor. The
browser host can call `packNeutralExposureAdjustments(wasm, exposure)` and pass
those 45,232 bytes directly to the original binding. This is not RapidRAW's
JSON/UI/baseline adjustment parser; it is only a bounded shader fixture.

The Node tests use a deterministic WebGPU device double to check original
binding order, dispatch dimensions, async readback, limits and unsupported
handling. They are protocol tests and do not prove that a browser GPU executed
the shader. Previous default launches lacked `navigator.gpu`. An isolated sandboxed Chromium
launch with explicit WebGPU/SwiftShader flags now executes the full shader and
reads back three finite9×3 exposure frames. The adapter is software, not a
hardware performance result. Independent native shader-fixture comparison now passes (software324/324 exact,
native NVIDIA at most one f16 step); real RAW/preprocessing and full native-engine
frame comparison remain open. [Current comparison](../../docs/rapidraw-wasm-webgpu-native-handoff.md). See [real execution evidence and reproduction](../../docs/rapidraw-wasm-webgpu-execution-handoff.md).

## Original exposure input slice

`ui_exposure.rs` and `packUiExposureFixture(wasm, json, asShot, options)` implement the original top-level exposure number, activeTools/legacy basic visibility and boolean baseline marker, using explicit camera exposure/settings. The bounded JSON input becomes exposure in an otherwise neutral45,232-byte payload. This does not map other controls or extract metadata. Independent native/actual browser WASM proof covers216 cases and11 invalid-input refusals. [Source, reproduction and remaining acceptance](../../docs/rapidraw-wasm-ui-exposure-handoff.md).

## Real RAW renderer slice

`renderer_upload::pack_rgb32f` / WASM `pack_rgb32f_renderer_input` and the JS
`packRgb32fRendererInput` host preserve the original RGB32F branch of
`gpu_processing::to_rgba_f16`: half rounding and alpha1. The independent full
original conversion function is retained with source hash. This API admits only
finite values within±65504, valid dimensions and bounded64MiB input/output.
`createNeutralRendererResources` accepts those Uint16Array words as
`inputRgbaF16`, uploads RGBA16F input/blur fixtures and keeps guided coefficients
RGBA32F. Its64MiB combined upload estimate is not a total-memory guarantee.

Actual worker development of the hash-pinned public CC0 Canon DNG feeds that
boundary and the full shader at three exposures. All2,359,296 f16 components
match the independent original native development/upload/shader reference;
input/adjustment hashes also match. Other preprocessing is still neutral,
camera exposure inputs are explicit fixture settings rather than extracted
metadata, and the original UI/editor/export/providers remain open.
[Reproduce and next gate](../../docs/rapidraw-wasm-raw-render-handoff.md).

## Original rendered PNG path

Native `render_output_precision` chooses EightBit for PNG, and SixteenBit only
for16-bit TIFF. `renderOriginalFrame({outputPrecision:"eight",...})` therefore
keeps the full original RGBA8 WGSL/dither specialization; the existing default
SixteenBit probe mode is retained explicitly. `encodeRenderedFramePng` accepts
only a bounded RGBA8 render and forwards it to WASM
`encode_rendered_rgba8_png`; it refuses SixteenBit reinterpretation. The source
PNG branch preserves RGBA8/alpha, ICC and optional DPI without converting to
RGB16. Raw codec-only RGB-f32 APIs remain separate.

Three real public RAW-derived exposure renders/PNGs match native byte-for-byte;
all decode and completed download hashes pass. Six malformed direct WASM inputs
reject. Remaining effects/preprocessing are neutral and camera exposure inputs
are explicit fixtures; metadata/XMP, transforms/watermarks, original UI and
provider/full export acceptance remain open.
[Current handoff](../../docs/rapidraw-wasm-rendered-png-handoff.md).

## Original camera exposure metadata

`camera_exposure::read_raw_exposure` and the WASM `read_raw_exposure` API preserve the exact pinned reader/helpers and dummy `read_as_shot` monochrome rule. Existing input/sensor preflight runs first; dummy dimensions and finite exposure metadata are checked. `worker.js` accepts `output: "exposure"` to return only `sceneReferred`, `dngBaseline`, and `highlightPreservation`. It does not return EXIF/location data or pretend to convert WB. Native exposure metadata and36 downstream original UI mappings match in Chromium on the CC0 Canon DNG (−0.5EV) and two explicit signed-rational derivatives. Four invalid/resource cases refuse. [Reproduction, native reference and limits](../../docs/rapidraw-wasm-camera-exposure-handoff.md). Earlier render reports retain their explicit fixture metadata; they are not retroactively relabeled as camera-driven frame parity.

## Original as-shot WB boundary

`camera_as_shot::read_as_shot`/WASM `read_as_shot` preserve original dummy metadata decode, monochrome fallback, camera-neutral coefficients and single/dual-illuminant selection. Full `white_balance.rs`, Robertson/Bradford math and pinned color helpers remain unchanged. `worker.js output:'as-shot'` returns only WB/exposure, with existing preflight/dimension/finite guards. `map_white_balance(json,temperature,tint)` runs original absolute/relative WB controls and adaptation/matrix mapping behind bounded JSON/finite input/output checks. Actual public-DNG proof matches58/58 native scalars exactly; the independent native harness now uses real original WB instead of a stub. [Reproduction and limits](../../docs/rapidraw-wasm-as-shot-handoff.md). This has not yet fed WB fields into the full shader/PNG proof or connected original React UI/providers.

## Real camera metadata to shader/PNG

`camera_renderer::camera_adjustments`/WASM `pack_camera_renderer_fixture` and host `packCameraRendererFixture` connect original WB visibility, actual as-shot metadata, original adaptation/gains, source GPU matrix packing and existing original exposure mapping. Other fields retain the neutral fixture. Actual public-DNG worker metadata drives five full WGSL EightBit/PNG frames with exact independent native adjustment/image/PNG bytes and completed downloads. [Evidence, source pins and next step](../../docs/rapidraw-wasm-camera-render-handoff.md). Full global defaults/controls, masks/preprocessing, original React and providers remain open.

## Full original global controls

`renderer_adjustments::full_global_adjustments`/WASM `pack_global_renderer_fixture` and host `packGlobalRendererFixture` run the full pinned global parser/defaults/helpers, retaining real WB/exposure. Native reference compiles independent original type/parser/helper copies.18 complete global payloads match, and five public RAW cases including tones/curves/HSL/grading/calibration/AGX produce byte-identical native shader/PNGs with completed downloads. Host guards reject oversized/unordered/out-of-domain curves, nonfinite output and unknown tone overrides. [Scope, reproduction and next original React transport task](../../docs/rapidraw-wasm-global-controls-handoff.md). Mapping all global effect fields does not implement their preprocessing textures; masks/geometry/preview transport/React/providers remain open.
