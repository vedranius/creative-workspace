# Original DesignCraft Document Endnote Options — alpha.74 candidate

The original native command is endnote.options. Its registered Quick Apply entry is preserved; the source static Type menu has no separate Endnote Options item. The bounded host route sends that existing entry through the original generic command form, using its original parameter documentation, fields, choices, omission, JSON parsing and string trimming. It adds no replacement HTML editor or invented menu. Actual edits stay owned by the original native server document.

Pending form controls/OK/Enter/Cancel/Escape cannot resubmit or dismiss. Errors retain the original draft, and only a validated matching command/revision/canonical ACK hydrates the server mirror and closes this form. Other generic commands and desktop dispatch retain their existing behavior. Browser telemetry records actual control geometry for QA; it is not a separate UI.

## Input and composition bounds

The gateway and worker admit only a partial original EndnoteOptions object, at most 4 KiB serialized UTF-8: style, startAt, prefix, suffix, heading, headingStyle, paraStyle and separator. Native NumberStyle enum values are retained; startAt is u32, and each of the six strings is at most 256 UTF-8 bytes. Unknown keys/types, malformed enums and invalid numbers refuse before mutation.

The worker merges a private copy using the original typed EndnoteOptions, then checks the document-wide 1024-note, final u32 increment and 1 MiB generated-listing budgets before original edit regenerates its listing. The original command then executes on an isolated COW Session with the exact selection/document. Only an original result that satisfies document/canonical/page/story/ID budgets reaches the real edit/history. Upstream options, numbering, formatting and composition algorithms remain unchanged. These bounded adapter checks do not claim complete resource or memory protection.

## Verification

18 native, 170 original UI +1 existing ignored, 38 gateway /96 repository tests, npm run check, release metadata/YAML and exact reviewed source patch validation pass. Native and actual original browser proofs below pass. Zero unexpected browser/HTTP/request failures; one deliberately injected pre-mutation 422 is recorded separately. One QA context/helper/session/server closes, and the own short TMP link is removed. Screenshots are inspected.

The native fixture contains two generated body pages and the original third-page endnote listing. Twelve malformed/overflow cases reject before document/selection mutation; original Roman numbering, affixes, heading and separator regenerate the original listing while retaining body/page/selection. Canonical Undo/Redo and native save/reopen match exactly. The empty-document partial-options case preserves original defaults and valid maximum numbering when no note is composed.

Browser QA uses actual original Open, Quick Apply, generic form fields/Cancel/OK and Undo/Redo. It exercises cancellation without a command, a deliberate pre-mutation 422 preserving the draft, held ACK with duplicate/Enter/Escape/text guards, original native listing pixels, retained Save a Copy and fresh owned-worker reopen. The original generic form trims surrounding whitespace in separator input; this behavior is preserved. Initial replay exposed unpainted control geometry and lost rapid input; the final harness waits for actual field geometry/stable frames and paced typing, retaining strict payload assertions. This is a QA synchronization correction, not a source parameter workaround. Story equality excludes only the regenerated listing. Input bytes and copy dirty/name semantics stay unchanged. Synthetic folder/on-demand helper is a boundary proof; real OS permissions and full providers remain unaccepted.

[Native report](designcraft-endnote-options-native.json) · [Browser report](designcraft-endnote-options-browser.json) · [Pending original form](designcraft-endnote-options-pending.png) · [Final original server view](designcraft-endnote-options-browser.png).

Reviewed cumulative source patch SHA256 `66c92f6bad625aa4708ab28ed194c7f87415a987957380bc51ae55fa76d6b940`. Local QA WASM `77728184f85e9fd5d81522d79fa6ddc36253244935103b310ee3d5201e45322a` (40357100 bytes); native worker `a639e5d5713cec11aca66b7633a86e28d3214bcb4ab16321e2fb4d2e88bc9e3e`.

All binary/WASM hashes above identify local QA only. Exact-source Actions checks/build, immutable tag/draft and independently downloaded asset/checksum verification remain required. Alpha73/72/71/70/69 gates are complete; no old assets/tags are rewritten. Full tools/formats/providers/real OS/all13 acceptance remains open and DesignCraft stays planned. No independent RapidRAW branch merge, private photographs, protected live studios or public demo changes. One low-impact writer/build and QA context; caches/binaries are reused where appropriate.
