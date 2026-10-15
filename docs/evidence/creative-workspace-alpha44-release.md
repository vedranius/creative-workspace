# Creative Workspace v0.2.0-alpha.44 release verification

Verified 2026-10-16 after the original DeckCraft preview was pushed.

- GitHub CLI identity: `vedranius`.
- Checks run [`38810016061`](https://github.com/vedranius/creative-workspace/actions/runs/38810016061) completed successfully for `bb7e34521cead3d3a3970bd891f7faf526b0963a`.
- Build/release run [`38810016085`](https://github.com/vedranius/creative-workspace/actions/runs/38810016085) completed successfully on the same commit, including original UI and target bundle jobs.
- Immutable tag `v0.2.0-alpha.44` resolves to `bb7e34521cead3d3a3970bd891f7faf526b0963a`.
- The prerelease remains a draft. It contains 18 Actions-uploaded assets: nine archives and nine SHA-256 sidecars (Linux x64, macOS arm64, Windows x64, DeckCraft, DesignCraft host-canvas candidate, DesignCraft PAR-03 preview, FilmCraft, GridCraft and WordCraft).
- Downloaded every release asset into the ignored verification scratch directory and ran `sha256sum -c` against all nine archive sidecars; all nine returned `OK`.

This closes the alpha.44 release gate only. Platform archives are prototype bundles; original browser previews remain browser-local and do not establish server processing or provider acceptance. The Creative Workspace applications remain subject to their documented server, save/reopen, permission, recovery and parity gates. No services, user documents, or DesignCraft Select All WIP were changed during verification.
