# RapidRAW browser renderer host boundary

`webgpu-renderer.js` dispatches the pinned RapidRAW `shader.wgsl` main entry
with all 14 original bindings and accepts the upstream `AllAdjustments` Pod
bytes unchanged. It uses the same `rgba16float` storage-format substitution as
the pinned native high-precision pipeline and maps the output asynchronously,
returning tightly packed RGBA16F rows. The caller must provide textures and
samplers from RapidRAW's existing preprocessing stages; this module does not
replace those stages or calculate adjustment packing itself.

The copied `shader.wgsl` is from `CyberTimon/RapidRAW` commit
`b39884b38d8f148caef6fd0d52afd264951be329`, path
`src-tauri/src/shaders/shader.wgsl`, SHA-256
`9ecb4cc31b8ce4a12f439f69935ed0c8c27f58b52501929e0dc41d22e85ca178`.
It is distributed under the upstream AGPL-3.0 license; see
`tests/reference/RapidRAW-LICENSE`.

`renderer_adjustments.rs` copies the pinned `repr(C)`/Pod field layout and
provides a finite, source-layout neutral/exposure fixture constructor. The
browser host can call `packNeutralExposureAdjustments(wasm, exposure)` and pass
those 45,232 bytes directly to the original binding. This is not RapidRAW's
JSON/UI/baseline adjustment parser; it is only a bounded shader fixture.

The Node tests use a deterministic WebGPU device double to check original
binding order, dispatch dimensions, async readback, limits and unsupported
handling. They are protocol tests and do not prove that a browser GPU executed
the shader. On the development host, both headless and isolated headed
Chromium reported no `navigator.gpu`; native rendered-frame comparison and
the required preprocessing integration remain open.

## Original exposure input slice

`ui_exposure.rs` and `packUiExposureFixture(wasm, json, asShot, options)` implement the original top-level exposure number, activeTools/legacy basic visibility and boolean baseline marker, using explicit camera exposure/settings. The bounded JSON input becomes exposure in an otherwise neutral45,232-byte payload. This does not map other controls or extract metadata. Independent native/actual browser WASM proof covers216 cases and11 invalid-input refusals. [Source, reproduction and remaining acceptance](../../docs/rapidraw-wasm-ui-exposure-handoff.md).
