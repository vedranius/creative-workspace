# RapidRAW WebGPU host boundary — 2026-10-18

## Checkpoint

**Status:** partial implementation; neutral preprocessing resource factory and protocol tests are implemented; no rendered-frame acceptance. Source pin
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

`createNeutralRendererResources(device, {width, height, inputRgba})` now creates
and uploads a source-shaped input, one-layer zero mask atlas, 2×2×2 identity
LUT, black 1×1 flare, four blur inputs and two neutral guided-filter textures.
Input RGBA float32 pixels are caller-provided and copied to blur inputs; no
CPU blur/filter algorithm is substituted. The guided-filter fixture stores
`a=1,b=0` pairs and the LUT is exact identity corners. It returns created
textures for caller lifecycle management. This is a protocol fixture, not proof
the GPU accepted/executed descriptors or rendered a frame.

**Checks:** native Rust tests 25/25, of which the new adjustment size/bytes
tests are 2/2; focused Node protocol tests 8/8 (including exact descriptors
and upload payloads); wasm32 `cargo check --locked` (prior host checkpoint)
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

**Material limitations:** source-defined neutral/exposure adjustments and a
neutral resource fixture are packable, but original UI settings/baseline
conversion and original preprocessing algorithms are not implemented. Local Chromium has no
`navigator.gpu`; the doubles prove protocol and byte forwarding only. This is
not real shader execution, a functioning renderer/editor, nor a release/demo
update. Full effects/masks, original React UI, export/provider parity and
browser permissions remain open.

## Next ready task

Run the full shader in a real WebGPU-capable browser and compare its bounded
neutral/exposure output against an independent pinned native
`process_and_get_dynamic_image_with_precision` reference. Required capability
currently missing: a browser/device exposing `navigator.gpu` (both headless and
isolated headed Chromium on this host lack it). Keep the full-shader execution
and native frame comparison explicitly open until that capability is
available. Preserve all user data, worktrees and the untracked local
`experiments/rapidraw-wasm-core/target/` directory.
