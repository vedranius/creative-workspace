# Creative Workspace alpha.18 release verification

Checked 2026-10-12. This is an Actions-built draft prerelease, not a complete server-backed ArtCraft suite.

- Commit: `707db964e97305344e2e8877f7b4550c5a2e95d5`
- Checks run `38240276991`: Linux, macOS and Windows passed.
- Build/release run `38240276900`: contract, 12 native target builds, three OS bundles, original FilmCraft regression and original DesignCraft build/worker verification all passed.
- Each OS bundle's Actions smoke passed with bundled Node and real native open/edit/save/reopen. Archives contain target engine manifests, installer notes, runtime and license files.
- Immutable tag `v0.2.0-alpha.18` resolves to the same commit. Draft prerelease ID `410527256` remains a draft.
- Five Actions-built archives and five SHA256 sidecars are attached. All five archives were downloaded and verified using their sidecars.

## Assets and SHA256

| Actions asset | SHA256 |
| --- | --- |
| `creative-workspace-0.2.0-alpha.18-darwin-arm64.tar.gz` | `2013e74eded5756e3f5522ae42b6a4c20386e0942076376c6a58965befb8005e` |
| `creative-workspace-0.2.0-alpha.18-designcraft-par03-preview.tar.gz` | `155af37bc043b8299201506b379a17023e77b763f93bf878070fe6ffe7089248` |
| `creative-workspace-0.2.0-alpha.18-filmcraft-original-ui.tar.gz` | `c0b9739bd46490c329e672a09efa6d41474de3ab011dd99856196364f1467a2b` |
| `creative-workspace-0.2.0-alpha.18-linux-x64.tar.gz` | `e996e8d7ac5ec2ff89c4d33362e154a6d0c1a6f1be43db7d0956acd9311adbd6` |
| `creative-workspace-0.2.0-alpha.18-win32-x64.zip` | `4c5e6833fc2107f7a869610925d7bc6305289bafae531304bcae9dc90a573b70` |

The DesignCraft browser report confirms only RPC snapshot transport: A4, revision 1, one-spread canonical snapshot (6,873 bytes), 595×842 server render and zero browser errors. The original `DesignApp` still does not hydrate from that snapshot. Original command/tool parity, synchronized panels, provider flows, save destination/retention and laptop ACK, reopen/recovery remain unaccepted; keep DesignCraft planned and alpha.18 draft-only.

See [DesignCraft native evidence](designcraft-par03-canonical-snapshot-native.json), [DesignCraft browser evidence](designcraft-par03-canonical-snapshot-browser.json), and the [PAR-03 handoff](../par-03a-handoff.md).
