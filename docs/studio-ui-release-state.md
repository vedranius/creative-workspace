# STU-ORG-01 release verification

Verified 2026-10-11. Product `0.2.0-alpha.8`, feature commit and immutable tag target `f2f3ae6794b85ce3c560bd25dc5db82c30ab71e9`.

- [Checks 38150923503](https://github.com/vedranius/creative-workspace/actions/runs/38150923503): Linux, Windows and macOS passed.
- [Build and release 38150923502](https://github.com/vedranius/creative-workspace/actions/runs/38150923502): all 12 native builds, three bundle jobs and publish job succeeded.
- GitHub Release `v0.2.0-alpha.8` exists as **draft/prerelease**, with three Actions-built native-prototype archives and three SHA256 sidecars. Original WASM UI assets are not bundled; the draft must not be presented as a complete original creative suite.
- All three sidecars were downloaded through authenticated GitHub access and their archive SHA256 values matched the GitHub asset digests. Full archive downloads were not independently repeated on this host; target extraction/startup/native smokes are the Actions evidence.
- GitHub keeps draft releases initially untagged. After verifying the completed workflow and assets, the maintainer normally pushed new immutable tag `v0.2.0-alpha.8` at the same feature commit. No published tag or release was rewritten. Future draft release automation should explicitly verify/create its Git tag too.

| Actions archive | Bytes | SHA256 |
| --- | --- | --- |
| `creative-workspace-0.2.0-alpha.8-linux-x64.tar.gz` | 121897283 | `9aa0ce74138dba502d765e2537dee313f08d886d3aa4d015940c471ac5403a56` |
| `creative-workspace-0.2.0-alpha.8-win32-x64.zip` | 109095094 | `7766e60f6c4b0fdf16cbeca0674129bc27ab3fd771fc72c4a5ae93a6a22a0604` |
| `creative-workspace-0.2.0-alpha.8-darwin-arm64.tar.gz` | 110004500 | `f6b0c7e7a9a0701a244632383f14827f1d7bfb13a81aec11fee0fb285cc17e97` |

Local original-UI studio: `http://127.0.0.1:8793/`; `/api/health` reports alpha.8, the roster reports seven verified original UI previews, and independently owned RapidRAW reports `ready:true, ownedRuntime:true`. Old `8792` was preserved for four existing prototype editing sessions. See [installation, browser evidence and remaining scope](studio-original-uis.md).

**Next:** resume the identified, restored uncommitted PAR-03 server sample patch. Scoped protocol tests now pass 6/6 after fixing their health-probe/active-worker selection. Real native worker rebuild, original UI read-model/command/canvas transport, server processing, real provider/write ACK and full parity remain pending. The patch is preserved separately and was not included in the alpha.8 UI launch release. Do not claim the entire project complete.
