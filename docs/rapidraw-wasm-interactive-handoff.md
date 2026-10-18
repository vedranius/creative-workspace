# RWASM-03 — original interactive preview and Slider drag

Completed2026-10-18 after `789439f`, branch `codex/rapidraw-wasm-port`. Native CyberTimon/RapidRAW pin `b39884b38d8f148caef6fd0d52afd264951be329` and decoder/React source remain unchanged (AGPL3/source attribution preserved). This is an unfinished editor-port checkpoint, without product version/tag/release/install/demo change.

## Source and behavior

Original process_preview_job reads live_preview_quality (default high) and editor_preview_resolution (default1920), then an explicit target overrides the default. Full selects divisor1/q85; performance without ROI selects divisor1.5/q65; other values select divisor1/q75. Final response is always the full preview at q94. Original ROI selector1.8/1.4 values are retained in independent source tests; the browser still explicitly refuses ROI rendering.

`interactive_preview.rs` retains exact pinned selector and small-size excerpts plus the original area filter. Performance is NOT a one-step resize of original RAW: Quality→final512×384 area preview→target_size=f32(512/1.5) truncated341, small bounds341×255→original f32 aspect/rounding→actual340×255. This second stage and source f32 effective-scale arithmetic are preserved. Geometry/effect preprocessing remains neutral/unaccepted.

The document worker now caches its full final-preview base and derives the interactive image from that base. Final buffers are copied for transfer so the worker's cached pixels remain owned. The bridge reads actual original settings, distinguishes final and live-quality texture cache entries, uploads the selected actual frame and supplies source q65/75/85 or q94 to the original encoder. Interactive responses contain six little-endian u32 values followed by JPEG; without ROI the rectangle is0,0,width,height,width,height, using the actual processing dimensions. Original useImageProcessing reads that envelope and publishes its own blob URL/normalized patch.

The original hooks, stores, Editor/ImageCanvas, Basic/Slider remain unchanged. QA uses an original settings-store setter for the three presets, then real Playwright mouse down/move/up with Shift for the source Slider's fine-adjustment mode. Exposure reaches+0.8 while isSliderDragging is true. The QA waits for a new interactive render and matching original hook patch hash, then verifies the JPEG bitmap and patch rectangle. On release it waits for isSliderDragging=false, patch=null and a matching fresh q94 final URL; it resets Exposure to0 through the original numeric field between cases. There is no synthetic store mutation of the drag flag or fabricated native response.

## Actual evidence

[Browser report](evidence/rapidraw-wasm/interactive-browser.json) · [native references](evidence/rapidraw-wasm/interactive-native.json) · [source/WASM provenance](evidence/rapidraw-wasm/interactive-source.json) · [actual performance drag](evidence/rapidraw-wasm/interactive-drag-performance.png).

Only public CC0 raw.pixls.us1327 Canon DNG, SHA `f0d2fe47507fadf50008bddbc6bd2c5e39fddbe90cca6bca72dd360fa0e0eb38`. Reuses previously proven full Quality/source512×384 preview RGB, then independently compiles original interactive selector/filter/encoder and uses the native original wgpu renderer. This does not repeat decoder/guard parity as new progress. The existing native renderer requires all five camera fixture cases; the reference encoder selects the independently rendered+0.8 case (frame1).

| Preset | Actual frame | Quality | Complete response bytes |
|---|---|---:|---:|
|full|512×384|85|50,335|
|high|512×384|75|36,589|
|performance|340×255|65|16,277|

All103,201 response bytes (including72 header bytes),1,919,664 RGBA8 components, three RGB inputs and complete adjustment hashes match native exactly, zero tolerance. Original overlay has normalized rectangle[0,0,1,1] and the JPEG bitmap has the actual processing dimensions. Each release produces the exact native512×384 q94 JPEG at+0.8 (85,035bytes), then Exposure0 restores the original final hash. Original dimensions remain2048×1536 throughout.

Final sandboxed Chromium151/SwiftShader QA records GPU/page/network/external-request errors empty, patch cleared and drag false after all cases. Original save errors remain visible and expected; save/export explicitly refuse, without a write ACK. Existing eight malformed direct-WASM resize refusals, oversize-GPU refusal and same-worker512→256→512 exact recovery remain regression checks. QA context/browser/server and owned worker/resources close.

Core51/51 and doctests pass; three new tests cover source excerpt hashes, default/unknown/full/high/performance selector values including unaccepted ROI selector branches, source two-stage bit-exact filter output and malformed input refusal. Host20/20, npm run check, source hashes, focused syntax/rustfmt and diff checks pass. Buffer/upload estimates and30s worker deadlines remain scoped limits, NOT total peak-memory, hard GPU/JPEG deadlines or complete editor lifecycle acceptance.

## Reproduce and CI

Use existing verified Quality timing-compatible stage, Rust1.99/wasm-bindgen0.2.129 and mandatory low-impact build lock/helper (max2CPU,nice10,jobs1). No shared Cargo/upstream edits or security-profile changes. Native outputs use create_new; choose empty output directories and reuse source-pinned cached binaries.

```sh
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example interactive_preview_reference -- prepare NATIVE_FINAL_PREVIEW_RGB_F32 512 384 512 performance NEW_NATIVE_DIR
# Render NEW_NATIVE_DIR/rgb.f32 using its reported dimensions, the existing
# original five-case React camera settings and independent native wgpu binary.
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example interactive_preview_reference -- encode NEW_NATIVE_DIR NATIVE_RENDER_JSON NATIVE_PNG_DIR
node scripts/build-rapidraw-react-proof.mjs NATIVE_SOURCE NEW_STAGE QUALITY_WASM_DIR
node scripts/smoke-rapidraw-react.mjs BUILT_STAGE PUBLIC_DNG OUTPUT_JSON NATIVE_FINAL_JPEG_REFERENCE NATIVE_RESIZE_JSON NATIVE_INTERACTIVE_JSON
```

The native interactive JSON is an array containing full/high/performance reference objects. Actions now produces these from the actual Quality preview, runs the same original pointer-drag proof in its single QA context, and uploads native responses/PNGs/source/browser artifacts. Previous789439f Checks39148224347 succeeded; parity39148224422 was in progress at the one entry check. Fresh CI remains pending source publication; no other CI run is cancelled or restarted. Native preparation initially supplied one camera case; the existing binary correctly refused, so preparation reused all five required cases without changing its guard.

## Next ready task

Trace the original apply_spatial_transformations and original React rotate/flip controls, then port one bounded quarter-turn/flip geometry slice before preview GPU upload. Preserve source orientation ordering, aspect/dimension selection, original command/UI behavior and resource limits; prove actual source UI action plus native pixels/JPEG. Keep crop/straighten/warp/patch/effect and provider/export acceptance explicit until separately implemented.

ROI/noise-coordinate behavior, geometry and effect preprocessing/masks, metadata/sidecars, full original App/menus/library, analytics/WGPU_RENDER, export flow and common-provider destination/retention/write-ACK/uncertain recovery remain open. This browser-processing experiment is separate from original server adapters and is not publicly deployed. Private files, live studios/services and public demo remain untouched. Continue in this MAIN chat without a new writer/chat; A waitingOnApproval remains untouched.
