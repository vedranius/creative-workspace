# Original DesignCraft Pages panel move — local proof, 2026-10-19

The original Pages panel thumbnail drag sends unchanged `layout.pages.move` with final-index `{from,to}` semantics. Both indexes must belong to the current document; malformed/extra parameters, stale revisions and rejected worker calls do not mutate order or consume a revision. The UI hydrates canonical state and server PNG only after matching ACK.

Local evidence passes: JavaScript 86/86, exact-source Rust UI 1/1, owned native tests 4/4 and isolated sandboxed Chromium. Actual source Text Tool creates “M”; actual Pages thumbnail drag 1→0 holds the mirror at revision 5 until ACK 6, moves page identity/content and changes server pixels. Reverse drag 0→1 ACK 7 restores identities and byte-identical PNG. Zero browser/network errors. The QA screenshot was visually inspected; the context, server and workers closed.

- [Browser JSON](designcraft-par03-pages-move-browser.json) · [inspected screenshot](designcraft-par03-pages-move-browser.png).
- Original source: `a127c6d5c3576972bbd60445f26d893db071eef3`; patch `par-03-pages-insert-v1`, SHA-256 `6a56500b279d5eb9488b8f72602e79f461e30aeadf3c3a84c8cd653f6e86a4bf`.
- Optimized WASM: `eb543dea6defea45b99db5d47a170b84ded364fb12c4d3f1478f7608f0252376`.
- Local owned worker (dev profile, optimized + debuginfo): `35aada596b7a9810d32dad58cdc004b7294f04b3404e64f04a973970ff83185d`. This local binary/archive is not a release asset.
- Before/restored server PNG: `c5d02012671d89a93d2c993498d993f13a3866bc384d295d3857c9c9d730bb91`. Moved blank page PNG: `40402e053fbcda7f6379931420bdbea7192004fd1973c890cafb6cd40efdc273`.
- `npm run check`, `npm test` (86/86), `npm run release:validate`, native formatting, exact source/patch comparison and `git diff --check` pass.
- Exact-source test `original_page_move_waits_for_matching_ack_and_preserves_page_identity` passes; a wrong command-ID ACK retains pending state/revision/order.
- Owned worker tests pass 4/4, including `owned_page_move_preserves_identity_and_recovers_after_bad_index`.
- Reproduce via `scripts/smoke-designcraft-pages-move-browser.mjs`, with `CW_ORIGINAL_UI_DIR`, `CW_DESIGNCRAFT_BINARY`, `CW_PLAYWRIGHT_MODULE` and optional `CW_BROWSER_EXECUTABLE` pointing at an isolated installation. The workflow runs this same script on Actions-built assets.

Builds used the existing lock/cache and low-impact wrapper (two CPU affinity, nice 10, one job). The optimized original UI build has an existing unused-variable warning in `panels/library.rs`; no new build/runtime error. One isolated sandboxed Chromium context uses generated A4/text content only. No private photos, protected runtime, demo or user document was used.

The folder chooser is synthetic. Real OS permission, full original parity and all-provider acceptance remain open; DesignCraft stays planned. Alpha.61 requires fresh Actions-built assets, immutable tag/draft and downloaded checksum verification; keep the prototype prerelease draft.
