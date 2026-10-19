# RWASM-03 — post-render JPEG export codec (2026-10-19)

The pinned native Lanczos3→RGB8 JPEG encoder, sRGB ICC and optional JFIF DPI now run in WASM on full native-rendered public DNG pixels. Seven browser outputs match2,357,232 native bytes;11 malformed/oversize/truncated requests refuse and the same worker recovers. Real OPFS close/readback and aborted-write QA pass. [Evidence, limits and next task](rapidraw-wasm-jpeg-export-handoff.md).

This is the post-render codec only. Full browser render, original ExportPanel/export_images, OS folder permission and provider acceptance remain open; browser preview budgets and public demo stay unchanged. Native reference full-image mode is explicit and separately bounded. No peak-memory safety or product release claim. Next A: alpha62 release gate and selected-page editing; next B: full browser export render/lifecycle before original UI wiring. MAIN only.

# RWASM-03 — original post-fine Exposure drag (2026-10-19)

Six actual original Exposure drags after+5.3/−7.1° fine rotation now match native full/high/performance preview sizing, complete GPU upload/adjustments/pixels/JPEG/header, and q94 on release. Three backend transparent-border cases prove full/high retain alpha while actual performance resampling becomes RGB. All9 interactive frames match5,758,992 RGBA8 components/247,038 response bytes;6 releases match446,427 JPEG bytes. [Evidence, limits and next task](rapidraw-wasm-fine-interactive-handoff.md).

Core65/doctests, host24, check/source/format/syntax/JSON/diff and sandboxed Chromium pass. Original17 React source hashes and prior WASM2b1499c1 remain exact; only worker/transport alpha policy changes, with independent native harness additions. No public editor/release/demo change or peak-memory safety claim. Full App/export/provider/fractional/ROI/effects acceptance stays open. Next A: current alpha62 release gate and selected-page editing proof; next B: original native JPEG export path with bounded settings and real write ACK. MAIN only.

# RWASM-03 — original fine Slider pointer drag (2026-10-19)

Real original Slider mouse drags+18/−23px show local CSS angles+7.6/−9.8° and source crop feedback while committed rotation stays0. Release commits the angle/integer crop, then original Adjustments displays native-exact511×384/512×384 final frames:1,571,328 RGBA8 components and108,370 JPEG bytes, complete RGB/RGBA16F/adjustment hashes and scale/offset. Both Full Resets restore the same document's baseline. [Proof and next task](rapidraw-wasm-fine-pointer-handoff.md).

Original17-source hashes and prior WASM2b1499c1 remain exact; no native/WASM/runtime change or rebuild. Fresh host24/24, repo check, focused syntax/source/diff and sandboxed browser proof pass. Backend interactive sizing with fine rotation remains explicitly unavailable. Full App/ROI/fractional/effects/providers/save/export remain open; no product release/version/demo change. Next A: original Pages selection → server page.select/selected PNG/ACK; next B: independent native interactive fine sizing/alpha policy before enabling it.

# RWASM-03 — original fine rotation (2026-10-19)

The original CropPanel numeric Slider edits +5.3°/−7.1° now drive the pinned fixed-canvas bilinear RGBA rotation between orientation/flips and integer crop. Independent native source, GPU upload, rendered pixels and final JPEG comparisons cover both signs and a separate transparent-border backend case. [Evidence, limits and next task](rapidraw-wasm-fine-rotation-handoff.md).

Core63/63 and doctests, host24/24, npm run check and focused source/format/syntax/diff checks pass. Original components/handlers remain unchanged. Nonzero fine rotation with interactive sizing explicitly refuses; actual pointer dragging, fractional crop, warp/effects/ROI/full App/provider/save/export acceptance remain open. The64MiB RGBA intermediate estimate is a per-buffer bound, not complete peak-memory/allocator protection. No product version/release/install/demo change.

# RWASM-03 — original crop tool and corner drag (2026-10-19)

