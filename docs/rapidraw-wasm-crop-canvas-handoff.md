# RWASM-03 — original crop tool and actual corner drag

Completed2026-10-19 after52de368 on codex/rapidraw-wasm-port. Source CyberTimon/RapidRAW b39884b38d8f148caef6fd0d52afd264951be329 and original React/native files are unchanged; AGPL3 attribution/pins remain. This unfinished experiment checkpoint does not change product SemVer/tag/release/install/public demo.

## Implemented source contract

Original generate_uncropped_preview downsizes the pre-geometry image with downscale_f32_image(target,target) directly, before orientation/flips. This differs from final-preview crop-specific/f64 working-size selection for some odd dimensions. New bounded helper retains exact source area filter and direct f32 bounds, source pre-orientation width/original-width scale, zero crop offset and clipping disabled. Fine rotation/warp/effects remain unsupported.

Original codec converts rendered image to RGB8, then BaselineFastest quality80 encode_rgb with default color conversion. The dedicated WASM codec and real JPEG data URL preserve that contract rather than reuse final q94/fast-color encoding. Native/WASM core tests verify odd axes/no upscale/exact float bits, byte-exact q80 codec, malformed shapes/targets/nonfinite/domain and resource refusals. Existing64MiB per-buffer/GPU-payload estimates, axes32768 and worker deadline stay; these are not complete peak-memory/allocator/GPU/JPEG-timeout guarantees.

Original useImageProcessing throttle/latest job IDs receive the real data URL unchanged. Command queue, document generation checks, worker ownership/cache clearing and resource teardown survive the additional command. Geometry/crop caches remain separate; generation is checked again after asynchronous hashing before returning a data URL. No metadata/save success or write ACK is fabricated.

The QA wrapper now mounts exact original PanelSwitcher and retains App.tsx's PointerSensor activationConstraint distance5. Original tab handlers select Crop/Adjustments; original Editor/ImageCanvas/ReactCrop handlers own the drag and crop commit. Sixteen original React files plus original App sensor source are hash-pinned. This does not mount the complete App or replace crop controls.

## Actual evidence

[Browser report](evidence/rapidraw-wasm/crop-canvas-browser.json) · [native references](evidence/rapidraw-wasm/crop-canvas-native.json) · [source/WASM provenance](evidence/rapidraw-wasm/crop-canvas-source.json) · [actual original crop selection](evidence/rapidraw-wasm/crop-canvas.png).

Only public CC0 raw.pixls.us1327 Canon DNG, SHA f0d2fe47507fadf50008bddbc6bd2c5e39fddbe90cca6bca72dd360fa0e0eb38. Previously proven full Quality RGB is reused; no repeated RAW/decode/guard progress is claimed. Independent native functions and native wgpu renderer/codec generate references from full RGB. Dynamic crop reference uses the integer coordinates produced by the real source UI, never injected crop state.

| Actual action | Result | Native-exact JPEG bytes |
|---|---|---:|
|Original Crop tab|512×384 uncropped q80 JPEG data URL|29,977|
|Original southeast corner pointer drag−72/−54|full crop0/0/1891/1418,512×384 final q94 preview|60,876|
|Original Adjustments tab then Reset Crop & Transform|original512×384 final q94 JPEG|61,812|

The uncropped and drag RGB, complete packed adjustment hashes,1,572,864 RGBA8 components and90,853 JPEG bytes match native exactly, zero tolerance. Uncropped scale is0.25/offset0; cropped scale0.27075621485710144/offset0 matches native. Original dimensions remain2048×1536. The original hook publishes the matching blob URL after drag; original SVG retained crossfade clears and its visible aspect is checked. Reset restores JPEG SHA042350b5c54e9244b8a9f33089efa25b0516ae59f4e188ba0345fcd60a86f869.

The screenshot was visually inspected and shows the source crop selection smaller than the full image. QA uses a hit-tested visible point inside the original handle: its bounding-box center at the full-image corner is clipped by the source overflow container. Initial QA also exposed the omitted App distance5 pointer sensor configuration; restoring that source configuration enabled the actual Crop tab. Neither diagnostic changed source handlers or wrote crop state directly.

A single sandboxed Chromium151/SwiftShader context at a time runs source UI and native references; final context/browser/server/owned resources close. GPU/page/failed/external-request errors are empty, dragging=false, patch cleared. Previous five Exposure comparisons, malformed resize/crop refusals, oversize refusal and same-document recovery run as regression checks; no reclassification as new decoder progress. Autosave/export explicitly remain unavailable and one original caught lens discovery refusal remains honest. Private images/EXIF/paths, live studios/services, main checkout and public demo are untouched; untracked target is preserved.

Core60/60 and doctests exit0, host23/23, npm run check and focused syntax/rustfmt/source/hash/diff checks pass. Native q80 reference is source-pinned independently; the Actions parity script builds it, creates native uncropped/actual-drag references and runs the same UI procedure. Auth/release state and exact new CI snapshot are recorded by private coordinator before completion. No prior CI is cancelled/restarted and no publication/release acceptance is implied by local proof.

## Reproduction and cache

Reuse the existing timer-only prepared Quality stage, Rust1.99, wasm-bindgen0.2.129, native binaries/full Quality RGB and short disk-backed TMPDIR. All heavy local build/native/QA work uses the shared flock + low-impact helper (max2CPU,nice10,jobs1). Never overwrite native reference files; create_new output checks remain. Native reference cache reuse verifies original full-RGB hash and actual crop coordinates.

`uncropped_reference prepare FULL_RGB_F32 2048 1536 STEPS HORIZONTAL VERTICAL NEW_DIR` applies independent original direct-square resize at512, then original orientation/flips. Render the resulting RGB through native eight-bit wgpu with existing five-case React camera settings. `uncropped_reference encode NEW_DIR NATIVE_RENDER_JSON NATIVE_PNG_DIR` selects native frame0 and source q80 RGB encoding. The actual-drag reference reuses crop_reference from full RGB with source-generated crop JSON.

`scripts/smoke-rapidraw-react.mjs` accepts a native-canvas config as its final positional argument, after native preview/resize/interactive/geometry/crop references. Config points to full public Quality RGB, camera settings, native binaries, output directory and child-only native driver env; do not publish private host config paths. Report only retains public source/native/browser evidence. scripts/build-rapidraw-react-proof.mjs stages pinned PanelSwitcher/App provenance with original components.

## Next ready WASM task

Trace pinned original apply_rotation and compute_transformed_preview fine-rotation behavior, including RGBA intermediate sizing, orientation/flip→fine rotation→crop order, source angle/rounding/filter policy and original CropPanel fine-rotation control. Port one bounded supported fine-rotation slice without changing source handlers or raising resource limits. Prove actual original slider edit and reset plus native/WASM RGB or RGBA, final pixels/JPEG, malformed/oversize refusal and document recovery. Keep warp/effects/ROI/export/provider acceptance explicit.

Only one actual crop corner/original-aspect case is evidenced here. Remaining corners, movement, history, fractional paths and full lifecycle need their own evidence; fine rotation/warp/resource-dependent effects/masks/ROI/metadata/full menus/export/provider acceptance remain open. Continue in MAIN only, one writer and no new chat/security-profile changes. A owner was interrupted at the final recovery check; inspect its WIP/process/approval state before a future separate A claim, without rewriting A from this task.
