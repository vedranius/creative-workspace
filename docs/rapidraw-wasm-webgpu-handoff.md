# RapidRAW WebGPU host boundary — 2026-10-18

## Checkpoint

**Status:** partial implementation; no rendered-frame acceptance. Source pin
`b39884b38d8f148caef6fd0d52afd264951be329`.
WebGPU host commit: `ee9fb0adb9746ff5ed5ff6facf45bd0113d5766f`; source-layout
adjustment packer commit: `87b1676`.

`experiments/rapidraw-wasm-core/webgpu-renderer.js` verifies the pinned shader
hash, preserves the full original WGSL and its 14 bindings, submits the full
`main` compute entry point, and asynchronously maps/packs RGBA16F output. The
new WASM `pack_neutral_renderer_adjustments(exposure)` returns the exact 45,232
byte Pod-compatible field layout copied from pinned `image_processing.rs`;
`packNeutralExposureAdjustments()` validates and forwards those bytes directly
to binding 2. The fixture supplies neutral matrices/basic tone mapping and one
finite exposure value. It does not implement the original adjustment JSON,
as-shot/baseline parser, or full preprocessing. Missing WebGPU and over-limit
dimensions return explicit unsupported errors.

**Checks:** native Rust tests 25/25, of which the new adjustment size/bytes
tests are 2/2; focused Node protocol tests 7/7; wasm32 `cargo check --locked`
and `npm run check` pass. Public PNG
parity Actions run `39074305014` succeeded; its downloaded artifact JSON records
Quality PNG 15,823,705 bytes / SHA-256
`f339e40cd74692a02afbc52b2e487930ff452293398a1d530eda7f8964013866` and Speed
PNG 1,032,380 bytes / SHA-256
`173420c1a8a03539c6b70f54e020f2165808cd6e3a1723e7b8240e4a48f39862`, with
completed browser downloads and matching reported lengths. That evidence bundle
contains JSON reports and provenance, not PNG binaries. Existing final-source
Checks run `39074305062` passed. New WebGPU workflow run `39074639418` is
in-progress. Local headless and isolated headed Chromium both had no
`navigator.gpu`. The mock tests prove host call order and byte handling only;
there is no real shader execution or native rendered-pixel comparison.

**Material limitations:** source-defined neutral/exposure adjustments are now
packable, but original UI settings/baseline conversion and preprocessing
resources are not yet produced by the browser path. Local Chromium has no
`navigator.gpu`; the doubles prove protocol and byte forwarding only. This is
not real shader execution, a functioning renderer/editor, nor a release/demo
update. Full effects/masks, original React UI, export/provider parity and
browser permissions remain open.

## Next ready task

Integrate a bounded browser factory for the minimum source-defined neutral
preprocessing resources (input, mask atlas, identity LUT, flare and original
blur/guided-filter inputs) and assert their descriptors/values in protocol
tests. Keep full original effect order and use the new WASM adjustment packer;
do not substitute CPU analysis filters. Then, only on a real WebGPU-capable
browser, execute the complete shader and compare rendered pixels to an
independent native `process_and_get_dynamic_image_with_precision` reference.
Current host has no `navigator.gpu`, so keep GPU acceptance explicitly open.
Preserve all user data, worktrees and the untracked local
`experiments/rapidraw-wasm-core/target/` directory.
