# RWASM-03 — original Back to Library waits for metadata ACK (2026-10-24)

Original Back to Library now waits before updating its editor cache, zoom and view. Same-image resume preserves native-exact pixels; failed/uncertain ACK and newer drafts retain the editor. Explicit acknowledged close detaches the old document only after GPU completion, and reopen reconciles without replay.88 host tests/check pass; browser proof and reviewed source pins are in the [handoff](rapidraw-wasm-metadata-navigation-handoff.md).

Experimental B only: original navigation hook plus a pinned ACK patch, isolated one-File library and explicit QA close boundary. Arbitrary library/folder/album navigation, zoomed-in ROI, full App/OS/provider acceptance remain open. Native/WASM unchanged; no product release/main/demo/private-photo change. Next A: alpha69 exact Build40117793506/tag/draft/Actions-assets gate. Next B: different-document selection through original handleImageSelect cache/load. MAIN only.

# RWASM-03 — original metadata history and acknowledged document selection (2026-10-24)

Original ControlsPanel Reset and EditorToolbar Undo/Redo now round-trip Exposure metadata, and the isolated selected-File transition waits for the latest draft ACK. Held writes retain the old image; same-name/different-content inputs stay isolated; uncertain writes/newer drafts veto selection and reload reconciles without replay.85 host tests/check and native-exact original browser frames pass. [Evidence and continuation](rapidraw-wasm-metadata-lifecycle-handoff.md).

Experimental B: one reviewed source autosave-completion patch, original controls/algorithms/commands and unchanged native/WASM. This proves selected-File navigation, not full App/library/OS/provider or bulk reset. No product release/main/demo/private input change. Next A: lossless footnote wire/geometry fix from9ab2d36; diagnostic and alpha68 assets are already complete. Next B: original library/editor navigation flush/cache/clear boundary. MAIN only.

# RWASM-03 — original Exposure metadata auto-save/read ACK (2026-10-24)

Original Exposure now persists content-bound private browser metadata and a native-exact400px JPEG thumbnail only after atomic IndexedDB commit/readback. Held ACK stays dirty, real abort and stale-tab CAS preserve records, and uncertain readback reconciles through reload/reopen without replay; editor pixels remain native-exact.81 host tests/check and original sandboxed browser proof pass. [Evidence and continuation](rapidraw-wasm-metadata-handoff.md).

Experimental B only: original hooks/store/UI/algorithms unchanged, host dirty status does not invent a source saved indicator. Exposure±5,32 records/4MiB, no sidecars/EXIF/original writes, private input or product release. Full App/OS/provider/other effects/navigation-pending-save acceptance remains open. Alpha68 A assets are independently verified complete; next A is original footnote caret/range/generated documents. Next B is Reset/Undo/Redo and document switching while auto-save is pending. MAIN only.

# RWASM-03 — original existing-tool Configure Preset name ACK (2026-10-24)

The original card context menu/Configure Preset dialog now renames one Exposure tool preset only after atomic library write/readback. Old name, ID, values and unrelated items survive held ACK, abort, stale-tab conflict and uncertain readback; reload reconciles without replay and the renamed card remains native-exact.74 host tests/check and extracted native save bytes pass. [Evidence and continuation](rapidraw-wasm-preset-configure-handoff.md).

Experimental B: reviewed source ACK patch stacked on create/modal patch; same original controls/algorithm/commands, shader/native/WASM unchanged. Only top-level tool names, not general CRUD/type/effect/metadata/OS/provider/full App acceptance; no product release/main/demo/private-photo change. Next A: exact b441e00 alpha68 CI/assets gate. Next B: original Exposure metadata auto-save/read with content identity and ACK before saved/clean. MAIN only.

# RWASM-03 — original create-tool-preset write ACK (2026-10-24)

The original Save New Preset/Tool dialog now waits for atomic library write/readback before adding its card or closing. Held ACK, double click, real transaction abort, stale-tab CAS and durable-but-unacknowledged reload reconciliation pass in Chromium; the created card reproduces the native+0.8 JPEG. A reviewed three-file source ACK patch preserves original controls/algorithms/command IDs.70 host tests/check and800-byte extracted native save reference pass. [Evidence and continuation](rapidraw-wasm-preset-create-handoff.md).

