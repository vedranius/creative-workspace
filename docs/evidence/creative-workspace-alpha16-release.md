# Creative Workspace alpha.16 release verification

Verified 2026-10-12. The release remains a draft prerelease.

## Source, checks and Actions

- GitHub account used for verification: `vedranius`.
- Product commit: `3f51e7d721bc0432bc42a5fbd7ff52df52809175` (`feat(designcraft): refresh server read model after edits`). Immutable tag `v0.2.0-alpha.16` resolves to this commit.
- Checks run `38194170672` passed on Ubuntu, macOS and Windows.
- Build/release run `38194170670` passed the contract, all 12 native engine/OS builds, all three target bundle smoke jobs, FilmCraft original UI regression, exact DesignCraft patch build/registration and browser/native worker smoke, and publish.
- The DesignCraft Chromium report verified `file.new` revision 1, two ordered `frame.create` actions through revision 3, synchronized response title/pages/dirty state/banner, a changed server PNG digest, 404 foreign session, 403 invalid Origin, 409 stale revision and zero uncaught browser errors.

## Draft release assets

Release ID `RE_kwDOVDgEq84YcV1b`; `draft: true`, `prerelease: true`; target commit `3f51e7d721bc0432bc42a5fbd7ff52df52809175`. Downloaded all five Actions-built archives and all five SHA256 sidecars; each archive passed `sha256sum -c`.

| Actions-built archive | SHA-256 |
| --- | --- |
| `creative-workspace-0.2.0-alpha.16-linux-x64.tar.gz` | `8015f9ecff5add7c0e3d15bc5fbf3af70d03fcb5155ac1ce4d5782eda047a632` |
| `creative-workspace-0.2.0-alpha.16-win32-x64.zip` | `27efbbf816fdbcb701c5b191935bc781abb92f22ca7690e10f949ebf74395320` |
| `creative-workspace-0.2.0-alpha.16-darwin-arm64.tar.gz` | `7dbd773231af34548cfd8aa240ba813d1c9bec28e11863e54996cd37fab8ccc6` |
| `creative-workspace-0.2.0-alpha.16-filmcraft-original-ui.tar.gz` | `fdf1b6bca4375e92456c3636e45b6c3dfd11ec49792f855fa9de0c3e8af17913` |
| `creative-workspace-0.2.0-alpha.16-designcraft-par03-preview.tar.gz` | `ef54f980e7babe1f5b2dc70c743bcabcdd97458e3bde381fbc4ea4e83510d485` |

The DesignCraft preview contains pin `a127c6d5` and exact patch `par-03-server-read-model-v3`. This bridge refreshes its own shell response, not the upstream DesignApp Session. The original panels still say “No document open”; original UI action dispatch, provider destination/retention, acknowledged save, reopen and recovery are incomplete. Keep the release draft and DesignCraft planned.
