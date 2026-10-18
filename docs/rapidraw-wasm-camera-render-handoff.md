# Actual as-shot WB/exposure → original shader/PNG — 2026-10-18

Branch `codex/rapidraw-wasm-port`; unfinished experiment, not a public full editor.

## Source and implementation

CyberTimon/RapidRAW `b39884b38d8f148caef6fd0d52afd264951be329`, AGPL-3.0-only. `camera_renderer::camera_adjustments` projects original `get_all_adjustments_from_json` WB tool visibility and adaptation gains into the pinned AllAdjustments layout, using actual `AsShot` and existing original exposure input/baseline semantics. The original `mat3_to_gpu_mat3` helper preserves three padded GPU columns; RGB→LMS and inverse use the same original WB module/glam0.33.5. Source/excerpt hashes and copies are in `UPSTREAM.json` and `tests/reference/wb-target.txt`/`wb-gpu-matrix.rs`; tests protect the original source fragments and disabled-tool behavior.

The matrix helper remains inside the original layout module so private GpuMat3 fields and the source layout stay unchanged. New host glue checks bounded JSON/positive finite WB, exposure and finite adaptation gains. `packCameraRendererFixture` validates metadata/payload and forwards values to WASM; it implements no JS color/exposure math. Full WGSL remains byte-identical and the source EightBit/dither path is retained.

Independent native `develop_reference --camera-render` reads actual original metadata and computes original WB visibility, gain/matrix/exposure settings for five explicit original JSON cases. Native wgpu reference's optional `--camera-settings FILE` uses those independently generated values in its otherwise neutral source-layout fixture; pre-existing neutral modes remain unchanged. Complete native/browser packed-adjustment hashes must match before per-component pixel checks. Neither native camera settings nor pixels are read from WASM outputs.

## Actual evidence

[Browser report](evidence/rapidraw-wasm/camera-render-png.json) · [compact native summary](evidence/rapidraw-wasm/camera-render-native-summary.json).

Sandboxed Chromium151.0.7922.34 and explicitly identified SwiftShader software WebGPU,512×384 public raw.pixls.us1327 CC0 Canon DNG:

| Case | Effective exposure | WB behavior | PNG bytes |
|---|---:|---|---:|
| Original exposure−0.8, baseline enabled |−1.5EV| As-shot reference |320478|
| Exposure0, temperature10/tint−3 |−0.5EV| Original relative WB shift |360281|
| Exposure0.8, absolute5500K/tint12, relative−5/+2 |+0.5EV| Original absolute/relative mapping |409103|
| Exposure0.8, WB explicitly inactive |+0.5EV| Gains reset, source matrices retained |406569|
| Exposure0, baseline disabled, legacy color hidden |0EV| Original legacy visibility |386072|

The actual separate as-shot WASM worker reads6133.300425391969K/tint39.766891841657326 and baseline−0.5EV; the Speed development worker supplies pinned native RGB-f32 pixels, then original f16 upload. All five source-shaped adjustment payloads, **3,932,160/3,932,160 RGBA8 components** and all PNG files match the independent native software reference exactly (zero allowed/measured byte difference). Original ICC/300DPI/dither are preserved; browser decode and completed download length/SHA match for every file. Six pre-existing invalid PNG inputs refuse; GPU/page/network errors are empty. Full shader proof still uses neutral remaining resources/effects, not original preprocessing.

Core39/39, native shader/source reference1/1, host15/15, `npm run check`, focused Rust/JS format/syntax and diff checks pass. Earlier as-shotc0bdfd4 Checks39124703583/parity39124703572 succeeded; fresh renderer CI follows source publication and is not assumed successful here.

Reproduce with cached toolchains/targets and the existing one-build low-impact wrapper:

```sh
# Native metadata reference; input is hash-pinned CC0, never a private photo.
develop_reference PUBLIC_DNG --camera-render > camera-settings.json
# Existing native RGB reference from original Speed development:
cw-rapidraw-native-render-reference --rgb-f32 NATIVE_RGB 512 384 --eight-bit --png-dir NEW_PNG_DIR --camera-settings camera-settings.json > native-camera-render.json
node scripts/smoke-rapidraw-webgpu.mjs WASM_DIR browser.json native-camera-render.json PUBLIC_DNG NEW_PNG_DIR
```

Native PNG outputs use `create_new`; supply a new destination. The browser proof admits only the existing hash-pinned public fixture, closes its context/workers/resources/server and does not write the source. Actions generates native camera settings, images and source/license provenance independently and runs this same comparison.

## Exact next step and limits

Replace the **neutral global fixture** with the full pinned `get_global_adjustments_from_json` and exact dependencies/defaults: basic controls, curves, HSL/color grading/calibration, tone mapping and AGX matrices. Trace helper calls/source pins first; retain already-working actual as-shot WB/exposure/visibility, original algorithms/effect order, native packed-byte and real frame reference. Do not add custom substitutes for missing original defaults. This moves toward the original React bridge; masks, preprocessing/effect resources, geometry/export options and actual file-provider integration remain separate acceptance work.

Current WB/exposure projection does not implement all controls, complete Tauri/AppState/cache behavior, original React interface, full metadata/XMP or laptop folder permission/write ACK/recovery. It does not establish hardware performance, broader RAW/camera/OS support or full memory safety. Private RAF development budget remains unchanged; no private photo/preview/EXIF/path, user original, protected service/studio, public demo or product version/tag/release was changed. Continue MAIN under temporary permission policy; A owner waiting approval remains untouched.
