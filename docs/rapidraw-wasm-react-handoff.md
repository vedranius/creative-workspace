# RWASM-03 — actual original React open/exposure transport

Completed2026-10-18 on `codex/rapidraw-wasm-port`, after `1ff5d9d`. Original CyberTimon/RapidRAW pin `b39884b38d8f148caef6fd0d52afd264951be329`, AGPL-3.0-only, remains unchanged. This is an unfinished experimental port checkpoint, without a product version/tag/release/install/demo change.

## Source and behavior

`build-rapidraw-react-proof.mjs` verifies the exact native commit and12 source hashes in UPSTREAM.json, stages original source/package lock, installs with npm ci --ignore-scripts, and builds the QA composition. Original hooks, stores, Editor/ImageCanvas, Basic/Slider, theme and CSS are reused; original source files are not edited. Only core invoke and native Clerk initialization are aliased. Clerk explicitly refuses; no fabricated login, Tauri internals, token or network service. This is not the complete original App, library, menus or dialogs.

`react-transport.js` registers only actual browser-selected File objects under opaque session IDs; filesystem paths, empty/over128MiB files and other documents refuse. load_metadata explicitly has no imported adjustments; load_image invokes actual as-shot and original Speed development in separate module workers, then the existing guarded f16 upload/resource factory. WB comes from RAW, EXIF is an explicitly empty unimplemented field. The returned512×384 dimensions describe actual Speed output. They are NOT original full-resolution dimensions; original native load_image/Quality parity remains open.

The unchanged original processing hook publishes the exact JPEG ArrayBuffer from full-global parser→actual camera WB/exposure→original EightBit shader→original q94 encoder. Basic values are supported; other fields must remain original defaults. ROI, waveform, resize and unknown commands refuse. Requested analytics are explicitly unavailable in the trace, without invented analytics data. Other resource-dependent effects/preprocessing remain neutral and unaccepted. Original autosave attempts surface their real unavailable-command error/toast; export also refuses. No save success/write ACK or provider availability is claimed.

Commands serialize; selecting another file aborts/terminates an active worker and invalidates stale generations. Workers have30s deadlines and terminate on response/error/abort; GPU textures are destroyed after submitted work completes. These are scoped lifecycle safeguards, not full editor cache/concurrency acceptance, universal decoder timing, hard GPU/JPEG deadlines or total allocation protection. Existing RAW sensor and combined64MiB upload estimates remain limits, not total memory guarantees.

## Actual native/browser evidence

[Browser report](evidence/rapidraw-wasm/react-browser.json) · [native reference](evidence/rapidraw-wasm/react-native.json) · [source pins](evidence/rapidraw-wasm/react-source.json) · [original UI screenshot](evidence/rapidraw-wasm/react-browser.png).

Only public CC0 raw.pixls.us1327 Canon DNG, SHA `f0d2fe47507fadf50008bddbc6bd2c5e39fddbe90cca6bca72dd360fa0e0eb38`. No private photograph/EXIF/path is included. Existing actual native Speed RGB buffer was reused for independent source full-global settings, native wgpu render and original preview encoder. Browser File input invokes actual original hooks; Exposure uses the actual Slider numeric editor with Enter, then waits for the original hook's new published URL and verifies the published bytes.

| Exposure | JPEG bytes | Native comparison |
|---|---:|---|
|0|62,906|Complete adjustment, pixel and JPEG hashes exact|
|+0.8|86,906|Exact|
|−0.8|38,600|Exact|
|+1.6|98,241|Exact|
|0 restored|62,906|Exact, original image hash restored|

Five512×384 frames:3,932,160/3,932,160 RGBA8 components and349,559 JPEG bytes match native, zero tolerance. Local Chromium151.0.7922.34 uses sandbox=true and explicit SwiftShader; original SVG image is visible and JPEG decode has actual512×384 dimensions. GPU/page/network errors and external requests are empty. Four expected original autosave errors are captured, including a visible error toast; save/export commands have code unavailable-command. QA context, browser/server and owned resources close.

Core45/45 tests and doctests pass with clean exit0; host19/19 includes registry/path/closed/save refusals and in-flight worker termination when a new File is selected. npm run check passes. JS syntax, focused rustfmt (preserving pinned reference formatting), source hashes and diff checks pass. Initial full-test session reported143 despite completed assertions; one captured cache-reusing repeat confirmed returncode0. Final actual React/native proof passed after restoring original theme variables.

## Reproduction and CI

Use mandatory low-impact build lock/helper (max2CPU,nice10,jobs1), existing Rust1.99, matching wasm-bindgen0.2.129 and existing Speed-capable WASM. Native reference output uses create_new; choose an empty output directory.

```sh
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example develop_reference -- PUBLIC_DNG --react-render NATIVE_SOURCE/src/utils/defaultAdjustments.json
# Feed those settings and actual native Speed RGB into the existing independent
# native renderer with --eight-bit --camera-settings and --png-dir.
cargo run --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example react_preview_reference -- NATIVE_RENDER_JSON NATIVE_PNG_DIR NEW_NATIVE_PREVIEW_DIR
node scripts/build-rapidraw-react-proof.mjs NATIVE_SOURCE NEW_REACT_STAGE WASM_DIR
node scripts/smoke-rapidraw-react.mjs BUILT_REACT_STAGE PUBLIC_DNG OUTPUT_JSON NEW_NATIVE_PREVIEW_DIR/reference.json
```

Actions now fetches only the pinned original native source, disables Git hooks, checks all hashes, and reproduces native references plus actual React proof/screenshot. Source/native/browser artifacts carry scope and licensing. Existing previous preview run39127057131 failed launching smoke-rapidraw-preview: it hard-coded sandbox=true while the existing workflow already configured CHROMIUM_SANDBOX=false for its runner. The preview script now honors that existing variable, as the other browser scripts do, and records the actual sandbox value; local default remains true. No host security/approval profile or workflow sandbox setting changed. Fresh Actions validation remains pending normal publication; do not cancel/rerun other runs or report CI success prematurely.

## Precise next step

Trace and port the original full-resolution load_image and compute_transformed_preview resize boundary. Preserve actual developed/original dimensions, source resize/filter/orientation behavior and existing resource limits; produce a bounded preview before GPU texture allocation. Prove Quality public-DNG open plus original React exposure edits against native, reusing the prepared timer-compatible WASM stage. Keep unsupported effects/ROI/analytics and saves explicit; do not raise budgets implicitly.

Full original UI/library/menu/dialog acceptance, full-resolution Quality load, resize/ROI/noise-coordinate parity, effect preprocessing/masks/geometry, analytics/WGPU_RENDER mode, EXIF/XMP, export flow and common server/laptop/hybrid/copy-first destination/retention/write-ACK/uncertain recovery remain open. The existing verified PNG/JPEG primitives are not full UI export acceptance. Public demo and all live services stay untouched. Continue in this MAIN chat with no new writer; A waitingOnApproval remains untouched.
