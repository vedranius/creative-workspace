# RWASM-03 — original native JPEG preview boundary

Completed2026-10-18 on `codex/rapidraw-wasm-port`, after `db45e3b`. Original CyberTimon/RapidRAW pin `b39884b38d8f148caef6fd0d52afd264951be329` remains unchanged.

## Source and behavior

`src-tauri/src/lib.rs::process_preview_job` uses RGBA8 GPU output, `mozjpeg_rs::Encoder::new(Preset::BaselineFastest).quality(jpeg_quality).fast_color(true).encode_imgref`. Final quality is94. Original live-preview settings select interactive65/75/85; their resize/divisor calculation remains a separate transport task. Interactive responses prepend six little-endian u32 values: x,y,patchWidth,patchHeight,fullWidth,fullHeight. Final responses contain only JPEG bytes. This is distinct from original `WGPU_RENDER` sentinel mode.

The new core `preview.rs` retains this encoder and envelope, pinning mozjpeg-rs0.9.2/imgref1.12.2/rgb0.8.53. No existing lock version changed. `tests/reference/preview.rs` independently compiles the original encoding/header excerpts; UPSTREAM.json pins those excerpts plus the original React reader source. Codec BSD license is retained alongside original AGPL3 provenance.

WASM accepts already-rendered/cropped EightBit RGBA pixels; the host refuses SixteenBit reinterpretation, invalid sizes, qualities, malformed output and mismatched headers. Axis32768, input/full-frame RGBA and output64MiB caps remain explicit. The post-encode output cap is **not a total memory/allocator or encoder timeout guarantee**. `encodePreviewResponse` returns an exact ArrayBuffer (including typed-array offset handling) for the original hook's declared response type. No PNG-as-JPEG or substitute editor.

## Actual native/browser evidence

[Browser report](evidence/rapidraw-wasm/preview-browser.json) · [native file hashes](evidence/rapidraw-wasm/preview-native.json).

Public CC0 raw.pixls1327 Canon DNG, source SHA `f0d2fe47507fadf50008bddbc6bd2c5e39fddbe90cca6bca72dd360fa0e0eb38`. This proof reuses the first already-verified full-global native512×384 EightBit render; native PNG SHA `474bda433ee362b524b1816c968e0f49a2fbb2aa68dda1822bb41b9eb1865698`, RGBA SHA `5d18fe92928c361ac0fdaac7118c57b9f3ad408a8504f2eb5d84dc37cc3b3466`. It is actual developed RAW/render output, not an embedded camera JPEG or new claim of repeated RAW parity.

| Response | Native bytes | Browser result |
|---|---:|---|
| Final512×384,q94 |8416|Exact JPEG bytes, decode/object URL pass|
| Interactive512×384,q75,origin0,0 |4227|Exact header+JPEG, decode/object URL pass|
| Interactive211×139,q85,origin16,20 |1319|Exact header+JPEG, decode/object URL pass|
| Interactive101×77,q65,origin17,9 |782|Exact header+JPEG, decode/object URL pass|

**14,744/14,744 response bytes exact**, zero tolerance. Pinned original `useImageProcessing.ts` reader excerpts run in sandboxed Chromium151.0.7922.34, correctly decoding dimensions and offset/full-frame rectangles. All blob/object URLs revoked and the single QA context/server closed. Ten direct WASM empty/malformed/oversized/out-of-bounds/overflow/quality cases refuse; browser/page/network errors empty. Core45/45 (three new preview tests), host17/17, npm check, focused JS syntax/rustfmt/diff pass.

Reproduce with the existing cached Rust1.99/wasm-bindgen0.2.129 and mandatory low-impact build lock/helper (max2CPU,nice10,jobs1):

```sh
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example preview_reference -- NATIVE_GLOBAL_FRAME_0_PNG NEW_NATIVE_PREVIEW_DIR
node scripts/smoke-rapidraw-preview.mjs WASM_DIR NEW_NATIVE_PREVIEW_DIR OUTPUT_JSON
```

Native output refuses existing files. Actions now generates these references from its own actual native RAW/global PNG and runs the same comparison; response/RGBA files, source excerpts, reader and codec license go in the artifact. Previous full-global Checks39126148074 succeeded; parity39126148007 was in progress at the single entry check. Fresh preview CI follows normal publication. Initial private local reference generation used a wrong filename; corrected it to existing frame-0.png and reused built binaries, without rerunning builds or overwriting outputs.

## Precise next step

Implement the narrow original React open/render transport: mount the pinned original useImageLoader/useImageProcessing path with original stores/panels, translate load_metadata/load_image/apply_adjustments using actual RAW/as-shot/full-global processing and the now-verified JPEG response. Trace original size/readiness/metadata and preview resize/cache/job supersession/cancel/error contracts first. Do not invent EXIF or silent success for unavailable commands. Preserve file handles/permissions, privacy/resource gates and explicit unsupported masks/preprocessing/geometry/analytics/save commands. Prove actual public RAW open and a Basic exposure edit in original React; no replacement editor or public deployment.

Do not call this proof a mounted React editor: only its exact reader excerpts execute here. The independent odd-dimension images are cropped from a verified full render for codec/header proof; this is not original GPU ROI/noise-coordinate/resize parity. Cache/lifecycle/supersession/timeout/cancel, analytics and the WGPU_RENDER frontend mode remain separate. Full original controls that need preprocessing textures, masks/geometry, metadata/XMP and full save/provider/write-ACK/recovery remain open. No private photograph/EXIF/path, user service/studio, public demo, product version, tag/release or OS availability claim changed. Continue in MAIN; A awaiting approval stays untouched.
