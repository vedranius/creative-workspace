# RapidRAW browser engine port

## Scope authorized on 2026-10-17

Port **native RapidRAW**, preserving its real React interface and image-processing algorithms, to WebAssembly/browser APIs. This is an additional browser-processing mode for independent public-demo visitors; the original Creative Workspace server-processing goal and owned rapidraw-web installation remain separate. No VNC, desktop streaming, substitute editor, or embedded-JPEG preview presented as RAW development.

Native installers for other operating systems establish useful behavior references, but are not WebAssembly binaries. Source-level separation and browser execution evidence are required.

## Verified sources

- Native RapidRAW by Timon Käch/CyberTimon: [`b39884b38d8f148caef6fd0d52afd264951be329`](https://github.com/CyberTimon/RapidRAW/tree/b39884b38d8f148caef6fd0d52afd264951be329), AGPL-3.0. Its frontend is React/Vite; native processing lives in `src-tauri/src/`.
- The same native lockfile pins RAW decoder `rawler` to RapidRAW-DngLab [`a32bc1ff1f4f3c56d4d3226082f6eb17414f9159`](https://github.com/CyberTimon/RapidRAW-DngLab/tree/a32bc1ff1f4f3c56d4d3226082f6eb17414f9159). That package declares LGPL-2.1; preserve upstream license/source obligations separately from Workspace/RapidRAW licensing.
- LightCraft architecture reference: [`9e6c4c6fc9c7a7f192ce846c00ceb531e0f64dda`](https://github.com/storytold/lightcraft/tree/9e6c4c6fc9c7a7f192ce846c00ceb531e0f64dda). Its browser entry shares the original engine/UI, uses dedicated module workers with transferable buffers, and provides browser storage through OPFS/IndexedDB. This is an architectural reference, not a replacement for RapidRAW's algorithms.

## First concrete result: compiler seam only

`experiments/rapidraw-wasm-core/` directly depends on the exact RapidRAW `rawler` revision and exports a wasm-bindgen entry calling the actual decoder on in-memory bytes. Its purpose is to find compiler/host boundaries without pulling in Tauri, GTK or the native ONNX runtime. It is **not** the extracted full development pipeline, an accepted RAW browser demo, a supported-format claim, or an editor.

First `cargo check --target wasm32-unknown-unknown` with Rust 1.99.0 passed. The dependency graph, including rawler, memmap2, rayon and JPEG XL, type-checks for this target. **This does not prove their runtime paths work:** browser thread creation, memory maps, random sources and format-specific code still need actual execution tests. The `uuid/js` feature supplies browser-compatible UUID randomness. The experimental lockfile records the exact resolved transitive graph; native/browser pixel comparison will also need aligned dependencies.

The probe currently bounds input bytes only. It is not exposed publicly: decoded-dimension limits, worker termination, time/memory limits and untrusted-input corpus tests are required before a browser entry accepts arbitrary user files. No user document was read during this compiler check.

```sh
cargo check --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --target wasm32-unknown-unknown
```

### RWASM-01 partial runtime evidence

The pinned probe also builds as an optimized WASM module (6,407,677 bytes before transport compression) and its matching wasm-bindgen 0.2.129 web glue runs in a dedicated Chromium module worker. Eight deterministic non-RAW bytes initialize the real module, reach rawler, and produce `No decoder found`, with zero page errors. The worker source is `experiments/rapidraw-wasm-core/decoder-worker.js`; [runtime evidence](evidence/rapidraw-wasm/runtime-smoke.json) records the exact artifact hash and limits. This is browser runtime evidence, not successful RAW decode evidence. No CC-0 fixture bytes were present locally; until a fixture and provenance/hash are obtained, RWASM-01 remains open. The fixture source's sample policy requires CC-0: [DngLab contribution instructions](https://github.com/CyberTimon/RapidRAW-DngLab/blob/a32bc1ff1f4f3c56d4d3226082f6eb17414f9159/CONTRIBUTE_SAMPLES.md).

## Bounded implementation sequence

1. **RWASM-01 — real decoder runtime.** Build the probe to WASM with the matching wasm-bindgen CLI, run it in a dedicated browser worker, and decode licensed real RAW fixtures. Check full sensor dimensions and values against a native execution of the same locked code. Include malformed files, unsupported formats and worker cancellation. Successful compilation alone does not pass this gate.
2. **RWASM-02 — original development pipeline.** Extract native RapidRAW's `raw_processing`, white balance, orientation, baseline exposure and multi-exposure dependencies into a shared host-independent crate. Retain upstream equations and source provenance, rather than replacing them with LightCraft processing or an approximate new editor. Prove RAW → developed pixels → original exposure adjustment → PNG/JPEG export in browser against native reference output, with explicit numerical tolerances and bounded allocation. Embedded preview extraction is a separate capability.
3. **RWASM-03 — original React interface.** Inventory Tauri invoke/event/plugin calls; introduce an explicit browser host implementation backed by the worker. Preserve original components, panels, controls, action IDs, history and document semantics. Connect supported operations to the actual shared core, show honest unsupported-operation errors, and keep all parity gaps visible. Do not publish a visual shell as a functioning port.
4. **RWASM-04 — GPU and extended features.** Port the existing wgpu/shader pipeline to browser WebGPU and verify it against native output. CPU fallback and browser GPU support need evidence. Native `ort` dynamic loading requires a browser inference implementation using the same model contract; AI masking/denoise are separate acceptance gates. Apple Core Image RAW, OS color management, tethering and other native services need explicit browser alternatives or documented unsupported status; none is silently declared equivalent.
5. **RWASM-05 — files, persistence and parity.** Laptop chooser/drop, browser storage and download/write acknowledgements must preserve originals and uncertain outputs. Separate save destination and retention. Benchmark representative camera formats, full-resolution processing, memory, responsiveness, history, presets, masks, export and multi-tab independence. The browser-local mode must remain clearly labelled and distinct from the server's common-provider paths.
6. **RWASM-06 — public delivery.** Build/version the accepted static port through Actions, include source/pins/licenses/checksums, verify the actual Cloudflare transport and supported browsers, then add it to the public demo. Every visitor receives an independent local engine; no shared document backend. Keep preview/full-parity claims tied to evidence.

## Development isolation and next step

The port starts on `codex/rapidraw-wasm-port` in an isolated managed worktree. Existing Cloudflare demo assets, user RapidRAW services and main-checkout server development are untouched. This branch currently contains an experimental compiler seam and plan; no product version or availability is advanced. The next task is RWASM-01 actual build/worker/native-reference proof. Broader extraction, original UI, exposure/export and feature parity are not yet implemented.
