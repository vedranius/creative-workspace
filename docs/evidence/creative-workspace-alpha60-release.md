# Creative Workspace 0.2.0-alpha.60 release verification

Date: 2026-10-17
Commit: `0773db1160c76369cabd8140922f91469fee6728`
Tag: `v0.2.0-alpha.60` (immutable; resolves to the commit above)
Build/release: [Actions run 39060796090](https://github.com/vedranius/creative-workspace/actions/runs/39060796090) — success
Checks: [Actions run 39060796105](https://github.com/vedranius/creative-workspace/actions/runs/39060796105) — success

The release is a prototype/prerelease draft. GitHub Actions built Linux x64, Windows x64 and macOS arm64 bundles, plus the original UI preview archives. The exact-pinned DesignCraft UI unit tests and browser checks passed in CI. A separate isolated Chromium run exercised the original Properties → Page → Insert Page button against the owned server worker: unchanged `layout.pages.insert` (`after: 0`, `count: 1`) received matching ACK at revision 2; the server document had two pages and remained dirty, and its revisioned PNG returned HTTP 200. Browser reported no console errors, failed responses or failed requests. [Local browser report](designcraft-par03-pages-insert-browser.json) · [screenshot](designcraft-par03-pages-insert-browser.png).

Authenticated GitHub identity was verified as `vedranius`. The draft release has 24 assets. All 24 were freshly downloaded; all 12 archive/sidecar pairs passed SHA-256 verification against each sidecar and each asset digest from GitHub. The package includes three platform prototype bundles, seven additional original UI preview archives, and two DesignCraft PAR-03 candidate archives, each with a checksum sidecar.

The folder chooser in the browser proof was synthetic. This single action does not establish real OS folder permission, laptop destination write ACK/recovery, complete open/edit/save/reopen, full DesignCraft original-action parity or the all-13 server/provider acceptance. Keep DesignCraft planned and the alpha.60 release draft-only.
