# Full original GlobalAdjustments parser — 2026-10-18

Branch `codex/rapidraw-wasm-port`; unfinished experiment, no product release.

## Exact source and behavior

CyberTimon/RapidRAW `b39884b38d8f148caef6fd0d52afd264951be329`, AGPL-3.0-only. `global_controls.rs` is the complete unchanged `get_global_adjustments_from_json`. `global_helpers.rs` retains original scales, HSL/grading/curve conversion, Rec2020 primaries, rotation/scale and AGX matrix functions. Existing unchanged WB, sRGB/D65/color and GPU column helpers supply dependencies. Parser/helper/type excerpt hashes are recorded in `UPSTREAM.json`; independent native reference copies are source-compared and compiled separately.

The production wrapper retains real as-shot WB/exposure and tool visibility, then replaces the neutral global fixture with that full original parser's result. Masks remain empty and preprocessing texture resources remain separate. Source structs/private fields/layout are unchanged; parser includes live inside their original layout module. Native `develop_reference --global-render` independently runs original metadata/WB/UI helpers and full original global parser/types, emitting original global fields into the native renderer's optional camera settings. The browser parses only original control JSON and its own actual worker metadata; it does not consume native computed fields. Native/browser **complete adjustment payload hashes** and real pixels are compared.

New bounded host guards require valid64KiB JSON, known tone override0/1, finite global fields, zero or2..16 curve points, finite coordinates in0..255 and increasing x. This refuses arrays that would otherwise report more points than the source's16-point storage. Original valid curve math/defaults remain unchanged. These checks are not total memory safety or acceptance for all effect inputs.

## Actual proof

[Browser report](evidence/rapidraw-wasm/global-render-png.json) · [compact native summary](evidence/rapidraw-wasm/global-render-native-summary.json).

Sandboxed Chromium151.0.7922.34, explicit SwiftShader software WebGPU and public raw.pixls.us1327 CC0 Canon DNG,512×384 Speed development. Real as-shot6133.300425391969K/tint39.766891841657326, DNG baseline−0.5EV.

| Original controls covered | Effective exposure | PNG bytes |
|---|---:|---:|
| Brightness/contrast/highlights/shadows/whites/blacks |−1.5EV|193551|
| Luma/red curves, saturation/vibrance and relative WB |−0.5EV|346587|
| HSL, grading/calibration, absolute/relative WB |+0.5EV|443314|
| Basic tool disabled and WB inactive |−0.5EV|363926|
| AGX tone mapper and legacy hidden color controls |0EV|400263|

Five complete native/browser adjustment payload hashes and **3,932,160/3,932,160 RGBA8 components match exactly**, zero allowed/measured byte difference. All five PNG files including original ICC/300DPI/dither match native exactly; browser decode/completed-download lengths and SHA match. Six direct WASM malformed-global cases refuse (single/oversized/unordered/out-of-domain curves, float conversion overflow, unknown tone override); six previous malformed PNG cases also refuse. GPU/page/network errors are empty. Native full field/pixel arrays stay in scratch/Actions artifacts; compact repo evidence keeps control JSON, hashes and summary.

Core42/42 includes18 complete native global-byte comparisons across default/null/full control/visibility cases and none/basic/AGX overrides. Native shader/source reference1/1, host16/16, `npm run check`, focused syntax/format/diff checks pass. Prior camera-render0a41403 parity39125368496 succeeded; fresh full-global hosted verification follows source publication.

Reproduce through existing cached Rust1.99/wasm-bindgen0.2.129, one low-impact build lock/helper(max2CPU/nice10/jobs1), one isolated QA context with short disk-backed TMPDIR:

```sh
develop_reference PUBLIC_CC0_DNG --global-render > global-settings.json
cw-rapidraw-native-render-reference --rgb-f32 NATIVE_SPEED_RGB 512 384 --eight-bit --png-dir NEW_PNG_DIR --camera-settings global-settings.json > native-global-render.json
node scripts/smoke-rapidraw-webgpu.mjs WASM_DIR browser.json native-global-render.json PUBLIC_CC0_DNG NEW_PNG_DIR
```

Native PNG destinations refuse existing files. The browser proof is public-fixture hash-gated; workers/context/resources/server are closed. Actions independently generates native settings/images and runs the same comparison, with original parser/helper/type/license provenance.

## Next original UI transport slice

The pinned React source uses `src/hooks/useImageLoader.ts` with `load_metadata` then `load_image`; it populates original size, `as_shot_white_balance`, EXIF/metadata and readiness. `src/hooks/useImageProcessing.ts` calls `apply_adjustments` with original adjustment JSON, interaction/ROI/resolution/analytics/waveform options and uses job/path checks to refuse stale frames. Command IDs live in `src/components/ui/AppProperties.tsx`. Final frames expect image bytes; interactive frames expect a24-byte little-endian rectangle/full-size header then JPEG bytes, with a separate `WGPU_RENDER` sentinel path. Do not fake these contracts or report unsupported analytics/masks/saves as completed.

Next bounded task: trace native preview encoding/envelope/cache/cancel/error behavior and implement the narrow original open/render transport on the verified RAW/as-shot/global renderer, then wire/verify the actual original React hooks/editor path. Preserve original interface/panels/menus, browser file permission, typed unavailable commands, private-file isolation and existing resource gates. Add the required original preview codec/envelope rather than relying on mislabeled PNG/JPEG blobs or a replacement HTML editor. This slice is a step toward original UI acceptance, not completion of every desktop command.

Global field parsing does not provide original resource-dependent preprocessing for sharpening/blur/noise/creative effects. Masks, geometry, full preview/AppState/cache/analytics, complete UI/commands, metadata/XMP/export options and real laptop folder/write-ACK/recovery remain open. No private photograph/EXIF/path or user original/service/studio/demo/product version/release/OS availability claim changed; private RAF development budget is unchanged. Continue MAIN under temporary permission policy; A owner awaiting approval remains untouched.
