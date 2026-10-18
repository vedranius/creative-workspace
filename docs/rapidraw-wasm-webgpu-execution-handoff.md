# Original shader browser execution — 2026-10-18

The previous default Chromium capability observations were incomplete. The existing Chromium151 binary, in a fresh isolated sandboxed context on localhost, exposes a working **SwiftShader software WebGPU adapter** with `--enable-unsafe-webgpu --use-angle=swiftshader --use-webgpu-adapter=swiftshader`. No user browser, service, profile, global security setting or private file was changed. For this particular local setup, additionally forcing the Vulkan compositor feature yielded null adapters with a Dawn external-instance warning; removing that compositor override produced the working configuration. These are test-process arguments only, never product defaults or a performance recommendation. [Chrome testing guidance](https://developer.chrome.com/blog/supercharge-web-ai-testing?hl=en) and [Chromium SwiftShader documentation](https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md) explain the isolated testing use case.

## Actual proof

`scripts/smoke-rapidraw-webgpu.mjs` serves only an allowlisted set of local test assets, loads actual WASM and creates the existing neutral resource fixture. It dispatches the **full original pinned WGSL**, with only the same RGBA16F storage-format substitution as the native high-precision renderer. All14 bindings and45,232-byte WASM adjustment payload are used. Binding5's LUT sampler now matches the original `SamplerBindingType::NonFiltering` declaration in `gpu_processing.rs`; binding11 remains filtering. The shader file/hash itself is unchanged.

Three synthetic9×3 frames at -1/0/+1 stops complete async readback. Each has216 tightly packed bytes despite256-byte padded GPU rows, finite half-float components, alpha1 and nonzero RGB. Hashes are distinct and the first red component rises with exposure. Software adapter identity/fallback status are asserted. GPU validation, page errors and failed requests are empty. [Actual report with hashes and launch configuration](evidence/rapidraw-wasm/webgpu-execution.json).

Focused host tests10/10, `npm run check`, script syntax and diff checks pass. There is no Rust change or native rebuild. The Actions parity runner now executes this same real test against its already built WASM and uploads the report plus adapter/frame provenance. Hosted verification of this new step remains pending. The preceding c7433c3 parity run [39106964966](https://github.com/vedranius/creative-workspace/actions/runs/39106964966) and Checks39106964937 succeeded; its downloaded artifact/reference verify216 exact UI exposure cases and11 invalid refusals. Those hosted results predate this GPU test.

## Reproduce

Use the existing optimized `ui-exposure-proof/wasm` artifact (Rust1.99/wasm-bindgen0.2.129), existing Playwright module/Chromium binary, short disk-backed TMPDIR and low-impact wrapper. No build required:

```sh
node scripts/smoke-rapidraw-webgpu.mjs "$WASM_DIR" "$OUTPUT_JSON"
```

Set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` to the installed QA dependencies. Sandbox defaults on locally; the existing GitHub hosted configuration remains explicitly reported in evidence. The test requires a real adapter and frame result; absent capability fails, never skips as success. Browser/context and loopback server close on completion/failure. No private photo is used.

## Remaining acceptance and next ready task

This is real shader execution on neutral resources and synthetic input, **not native-frame parity**, real preprocessing, a RAW-to-render chain, complete effect validation, original React UI/editor, export/provider acceptance or hardware performance evidence. No product version/release/demo claim changes for this unfinished port.

Next: create an independent bounded native reference from the pinned original shader, source layout, resource bindings and native RGBA16F dispatch/readback. Compare these same synthetic neutral/exposure frames, documenting numeric tolerance/adapter differences if necessary. Keep a direct upstream source/provenance check; do not use the browser host as its own reference or substitute a CPU exposure multiply. Reuse the existing native dependency cache/target, one low-impact build lock and no desktop app restart. Then connect real RAW preprocessing and the original UI in subsequent bounded steps. Keep all existing allocation/input/worker gates and protect the private RAF/originals.

Work stays on `codex/rapidraw-wasm-port`. Same MAIN heartbeat continuation only while new-chat permission inheritance differs; no new writer/chat and no approval bypass.
