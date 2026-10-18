# RWASM-03 — Quality load and original preview resize

Completed2026-10-18 after `2676ce0` on `codex/rapidraw-wasm-port`. Native CyberTimon/RapidRAW pin `b39884b38d8f148caef6fd0d52afd264951be329` (AGPL-3.0-only), decoder pin and original React source remain unchanged.

## Behavior and source

The previous original React proof returned Speed512×384 dimensions. This checkpoint runs original Quality development in a persistent document worker and returns the actual2048×1536 developed dimensions through load_image. The unchanged useImageLoader records both selectedImage and originalSize correctly, then the unchanged processing hook requests its512-pixel preview. EXIF/sidecar metadata remain explicitly unimplemented; this does not establish full native load_image parity.

`original_downscale.rs` retains exact original downscale_f32_image area weights, overlap normalization, sample order, negative-value clamp, aspect rounding and no-upscale behavior. Only its profiling Instant/log have non-wasm32 cfgs. Independent reference source and UPSTREAM.json pin the full function and original files. The original compute_transformed_preview f64 target-scale/rounded working-size sequence precedes the helper's f32 aspect/rounding sequence. GPU scale uses the source f32 cast. Geometry is neutral; existing RAW development already applies EXIF orientation. No crop/rotation/warp/patch/effect substitute is introduced.

`preview_resize.rs` adds dimension/RGB shape/finite/f16-domain and64MiB input/output guards before image materialization. The worker owns full Quality RGB; preview requests reuse it and transfer only the resized pixels. Before resize/upload, the worker checks the unchanged combined texture-payload estimate; the existing resource factory validates it again. Requests serialize with IDs and30s deadlines; file switch/clear/close terminates the owned worker. Refused preview requests leave the current image and valid cached textures usable.

The original helper's extreme thin-image zero-rounded-axis fallback returns the original image; that behavior is retained, with resource validation before GPU allocation. Rayon1.12.0 is now a direct exact dependency for the original parallel-row code; it was already locked transitively, with no dependency version changes. Quality reuses the reviewed isolated PPG profiling-only compatibility patch. The React staging builder requires its matching provenance and records the actual WASM SHA; neither shared Cargo/native source nor host security settings are modified.

These are per-buffer and upload-payload limits, NOT complete allocator/peak-memory protection. Full RGB, WASM copies, filter scratch, GPU resources and JPEG may coexist. Existing RAW sensor/development guards remain intact; large private RAF development is still outside the current64MiB developed-image estimate. No private-photo re-test/copy/publication was needed. This checkpoint does not repeat decoder parity as new progress: it connects the already-proven full Quality output to original UI dimensions and preview processing.

## Evidence

[Browser report](evidence/rapidraw-wasm/quality-react-browser.json) · [native resize](evidence/rapidraw-wasm/quality-react-native-resize.json) · [native JPEG reference](evidence/rapidraw-wasm/quality-react-native-jpeg.json) · [source/WASM provenance](evidence/rapidraw-wasm/quality-react-source.json) · [actual original UI](evidence/rapidraw-wasm/quality-react-browser.png).

Only public CC0 raw.pixls.us1327 Canon DNG, SHA `f0d2fe47507fadf50008bddbc6bd2c5e39fddbe90cca6bca72dd360fa0e0eb38`. Independent native original developer/filter/wgpu renderer/preview encoder are reused; no private photograph/EXIF/path is in these artifacts.

