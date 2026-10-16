# Creative Workspace 0.2.0-alpha.49 release verification

- Product commit: `320a8e8c23bc8fe4821498f23a0f91cd5357fabb` (`feat: bridge DesignCraft deselect all action`). GitHub login was verified as `vedranius`.
- Checks workflow `38876397106`: success on Linux, Windows and macOS.
- Build/release workflow `38876397126`: success. The original DesignCraft job built and registered the exact pinned UI, passed focused Selection/Type, Select All and Deselect All source tests, and completed the original UI/owned-worker browser checks.
- Immutable tag `v0.2.0-alpha.49` resolves to the product commit. The GitHub prerelease remains a draft while provider permission/write-ACK/recovery and complete original-app parity are not accepted.
- Draft release ID and metadata report 24 uploaded assets: 12 Actions-built archives and 12 `.sha256` sidecars. Freshly downloaded all 24 files and ran `sha256sum -c` on every sidecar; all 12 archive checks passed.

The DesignCraft Deselect All browser report and screenshot are recorded separately in [the PAR-03 action evidence](designcraft-par03-edit-deselect-all.md). Its chooser is synthetic and does not prove real browser folder permission or laptop write acknowledgement.
