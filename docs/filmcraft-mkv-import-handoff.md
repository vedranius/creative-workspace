# FIL-MKV-01 — original FilmCraft pending import fix

2026-10-11. Implemented and isolated browser regression verified; Creative Workspace **0.2.0-alpha.9** candidate. Feature commit `1348d4b62aba016e498b654bd5745975f549768b` is pushed. The isolated development candidate is verified at [studio 8794](http://127.0.0.1:8794/) / [original FilmCraft](http://127.0.0.1:8794/original/filmcraft/?webgl). [Publication status](filmcraft-mkv-release-state.md) tracks Actions separately; release downloads are not yet claimed.

## Changed behavior

The reported `media data is still loading` is a deferred Blob read, not evidence of unsupported/corrupt MKV. It was reproduced with a valid 222,449,488-byte sparse Matroska fixture whose indexed cluster is outside prewarmed head/tail ranges. The original shared UI Media Browser returned the user's error while the normal asynchronous picker importer later succeeded.

Single registered MKV/WebM **Import** and **Open in Source** actions now wait/retry through the original browser host. Paths, image-sequence mode, target bin and project epoch are captured before yielding. Repeated actions are deduplicated; an existing imported path is reused, including a nested-bin item opened in Source. Replacing the project or deleting the target bin cancels; it cannot silently import into a different project/root. At most four actions wait concurrently. Retry count and a 120-second deadline bound deferred commands; real read/partial import failures remain visible. Pending metadata is not permanently cached as unsupported.

Original menus, tools, command IDs, shared engine and canvas remain in use. The returned `{pending:true}` means queued only. Actual completion/failure is visible in the project and `filmcraft.info().mediaImport`. No save acknowledgement is introduced. Folder/batch/image-sequence imports and other formats keep upstream behavior; media drag/placement beyond these actions is not part of this acceptance.

## Source and immutable installation

- Upstream: [storytold/filmcraft](https://github.com/storytold/filmcraft), original source **4e2d0bc2d3646f9cf27ef7aa8b2095c6858c7efe**, app 0.6.0.
- Reviewed source patch: [mkv-pending.patch](../engines/original-ui/filmcraft/mkv-pending.patch), ID `mkv-pending-v1`, SHA256 `d13b72e23a3ae9b13c278144fe12f507d8fe07e2d2f41fa8cc98e7c3d77c897d`.
- Variant directory: `filmcraft/4e2d0bc2d3646f9cf27ef7aa8b2095c6858c7efe-d13b72e23a3a`. The registrar requires the exact known Git diff; the loader checks pin, patch identity, provenance, all asset hashes and existing confinement/budgets. Unknown patches are rejected.
- `npm run ui:filmcraft:build -- <pinned-source> <static-output> <package-root>` applies only the reviewed patch and builds with Rust 1.99.0/wasm32 + wasm-bindgen 0.2.129. A separate immutable root protects installed packages and unsaved live pages. Licenses/notices and patch provenance accompany assets.
- Actions builds the separate FilmCraft WASM preview archive and checksum, performs this browser regression, then joins three target-native prototype bundles in a **draft** release. Locally built bytes are development evidence, not downloadable Actions release assets.

## Evidence

[Browser report](evidence/filmcraft-mkv/report.json), [unchanged original UI with imported MKV](evidence/filmcraft-mkv/original-filmcraft-mkv.png). Chrome 151.0.7922.34 / Playwright 1.64.0, isolated authenticated-origin gateway and generated H.264/AAC fixtures; no user file/page was modified. Eight cases: deferred middle + repeated action + metadata recovery; frozen path/bin/selection; nested-bin Source reuse; project replacement; removed target bin; accelerated-clock deadline; real read failure; normal import/Source reuse. No uncaught browser exceptions. Gateway/source registry tests: 42 passed; syntax, release metadata and diff checks passed.

This fixture exercises the original UI command boundary in a real browser with test-provided Files. It does **not** prove interactive directory-picker permissions, broad codecs, real long-film performance, acknowledged disk saving, native OS/browser parity or server processing. Sparse filler avoids allocating a whole movie. Original FilmCraft processing remains browser-local WASM.

## Handoff

Preserve studio 8793, legacy 8792 and the user's independent RapidRAW 8780. New alpha.9 must run on a separate package/state root and free port; do not restart an unsaved document. Main checkout's DesignCraft PAR-03 work and unrelated untracked `engines/filmcraft/` remain separate. Final publication evidence must include CI results, tag, release draft and eight archive/checksum assets before download claims.

After this fix, resume the concrete DesignCraft **PAR-03** original UI/server Session/read-model/render bridge. Read its preserved sample smoke/handoff; do not expand a replacement frontend or repeat source audits as implementation. The original server/provider/full parity milestone remains incomplete.