- Full Quality2048×1536 RGB SHA `f052bba0940702e068fb03d6a9f1cc78b9c57e7ff5758f1c460f28d11fb49e30` matches the worker-owned image.
- Native area preview512×384 RGB SHA `c0d07e55c42bd67059613035283567cc83e324ad95f75c9008de854ac5d7ec9f` matches before upload; scaleForGpu0.25. The preview's589,824 RGB f32 components are bit-exact. GPU payload estimate14,942,340bytes fits64MiB; the full2048×1536 texture set would exceed that budget and is refused.
- Original React Basic/Slider numeric Exposure edits0,+0.8,−0.8,+1.6,0 yield native-exact complete adjustment hashes,3,932,160 RGBA8 components and342,799 JPEG bytes. File lengths:61,812 /85,035 /38,183 /95,957 /61,812. The original final image hash is restored; original SVG image is visible and decoded preview is512×384 while originalSize stays2048×1536.
- Eight direct WASM malformed/oversized/invalid-target/nonfinite/domain inputs refuse. An odd-ratio direct WASM check verifies the original f32 scale cast. Native filter comparisons cover odd landscape/portrait, no upscale, negatives and thin-image fallback. An oversized actual worker preview request refuses before texture creation; the same worker then computes a new256×192 preview and restores512×384 with the exact original JPEG hash (targets512→256→512).
- Local Chromium151.0.7922.34 uses sandbox=true and explicit SwiftShader. GPU/page/network/external-request errors empty. Autosave still surfaces its real unavailable-command toast; export refuses. No fake write ACK. The QA context, browser/server and owned worker/resources close.

Core48/48 and doctests pass, host20/20 (including loaded worker ownership/clear termination), npm run check, source-hash, focused JS syntax/rustfmt and diff checks pass. Final WASM SHA `3f41fbc8cb5b88e0a0600ef03ccfb89ac6abc8585a284df0add007c72dd6dc3b`. Builds use the required lock/low-impact wrapper, max2CPU/nice10/jobs1. The final actual browser/native proof was rerun after correcting the odd-ratio GPU scale cast; no tolerance was relaxed. A later QA run exposed a sampling race on repeated Exposure0: the harness now requires a newer render record and matching published-URL hash, rather than accepting an older equal-value trace. The final full proof passes with fresh-worker resize recovery.

## Reproduce and CI

Use Rust1.99 and wasm-bindgen0.2.129. Prepare with scripts/prepare-rapidraw-quality.mjs or reuse the existing verified isolated decoder stage; build with feature quality-timer-compat. Source filter copies are checked independently and retain attribution. Never edit shared Cargo cache/upstream to fix profiling.

```sh
# Existing independent native developer: export actual full Quality RGB.
develop_reference PUBLIC_DNG quality NEW_NATIVE_PNG NEW_NATIVE_RGB_F32
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example preview_resize_reference -- NEW_NATIVE_RGB_F32 2048 1536 512 NEW_PREVIEW_RGB_F32
# Feed that preview RGB and original React settings to the existing native
# renderer, then react_preview_reference for all five JPEG hashes.
node scripts/build-rapidraw-react-proof.mjs NATIVE_SOURCE NEW_STAGE QUALITY_WASM_DIR
node scripts/smoke-rapidraw-react.mjs BUILT_STAGE PUBLIC_DNG OUTPUT_JSON NATIVE_JPEG_REFERENCE_JSON NATIVE_RESIZE_JSON
```

Native output uses create_new. Local cached artifacts are recorded in the private coordinator, not source paths in public evidence. Actions now retains native Quality RGB in its temporary directory, computes original resize, renders native references and runs the same actual React comparison/refusal/recovery proof. All intermediate downloads are the hash-pinned CC0 fixture/source. Previous2676ce0 Checks39147262088 succeeded; parity39147262083 was still in progress at the single entry check. Fresh CI is pending source publication; no other run is cancelled/restarted. No product version/tag/release/assets/install/demo change for this unfinished experimental editor checkpoint.

## Next ready task

Port the original interactive preview resolution/divisor/quality selection from process_preview_job and live-preview settings. Exercise actual original Slider pointer drag followed by release, compare interactive header/preview pixels/JPEG and restored final q94 against native. Reuse Quality worker/source area resize and retain full original dimensions; keep ROI/geometry/effects/analytics/save/provider commands explicitly unaccepted. Do not substitute cropped codec fixtures for actual interactive rendering.

Interactive preview divisor/quality settings, full metadata/sidecars/load-image behavior, original geometry/effect preprocessing/masks, analytics/WGPU_RENDER, whole App/menu/library acceptance, export flow and common provider destination/retention/write-ACK/recovery remain open. The source filters and codec primitives are not an accepted full browser editor or server adapter. Continue in this MAIN chat, without new writers/chats or security-profile changes; A remains waitingOnApproval and untouched.
