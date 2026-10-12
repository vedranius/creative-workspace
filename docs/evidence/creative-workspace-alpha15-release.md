# Creative Workspace alpha.15 release verification

Verified 2026-10-12. The release remains a draft prerelease.

## Source, checks and Actions

- Account used for publication and verification: `vedranius`.
- Product commit tagged by the release workflow: `42cb3b00fe1cfe5d4a120568e9bea901b6700cdf` (`test: bind DesignCraft edits to the active worker`). Tag `v0.2.0-alpha.15` resolves directly to that commit and is not rewritten.
- Checks `38188391413` passed on that commit. Follow-up docs/handoff commit `fdbc69f9a76b50c4f62c7427eba9d78fc0545226` also passed Checks `38188396149`.
- Build/release run `38188391442` succeeded: contract checks, all 12 native engine/OS jobs, three bundle builds and native smokes, FilmCraft original UI regression, DesignCraft exact-patch build/registration and owned-server Chromium regression, then publish.
- The Actions DesignCraft browser report was downloaded and inspected: owned runtime, `file.new` revision 1, two serialized `frame.create` gestures reaching revision 3, 612×792 server render, 404 foreign session, 403 invalid Origin, 409 stale revision and zero uncaught browser errors.

## Draft release assets

Release ID `410031237`; tag `v0.2.0-alpha.15`; `draft: true`, `prerelease: true`. Downloaded all five archives and five SHA256 sidecars from the release and verified each with `sha256sum -c`.

| Actions-built archive | SHA-256 |
| --- | --- |
| `creative-workspace-0.2.0-alpha.15-linux-x64.tar.gz` | `2868ca3643d4d1541fc8bca9f83f1e0ae705cd6db128e09ea962a22bb59ceea9` |
| `creative-workspace-0.2.0-alpha.15-win32-x64.zip` | `9f80875bcc544ec1a204e6499ba7f66b9b6d47478ce44982056e9023a0f9dc5b` |
| `creative-workspace-0.2.0-alpha.15-darwin-arm64.tar.gz` | `d309d5daef088cc5062d2c6f8e71904ce7e2a1a1485a213c7bc3a2a53366f5e0` |
| `creative-workspace-0.2.0-alpha.15-filmcraft-original-ui.tar.gz` | `66ad95a709e6c8c0343d80c811861777757bcd2fb9136a4de96816ab14a2b4d3` |
| `creative-workspace-0.2.0-alpha.15-designcraft-par03-preview.tar.gz` | `8a1994913290917dcdaefd837623b54d74294b64ae25e4a89ae463cc8a4a9a77` |

The DesignCraft preview archive contains the pinned `a127c6d5` UI, `par-03-server-edit-v1` exact patch, upstream MIT/Apache notices, provenance and a registration manifest. It remains a partial preview, not an available complete DesignCraft application.

## Product limits

Keep the draft. The original `DesignApp` remains visibly unsynchronized and says “No document open”; the server preview is overlaid on its shell. The bridge handles only `file.new` and fixed demo-text `frame.create` pointer gestures. Provider destination/retention, acknowledged save, reopen/recovery and original tool/state parity remain incomplete. No full original ArtCraft availability claim is made.
