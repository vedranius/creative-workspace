# rawler PPG wasm32 diagnostic compatibility

Source: [CyberTimon/RapidRAW-DngLab](https://github.com/CyberTimon/RapidRAW-DngLab/tree/a32bc1ff1f4f3c56d4d3226082f6eb17414f9159), exact revision `a32bc1ff1f4f3c56d4d3226082f6eb17414f9159`.

The `rawler` package declares LGPL-2.1; its unmodified license is included as [LICENSE](LICENSE). Original authors retain ownership. This patch is provided under the same license and changes only PPG's profiling import/start/debug log on wasm32. Native profiling and all interpolation operations are preserved. It is an experimental compatibility modification, not an upstream release or a general RAW-format support claim.

Prepare an empty, isolated source tree with `node scripts/prepare-rapidraw-quality.mjs EMPTY_STAGING_DIR`. Source and patch SHA256 identities are recorded in `experiments/rapidraw-wasm-core/UPSTREAM.json`. The preparation tool verifies the pin, exact before/after source hashes and changed-file scope. Shared Cargo cache sources and user installations must never be patched.

For native/browser pixel parity, reproduction and remaining gates see [the handoff](../../../docs/rapidraw-wasm-development-handoff.md).
