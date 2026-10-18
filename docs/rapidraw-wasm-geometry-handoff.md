# RWASM-03 — original quarter-turn and flip controls

Completed2026-10-18 after `849da33` on `codex/rapidraw-wasm-port`. Original CyberTimon/RapidRAW pin `b39884b38d8f148caef6fd0d52afd264951be329` and decoder/React source remain unchanged. AGPL3 attribution is retained; no product SemVer/tag/release/install/demo change for this incomplete port checkpoint.

## Source and behavior

The pinned apply_orientation_and_flip calls apply_coarse_rotation, then apply_flip horizontal followed by vertical. The exact IntoCowImage trait/functions are retained byte-for-byte in source and independent native reference; UPSTREAM.json pins them and both original files. The wrapper accepts only orientationSteps0..3 and finite/domain/shape/64MiB-bounded RGB. All16 turn/flip combinations match original float bits; four successive quarter-turns restore the original pixels. Unsupported step4/256 and malformed/oversized/nonfinite/domain inputs refuse before image allocation.

Original compute_transformed_preview downsizes the working image before this spatial stage. With crop/fine rotation/warp disabled, quarter-turn preserves the longest axis, so the existing working dimensions/area-filter sequence remain valid. The worker caches the source final preview and oriented pixels under target/turn/flip keys; changes invalidate the GPU resource cache. Original oriented full width is used for the source f32 GPU scale, then the already-proven interactive divisor stage follows. No CSS-only or post-JPEG rotation is substituted for image processing.

The QA composition now mounts unchanged original CropPanel plus its actual ContextMenuProvider/useEditorActions/cropUtils, in the existing sidebar. Exact new React source hashes join the previous pins. It tests the panel's real Rotate Right/Left and Flip Horiz/Vert click handlers. The native handleRotate preserves its modulo4/aspect-ratio/new-crop behavior; the default aspectRatio0 produces crop=null, which remains required by this limited bridge. The crop tool itself is not activated and no alternate rotate controls or rewritten handlers are introduced.

CropPanel reads load_settings: this returns a clone of the actual in-memory QA settings snapshot used by the original stores/bridge, not invented persisted settings or a write ACK. Its original lens-maker discovery command remains explicitly unavailable and is caught/logged by original source; no fake empty database response. The report distinguishes that one expected unavailable lens read from save errors. Cropping, fine rotation, warp, other changed resource-dependent adjustments and export/save commands continue to refuse explicitly.

## Actual evidence

[Browser report](evidence/rapidraw-wasm/geometry-browser.json) · [independent native references](evidence/rapidraw-wasm/geometry-native.json) · [source/WASM provenance](evidence/rapidraw-wasm/geometry-source.json) · [settled original Rotate Right display](evidence/rapidraw-wasm/geometry-rotate-right.png).

Only public CC0 raw.pixls.us1327 Canon DNG, SHA `f0d2fe47507fadf50008bddbc6bd2c5e39fddbe90cca6bca72dd360fa0e0eb38`. Reuses the previously proven actual Quality/source area-preview RGB; independent original native orientation/flip, wgpu renderer and q94 codec produce references. This is new original-control/spatial behavior, not repeated decoder/guard progress.

| Actual UI action | Turn/H/V after action | Preview | JPEG bytes |
|---|---|---|---:|
|Rotate Right|1/false/false|384×512|61,910|
|Flip Horiz|1/true/false|384×512|61,831|
|Flip Vert|1/true/true|384×512|61,927|
|Rotate Left|0/true/true|512×384|61,837|
|Flip Horiz|0/false/true|512×384|61,949|
|Flip Vert|0/false/false|512×384|61,812|

All4,718,592 RGBA8 components,371,266 JPEG bytes, complete adjustment hashes and six pre-upload RGB hashes match native exactly, zero tolerance. Original dimensions remain2048×1536 and crop=null. The last actual flip restores the starting JPEG hash. The hook's new published URL is hash-verified after each action; QA also waits for the original SVG crossfade/retained patch to clear and the visible image's oriented aspect to settle before screenshot/next action. An initial screenshot caught the valid intermediate crossfade; the final evidence waits for the completed original display.

The same single sandboxed Chromium151/SwiftShader context retains the earlier five Exposure comparisons, all three actual Slider drag/release modes, eight malformed WASM resize refusals, oversize-GPU refusal and same-worker512→256→512 exact recovery as regression checks. After all actions GPU/page/network/external-request errors are empty; dragging=false and patch cleared. Original autosave/export remain unavailable without a fake ACK. The QA context/browser/server and owned worker/resources close. Evidence omits repeated full adjustment objects while retaining native-checked complete-payload hashes and all source pins.

A trailing extraction separator blank line was removed from both exact-source copies after QA; their shared provenance hash was updated and focused geometry/source tests rechecked. Pixel arithmetic is unchanged.

Core54/54 and doctests, host20/20, npm run check, source hash, focused syntax/rustfmt and diff checks pass. Buffers/upload-payload estimates and worker deadlines remain scoped limits, NOT complete peak-memory, GPU/JPEG timeout or whole editor lifecycle protection. No private photograph/EXIF/path, live studio/service, public demo or main/server checkout changed.

## Reproduction and CI

Use existing Quality timing-compatible WASM stage, Rust1.99/wasm-bindgen0.2.129 and the mandatory build lock/low-impact helper (max2CPU,nice10,jobs1). No shared Cargo/upstream modifications. Native outputs refuse existing files.

```sh
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example geometry_reference -- prepare NATIVE_FINAL_PREVIEW_RGB_F32 512 384 1 false false NEW_NATIVE_DIR
# Existing independent native renderer: use reported384x512 RGB, original
# five-case React camera settings, --eight-bit and --png-dir.
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example geometry_reference -- encode NEW_NATIVE_DIR NATIVE_RENDER_JSON NATIVE_PNG_DIR
node scripts/build-rapidraw-react-proof.mjs NATIVE_SOURCE NEW_STAGE QUALITY_WASM_DIR
node scripts/smoke-rapidraw-react.mjs BUILT_STAGE PUBLIC_DNG OUTPUT_JSON NATIVE_FINAL_JPEG_REFERENCE NATIVE_RESIZE_JSON NATIVE_INTERACTIVE_JSON NATIVE_GEOMETRY_JSON
```

Native geometry JSON is an ordered six-object array with action labels and source state shown above. Actions now creates these native references from actual Quality preview RGB and runs the same original control sequence, retaining source/native/browser/screenshot artifacts. Previous849da33 Checks39149209649 succeeded; parity39149209712 was in progress at the one entry check. Fresh CI remains pending normal source publication. No other CI run is cancelled/restarted; no public release or OS/adapter availability claim.

## Next ready task

Trace original source crop sizing/apply_crop and original CropPanel crop/aspect-ratio controls. Implement one bounded integer crop path with original orientation→flip→crop order, full-image coordinates scaled into the working preview, target dimensions and resource/input bounds. Mount/bridge the original uncropped-preview requirement if the actual crop UI needs it; no custom crop editor or silent fallback. Prove actual original UI crop plus native RGB/pixel/JPEG and refusal/recovery; leave fine rotation/warp/effects/ROI/export/providers explicit until implemented.

Full crop/straighten/warp/lens/effect preprocessing/masks/ROI, metadata/sidecars, complete App/menu/library behavior, analytics/WGPU_RENDER and common-provider destination/retention/write-ACK/uncertain recovery remain open. Continue in this MAIN chat with no new writer/chat or security-profile changes; A waitingOnApproval remains untouched.
