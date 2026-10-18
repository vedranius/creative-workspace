# Latest RAW renderer checkpoint — 2026-10-18

Actual public CC0 Canon Speed-developed pixels now pass original f16 upload/exposure/full shader comparison:2,359,296/2,359,296 components exact across three512×384 frames. Remaining preprocessing/effects are neutral, metadata inputs explicit, and full engine/UI/export/provider acceptance remains open. [Current source/proof/next step](rapidraw-wasm-raw-render-handoff.md). Prior da37854 Actions parity39108228207 passed and its native/browser324-component report was downloaded/verified.

# Independent original-shader native comparison — 2026-10-18

## Corrected behavior and proof

An independent compute-only native reference now compiles exact pinned original RapidRAW adjustment structs,14-binding layout and high-precision pipeline creation. The full original WGSL remains byte-identical to b39884b. Excerpts, their whole source-file hashes and expression-block wrappers are recorded in [UPSTREAM.json](../experiments/rapidraw-native-render-reference/UPSTREAM.json); AGPL attribution/license remain explicit. The reference does not import the JS renderer or extracted WASM packer.

The first comparison failed by82 f16 representable steps at one sampled component. Inspection found the native high-precision pipeline sets `HIGH_PRECISION_OUTPUT=1`, while the browser had only substituted RGBA16F storage and retained the shader's default8-bit dither. The browser now sets the exact original specialization; a protocol regression assertion checks it. The native reference includes the exact source pipeline-creation excerpt with that specialization. **The original shader and predeclared tolerance were not changed to conceal the divergence.**

The three9×3 -1/0/+1-stop fixtures use binary-fraction RGB values, empty masks, identity LUT and neutral preprocessing/effects. Native input is RGBA16F; browser fixture input is RGBA32F, with exactly equal f32 sample values for these fractions. Comparison checks source hash, dimensions, input hash and every45,232-byte adjustment payload before comparing all324 f16 components. The bound was one f16 representable step for RGB, exact alpha.

- Native wgpu29/Vulkan **SwiftShader** versus actual sandboxed Chromium151/SwiftShader: **324/324 components exact**, maximum difference0. [Browser comparison](evidence/rapidraw-wasm/webgpu-execution.json) · [complete independent native words](evidence/rapidraw-wasm/native-shader-swiftshader.json).
- Native wgpu29/Vulkan **NVIDIA GTX1660Ti** versus the same browser fixture:215/324 exact, maximum difference1 f16 step, alpha exact. [Browser comparison](evidence/rapidraw-wasm/webgpu-native-comparison.json) · [complete native words](evidence/rapidraw-wasm/native-shader-nvidia.json).

All frames are finite/nonzero with alpha1; input/all adjustment bytes match; no browser/GPU/network errors. Adapter identity is recorded, without any hardware performance claim. Native source/ABI test1/1, focused host10/10, `npm run check`, Rust format, JS syntax and diff checks pass. One low-impact build reused the existing owned native build cache; no desktop app, private photograph, protected service or public demo was opened/changed.

## Reproduction and hosted verification

Use the [reference README](../experiments/rapidraw-native-render-reference/README.md), existing Rust1.99/native cache, the shared low-impact build lock, and the existing optimized WASM artifact. The optional third argument makes the browser smoke compare actual native words:

```sh
node scripts/smoke-rapidraw-webgpu.mjs "$WASM_DIR" "$BROWSER_REPORT" "$NATIVE_REFERENCE_JSON"
```

The native reference has fixed bounded inputs and does not accept photographs or arbitrary dimensions. The Actions runner builds/tests it sequentially, uses the pinned test Chromium's bundled Vulkan loader/SwiftShader ICD only in the native child environment, asserts a software adapter, compares browser output and uploads both reports, source excerpts, pin metadata and upstream license. It never changes host driver configuration. Missing capability or divergence fails, never skips as success.

Prior6c79066 [parity39107485071](https://github.com/vedranius/creative-workspace/actions/runs/39107485071) and Checks39107485075 succeeded; its downloaded Chromium140 report has three actual SwiftShader frames and no errors. That run predates this correction/native comparison. Fresh hosted verification remains pending source push; local proof is not described as an Actions result.

## Remaining acceptance and next ready task

This establishes **neutral synthetic shader-fixture parity**, not original Tauri/AppState/cache/preprocessing or complete native `process_and_get_dynamic_image_with_precision` frame parity. Arbitrary f32→f16 input quantization, real RAW-derived frame flow, effects/masks/LUT preprocessing, original React UI, export/providers and full editor acceptance remain open. Native/browser CPU development and codec proofs remain separate. No product SemVer/tag/release/demo change for this unfinished port checkpoint.

Next bounded step: feed the already proven public CC0 Canon Speed-developed RGB pixels into the original renderer boundary, preserving the native f32→f16 upload semantics and explicit frame budgets. Map exposure/baseline inputs, compare a real RAW-derived neutral/exposure frame with the independent native reference, and keep omitted preprocessing controls explicit. Do not raise the private RAF development budget or repeat sensor proofs as new progress. Reuse existing artifacts/cache and one low-impact build; no desktop restart or CPU renderer substitution.

Continue on `codex/rapidraw-wasm-port` in MAIN with its existing permissions. A's owner is waiting for approval; leave its checkout alone. No new feature chat/writer or approval bypass while permission inheritance is unresolved.
