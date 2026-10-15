# GridCraft original UI preview — 2026-10-15

## Source, build, and registration

Built the original `storytold/gridcraft` web app at the clean, detached v0.7.0 pin `d9d09f0baa912e88c5111107903fc8c640214b57` using its tracked `apps/gridcraft-web` Trunk recipe. The upstream source was not modified. Its MIT and Apache-2.0 licenses, NOTICE, attribution, and separate ArtCraft brand terms were reviewed and copied into the immutable package provenance. The source manifest and assets were registered under a separate package root; the isolated Creative Workspace server served `/original/gridcraft/` on port 8802 with its own data/workspace roots and Basic auth. The registry reported the exact source commit and `processing: browser`, `serverIntegrated: false`.

Build artifact SHA-256:

| File | SHA-256 |
| --- | --- |
| `index.html` | `832f77eec328e4db9402891d0ba1fc4fea08f78075b1547ee114e75564ab9a31` |
| `gridcraft-web-eef3b0626eccc128.js` | `cd4d0aa76dfb703870a6b5dbf63c88217221ebb7aac5c491f51c0e1b2d8fcbd9` |
| `gridcraft-web-eef3b0626eccc128_bg.wasm` | `0654d164a58698f2e624d251212d1178d78c44766efadbb389b38e15c5e75a7e` |

## Browser evidence

A single isolated Chromium 151 context at 1600×1000 used WebGL2/SwiftShader. The original two-chart Quarterly Sales sample rendered with its worksheet, ribbon, formula bar, status bar, and charts. The File backstage Open page and Save As page rendered. Formula and Data ribbon tabs were opened. A workbook cell edit updated dependent totals, growth values and chart output. The original Save As command produced a valid XLSX browser download (`Quarterly Sales Dashboard.xlsx`, 11 KiB; SHA-256 `6fff7b41fa58f4bfca0691c4be4831e8e342a7b96b8c437d370c49b0cfef3026`). To keep the automated smoke non-interactive, Chromium's native save-picker API was disabled for that check so the upstream browser-download fallback ran. The downloaded XLSX was reopened into a fresh page by dropping its bytes on the original canvas; the original app showed the filename and workbook without page or console errors. This uses Playwright file injection/drop and does not prove a real OS file picker or folder permission.

- [Original workbook sample](evidence/gridcraft-original-ui-sample.png)
- [File backstage](evidence/gridcraft-original-ui-file-backstage.png)
- [Open page](evidence/gridcraft-original-ui-open-page.png)
- [Formula ribbon](evidence/gridcraft-original-ui-formulas-ribbon.png)
- [Data ribbon](evidence/gridcraft-original-ui-data-ribbon.png)
- [Edited worksheet with recalculated dependents](evidence/gridcraft-original-ui-edited-sheet.png)
- [Reopened XLSX](evidence/gridcraft-original-ui-reopened.xlsx.png)

## Limits and next task

This is the original UI and its browser-local WASM spreadsheet engine. It does not establish server-owned workbook state, recalculation/render/export, the four file-provider modes, destination/write acknowledgement, real folder permission, uncertain-save recovery, native OS support, cross-browser acceptance or full Excel-format parity. GridCraft remains planned; no availability claim is made. The upstream checkout's gitignored `plan/` and sibling `craftrules/` were not present in the isolated checkout; the tracked source instructions, README/web build recipe, license and attribution files were reviewed, and the upstream source stayed untouched.

Next bounded original UI task: ORG-DECK-UI. After DeckCraft, continue CADCraft → FigCraft → SoundCraft, then the server/provider acceptance order in [the expansion plan](artcraft-expansion.md). Preserve the existing DesignCraft Select All WIP and `engines/filmcraft/`.
