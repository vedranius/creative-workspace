# Original as-shot white-balance checkpoint — 2026-10-18

Branch `codex/rapidraw-wasm-port`; unfinished experiment, no product release.

## Source and behavior

CyberTimon/RapidRAW `b39884b38d8f148caef6fd0d52afd264951be329`, AGPL-3.0-only. Production and independent reference copies of full `white_balance.rs` are byte-identical. The source-shaped `wb_color.rs` includes original `WP_D65`, sRGB primaries, `xy_to_xyz` and `primaries_to_xyz_matrix`. Full source/helper hashes and matching native dependencies glam0.33.5/serde1.0.229 are recorded in `UPSTREAM.json`. Existing PNG/flate2/codec lock versions remain unchanged.

`camera_as_shot` runs the original metadata/dummy decoder after existing input/sensor preflight, checks dimensions/components, preserves the original monochrome/reference fallback and exact `as_shot_white_balance` helper. That helper retains Canon multi-exposure neutralization, coefficient inversion, IlluminantA/D65 dual matrix conversion and fallback matrix selection. Full original Robertson isotherms/Bradford math remains intact. Positive/finite temperature and finite tint/exposure are checked at the host boundary. Sensor estimates still do not bound all parser/intermediate memory; no private RAF development budget was raised.

The actual worker accepts explicit `output:'as-shot'` and returns only WB/exposure. WASM `map_white_balance` runs original `from_adjustments`, relative shifts/clamps, adaptation log gains and RGB→LMS matrix with64KiB JSON and finite input/output guards. It does not map other controls or dispatch GPU work.

The independent native `develop_reference --as-shot` harness now compiles the **real unchanged original WB module** and color helpers; the previous dummy WB stub was removed. Full original `raw_processing::read_as_shot` supplies metadata, with original WB controls/adaptation computing expected outputs.

## Evidence

[Actual browser report](evidence/rapidraw-wasm/as-shot-browser.json): sandboxed Chromium151.0.7922.34, one actual module worker, pinned public raw.pixls.us1327 CC0 Canon DNG. Native and WASM read identical:

- Temperature6133.300425391969K, tint39.766891841657326.
- Scene-referredtrue, DNG baseline−0.5EV, highlight preservation0.
-58/58 metadata, four original WB adjustment/relative/clamp cases, Bradford log-gain and RGB→LMS matrix scalars match exactly; measured maximum absolute differences all0. Cross-target tolerances were declared before execution: temperature1e-8K, tint1e-9, log gains5e-7, matrix1e-6. These tolerances do not establish rendered-image parity or permit algorithm changes.
- Eight malformed mappings and empty RAW reject; no page/network errors.

Native tests37/37 cover source pins, single/dual/singular/mismatched matrix cases against original source, input guards and original clamping. Host14/14, `npm run check`, focused JS/Rust syntax/format and diff checks pass. One initial lockfile regeneration selected newer codec dependencies; that build alone was stopped and the original lock retained with only pinned glam/direct serde additions. Final native/WASM build/tests use the preserved codec graph.

Reproduce with the existing low-impact build lock/helper, cached Rust1.99 and matching wasm-bindgen0.2.129:

```sh
cargo test --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml
cargo build --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example develop_reference
# Build/bind WASM as in the port instructions, then:
node scripts/smoke-rapidraw-as-shot.mjs WASM_DIR PUBLIC_CC0_DNG NATIVE_DEVELOP_REFERENCE OUTPUT_JSON
```

The smoke hash-gates the CC0 input and closes its worker/context/browser/server. Actions reproduces it and retains original WB/color source/license provenance. Prior exposure checkpoint201a8f2 Checks39111264750/parity39111264753 succeeded; fresh as-shot hosted verification follows publication, not assumed here.

## Next real task

Connect **actual** as-shot WB/exposure to original visibility/control semantics and the pinned AllAdjustments WB fields/matrices, then execute the full original shader against an independent native adjustment/render/PNG reference on that public DNG. Trace original `get_global_adjustments_from_json`/`get_all_adjustments_from_json` and GPU matrix packing; preserve source effect order and avoid applying decoder camera coefficients twice. Previous neutral shader/PNG reports retain explicit fixture camera settings; do not relabel them as real WB frame parity.

Remaining controls/preprocessing/effects, complete original React interface/bridge, metadata/XMP/transforms/export options, actual laptop folder permission/write ACK/recovery and complete editor acceptance stay open. One public camera proof and native synthetic matrix tests are not broad RAW compatibility evidence. No private image/EXIF/personal path, protected services/studios/demo, product SemVer/tag/release or OS availability claim changed. Continue MAIN under temporary permission policy; A owner awaiting approval remains untouched.