Experimental B only: one appended Exposure tool preset,32 presets/64KiB, unchanged existing items. General CRUD/style/metadata/OS/provider/full App acceptance remains open; no engine/WASM rebuild, product release/main/demo/private-photo change. Next A: exact b441e00 alpha68 CI/assets gate. Next B: original existing-tool Configure/rename save with ACK before list/modal success. MAIN only.

# RWASM-03 — persisted original Exposure preset card (2026-10-24)

The original PresetsPanel now applies a persisted Exposure+0.8 preset to the public CC0 DNG, Amount200 produces+1.6, card toggle restores the exact baseline, and reload/open/reapply preserves library revision1. Source400px/q80/clipping-off thumbnail and512px/q94 editor match4,412,160 native RGBA8 components and419,208 JPEG bytes on matched SwiftShader;66 host tests/check pass. [Evidence, backend limits and continuation](rapidraw-wasm-preset-apply-handoff.md).

Experimental B: original UI/shader/native/WASM unchanged, synthetic picker and isolated composition; general library writes, metadata autosave, legacy/OS/provider/full App acceptance remain open. NVIDIA-versus-SwiftShader original dither differs by at most2LSB; no universal GPU byte-parity claim. No product release/main/demo/private-photo change. Next A: exact b441e00 alpha68 Checks/Build/assets gate. Next B: source create-tool-preset callback with atomic library ACK before list/success, retaining Exposure-only limits. MAIN only.

# RWASM-03 — original development-preset import and library ACK (2026-10-24)

The unpatched original Import toolbar/hook now imports bounded Exposure/folder `.rrpreset` files into an atomic IndexedDB library. Fresh IDs/name collisions match the extracted native merge. Two held readback ACKs, partial failure, actual transaction abort, second-tab CAS and reload/export pass in Chromium;64 host tests/check pass. [Evidence and continuation](rapidraw-wasm-preset-import-handoff.md).

Experimental B, synthetic picker, no RAW/preset-card application, general library writes, legacy/OS/provider/full App acceptance or product release. JPEG preferences are separate. Next A: exact b441e00 Checks40091269520/Build40091269526 gate. Next B: original persisted Exposure preset card applied to supported public RAW through the existing preview pipeline. MAIN only.

# RWASM-03 — original development-preset file export (2026-10-24)

The unchanged original PresetsPanel Export All and usePresets command now export a bounded Exposure preset/folder file through explicit selection and real close/readback ACK. All601 bytes match the pinned original Rust serializer. Cancel, held ACK, newer-file refusal, three uncertain recoveries and separate Keep retention pass in Chromium;58 host tests/check pass. [Proof and continuation](rapidraw-wasm-preset-file-handoff.md).

Experimental B only: read-only generated in-memory library, synthetic chooser over real OPFS, no RAW/render/WASM rebuild, full App/OS/provider acceptance or product release. Next A: investigate alpha68's existing EditClear browser assertion before release. Next B: original `.rrpreset` import with atomic library/write/readback ACK, fresh IDs and collision handling. JPEG export preferences are separate. MAIN only.

# RWASM-03 — concurrent presets, export snapshots and stale-tab CAS (2026-10-24)

Three real RAW/JPEG exports verify that last-used settings retain captured export values and the latest preset edit, refuse a concurrent pending settings write, and preserve newer presets written by a real second browser tab. File Success survives both preference rejections. Original preset controls remain blocked during export; cross-component changes use the actual source-store callback programmatically. Reload reconciliation waits for settings load ACK. [Evidence, limits and continuation](rapidraw-wasm-settings-concurrency-handoff.md).

QA-only experimental B: unchanged source patches/runtime/native/WASM, reused verified stage, no product release/main/demo/private-photo change. Host54 and npm check pass; complete React/OPFS/IDB proof is local, with synthetic chooser rather than actual OS/common-provider acceptance. Next A: exact alpha67CI gate, then original cell caret; cell range highlight is already complete. Next B: original preset file import/export contract. MAIN only, no new writer/chat.

