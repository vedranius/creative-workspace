# RWASM-03 full fine rotation / integer crop export — 2026-10-22

Full-resolution export now follows the pinned original orientation/flip→fine rotation→crop functions before the original EightBit GPU render and JPEG encoder. The original React CropPanel and ExportPanel remain unchanged. A separate full-geometry WASM boundary accepts fine angles−45..45 and bounded integer full-image crops, preserves source edge clipping and rotation alpha, and performs no preview resampling. Existing preview and export budgets stay separate and unchanged. This is an unintegrated experimental slice, with no product version/release, main merge, public demo or complete adapter availability claim.

## Actual source UI and native evidence

[Final clean-stage browser proof](evidence/rapidraw-wasm/export-fine-browser.json) and [independent native reference](evidence/rapidraw-wasm/export-fine-native.json) compare all28,929,748 RGBA8 components and1,370,418 JPEG bytes exactly across3 actual RAW jobs:

| Case | Full output | JPEG bytes | Path |
| --- | --- | --- | --- |
| Quarter-turn/flip, +8.7°, no crop |1536×2048|573,837|Dedicated full RAW worker;213,871 native transparent-border pixels retained through f16 upload |
| +5.3°, original1:1 preset |1412×1412|385,288|Actual source numeric rotation/preset→original ExportPanel→real OPFS close/readback ACK |
| −7.1°, original16:9 preset |1929×1085|411,293|Actual source numeric rotation/preset→original ExportPanel→real OPFS close/readback ACK |

Every case matches independent source full RGB, original RGBA-f16 upload including alpha, complete packed adjustments, original native full shader RGBA8 and source JPEG bytes. Native reference uses the previously verified public Quality RGB and neutral original camera fixture; it does not call the port's geometry function. The reference extracts are unchanged and separately hash-checked. JPEG encoding is independently compared to the copied native source. The browser uses only the existing hash-pinned CC0 Canon A410 DNG; private photographs were not read.

The QA composition previously displayed ExportPanel while its native `activePanels` entry was inactive. The original panel subscribes to adjustment changes only while its tab is active, so a baseline-only proof did not establish edited-image export. The composition now includes the unchanged original left-region PanelSwitcher and the smoke clicks its actual Export tab before editing the separate Crop region. The source subscription stays active across those edits. Assertions require the exact cropped dimensions and a changed JPEG hash, preventing a stale neutral export from passing. Original17 source hashes remain exact;9 additional export/UI-store sources are pinned. No original source handler or preset implementation is patched.

Four invalid fractional/out-of-frame crop, angle and unsupported-effect requests refuse before GPU submission. Existing single-file capability, generation identity, write ACK, cancellation, uncertain-output journal and no-replay policies remain in place. UI output is a real OPFS file selected through an injected chooser; this is **not** an actual OS picker permission or common-provider acceptance test. Both accepted source UI exports reach original Success only after real close/readback ACK and until-ACK journal cleanup. Screenshots were visually inspected. Final clean staging was tested again after a bundle change, then compared to the same native references; no redundant native GPU runs were needed. Page errors, failed requests, external requests and preview GPU errors are zero. Own QA context/server/workers closed and the short TMP symlink removed.

## Checks and resource limits

- Rust core71/71 plus doctests; native-render source/shader pin test1/1; host45/45; npm check, focused syntax/format/JSON/privacy/diff checks pass.
- Rust1.99.0, existing target caches and the reviewed timer-only rawler patch reused. Actual matching wasm-bindgen is0.2.129. All local native/WASM builds and native GPU reference processes use the shared low-impact lock, max2CPU/nice10/jobs1. No global priority or toolchain changes.
- New WASM SHA256: `b4a794da6b6d9e987dafa810be9484ac6797b12484cf1e97135a105f878c9556`.
- Sensor preflight remains4M samples/4096 axes; full developed input remains3MP even for a tiny output crop. Source rotation RGB/RGBA intermediates remain below64MiB each; GPU full-frame estimate remains256MiB and preview cap64MiB. These per-buffer/estimated bounds do **not** cap aggregate live allocations, imageproc internals or physical GPU memory.
- Native reference's explicit full-export mode now admits any bounded shape in that same3MP/4096 slice. Its30s software-GPU wait expired on the last case under low CPU limits; the full-reference mode now uses the existing120s export deadline and passed. Ordinary preview reference remains30s, and browser export timeout/cancel behavior is unchanged. Completed first-two references were reused and all final hashes rechecked; the last case alone was recomputed.

Reproduce using `build-rapidraw-react-proof.mjs ... export`, `smoke-rapidraw-export-fine.mjs BUILT_STAGE PUBLIC_DNG BROWSER_JSON`, then under the shared low-impact wrapper `verify-rapidraw-export-fine-native.mjs BROWSER_JSON PUBLIC_NATIVE_QUALITY_RGB NATIVE_RENDER_BINARY CORE_EXAMPLES ORIGINAL_CAMERA_JSON NEW_OUTPUT_DIR`. The latter runs independent source geometry→native EightBit→source codec and fails any byte/hash mismatch. Use existing source/toolchain/target caches and one sandboxed QA context; do not expose the probe publicly.

## Next ready step

Alternate in this MAIN chat to A's exact pending alpha63/alpha62 Actions/tag/draft/downloaded asset checks, then original selected-second-page TextTool/caret/typing. Do not cancel/restart another CI run or overwrite A's coordinator.

Next B: actual original Exposure edit→original ExportPanel long-edge resize/DPI controls→JPEG, independent native full-render/codec parity and destination ACK. This should validate non-neutral edits and source settings beyond the current default-quality geometry cases. Fractional crop, warp/effects/masks/metadata, multi-file, larger private-RAF full export, original full App/presets/storage and all common server/laptop/hybrid/copy-first providers remain open. Keep the explicit larger-export refusal until a separately proven memory/processing design; do not just raise limits. No private photos, new writer/chat or implicit main merge.
