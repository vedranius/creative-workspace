# RapidRAW WebGPU host boundary — 2026-10-18

## Checkpoint

**Status:** partial implementation; no rendered-frame acceptance. Source pin
`b39884b38d8f148caef6fd0d52afd264951be329`.
Implementation source commit: `ee9fb0adb9746ff5ed5ff6facf45bd0113d5766f`.

`experiments/rapidraw-wasm-core/webgpu-renderer.js` verifies the pinned shader
hash, preserves the full original WGSL and its 14 bindings, accepts upstream
`AllAdjustments` Pod bytes without repacking, submits the full `main` compute
entry point, and asynchronously maps/packs RGBA16F output. It refuses missing
WebGPU/adapters or over-limit dimensions with explicit unsupported errors.
Original source and license attribution are in the experiment README; evidence
is in `docs/evidence/rapidraw-wasm/webgpu-host-boundary.json`.

**Checks:** focused Node protocol tests 5/5 and `npm run check` pass. Public PNG
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

**Material limitations:** original preprocessing resources are caller-supplied
and are not yet produced by the browser path; the current WASM core does not
yet construct original `AllAdjustments`. Thus this is a reusable full-shader
host boundary, not a functioning browser renderer/editor. Full effects/masks,
LUTs, original React UI, export/provider parity and browser permissions remain
open. No product release or demo update.

## Next ready task

Integrate one source-defined neutral/exposure `AllAdjustments` instance and the
minimum original preprocessing resources for a bounded public/synthetic frame;
run the complete shader on a WebGPU-capable browser and compare pixels with an
independent native `process_and_get_dynamic_image_with_precision` reference.
Use explicit unsupported results on browsers without WebGPU. Do not substitute
CPU analysis filters or reduce the original effect order. Preserve all user
data, worktrees and the untracked local `experiments/rapidraw-wasm-core/target/`
directory.
