# RWASM-03 post-render JPEG codec — 2026-10-19

The pinned native `export_images` path renders the full transformed image before export geometry. Its JPEG encoder is `image::codecs::jpeg::JpegEncoder`, distinct from the mozjpeg preview encoder. This experiment adds that **post-render** slice: bounded RGBA8 → original f32 resize target → Lanczos3 RGBA resize → RGB8 JPEG, original 736-byte sRGB ICC and optional JFIF DPI. The supported contract has no EXIF/XMP copy (`keepMetadata=false`), border, pad or watermark. Unknown fields refuse.

Full browser RAW→GPU→export and the original **ExportPanel** remain unaccepted. `export_images` stays unavailable through the browser bridge. The existing diagnostic `export_image` name is not the native command ID. There is no public editor/demo/product release change.

## Evidence

- [Native source/reference](evidence/rapidraw-wasm/jpeg-export-native.json): unchanged pinned resize types/function and JPEG branch, exact source ICC; 108 native comparisons across landscape/portrait/square, all four resize modes, dontEnlarge, alpha, qualities1/90/100 and DPI none/300/65535.
- [Sandboxed Chromium](evidence/rapidraw-wasm/jpeg-export-browser.json): seven real full native-rendered public CC0 DNG cases match **2,357,232 JPEG bytes exactly** in WASM. Sizes:2048×1536,1024×768,512×384,777×583,444×333. JPEG decoding, SOF dimensions, ICC and JFIF DPI verify. No external requests, failed requests or page errors.
- Each browser output is written to a unique QA OPFS directory, closed and read back with matching SHA256. An actual aborted write persists zero bytes, reports no success, retains655,924 recoverable bytes and performs no replay. QA files/context/worker/server close afterward. This is OPFS API evidence only: it does **not** prove the original app save lifecycle or real OS destination-folder permission.
- Eleven malformed/oversize/truncated browser requests refuse; the same worker then reproduces the original full output hash. Native guards also cover the Lanczos intermediate. `npm run check`, focused syntax/format/source pin checks and68 core tests/doctests pass.

The real native input is the previously proven public DNG Quality-developed2048×1536 RGB, SHA256 `f052bba0940702e068fb03d6a9f1cc78b9c57e7ff5758f1c460f28d11fb49e30`. One original camera-reference frame (exposure−0.5) is rendered through the unchanged full EightBit shader. Native RGBA8 SHA256 is `e6273b8a5b8d8d653e6cbe19328ac88a77caae50af2f5295cf3c7a8444888bae`. Browser codec input is these full native pixels, **not** a browser full-resolution render or enlarged preview.

## Bounds and reproduction

The standalone native reference now has explicit `--export-codec-reference`: one EightBit camera frame, exactly2048×1536,64MiB input and256MiB estimated texture payload limit. This permits the239,075,460-byte native reference payload; the browser preview's64MiB estimate is unchanged. No complete GPU/allocator/peak-RAM protection is claimed.

The codec rejects zero/oversize axes, nonexact RGBA length, settings over4096 bytes, unknown fields, quality outside1–100, DPI outside1–65535, invalid resize mode/value and zero rounded output. Source, target RGBA8, vertical source-width×target-height RGBA-f32 intermediate and encoded output each have a64MiB cap. These are separate buffers, not an aggregate peak-memory guarantee; wasm-bindgen also copies input before the Rust helper runs. The QA worker has a60s terminate deadline.

Reuse Rust1.99, pinned dependencies, prepared timer-only decoder stage and matching wasm-bindgen. Build core/native reference through existing low-impact wrapper/shared lock. For the native full render, reduce existing public camera settings to its first frame, then run:

```text
cw-rapidraw-native-render-reference --rgb-f32 PUBLIC_QUALITY_RGB 2048 1536 --eight-bit --export-codec-reference --png-dir NEW_NATIVE_PNG_DIR --camera-settings ONE_FRAME_SETTINGS
jpeg_export_reference NEW_NATIVE_PNG_DIR/frame-0.png NEW_CODEC_DIR
node scripts/smoke-rapidraw-jpeg-export.mjs WASM_DIR NEW_CODEC_DIR REPORT_JSON
```

The codec harness uses create-new files/directories. Use one sandboxed QA context and a short disk-backed TMPDIR. Reference source and ICC remain AGPL-attributed; private RAFs are unnecessary.

## Next ready steps

Alternate to A in MAIN: verify exact alpha62 Checks39226350612/Build39226350624, immutable tag/draft and fresh Actions assets/checksums. Then prove original Text Tool/caret/typing geometry on the selected second page against server output.

Next B: establish an explicit export render budget/lifecycle that can process this full public DNG in browser with original full transformations and EightBit pipeline **before** Lanczos3 resize; preserve the preview cap. Prove native full RGBA/codec parity, cancellation and recovery before connecting the original ExportPanel `export_images` and real destination write ACK. Full effects/ROI/fractional geometry/metadata/providers/storage acceptance remains open. Continue MAIN only; no new writer/chat or implicit main merge.
