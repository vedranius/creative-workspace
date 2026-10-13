# Creative Workspace v0.2.0-alpha.28 release verification

- Feature commit: `747a84e06399bff9f238f3a0c40b8c2cf30db9d0` (DesignCraft laptop Save Copy ACK handler and protocol evidence).
- Release metadata commit: `4cf66ced053ba7ea3ea0db1401ed8347472615d5`.
- Checks run `38332923836`: Linux, macOS and Windows passed.
- Build/release run `38332923828`: contract, all 12 native targets, FilmCraft original browser regression, DesignCraft original UI/server worker/browser candidate proof, and all three Actions-built bundle jobs passed; publish completed successfully.
- GitHub account verified as `vedranius`.
- Immutable tag `v0.2.0-alpha.28` points to `4cf66ced053ba7ea3ea0db1401ed8347472615d5`. Release ID `411173127` is prerelease + draft.
- All six Actions-built archives and six SHA256 sidecars were downloaded. Every `sha256sum -c` check passed.

| Actions-built asset | SHA-256 |
| --- | --- |
| `creative-workspace-0.2.0-alpha.28-linux-x64.tar.gz` | `8d42dd9d6ab563de91fbb16d3e2b7ef7a6764946430f232edd45c92a461e64af` |
| `creative-workspace-0.2.0-alpha.28-win32-x64.zip` | `a5ba1070c73a5d208cdfcf4e3e0117a3003f37ba421d0ebf24cc32f63b8c154f` |
| `creative-workspace-0.2.0-alpha.28-darwin-arm64.tar.gz` | `12d124889c9bc10f5baf6c5583e9678c73cef82648b2c20f9bc77a27da439705` |
| `creative-workspace-0.2.0-alpha.28-designcraft-host-canvas-candidate.tar.gz` | `45672ecdebb17e763ec74fa12cfaaa70c012ad9bdda2704e4212cc0112dd9007` |
| `creative-workspace-0.2.0-alpha.28-designcraft-par03-preview.tar.gz` | `82011145ccf70b1fc609013751a4bdb65d93fb8422bb9381ce03ba71a1a21884` |
| `creative-workspace-0.2.0-alpha.28-filmcraft-original-ui.tar.gz` | `25cda15859fd33207e35d05d3f97ac3f196baae61ed476eec3308e574290a1f8` |

The existing DesignCraft A4/server-canvas and FilmCraft proof jobs are not laptop Save Copy acceptance. The original DesignCraft host still does not bind a selected read/write laptop share or offer its destination choice; local `/dev/fuse`, Trunk and Chromium were unavailable. Keep this prerelease draft-only and DesignCraft planned until actual browser permission, provider ACK, reopen and uncertain-output recovery pass.
