# Creative Workspace v0.2.0-alpha.42 release verification

- Commit/tag: `4d073844a842061569126dda945fa575d9652fbd`; remote tag `v0.2.0-alpha.42` points to that exact commit.
- GitHub Actions Build and release run: [38777350723](https://github.com/vedranius/creative-workspace/actions/runs/38777350723).
- GitHub draft release: [RE_kwDOVDgEq84Yr0TA](https://github.com/vedranius/creative-workspace/releases/tag/untagged-305db1353e8cb011b312); retained as a prerelease draft.
- Downloaded all 14 release assets from GitHub. Every archive passed its published `.sha256` sidecar.

| Archive | SHA256 |
|---|---|
| `creative-workspace-0.2.0-alpha.42-darwin-arm64.tar.gz` | `382f2c5473191b4c97983060c0cfcc001e837eadc196cbc959613841bf89b0db` |
| `creative-workspace-0.2.0-alpha.42-designcraft-host-canvas-candidate.tar.gz` | `5f68456bf92e75f4c9d138abeec11da5ccb3e08b64f89207f8703ecf6103d1ba` |
| `creative-workspace-0.2.0-alpha.42-designcraft-par03-preview.tar.gz` | `b6fa49a795eef1973a8e77e02d34dfbe99451d0ad7142b89b3efdf92ea7a37ac` |
| `creative-workspace-0.2.0-alpha.42-filmcraft-original-ui.tar.gz` | `c96abc5319e5da591dc1bcf1718fd0c6a416e7400dcc8ab555c1799928bdd880` |
| `creative-workspace-0.2.0-alpha.42-linux-x64.tar.gz` | `15e66163a8d3bd871df637df83fb2c28e085d57917704d53386b92e26e283abb` |
| `creative-workspace-0.2.0-alpha.42-win32-x64.zip` | `065a2c22ad50f189c0a32baed5f358498bf936d29749c2ec3e6c4d9cbcfdab4e` |
| `creative-workspace-0.2.0-alpha.42-wordcraft-original-ui.tar.gz` | `8f640c8b3c69b4bc4f16d73711fcf3906056d9b4f122b0670086343afd9815f8` |

Checks `38777350639` and all Build and release jobs passed. Actions created the draft and pushed the immutable tag. The original WordCraft preview archive contains clean pin `fc41918814f62645b6746ed68e71e8c2c2e85d6f`, its built browser assets, MIT/Apache licenses, NOTICE and attribution provenance; it remains a browser-WASM preview and does not change WordCraft catalog status. Release remains draft-only.