# RWASM-03 — last-used export preferences after file ACK (2026-10-23)

The reviewed original ExportPanel now waits for its terminal Success event before saving `__last_used__`, independently awaiting settings commit/readback. Native invoke returns before the background export completes; this contract is source-pinned. Actual browser tests hold file and preference ACKs, restore saved controls after reload, retain file Success when IDB aborts, and preserve recovery/no preference write on output failure or original GPU-stage Cancel. No destination authority persists. [Evidence and continuation](rapidraw-wasm-last-used-settings-handoff.md).

Host54/npm84/check pass; native/WASM/render algorithms unchanged, cached Vite only. Experimental B only: no product release, main/demo/private photo change or actual OS/common-provider/full App acceptance. Next A: exact alpha66CI/draft verification, then cell selection; non-cell highlight is done. Next B: concurrent preset/export writes and captured last-used values, then original preset file contracts. MAIN only.

# RWASM-03 — original export-preset browser persistence (2026-10-23)

The original settings command IDs now support bounded JPEG presets in atomic IndexedDB storage. A reviewed two-file ACK patch keeps the original store/list from updating or displaying Saved before write/readback acknowledgement. Actual source ExportPanel create/overwrite/apply/delete/reload passes, including three held readback ACKs, a real injected IndexedDB transaction abort and a stale independent host refused by compare-and-swap. Paths, chooser leases and grants do not persist. [Evidence, patch and continuation](rapidraw-wasm-settings-persistence-handoff.md).

Host54/npm84/check pass; one cached Vite build, unchanged native/WASM/render algorithms. Only public CC0 DNG, no private photo/main/demo or product release. This is an isolated experimental settings slice, not full App/settings/OS/common-provider acceptance. Native ABI/source pins are traced; no new native filesystem-settings or renderer-parity proof is claimed. Next A: exact alpha65 CI/release gate, then original text-range highlight geometry. Next B: original ExportPanel `__last_used__` persistence/error handling after a real file export, keeping file ACK separate from preference ACK and all destination authority ephemeral. MAIN only.

# RWASM-03 — original JPEG quality and enlargement after fine crop (2026-10-23)

Actual original +5.3°/1:1 crop and Exposure+0.8 now drive source ExportPanel quality60/95, long-edge1200/1800 and Don't Enlarge controls. Three real RAW exports match23,924,928 native full-frame RGBA8 components and2,485,154 JPEG bytes exactly:1200²,1800² and1412². Each real OPFS close is gated before source Success; the same1412² full render precedes all codec resizes. Original26 source pins/runtime/WASM stay exact;45 host tests/check pass. [Proof and next task](rapidraw-wasm-export-quality-handoff.md).

This verifies existing experimental behavior with QA/reference improvements, without a build/product release/main/demo/private-photo change. Full input3MP/4096, sensor4M, codec/preview64MiB and estimated GPU256MiB limits remain; post-render codec output has its separate existing64MiB bound, not an aggregate-memory guarantee. Next A: exact alpha64 release gate then original visible caret/selection overlay. Next B: original settings/export-preset browser persistence, source load/save contract, bounded storage and write/readback ACK; keep opaque destination grants ephemeral and OS/common-provider/full App acceptance open. MAIN only.

# RWASM-03 — original Exposure and export resize/DPI proof (2026-10-23)

Three actual original Exposure/ExportPanel exports now prove non-neutral edits, long-edge resize, Don't Enlarge, 72/144 DPI and real gated destination ACK. All37,748,736 full-frame RGBA8 components and719,812 JPEG bytes match independent native source. Render remains2048×1536 before1024×768 output resizing;4096 with Don't Enlarge stays2048×1536. Original26 source pins and existing WASM/runtime are exact;45 host tests and npm check pass. [Evidence, limits and continuation](rapidraw-wasm-export-settings-handoff.md).

