# Full image Basic export worker — 2026-10-19

A dedicated browser worker now runs the pinned original RAW **Quality** development, full image quarter-turn/flip, original Basic adjustment packing and EightBit shader, then the original Lanczos3/JPEG/ICC/DPI codec. It does not resize to the preview before GPU processing. Native `process_image_for_export_pipeline` forces `show_clipping=0`; this worker does too. Render options remain the existing baselineExposure0/compensateHighlightPreservation=true contract.

This accepts a bounded **Basic/quarter-turn** slice, not all native transformations. Fine rotation, crop, warp, preprocessing effects, masks, custom LUTs, metadata copy, original ExportPanel `export_images` integration, providers and destination write acceptance remain open. The worker returns in-memory JPEG bytes and never reports file-save success. Original React components/handlers, public demo and server suite remain untouched. No product release/version or public editor availability claim.

## Actual native/browser proof

- [Native reference and source hashes](evidence/rapidraw-wasm/full-export-native.json): existing pinned CC0 Canon DNG Quality RGB2048×1536, unchanged independent native orientation/flip helper, full original native EightBit shader and JPEG export branch. Identity reference reuses the prior verified full native cache; a new180°+horizontal-flip reference is actually rendered at full size before1024×768 Lanczos3 export resize.
- [Sandboxed Chromium](evidence/rapidraw-wasm/full-export-browser.json): each job starts from the hash-pinned **RAW file**, develops in WASM and matches the native full RGB, RGBA16F upload, complete AllAdjustments, all **25,165,824 RGBA8 components** and **755,670 JPEG bytes** exactly. Full output is2048×1536; the transformed job renders2048×1536 before producing1024×768 JPEG. JPEGs decode successfully. No page errors, failed requests, external requests or successful-job GPU errors.
- Real cancellation occurs after `gpu-submitted`. The worker explicitly destroys its owned textures/device and acknowledges this API operation without waiting for readback; the client then terminates it and returns aborted with **no bytes**. No forced termination was needed. This corrects an observed readback wait that originally exhausted the grace period.
- A real1ms timeout terminates a job before device creation. An overlapping job refuses as busy. Subsequent complete RAW jobs reproduce both native outputs. Host tests also exercise an unresponsive worker: the2s grace force-terminates it without publishing output; late success cannot settle an already cancelled job twice.
- Seven requests refuse before GPU allocation: modified public-DNG sensor width exceeding the dedicated budget, truncated RAW, invalid JPEG quality, metadata-copy setting, unsupported crop, nonfinite Basic value and oversize output. They are export-boundary checks, not repeated claims of new RAW decoder acceptance.

Core69/doctests, host25, `npm run check`, focused JS/Rust syntax/format/JSON/diff checks and the actual browser proof pass. The Actions host-test step now includes the new export client tests; the full native/browser proof remains a separately reproducible local gate. All own QA contexts/workers/devices/server/builds close. Private photographs were unnecessary.

## Resource and lifecycle contract

The existing64MiB **preview** texture limit stays fixed; it still rejects a full2048×1536 request in the real browser. There is no arbitrary budget override. A distinct export entry point accepts at most4096 per axis,3,145,728 render pixels and256MiB estimated GPU payload including source textures, output, padded readback and AllAdjustments. This fixture estimates264,286,516 bytes. The export sensor preflight admits at most4,194,304 samples/4096 per axis **before decode**. Larger images require a different export strategy; general decoder/preview acceptance is unchanged.

Input remains1byte–128MiB; native RGB/upload/readback and codec source/target/intermediate/output bounds remain64MiB each. Codec settings/targets are checked before pixel rendering. These estimates and per-buffer caps are **not** aggregate CPU/GPU peak-memory or allocator protection. Device destruction acknowledgement does not measure immediate physical GPU-memory reclamation or hardware queue completion.

Only one export is active per client module. IDs bind progress/terminal messages to their owner. Abort/timeout suppress any later result; cancellation waits at most2s for destruction acknowledgement before force termination. Job timeout is bounded1–120,000ms. Completed or failed jobs destroy their own WebGPU device and end their worker; no document worker or existing preview state is changed. There are no paths, file writes, replay or overwrites in this API.

## Reproduce and continue

Reuse Rust1.99, matching wasm-bindgen, prepared timer-only decoder stage and target cache through the low-impact wrapper/shared lock. Build the new core and `export_geometry_reference`/`jpeg_export_reference` examples. Use the existing public Quality RGB and one-frame original camera settings to prepare full identity and180°+flip native render/codec references, as recorded in the JSON. The browser script serves only explicit pinned local assets:

```text
RAPIDRAW_NATIVE_SOURCE=PINNED_NATIVE_CHECKOUT node scripts/smoke-rapidraw-full-export.mjs WASM_DIR PUBLIC_CC0_DNG NATIVE_REFERENCE_JSON OUTPUT_JSON
```

Use one sandboxed QA context, a short disk-backed TMPDIR and the existing low-impact CPU limits. No probe is public.

Alternate next to A in MAIN: inspect exact b18d550 Checks39260718822/Build39260718607 once; when successful verify immutable alpha62 tag/draft and fresh Actions assets/checksums. Then prove original Text Tool/caret/typing on the selected second page. Do not repeat the resolved ACK-observer race or alpha61 assets.

Next B: connect the original ExportPanel's **single-file** JPEG settings and `export_images` command to this explicitly restricted worker, preserving source cancellation/progress/error semantics and rejecting unsupported settings before work. Prepare real destination close/write ACK and uncertain-output recovery before showing save success; synthetic OPFS/picker QA is not real OS folder permission acceptance. Keep larger-image/fine/crop/effect/provider limitations explicit, use the existing checkout and continue MAIN only.