Actual original PanelSwitcher activates Crop; original useImageProcessing receives the source q80 uncropped JPEG data URL. A real original ReactCrop southeast-handle drag creates1891×1418 integer crop, then actual Adjustments tab/reset restores the baseline. Uncropped29,977 bytes and cropped60,876 bytes plus RGB/complete adjustment/pixel hashes match independent native source exactly. [Proof and next task](rapidraw-wasm-crop-canvas-handoff.md).

Core60/60 and doctests, host23/23, npm run check and focused format/syntax/diff pass. Original components and App distance5 sensor configuration are retained; this is one fixture/corner, not all geometry/full App/provider/export acceptance. No product version/release/install/demo change.

# RWASM-03 — original integer crop presets (2026-10-18)

Unchanged original CropPanel 1:1/16:9 presets, Rotate Right, Flip Horiz and reset now drive source crop-specific preview sizing followed by orientation→flip→crop. Six actual UI actions match independent native RGB, complete adjustment hashes,5,308,416 RGBA8 components and391,185 JPEG bytes exactly; resets restore the initial JPEG. [Proof and next task](rapidraw-wasm-crop-handoff.md).

Core57/57 and doctests, host23/23, npm run check and focused format/syntax/diff pass. Eleven malformed/resource WASM crop requests and four bridge crop requests refuse; the same document restores its original image. This accepts bounded integer crop presets, not crop-canvas/tool activation or fractional/fine-rotation/warp/effect/ROI/provider/export acceptance. No product release/version/install/demo change.

# RapidRAW browser engine port

## Current checkpoint — 2026-10-18

The pinned original RAW development, as-shot WB/exposure, full global controls/defaults/helper math and complete WGSL/EightBit PNG path now run in browser proofs. Five actual public-DNG edited files and3,932,160 byte components match independent native output exactly; downloads and malformed-input refusals are evidenced. Original native JPEG preview and interactive rectangle responses also match14,744/14,744 native bytes with original React reader excerpt decode in Chromium. The actual original hooks/Editor/Basic now record Quality2048×1536 dimensions and render the original area-filtered512×384 preview; five Exposure edits have native-exact adjustment/pixel/JPEG hashes. Full and resized RGB hashes match native; oversize previews refuse while the worker remains usable. Actual original Slider mouse drag/release now verifies source full/high/performance sizing/quality, all103,201 interactive bytes native-exact and q94 restored on release. Original CropPanel Rotate/Flip actions now produce six native-identical spatial frames/JPEGs and restore the initial image. [Latest handoff](rapidraw-wasm-geometry-handoff.md). Full metadata/sidecar load, crop/fine rotation/warp/ROI/full lifecycle, effect preprocessing/masks, menus and common-provider/save acceptance remain open. Earlier sections below record their individual historical slices and limits; no public editor release/demo integration is claimed by this checkpoint.

## Scope authorized on 2026-10-17

Port **native RapidRAW**, preserving its real React interface and image-processing algorithms, to WebAssembly/browser APIs. This is an additional browser-processing mode for independent public-demo visitors; the original Creative Workspace server-processing goal and owned rapidraw-web installation remain separate. No VNC, desktop streaming, substitute editor, or embedded-JPEG preview presented as RAW development.

Native installers for other operating systems establish useful behavior references, but are not WebAssembly binaries. Source-level separation and browser execution evidence are required.

## Verified sources

