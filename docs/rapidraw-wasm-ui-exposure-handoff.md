# Latest comparison checkpoint — 2026-10-18

Independent native shader-fixture comparison exposed and corrected the missing browser `HIGH_PRECISION_OUTPUT=1` option. Software native/browser now match324/324 components; native NVIDIA differs by at most one f16 step, with exact input/adjustment bytes. This supersedes the open synthetic native-shader comparison below; real RAW/preprocessing/full engine/UI/editor acceptance remains open. [Current source, evidence and next task](rapidraw-wasm-webgpu-native-handoff.md). Prior6c79066 Actions succeeded and its Chromium140 execution artifact was inspected, before this correction/comparison.

# Latest renderer checkpoint — 2026-10-18

The complete original WGSL now executes on actual browser WebGPU/SwiftShader with three finite synthetic exposure frames and zero GPU/page/network errors. This supersedes the missing-default-launch capability observation below. Native rendered-frame comparison remains open; [current proof and next task](rapidraw-wasm-webgpu-execution-handoff.md). Prior c7433c3 Actions Checks39106964937/parity39106964966 succeeded; its downloaded exposure evidence verifies216 native/browser matches and11 invalid refusals.

# Original RapidRAW UI exposure mapping — 2026-10-18

The failed successor ended after a patch context mismatch and malformed JavaScript tool invocations, before changing files. MAIN verified its idle state, claimed the isolated port checkout and implemented the missing bounded input mapping directly. No denied approval was rerouted or security profile modified. Automatic continuation now uses the existing MAIN chat heartbeat, without opening new development chats while their permission profiles differ.

## Actual behavior

`src/ui_exposure.rs` copies the pinned `image_processing.rs` visibility, scales, `get_val` and effective-baseline helpers. It preserves the original **top-level** `exposure` number, cast to f32 before division by0.8, plus enabled baseline compensation. `activeTools.basic` takes precedence over legacy `sectionVisibility.basic`. Missing/non-numeric exposure defaults as native does. Baseline applies to a null adjustment state or a boolean `baselineExposure:true` marker; the existing original RawExposure/BaselineOptions formula remains unchanged. Hidden basic controls suppress the UI contribution, not the separately enabled baseline term.

The input boundary accepts a null/object JSON string at most64KiB and explicit finite camera exposure/settings. Malformed root types, invalid JSON, nonfinite metadata or mapped overflow are rejected. It does not read camera metadata or invent settings defaults.

`pack_ui_exposure_fixture` returns the original45,232-byte AllAdjustments layout with this mapped exposure at the original offset; all other fields deliberately remain the existing neutral fixture. The JS host `packUiExposureFixture` bounds input before crossing into WASM and forwards the original JSON/camera/settings without duplicating the calculation. This is an exposure-input slice, **not** the complete original UI/adjustment parser, a rendered frame or accepted editor.

## Evidence

An independent reference compiles exact source excerpts plus the byte-identical original baseline module. Eighteen adjustment inputs ×3 camera exposure states ×4 settings combinations give216 cases. Native tests and an optimized actual Chromium module worker match every exposure f32 bit; all remaining fixture bytes stay unchanged. Browser rejects11 malformed/overflow cases and reports no page errors or failed requests. [Browser report](evidence/rapidraw-wasm/ui-exposure-browser.json).

All28 native tests, ten focused WebGPU host protocol tests, Node84/84, repo check, JS syntax/rustfmt and diff checks pass. GPU protocol tests use doubles; the exposure browser test executes real WASM without requiring WebGPU. No photo, private RAF, live service, original or demo deployment was touched.

The Actions parity runner now generates the independent216-case native matrix, runs this browser test against the prepared WASM and uploads the matrix, source excerpts and report. Fresh hosted verification is pending source push/Actions completion; local proof is not reported as hosted evidence.

## Reproduction

Use the existing Rust1.99/cache, wasm-bindgen0.2.129 and low-impact shared lock. Run the normal native suite, generate `cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example ui_exposure_reference`, build the same crate for wasm32 and generate web glue. Then:

```sh
node scripts/smoke-rapidraw-ui-exposure.mjs "$WASM_DIR" "$NATIVE_REFERENCE_JSON" "$OUTPUT_REPORT"
```

Set the existing `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH`. `scripts/ci-rapidraw-pixel-parity.mjs` also reproduces the mapping alongside the existing decoder/PNG evidence.

## Next ready work

Keep full shader/native-frame parity open. Investigate an isolated WebGPU-capable QA browser configuration using existing binaries (including an explicitly identified software Vulkan adapter if available), without restarting protected user tabs/services or claiming hardware performance. Run the complete original shader and compare a bounded rendered frame to the pinned native renderer. Missing navigator.gpu under previous default headless/headed launches is the observed environment limit, not proof that every browser configuration is incapable. Preserve original WGSL, source-defined uniforms and effect order; never replace the renderer with CPU analysis helpers. Remaining UI controls, camera/as-shot extraction, preprocessing, masks/LUT/effects and full editor/public-demo acceptance remain open.

Product version/public availability stay unchanged for this unfinished experimental checkpoint. Do not create a new feature chat until its effective permissions can be verified; continue through the existing MAIN heartbeat and one writer. Preserve untracked target/, private originals and all live services.
