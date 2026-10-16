# Creative Workspace alpha.50 release verification

- Product commit: `ad921cb8b6431b484bfe6ee66a1556b7b73ca02f`.
- Checks `38890067614` and Build/release `38890067623` completed successfully. The latter passed contract, target bundle/native jobs, six original Crafting Apps UI jobs, and the DesignCraft original UI/server worker candidate, then published through its Actions job.
- Immutable tag `v0.2.0-alpha.50` resolves to the product commit above. GitHub release is a prerelease draft: https://github.com/vedranius/creative-workspace/releases/tag/untagged-f62327fffe10f792a3a3
- Authenticated GitHub CLI identity was verified as `vedranius`.
- Downloaded all 12 release archives and their 12 `.sha256` sidecars from GitHub. `sha256sum -c` passed all 12 pairs. Verification downloads were kept outside the repository.
- DesignCraft's original Edit > Clear action and prior Selection/Type actions reached the owned server worker; the original preset/server-canvas candidate passed the Actions browser job. The detailed feature/browser evidence is in the alpha.50 section of [PAR-03 handoff](../par-03a-handoff.md) and [roadmap](../roadmap.md).

The release remains draft-only. Synthetic chooser coverage does not establish real browser folder permission; laptop destination ACK/recovery, full DesignCraft open/edit/save/reopen, remaining original actions/tools, and complete parity/provider acceptance across all 13 applications remain incomplete. Keep DesignCraft planned and do not claim the suite is available.
