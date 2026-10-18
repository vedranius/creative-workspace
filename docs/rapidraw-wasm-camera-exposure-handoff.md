# Original camera exposure extraction checkpoint — 2026-10-18

Branch `codex/rapidraw-wasm-port`; experimental, no public editor release.

The original PNG path previously proved edited frame/codec bytes with explicit camera fixture inputs. This checkpoint reads actual RAW exposure metadata, then feeds those values into the already-pinned original UI exposure mapping. It does not relabel prior frame reports as automatic metadata-driven rendering.

## Source and implementation

- CyberTimon/RapidRAW `b39884b38d8f148caef6fd0d52afd264951be329`, AGPL-3.0-only. `camera_exposure.rs` contains byte-identical `baseline_exposure.rs::read` and every following helper; the original full reference already exists in `tests/reference/baseline_exposure.rs`. Full source and reader hashes are in `UPSTREAM.json` and tested.
- Original `read_as_shot` uses `raw_image(..., true)` to inspect metadata and checks `cpp==1 && !Cfa` for monochrome. The exposure portion now runs behind the existing128MiB input/32,768axis/64MiB estimated-sensor guard; dummy dimensions/components must match preflight, and returned exposure fields must be finite. The sensor estimate does **not** bound all parser/intermediate memory, and wasm `catch_unwind` is not a general panic-recovery guarantee.
- `worker.js` adds explicit `output:'exposure'`; its response contains only the original scene-referred flag, DNG baseline sum, and highlight preservation. Existing pixel/codec behavior is retained.
- The independent native harness executes full unchanged original `raw_processing::read_as_shot` and unchanged baseline reader. Its existing WB result stub is ignored; it does **not** serve as a WB reference. Original UI exposure reference excerpts supply12 baseline/visibility mappings per input, compared bit-for-bit through the actual host/WASM packer.

## Actual browser evidence

[Report](evidence/rapidraw-wasm/camera-exposure-browser.json): sandboxed Chromium151.0.7922.34, actual dedicated module workers; no page/network errors. Three exact native/browser camera results and36/36 exact mapped exposure f32 outputs:

| Input | Original DNG exposure sum | Nature |
|---|---:|---|
| Public raw.pixls.us1327 CC0 Canon DNG |−0.5EV| Unmodified public original |
| Derived positive baseline |+0.5EV| Test tags3/4 + (−1/4) |
| Derived negative baseline |−1.25EV| Test tags−3/2 +1/4 |

Each derivative is created only in temporary scratch: append a sorted rootIFD with explicit signed-rational BaselineExposure/Offset tags, repoint the TIFF header, retain original pixel/data offsets. The pinned public source file is never modified. Input/derivative hashes and mutation pairs are in the report; derivatives are not additional camera compatibility evidence. Empty input,64-byte truncation, actual oversized raw SubIFD width and infinite baseline are all refused. The oversized test walks SubIFDs as well as thumbnail/root dimensions, so it exercises the actual sensor guard.

Final native tests34/34, host14/14, `npm run check`, JS syntax, Rust formatting and `git diff --check` pass. Earlier PNG run39110720494 was pending at entry; check its exact run/artifact separately. Fresh camera CI pending publication; no hosted camera success is assumed.

Reproduce with the cached pinned toolchain/native example and built WASM:

```sh
cargo test --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml
cargo build --release --locked --manifest-path experiments/rapidraw-wasm-core/Cargo.toml --example develop_reference
# Build/bind the WASM as in the existing port instructions, then:
node scripts/smoke-rapidraw-camera-exposure.mjs WASM_DIR PUBLIC_CC0_DNG NATIVE_DEVELOP_REFERENCE OUTPUT_JSON
```

The new script hash-gates the public fixture before creating variants; it uses one browser context and closes workers/browser/server/temp files. Actions runs this after its existing native/Quality/Speed builds, with original camera reader source/license provenance in its artifact.

## Remaining work and exact next step

`raw_processing::as_shot_white_balance` neutralizes in-camera Canon multi-exposure coefficients, converts coefficients to camera neutral, selects dual IlluminantA/D65 matrices or a fallback matrix, and calls original `WhiteBalance::from_*camera_neutral`. The original implementation depends on `glam`, Robertson isotherms/Bradford conversion and source `PRIMARIES_SRGB`, `WP_D65`, `primaries_to_xyz_matrix`; use those exact pinned algorithms/constants. Existing development already uses original rawler WB coefficients, which is distinct from UI temperature/tint and chromatic adaptation.

Next bounded task: port that original as-shot WB extraction with independent native source reference and actual public-DNG browser comparison, then feed both actual WB/exposure into original renderer settings. Do not reuse the native harness's current dummy WB stub as validation. Keep non-WB controls/preprocessing, full React integration, EXIF/XMP/transforms/watermarks/export options, real laptop folder permission/write ACK/recovery and complete editor acceptance open. Other camera formats' highlight branches are source-preserved but not newly verified here.

No private RAF/photo/EXIF/personal path, original/live service, demo, root/auth/provider semantics, product version/tag/release or OS availability claim changed. Continue MAIN only under the temporary permission policy; A's owner remains awaiting approval.
