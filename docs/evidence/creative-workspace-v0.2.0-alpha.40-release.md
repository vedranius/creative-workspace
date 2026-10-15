# Creative Workspace v0.2.0-alpha.40 release verification

- Commit/tag: `498af5599a881bc5470c56dbdcbde47da1fa066e`; remote tag `v0.2.0-alpha.40` points to that exact commit.
- GitHub Actions Build and release run: [38770403437](https://github.com/vedranius/creative-workspace/actions/runs/38770403437).
- GitHub draft release: [414093618](https://github.com/vedranius/creative-workspace/releases/tag/untagged-65c224fdffcfc92a71ea); retained as a prerelease draft.
- Downloaded all 12 release assets from GitHub. Every archive passed its published `.sha256` sidecar.

| Archive | SHA256 |
|---|---|
| `creative-workspace-0.2.0-alpha.40-darwin-arm64.tar.gz` | `610370ea0baabfc971c069379c1cfa9d9f4dc7ba337a070f5de794ff7f0fc33d` |
| `creative-workspace-0.2.0-alpha.40-designcraft-host-canvas-candidate.tar.gz` | `de87cb9ae8a41fc98d46311149dfc6a62c7cd18890907b4fe1dbeb5c0bb20b33` |
| `creative-workspace-0.2.0-alpha.40-designcraft-par03-preview.tar.gz` | `0562332bb4bdd76c79743b90b95acce15440b2bc7a931885a04e65b58b6f9623` |
| `creative-workspace-0.2.0-alpha.40-filmcraft-original-ui.tar.gz` | `6354abea4a6095f6422565a3a10f1f8bd5e5167584e44219c62b1005256dcbeb` |
| `creative-workspace-0.2.0-alpha.40-linux-x64.tar.gz` | `1f073ccb80248c931a5c5f611302c050c6c46cb31873f1277ead7dc5000f75f8` |
| `creative-workspace-0.2.0-alpha.40-win32-x64.zip` | `43e941354f112ae5ce75a8e2e3186dc943cd5589652095c05ef121541f73d142` |

The Actions build, native bundles, original FilmCraft/DesignCraft jobs and checksums completed. The Actions publish step failed with `403 Resource not accessible by integration` because the workflow token could not create releases. Using the authenticated `vedranius` host helper, the verified artifacts were uploaded to a draft and the immutable tag was pushed normally. Release ID `414093618`.
