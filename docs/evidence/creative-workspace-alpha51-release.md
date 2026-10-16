# Creative Workspace alpha.51 release verification

- Product commit: `560e997291fab253049ab3f13a27399290d57312`.
- Checks `38905204890` succeeded on Ubuntu, macOS and Windows. Build/release `38905204975` succeeded across all 24 contract, native, original-UI, DesignCraft browser and bundle jobs, then published through the Actions job.
- Immutable tag `v0.2.0-alpha.51` resolves to the product commit above. The GitHub prerelease is a draft: https://github.com/vedranius/creative-workspace/releases/tag/v0.2.0-alpha.51
- GitHub CLI identity was verified as `vedranius` before publication.
- The release has 24 assets: 12 Actions-built archives and 12 SHA256 sidecars. All 12 archive/sidecar pairs were downloaded and passed `sha256sum -c`.
- DesignCraft's pinned original Selection/Type, Select All, Deselect All, Clear, owned-worker and preset/server-canvas checks all passed in Actions. The alpha.51 browser proof also confirms Clear → original Ctrl+Z restores `INK` and the exact previous server-render PNG at revision 10; see [PAR-03 evidence](../par-03a-handoff.md) and [browser JSON](designcraft-par03-edit-clear-undo-browser.json).

The release remains draft-only. Synthetic chooser coverage does not establish real browser folder permission; laptop destination ACK/recovery, complete DesignCraft open/edit/save/reopen, remaining original actions/tools, and complete parity/provider acceptance across all 13 applications remain incomplete. Keep DesignCraft planned and do not claim the suite is available.
