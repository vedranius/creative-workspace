# ORG-DECK-UI handoff — 2026-10-15

Built and registered the original DeckCraft v0.7.0 browser UI from exact pin `d78e657e4cb1e490ceb5445785c052d9cf5ad963`; isolated Chromium 151 verified the original ribbon, sample presentation, slide thumbnails, canvas and presenter control with zero page/console errors. Evidence and limits: [DeckCraft preview report](deckcraft-original-ui-preview.md).

This is browser-local WASM. DeckCraft remains planned; its owned server engine/action/state/render/export, all four provider modes, real permission/write acknowledgement/recovery, native OS support and full parity are not accepted. Optional upstream `craft-fonts` was absent, so the build uses system fonts.

Alpha.44 adds immutable registration and an Actions-built browser archive/checksum job. Keep the release draft-only until full original app bundle/OS/browser/provider parity is accepted. Next: ORG-CAD-UI, then FigCraft → SoundCraft. After the six new UI previews, resume DesignCraft PAR-03 and complete server/provider acceptance across all 13 apps. Preserve the existing DesignCraft Select All WIP and unrelated `engines/filmcraft/`; no protected runtime was touched.
