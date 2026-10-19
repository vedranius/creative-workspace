# RWASM-03 — original fine rotation

Completed2026-10-19 after bc76a40 on codex/rapidraw-wasm-port. Source CyberTimon/RapidRAW b39884b38d8f148caef6fd0d52afd264951be329; original React components/handlers and AGPL3 attribution/pins remain unchanged. This is an unfinished WASM experiment checkpoint, with no product SemVer/tag/release/install/public-demo change.

## Source contract

The copied original apply_rotation uses imageproc0.27.0 rotate_about_center: fixed-canvas RGBA32F, source f32 degree-to-radian arithmetic, bilinear interpolation and transparent black border. Source crop-specific area working resize runs first, then orientation/flips → fine rotation → integer crop. Native source generate_uncropped_preview intentionally omits fine rotation and retains its existing q80 data URL contract.

The browser worker caches RGB plus original alpha, keyed by angle/geometry/size. The source f16 GPU upload preserves alpha through the unchanged original WGSL renderer; final q94 JPEG uses the existing source encoder. Generation checks, serialized commands, document ownership/cache teardown and honest unsupported-save errors survive this addition. Fine angles must be finite numbers in−45..45°, matching the source Slider range. Nonzero fine rotation plus interactive sizing explicitly refuses until independently verified.

The RGBA working intermediate is checked against64MiB before copying input pixels. Existing RGB/GPU-payload budgets and32768-axis limits remain. This is a per-buffer estimate, **not complete peak-memory, allocator, decoder, GPU or codec timeout protection**; multiple RGBA/RGB intermediates can coexist. No limit is removed or raised.

## Independent evidence

[Browser report](evidence/rapidraw-wasm/fine-rotation-browser.json) · [native references](evidence/rapidraw-wasm/fine-rotation-native.json) · [source/WASM provenance](evidence/rapidraw-wasm/fine-rotation-source.json) · [original CropPanel](evidence/rapidraw-wasm/fine-rotation.png).

Only public CC0 raw.pixls.us1327 Canon DNG, SHA f0d2fe47507fadf50008bddbc6bd2c5e39fddbe90cca6bca72dd360fa0e0eb38, and its previously proven full native Quality RGB are used. No private photograph, EXIF or personal host path is published. The native reference executes an independently copied original rotation/pipeline, original native wgpu upload/shader and original codec. Source function/reference hashes and original React component hashes are pinned. The full original RAW decode is a reused prerequisite, not new progress.

The unchanged original CropPanel Slider numeric edit commits +5.3° and−7.1°. Actual source Editor calculates safe integer crops; actual Adjustments tab publishes final blob URLs and the visible original SVG image settles. Both output RGB, complete RGBA16F GPU-upload hashes, full packed adjustment bytes, RGBA8 and JPEG match native exactly. The source Fine Reset is awaited through a new zero-angle render and its matching published URL, so a queued earlier exposure0/rotated frame cannot be mistaken for reset evidence. Fine Reset clears angle; its remaining source crop is compared independently. Full Reset separately restores the original baseline JPEG.

| Action | Preview | Native-exact JPEG bytes |
|---|---|---:|
|Original numeric Slider +5.3°|512×384, crop109/82/1830/1373|54,662|
|Original Fine Reset after +5.3°|512×384, angle0/cropnull|61,812|
|Original numeric Slider−7.1°|512×384, crop139/104/1770/1327|54,951|
|Original Fine Reset after−7.1°|512×384, angle0/cropnull|61,812|
|Direct backend +12.5° transparent border|512×384, no crop|53,694|

All3,932,160 RGBA8 components and286,931 JPEG bytes in these five comparisons are native-exact. Both subsequent original Full Reset actions also restore the baseline. The fine-reset matcher specifically requires a fresh zero-angle frame/preview and matching published URL; exposure0 alone can also identify an earlier queued rotated frame and is insufficient evidence.

A separate direct backend rotation12.5°/no-crop case retains the border that the source safe crop normally removes:18,608 input pixels have nonopaque alpha. It matches native RGB, complete RGBA16F upload, RGBA8 and JPEG exactly. This backend case is explicitly distinguished from real original UI edits; it does not inject UI state.

Five malformed/oversize WASM fine requests and four malformed bridge rotations refuse. The same loaded document/worker then reproduces baseline JPEG SHA042350b5c54e9244b8a9f33089efa25b0516ae59f4e188ba0345fcd60a86f869 (61,812 bytes). Existing exposure/interactive/orientation/crop/canvas/refusal proofs run as regressions. Original autosave/export and lens discovery remain honestly unavailable; no fake write ACK or success is introduced.

Core63/63 and doctests exit0, host24/24, npm run check, optimized WASM/native reference build and focused source/hash/format/syntax/diff checks pass. A single sandboxed Chromium151/SwiftShader context at a time is used; context/browser/server/owned native work closes after QA. Source components and public screenshot are visually verified. The Actions parity script builds fine_reference and executes the same actual UI and transparent-border procedure. Local success does not imply hosted CI/release acceptance; the exact new commit/run snapshot is retained by the private coordinator.

## Reproduce and continue

Reuse timer-only prepared Quality source, Rust1.99, matching wasm-bindgen0.2.129, native binaries/full Quality RGB, caches and a short disk-backed TMPDIR. Heavy local build/native/QA uses the shared flock and low-impact helper (max2CPU,nice10,jobs1). Native reference output uses create_new; never overwrite prior fixtures.

`fine_reference prepare FULL_RGB_F32 WIDTH HEIGHT STEPS HORIZONTAL VERTICAL CROP_JSON ROTATION NEW_DIR` writes original RGB/RGBA and geometry metadata. Render rgba.f32 with the native reference --rgba-f32 mode and original eight-bit camera settings. `fine_reference encode NEW_DIR NATIVE_RENDER_JSON NATIVE_PNG_DIR` writes complete reference hashes and q94 JPEG metadata. smoke-rapidraw-react.mjs receives fineBinary/fineOutput in its existing optional canvas config. Reference cache verifies full-RGB hash, actual geometry and source f32 angle. Publish reports/provenance only, never the host config.

Next rotation task: verify an actual original fine Slider pointer drag, local live CSS rotation/safe-crop behavior and release commit with independent final native pixels/JPEG, while preserving latest-job reset behavior. Then trace native interactive fine-rotation sizing before enabling it. Fractional crops, other corners/move/history, warp/resource effects/masks/ROI/full metadata/App/menus/export/provider/save acceptance remain open.

Alternate next to A: short exact alpha.61 CI/tag/draft/Actions asset-checksum verification, then original Pages thumbnail selection → bounded server page.select and matching selected-page PNG/ACK with two distinct pages, unchanged dirty/document identity. A waiting CI does not block independent future B work. Continue in MAIN only; no new writer/chat/security-profile changes and no main merge or public-demo update.
