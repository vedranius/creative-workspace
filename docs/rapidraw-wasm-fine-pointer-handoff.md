# RWASM-03 — original fine Slider pointer drag

Completed2026-10-19. Evidence-only continuation after bc1b33b on codex/rapidraw-wasm-port. Reuses the exact previously proved WASM2b1499c18e24876f782009932adc061946e4f4f7e5dc0b689b9f3c50a295eda8 and the original CyberTimon/RapidRAW source b39884b38d8f148caef6fd0d52afd264951be329. No Rust, renderer, transport, original React module, product version/release/install or public-demo change. Seventeen original staged source hashes remain exact.

## Original interaction contract

Original Slider mouse-down/move invokes CropPanel handleDragStateChange and handleFineRotationChange. While rotation is active, CropPanel updates localRotation/liveRotation rather than committing adjustments.rotation. Original ImageCanvas rotates the uncropped q80 preview with CSS; original Editor recalculates a local safe crop and the dense grid. Mouse-up clears isRotationActive/liveRotation and commits the final numeric angle. Editor normalizes the resulting crop; actual Adjustments tab then publishes the original final-preview response.

The new browser procedure moves the real mouse from the unchanged range center in two stages, with positive18px and negative23px final deltas. At both intermediate positions it reads the original store and DOM, requiring rotation0/cropnull still committed, a nonzero local angle, active drag state, matching CSS rotation, a smaller visible local crop and the existing uncropped preview URL. The actual Crop image bytes remain the native-exact q80 uncropped JPEG while source CSS supplies live feedback. The hidden final-preview URL/last backend trace may retain an earlier rotated frame or change as an earlier job completes; neither is the visible Crop image. The proof hashes the actual img.src and records the retained final hash separately. It requires a new native-exact final result only after the actual Adjustments tab is selected. No direct adjustment/store writes implement the drag.

On release, the original store must clear liveRotation/rotation-active and commit that angle plus a bounded integer crop. Independent native fine_reference starts from the previously proved full public Quality RGB and uses source working resize/orientation/flips/rotation/crop, native f16 GPU upload/WGSL and source q94 codec. The browser requires exact RGB, complete RGBA16F upload, full packed adjustment, RGBA8 and JPEG hashes, matching scale/crop offset, unchanged document identity and a settled visible original SVG. Original Full Reset requires a new zero-angle response and matching published baseline JPEG before the next case.

## Proof and limits

[Browser report](evidence/rapidraw-wasm/fine-pointer-browser.json) · [native references](evidence/rapidraw-wasm/fine-pointer-native.json) · [source provenance](evidence/rapidraw-wasm/fine-pointer-source.json) · [actual live pointer drag](evidence/rapidraw-wasm/fine-pointer-live.png) · [released final preview](evidence/rapidraw-wasm/fine-pointer-released.png).

One public CC0 raw.pixls.us1327 Canon DNG only; SHA f0d2fe47507fadf50008bddbc6bd2c5e39fddbe90cca6bca72dd360fa0e0eb38. Existing original numeric +/- rotation/reset, transparent border, crop canvas and other exposure/geometry/refusal/recovery comparisons remain regression checks; they are not new decoder or guard progress. Original unsupported autosave/export and lens discovery remain explicit. The screenshots retain those honest errors.

| Actual mouse motion | Local angles while held | Released full-image crop | Native-exact final frame/JPEG |
|---|---|---|---|
|+18px|+3.8°, +7.6°|147/110/1754/1316|511×384;54,343bytes|
|−23px|−5.1°,−9.8°|179/135/1689/1267|512×384;54,027bytes|

Both final frames match all1,571,328 RGBA8 components and108,370 JPEG bytes exactly. Full RGB, complete RGBA16F upload and packed-adjustment hashes, source scale and crop offsets match independently. Four held-pointer snapshots retain the source q80 Crop JPEG hash d70d81ee817f4648a5dfdbbb0091b5c98e2c68f1b3e902f0e20e9243ef7f3726; CSS angles match the store within0.0001°. Both releases clear local drag state, both Full Resets restore the baseline61,812-byte q94 JPEG, and document identity stays unchanged. GPU/page/failed/external-request errors are empty, final dragging=false and patch cleared.

The positive source working-size rounding produces511×384; forcing512 here would change source behavior. Initial QA incorrectly treated the last backend trace, then the hidden final-preview URL, as the visible Crop image. The final proof checks original ImageCanvas's actual q80 img.src instead. No source handler or runtime logic was changed to satisfy that expectation. Both live and released screenshots were visually inspected.

The runtime algorithm/resource gates are unchanged. Core63/63/doctests and native/alpha parity remain the prior bc1b33b prerequisite; fresh host24/24, npm run check, focused syntax/source/hash/diff checks and the actual pointer browser proof validate this evidence change. No extra native/WASM build is performed. A single sandboxed Chromium151/SwiftShader context at a time uses the shared flock/low-impact wrapper (max2CPU,nice10,jobs1) and short disk-backed TMPDIR, then closes its owned browser/server/workers/native references.

This verifies source local CSS feedback and final release rendering. It does **not** enable backend interactive sizing with nonzero fine rotation, which still explicitly refuses. Pointer/touch variants, fractional crops, other crop corners/move/history, warp/effects/masks/ROI/full App/metadata/menu/provider/save/export acceptance remain open. Existing64MiB per-buffer RGBA estimate is not complete peak-memory/allocator protection. No private photograph/EXIF/path, protected studio/service, main checkout or public demo was changed.

## Reproduce and next step

Reuse fine-rotation-proof staged original modules/WASM and full Quality RGB/native binaries. Set finePointer:true in the optional canvas config supplied to scripts/smoke-rapidraw-react.mjs. Native references are keyed by source-generated geometry hash and full-RGB hash; create_new prevents overwriting older output. The public report omits host config paths. The Actions parity script enables the same pointer procedure; inspect its exact new run on the next B entry without restarting/cancelling other runs.

Alternate next to A's original Pages thumbnail selection → bounded server page.select and matching selected-page PNG/ACK, two pages with distinct content, unchanged document identity/dirty state. Alpha.61 assets/tag/draft were already verified by A evidence commit e024ed7; do not repeat that verification as new progress. Future B: trace and independently prove native fine-rotation interactive preview sizing/alpha/resampling policy before lifting the current explicit refusal. Keep fractional/ROI/effect paths unavailable until separately evidenced. MAIN only; no new writer/chat/security-profile changes.
