# Original rendered PNG slice — 2026-10-18

## Source decision and implemented behavior

Tracing pinned `export_processing::render_output_precision` found that the
normal PNG export selects **EightBit**, retaining original dithering. Only
16-bit TIFF selects SixteenBit. A copied, hash-pinned original selector now
compiles in the reference tests, with only host enum/settings types supplied.
The previous codec-only RGB-f32→RGB16 proof remains valid as a codec slice; it
was not the normal rendered PNG route. No RGBA16F→PNG shortcut was introduced.

`renderOriginalFrame({outputPrecision:"eight",...})` now dispatches the full,
unchanged original WGSL to RGBA8 storage/readback, with HIGH_PRECISION_OUTPUT=0.
The existing SixteenBit probe default/high-precision specialization remains
available. `encodeRenderedFramePng` accepts only actual bounded RGBA8 frames,
rejecting SixteenBit reinterpretation and invalid DPI. WASM
`encode_rendered_rgba8_png` constructs ImageRgba8 and uses the existing original
PNG branch, preserving alpha, sRGB ICC and optional DPI. It bounds dimensions,
exact input length and input/encoded output at64MiB; this is not total allocator
protection. The original PNG branch/ICC/DPI/CRC math is unchanged.

The independent native wgpu reference uses the original EightBit pipeline
creation excerpt (only local variable names/expression wrapper mapped), original
bindings/shader, ImageRgba8 and the original PNG encoder reference. Its
flate2=1.1.9 pin matches the original native/core lock; the latest compressor
must not silently become the reference. PNG outputs use create_new. Source
pin b39884b/AGPL attribution and excerpt mappings remain in UPSTREAM.json.

## Actual evidence

[Browser report](evidence/rapidraw-wasm/raw-render-png.json) covers actual public
CC0 Canon DNG → existing WASM Speed worker → original f16 upload → explicit
exposure mapping → original EightBit shader/dither → original PNG codec.
Three512×384 frames at -1/0/+1 stops compare **2,359,296/2,359,296 byte components
exactly**, with matching input RGB/f16 hashes and all adjustment bytes. No
relaxed byte tolerance is used. Software SwiftShader adapters are identified;
no hardware performance claim.

All three PNGs match native **byte-for-byte**:341,836 /386,072 /424,473 bytes.
They are8-bit RGBA (color type6), with the original sRGB profile and300DPI.
Chromium decodes every PNG; all three completed download streams have matching
hashes/lengths and no download failure. Six malformed direct WASM encoder
inputs reject. GPU/page/network errors are empty. [Compact native summary](evidence/rapidraw-wasm/rendered-png-native-summary.json)
records source/input/frame/PNG hashes and the full reference JSON SHA256;
large output-word JSON and PNG binaries stay in scratch/Actions evidence.

Core32/32, native reference source/ABI1/1, host14/14, repo check, Rust format,
script syntax and diff checks pass. Core tests independently verify the source
precision selector, exact native RGBA8 PNG bytes including partial alpha, decode
and malformed/budget refusals. Protocol tests verify original EightBit shader,
storage, dither specialization and rejection of SixteenBit misuse. Actual
browser decode/download proof is separate from these protocol fixtures.

Prior43431e2 [parity39109630466](https://github.com/vedranius/creative-workspace/actions/runs/39109630466)
passed; its downloaded real-RAW report confirms2,359,296 exact f16 components
and input upload hash. That hosted result predates rendered PNG. Fresh hosted
verification of this new step remains pending source push.

## Reproduce

Reuse the existing original native RGB file/current WASM artifact, Rust1.99/
wasm-bindgen0.2.129 caches and the shared low-impact build lock. Supply the test
Chromium SwiftShader ICD only in the native child environment, no global driver
changes. Existing output files are refused; choose a fresh directory:

```sh
cargo run --release --locked --manifest-path experiments/rapidraw-native-render-reference/Cargo.toml -- --rgb-f32 ORIGINAL_NATIVE.f32 512 384 --eight-bit --png-dir NEW_PNG_DIRECTORY > native-png-reference.json
node scripts/smoke-rapidraw-webgpu.mjs "$WASM_DIR" report.json native-png-reference.json PUBLIC.dng NEW_PNG_DIRECTORY
```

The public RAW digest/CC0 record is checked before loopback serving. Private
fixtures cannot be substituted. The Actions runner now performs both earlier
SixteenBit proofs and this EightBit PNG path sequentially, uploading native
PNGs/full reference, browser report, source selector/pipeline excerpts and
license/provenance. Missing capability/divergence fails, never skips. QA context,
loopback server and blob URLs close/release after completion.

## Remaining acceptance and next task

This is a source-faithful rendered PNG **slice**, not the complete original
export/editor. Remaining preprocessing/effects are neutral. Camera/as-shot
exposure inputs remain explicit fixture values (sceneReferred=true, baseline0,
highlightPreservation0; absent/disabled baseline marker). Metadata/XMP copying,
GPS settings, transforms/watermarks, original React UI, full settings/WB and
common-provider write/recovery acceptance remain open. A completed test-browser
download does not establish real laptop-folder permission or provider write ACK.
Private photos/originals, protected services and demo were untouched. No new
product version/tag/installable release/demo availability claim.

Next bounded task: extract original camera/as-shot exposure metadata from the
pinned native reader, first on the public DNG, compare an independent native
reference and feed it into existing baseline/exposure mapping. Trace original
white-balance dependencies; keep unimplemented WB/settings explicit rather than
presenting zero metadata as automatic camera support. Reuse cached artifacts;
preserve RAW resource/privacy gates and the private RAF development budget.
Continue in MAIN only; A's approval-waiting checkout remains untouched.
