# RWASM-03 — original integer crop presets

Completed2026-10-18 after98a9dbc on codex/rapidraw-wasm-port. Original CyberTimon/RapidRAW b39884b38d8f148caef6fd0d52afd264951be329 and React/native source remain unchanged; AGPL3 attribution/pins retained. This is an unfinished experiment checkpoint, with no product SemVer/tag/release/install/demo update.

## Source behavior and bounds

Original compute_transformed_preview determines full oriented crop dimensions, chooses a working resolution from the crop's longest dimension, downsizes the entire unrotated image using original area filtering, then performs orientation→flips→crop. Crop coordinates use working.width/original.width; width/height cap at target before original apply_crop rounds/clamps. GPU scale is preview.width/full_crop_width as f32; unscaled crop offset is retained separately. The new wrapper preserves that order and sizing rather than cropping the already bounded512×384 base.

For the public2048×1536 fixture,1:1 chooses a683×512 working image and then a512×512 crop at scaled x85. A naive crop of the previous512×384 preview would yield different pixels. The worker uses crop-aware keys and invalidates GPU resources; source target/divisor/quality and no-crop baseline behavior remain intact.

Exact apply_crop is copied and independently compiled; native crop_reference uses separately retained original area/orientation/crop functions and pure calculation excerpts from compute_transformed_preview. Source lib/image-processing/excerpt/reference hashes are recorded in UPSTREAM.json. Core tests compare768 supported dimension/target/crop/turn/flip combinations, including odd dimensions, crop clamping and full-frame no-op, with exact float bits/scale/offsets.

Accepted crop coordinates are finite nonnegative integers in full oriented-image pixels, positive width/height bounded32768; starts must be inside the image. Source clamping at the remaining extent is preserved. A crop erased by preview rounding refuses explicitly instead of presenting native's uncropped no-op as a successful crop. Shape, finite/f16 domain, axes and input/working RGB64MiB estimates are checked before image allocation; output retains the existing64MiB GPU payload estimate. These are scoped buffer/input limits, not whole peak-memory/allocator/GPU/JPEG timeout guarantees. Fractional crop, fine rotation, warp, effects/ROI remain unaccepted.

## Actual original UI and native evidence

[Browser report](evidence/rapidraw-wasm/crop-browser.json) · [native references](evidence/rapidraw-wasm/crop-native.json) · [source/WASM provenance](evidence/rapidraw-wasm/crop-source.json) · [settled original square preview](evidence/rapidraw-wasm/crop-square.png).

Only the public CC0 raw.pixls.us1327 Canon DNG is used, SHA f0d2fe47507fadf50008bddbc6bd2c5e39fddbe90cca6bca72dd360fa0e0eb38. Previously proven full Quality RGB is reused; no repeated decoder/guard success is claimed. Independent original native spatial code, native wgpu renderer and q94 codec provide references.

| Actual original control | Full crop x/y/w/h | Preview | JPEG bytes |
|---|---|---|---:|
|1:1|256/0/1536/1536|512×512|73,068|
|Rotate Right|0/256/1536/1536|512×512|73,103|
|Flip Horiz|0/256/1536/1536|512×512|73,012|
|Reset Crop & Transform|none|512×384|61,812|
|16:9|0/192/2048/1152|512×288|48,378|
|Reset Crop & Transform|none|512×384|61,812|

All5,308,416 RGBA8 components/391,185 JPEG bytes, six RGB hashes and complete packed adjustment hashes match native exactly, zero tolerance. Scale/crop offsets match native; originalSize stays2048×1536. Each original hook publishes a matching blob URL, bitmap dimensions match, and original SVG crossfade/retained patch clears before display/aspect verification. The screenshot was visually inspected: square image plus active unchanged1:1 preset. Both resets restore initial JPEG SHA042350b5c54e9244b8a9f33089efa25b0516ae59f4e188ba0345fcd60a86f869.

The same sandboxed Chromium151/SwiftShader QA context regresses the earlier five Exposure frames, three original Slider drag/release modes, six rotation/flip actions, malformed resize and oversize/refusal/recovery. Additionally11 direct malformed/resource WASM crop requests and4 transport crop requests refuse; the same loaded session produces the initial JPEG afterward. GPU/page/failed/external-request errors are empty; dragging=false and patch cleared. Original autosave/export remain explicitly unavailable with no write ACK; one caught original unavailable lens discovery is recorded. All owned QA/browser/server/resources close. Private photographs/services/studios/main checkout/public demo are untouched; untracked target is preserved.

Core57/57 and doctests exit0, host23/23, npm run check, focused syntax/rustfmt and diff checks pass. Auth verified as vedranius; existing v0.2.0-alpha.60 stays draft/prerelease. Normal branch publication and exact new CI snapshot are recorded by the private coordinator; no previous CI cancellation/restart or release claim.

## Reproduction

Use the existing prepared Quality timer-only stage, Rust1.99 and matching wasm-bindgen0.2.129. Heavy builds/native rendering/QA must use the mandatory shared flock + low-impact helper (max2CPU,nice10,jobs1), and one sandboxed QA context with short disk-backed TMPDIR. Native outputs refuse existing files.

`crop_reference prepare FULL_QUALITY_RGB_F32 2048 1536 STEPS HORIZONTAL VERTICAL CROP_JSON NEW_DIR` emits independent crop-specific RGB, scale and offsets at target512. Render its RGB with the existing native five-case React camera settings and eight-bit PNG output, then `crop_reference encode NEW_DIR NATIVE_RENDER_JSON NATIVE_PNG_DIR` picks frame0 and the original final q94 encoder. `scripts/build-rapidraw-react-proof.mjs` stages exact original React and source pins. `scripts/smoke-rapidraw-react.mjs` accepts the native crop reference array as its last argument after existing native preview/resize/interactive/geometry JSON. Actions reproduces all six crop-native references from full Quality RGB and runs the same UI/refusal sequence.

## Next ready task

Activate the original crop tool in the unchanged Editor/ImageCanvas, trace generate_uncropped_preview and implement its bounded source contract: source square-area resize before orientation/flips, original pre-orientation f32 scale, show_clipping=0, crop offset0, original q80 JPEG/data URL codec policy (not the q94 fast-color final preview). Preserve source latest-job handling. Prove an actual original crop-canvas edge/corner drag and return to Adjustments with native RGB/pixel/JPEG parity and reset/refusal recovery. Keep fine rotation/warp/effects/ROI/export/providers explicit; no custom crop editor or fake uncropped image.

Current QA mounts unchanged CropPanel while activePanel remains Adjustments. This proves actual preset processing/display, not original crop-tool activation or its crop canvas. The original useImageProcessing Panel.Crop branch calls GenerateUncroppedPreview and uses source latest-job IDs; that command is still explicitly unavailable. No fabricated uncropped data URL, alternate crop editor, metadata/write ACK or full App acceptance is introduced. Continue MAIN only; no new writer/chat/security-profile changes; A waitingOnApproval stays untouched.