This is decisive verification of the existing experimental runtime, with QA/reference improvements only; no product release, main/demo change or private photograph. Existing3MP/4096 full input,4M sensor,64MiB preview/codec and256MiB estimated GPU limits remain, without aggregate-memory guarantees. Next A: exact alpha64 CI/release gate then original right-hand facing-page TextTool/caret/typing. Next B: original JPEG quality and explicit enlargement after fine crop, native/codec/ACK parity within the same limits. MAIN only.

# RWASM-03 — full source fine rotation/crop JPEG export (2026-10-22)

The unchanged original CropPanel/ExportPanel now exports +5.3°/1:1 and−7.1°/16:9 full-image crops, with real OPFS ACK. Alongside an uncropped quarter-turn/flip/alpha case, all3 actual RAW jobs match28,929,748 native RGBA8 components and1,370,418 JPEG bytes exactly. Original Export tab activation fixes the QA composition's adjustment subscription;17+9 source hashes remain exact. Core71/native1/host45/check and clean-stage browser pass. [Evidence, limits and continuation](rapidraw-wasm-export-fine-handoff.md).

Full input3MP/4096, sensor4M, preview64MiB and estimated GPU256MiB limits remain; no aggregate-memory guarantee or private-RAF full-export acceptance. Four malformed/unsupported requests refuse before GPU. No private photo, product release, main/demo change or common-provider/OS acceptance. Next A: exact release asset gate then selected-page editing. Next B: original non-neutral Exposure edit and resize/DPI export controls with native/write-ACK proof. MAIN only.

# RWASM-03 — original ExportPanel JPEG command/event composition (2026-10-22)

Unchanged original ExportPanel/settings/listeners/process store now drive native command IDs and useful errors. Actual source metadata refusal, metadata-off full RAW→655,924-byte native-exact JPEG, gated destination close with no early success, retained close-failure output and original Cancel handler at GPU submission all pass. Existing17 plus8 export source hashes are exact;45 host tests and npm check pass. [Evidence, limits and next task](rapidraw-wasm-export-panel-handoff.md).

This remains an isolated experimental Basic/quarter-turn single-JPEG slice with a synthetic OPFS chooser, not actual OS/common-provider/full App acceptance. No private photo, native/WASM rebuild, product release or public demo change. Next B: full-resolution source fine rotation→integer crop export and independent native/UI parity within current budgets. Alternate with A's exact release/Actions and selected-page editing gates. MAIN only.

# RWASM-03 — export destination host foundation (2026-10-22)

The interrupted host foundation now gates native-shaped success on a real destination close/readback ACK, retains uncertain JPEGs in OPFS and refuses stale/replayed/newer-file output. One actual public RAW export produces655,924 native-exact JPEG bytes; gated-close, keep retention, four real-OPFS injected faults and another actual GPU-cancel job pass. Host41/41 and npm check pass; no native/WASM rebuild, private photo, product release or demo change. [Evidence, limits and next step](rapidraw-wasm-export-destination-handoff.md).

This is the command-shaped host foundation, **not** original ExportPanel/transport or OS/common-provider acceptance. Next B: compose unchanged original export panel/settings/listeners/stores and native command IDs, with cancellation outside the preview queue, then prove actual UI ACK/error/cancel behavior. Keep the original server-processing suite and pending A release/Cloudflare-secret work independent. MAIN only.

# RWASM-03 — full image Basic export worker (2026-10-19)

The browser now develops the real public RAW, applies source quarter-turn/flip and renders the full2048×1536 image before JPEG export resize. Two jobs match25,165,824 native RGBA8 components and755,670 JPEG bytes exactly. GPU-submit cancellation, timeout, overlap refusal, seven invalid-input refusals and successful subsequent jobs are verified. [Evidence, resource limits and next task](rapidraw-wasm-full-export-handoff.md).

Core69/host25/check and sandboxed browser pass. A separate3MP/256MiB estimated GPU export budget preserves the64MiB preview cap; no aggregate memory guarantee. This is the Basic/quarter-turn slice only: original ExportPanel/export_images, destination/provider acceptance and other transformations/effects remain open. No public editor/release/demo change. Next A: current alpha62 Actions/assets gate; next B: original single-file ExportPanel bridge and real write-ACK lifecycle. MAIN only.

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
