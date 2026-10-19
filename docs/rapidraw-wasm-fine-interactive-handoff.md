# RWASM-03 — original post-fine Exposure drag

Completed locally2026-10-19 on `codex/rapidraw-wasm-port`. This is an experimental browser-port checkpoint, not a product release or public editor. Original CyberTimon/RapidRAW source remains `b39884b38d8f148caef6fd0d52afd264951be329`; all17 staged React source hashes remain exact. Reused WASM `2b1499c18e24876f782009932adc061946e4f4f7e5dc0b689b9f3c50a295eda8`; no decoder/renderer/WASM rebuild. The two-line runtime change removes the explicit fine+interactive refusal and preserves cached alpha only when the native resize leaves dimensions unchanged.

## Source behavior

Pinned `process_preview_job` selects full/high/performance JPEG quality85/75/65 and no-ROI divisors1/1/1.5. It applies the second area downscale to the **already fine-rotated/cropped DynamicImage**, then multiplies GPU scale by the small/base width ratio. Original `downscale_f32_image` converts a resized RGBA image to RGB, so alpha becomes opaque after real performance downscaling. A no-op returns the original RGBA image, including its alpha. The cached final image retains alpha for later q94 output. This policy is proved across native no-op/small-image, orientation/crop and both-angle cases, rather than inferred from the final-preview path.

The worker already has the exact source RGB resize helper. It now sends cached alpha words only when output dimensions match the geometry image; otherwise the existing RGB upload supplies opaque alpha. Geometry cache bytes remain intact. Existing dimension, finite-value, crop, RGBA intermediate and GPU payload limits remain. The64MiB intermediate is a per-buffer estimate, not whole-process peak-memory/allocator protection. ROI/waveform and fractional/warp/effect paths remain explicitly unavailable.

The independent native `fine_reference` harness assembles pinned working-size/orientation/flip/fine/crop branches, the source interactive selector/filter, original native RGBA16F/WGSL GPU renderer and native JPEG/header codec. Its optional quality and frame-index arguments produce real-exposure native comparisons. Source assembly excerpt and full source-file SHA are recorded under `fineInteractive` in `UPSTREAM.json`; existing filter/rotation/crop source pins remain separate.

## Actual browser proof

[Browser results](evidence/rapidraw-wasm/fine-interactive-browser.json) · [native references](evidence/rapidraw-wasm/fine-interactive-native.json) · [source/runtime provenance](evidence/rapidraw-wasm/fine-interactive-source.json) · [inspected original Exposure drag](evidence/rapidraw-wasm/fine-interactive-drag.png).

The unchanged original CropPanel Slider value edit commits+5.3/−7.1 degrees and original safe crop; actual Adjustments tab returns to the original Basic panel. Six real Shift+mouse Exposure drags to0.8 exercise all three settings while held, comparing actual original interactivePatch image bytes and normalized/full pixel rectangle. Complete RGB, RGBA16F upload, packed adjustments, RGBA8 pixels, JPEG and full24-byte-header responses match independent native output. Mouse-up clears the patch and publishes the matching q94 JPEG; numeric reset0 restores the angle's neutral-exposure image. Source Full Reset restores the original baseline and same document. No direct adjustment/store writes implement these drags.

| Fine angle | Interactive full/high | Interactive performance | q94 bytes after release |
|---|---|---|---|
|+5.3°|512×384;43,956/32,241 response bytes|340×255;14,861 bytes|74,278 for each mode|
|−7.1°|512×384;44,115/32,280 response bytes|340×255;14,836 bytes|74,531 for each mode|

Three separate **backend contract** cases retain the12.5° transparent border that the source UI's safe crop removes. Full/high preserve native alpha; performance becomes opaque native RGB. All9 interactive frames match5,758,992 RGBA8 components and247,038 response bytes, including each24-byte rectangle header. The6 q94 releases total446,427 bytes and are native-exact. All live samples retain the same document. Final reset restores61,812-byte baseline SHA `042350b5c54e9244b8a9f33089efa25b0516ae59f4e188ba0345fcd60a86f869`.

Core65/65 plus doctests, host24/24, `npm run check`, focused script syntax, source/format/JSON/diff checks and isolated sandboxed Chromium pass. Zero GPU/page errors, failed requests or external requests. Original unsupported autosave and lens discovery errors remain visible and classified; no save/export success is claimed. The inspected screenshot uses only the hash-pinned public CC0 raw.pixls.us1327 DNG; no private photos or EXIF were used. The native harness build used the shared build lock. Build and QA used the low-impact helper with two CPU affinity and nice10; builds used jobs1. One QA context used short disk-backed TMPDIR. All owned QA/server/native children closed.

## Next ready work

Alternate to A in MAIN: inspect its current coordinator and exact alpha62 Checks39226350612/Build39226350624 once. Verify immutable tag/draft and fresh Actions-built assets/checksums only after success; preserve its selected-page editing/geometry follow-up. A CI waiting does not block independent B. Next B implementation: trace the original ExportDialog/`export_image` JPEG path, settings/dimensions/alpha and resource bounds, then prove a bounded native/browser export and actual write acknowledgement before enabling it. Never label preview JPEG as full-resolution export. Fractional crop/ROI/effects/full App/provider/storage acceptance remain open. No main merge, product version/release or demo change; MAIN only/no new writer/chat/security changes.