- Native RapidRAW by Timon Käch/CyberTimon: [`b39884b38d8f148caef6fd0d52afd264951be329`](https://github.com/CyberTimon/RapidRAW/tree/b39884b38d8f148caef6fd0d52afd264951be329), AGPL-3.0. Its frontend is React/Vite; native processing lives in `src-tauri/src/`.
- The same native lockfile pins RAW decoder `rawler` to RapidRAW-DngLab [`a32bc1ff1f4f3c56d4d3226082f6eb17414f9159`](https://github.com/CyberTimon/RapidRAW-DngLab/tree/a32bc1ff1f4f3c56d4d3226082f6eb17414f9159). That package declares LGPL-2.1; preserve upstream license/source obligations separately from Workspace/RapidRAW licensing.
- LightCraft architecture reference: [`9e6c4c6fc9c7a7f192ce846c00ceb531e0f64dda`](https://github.com/storytold/lightcraft/tree/9e6c4c6fc9c7a7f192ce846c00ceb531e0f64dda). Its browser entry shares the original engine/UI, uses dedicated module workers with transferable buffers, and provides browser storage through OPFS/IndexedDB. This is an architectural reference, not a replacement for RapidRAW's algorithms.

## Experimental browser decode and development slices

`experiments/rapidraw-wasm-core/` depends on the exact RapidRAW `rawler` revision. It contains a shared decoder report and an experimental native Speed/Quality pixel development path compiled for native and WASM. It is not the complete development pipeline, browser editor, supported-format catalog, or public feature. Decoder reports contain sensor metadata, deterministic samples and the canonical sensor-data digest; developed pixels are hashed in-browser and are not written to evidence.

The pinned native CPU `apply_exposure` helper is separately reproduced for interleaved RGB floats. Eight synthetic stop cases match all72 f32 values between the original helper reference and a dedicated Chromium WASM worker. This helper is used by native auto-analysis; the interactive editor applies exposure in its GPU shader, after local contrast and before further effects and tone mapping. The current probe does not implement that complete shader pipeline, user adjustment mapping or full export; a separate original PNG codec boundary is now verified below. [Exposure pixel evidence](evidence/rapidraw-wasm/exposure-pixels-browser.json) · [current technical handoff](rapidraw-wasm-development-handoff.md).

The locked graph passes wasm32 check and optimized WASM build with Rust 1.99.0. `wasm-bindgen` 0.2.129 output runs in a dedicated Chromium module worker. Native and WASM reports match exactly on a CC0 raw.pixls.us Canon PowerShot A410 CHDK DNG and on one locally user-authorized Fujifilm RAF copy. This proves real browser RAW decoder runtime for those fixtures only; it does not prove the native RapidRAW development pipeline or broad format support.

The browser client preflights 1-byte–128-MiB buffers, uses a 30-second default/120-second maximum timer, and terminates the dedicated worker on timeout or AbortSignal. Chromium confirmed both abort after the worker's pre-decode status and timeout termination of a real dedicated module worker intentionally stalled in an infinite loop (250-ms timeout; result after 252 ms). The latter verifies lifecycle cancellation only; it is not a RAW decoder timeout measurement. A future UI host must check File.size before reading/transferring.

The shared helper checks bounded metadata before `raw_image()`. DNG uses its Raw IFD; RAF dimensions are extracted from the pinned Fuji/TIFF metadata branch used by the decoder. It refuses malformed dimensions, axes above 32,768, component counts outside 1–4 and sensor buffer estimates above 64 MiB. Estimates match rawler output storage (`u16` for unsigned samples, `f32` for IEEE float), allowing the verified 6384×4182 Fujifilm RAF at 53,395,776 estimated sensor bytes. The estimate caps only the output sensor buffer, not all decoder intermediates. After decode, dimensions/components are checked against preflight. The probe remains private; no format availability is claimed.

## RWASM-01 runtime evidence

The current guard was rechecked after a reported Fuji RAF regression. The verified 6384×4182 fixture is accepted, decodes natively and in the dedicated browser WASM worker with exact sensor digest parity, and the existing bounded-oversize/truncated refusals remain effective. The report is anonymized and the original was verified read-only after testing. This recheck found no reproducible regression and made no decoder source change. See [recheck evidence](evidence/rapidraw-wasm/raf-preflight-recheck.json).

- CC0 raw.pixls.us sample 1327 (Canon PowerShot A410 CHDK DNG): native and browser reports match exactly at 2144×1560, one component, 10 bits and 3,344,640 samples. Whole-sensor SHA-256: `17124596990a87b26c4ea02994e0b0ddd5e65897d5661041142311a1e727a208`.
- CC0 raw.pixls.us sample 7317 (Blackmagic Micro Cinema Camera, 12-bit 3:1 CinemaDNG): both native and WASM fail with `ljpeg: not a valid raw file, found DQT`. Pinned source path: `DngDecoder::raw_image` → `plain_image_from_ifd` routes 12-bit `ModernJPEG` to `LJpegDecompressor` → its constructor rejects DQT. This is a decoder format gap, not a WASM-only failure.
- One local user-authorized Fujifilm RAF copy: native and WASM reports match exactly at 6384×4182, one component, 16 bits and 26,697,888 samples. Whole-sensor SHA-256: `084bf4d0f61d04fe2776afd37d60c40e7489accf494b9886ca8f1d1989ecaef0`. Exact camera model, source path, input hash, EXIF and sample values are withheld; only this anonymized summary is committed. Read-only O_NOFOLLOW|O_NOATIME verification confirmed the original source's hash and size/mtime/inode match the pre-test baseline.

The guarded DNG preflight reports 2144×1560, one component, 3,344,640 samples and 6,689,280 estimated bytes (`Vec<u16>`). RAF preflight follows the pinned Fuji/TIFF parser and `RafDecoder::raw_image()` dimension branch; its 6384×4182 sensor has 26,697,888 samples and a 53,395,776-byte `PixU16` estimate. Current Chromium worker reports match native exactly for both. A 256-byte truncated public DNG prefix is rejected before pixel decode. An oversized-IFD test proves `raw_image()` is never called after preflight refusal. No pinned upstream files were modified; no private path, source hash, EXIF, preview or sample values are committed.

The worker had zero page errors in Chromium. [Full fixture provenance, build hashes, comparison results, and remaining gates](evidence/rapidraw-wasm/runtime-smoke.json).

## Bounded implementation sequence

1. **RWASM-01 — real decoder runtime (partial).** Real CC0 DNG and private Fujifilm RAF native/worker parity pass behind the dimension and sensor-output budget. An additional malformed TIFF directory offset is rejected by native decoder selection; the broader malformed corpus remains open. Chromium also confirms timeout termination of a genuinely stalled dedicated worker, but not a stalled RAW decode. This budget is not a whole-decoder memory cap. The Blackmagic 12-bit DNG variant remains explicitly unsupported. Successful compilation alone does not pass this gate.
2. **RWASM-02 — original development pipeline (partial).** Native Speed and Quality RAW pixels now match the byte-identical pinned native source in a Chromium WASM worker on one CC0 DNG. An isolated exact-pin patch disables only wasm32 PPG profiling; unprepared builds retain the explicit Quality refusal. Add the reproducible Actions parity job. Then apply original exposure to pixels and verify export against native reference with bounded allocations. Embedded preview extraction is separate.
3. **RWASM-03 — original React interface.** Inventory Tauri invoke/event/plugin calls; introduce an explicit browser host implementation backed by the worker. Preserve original components, panels, controls, action IDs, history and document semantics. Connect supported operations to the actual shared core, show honest unsupported-operation errors, and keep all parity gaps visible. Do not publish a visual shell as a functioning port.
4. **RWASM-04 — GPU and extended features.** Port the existing wgpu/shader pipeline to browser WebGPU and verify it against native output. CPU fallback and browser GPU support need evidence. Native `ort` dynamic loading requires a browser inference implementation using the same model contract; AI masking/denoise are separate acceptance gates. Apple Core Image RAW, OS color management, tethering and other native services need explicit browser alternatives or documented unsupported status; none is silently declared equivalent.
5. **RWASM-05 — files, persistence and parity.** Laptop chooser/drop, browser storage and download/write acknowledgements must preserve originals and uncertain outputs. Separate save destination and retention. Benchmark representative camera formats, full-resolution processing, memory, responsiveness, history, presets, masks, export and multi-tab independence. The browser-local mode must remain clearly labelled and distinct from the server's common-provider paths.
6. **RWASM-06 — public delivery.** Build/version the accepted static port through Actions, include source/pins/licenses/checksums, verify the actual Cloudflare transport and supported browsers, then add it to the public demo. Every visitor receives an independent local engine; no shared document backend. Keep preview/full-parity claims tied to evidence.

## Development isolation and next step

The port starts on `codex/rapidraw-wasm-port` in an isolated managed worktree. Existing Cloudflare demo assets, user RapidRAW services and main-checkout server development are untouched. This branch contains decoder parity for one CC0 DNG and one local user-authorized RAF, plus exact native/browser pixel parity for original Speed and prepared Quality demosaic on the CC0 Canon DNG. The pinned Blackmagic 12-bit DNG variant currently fails in both environments. No product version or availability is advanced. Next: automate Quality/Speed parity in Actions, then continue pixel exposure/export against native output. Keep full develop/export acceptance open.

## RWASM-02 compensation slice verified

The unchanged native RawExposure/BaselineOptions calculation is extracted into src/exposure.rs in the probe. An independently compiled byte-identical original baseline_exposure.rs generates the expected 144-case matrix. The extracted native implementation and a real dedicated Chromium WASM worker both match every original f32 bit pattern; ten nonfinite/overflow cases are rejected at the browser boundary. All14 native tests and 84Node tests pass. [Evidence](evidence/rapidraw-wasm/exposure-compensation.json). This does not apply exposure to image pixels, parse exposure metadata, develop a RAW or export an image. Those are the next bounded pixel-pipeline tasks in [the current handoff](rapidraw-wasm-exposure-handoff.md).

## RWASM-02 first developed pixels (historical Speed checkpoint)

The shared core now returns the pinned native output buffer with `RawDevelop` crop/calibration, native black/white rescaling, clipped-pixel recovery, clamp and EXIF orientation. The exact native `raw_processing.rs` harness and shared native implementation match on every RGB f32 bit for a CC0 Canon DNG; an optimized dedicated Chromium WASM worker matches the same digest. The report is [here](evidence/rapidraw-wasm/raw-development-pixels.json). Unprepared WASM still refuses PPG Quality. The prepared timer-only compatibility build now has exact Quality parity on this fixture (below); exposure-on-pixels, export, UI and a usable editor remain open.

## RWASM-02 PPG timer investigation

At pinned rawler `a32bc1f`, the PPG Bayer implementation uses `Instant::now()` only to report elapsed time through `log::debug!`; the measured interval does not influence interpolation or output pixels. The WebAssembly panic can therefore be addressed without changing image math by using a target-specific monotonic browser clock for this diagnostic (or compiling out only that diagnostic on wasm32). Do not add a separate PPG implementation or relax the explicit WASM refusal until a minimal pinned-source patch passes exact native-vs-WASM developed-pixel parity on an adequately sized CC0 Bayer DNG. Keep the patch isolated to timer/logging and retain the private RAF as a subsequent parity check. Existing output-sensor estimates remain distinct from a full allocation cap.

## RWASM-02 Quality compatibility verified

The isolated timer-only patch now passes exact native-vs-WASM RGB f32 comparison on the CC0 Bayer DNG at2048×1536; Speed remains bit-identical at512×384 on the same prepared artifact. No interpolation code changes. Patch/source hashes, preparation/build instructions, browser evidence and remaining limits are in the [current handoff](rapidraw-wasm-development-handoff.md). The private RAF exceeds the current developed-output budget and has sensor parity only; keep developed RAF acceptance open. This unfinished experimental checkpoint does not change the public demo or product version. Next: Actions parity evidence, then original exposure-on-pixels/export.

## RWASM-02 PNG codec checkpoint (2026-10-18)

The native PNG encoder's RGB32f→RGB16 conversion, original CC0 sRGB ICC and optional DPI helpers now run in WASM. Both public DNG modes match original native PNG bytes exactly, open in Chromium and complete a browser download with the same bytes/hash. Eight malformed cases reject per mode. This is a codec boundary with the GPU renderer bypassed, not final rendered/export parity; original React UI/provider save and public demo are unchanged. [Evidence, build instructions and next original WebGPU boundary](rapidraw-wasm-png-handoff.md).
