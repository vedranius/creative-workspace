# Creative Workspace v0.2.0-alpha.43 release verification

Verified 2026-10-15 against GitHub as `vedranius`.

- Source commit: `fbf904e11f3268e9c1d729ec3e3dfd3fed1a6d04`.
- Immutable tag: `v0.2.0-alpha.43` resolves to that commit.
- Checks workflow `38794478660`: completed successfully.
- Build/release workflow `38794477323`: completed successfully, including contract tests, GridCraft/WordCraft/FilmCraft/DesignCraft UI jobs, 12 native jobs, three target bundle jobs and publish.
- Release: [v0.2.0-alpha.43](https://github.com/vedranius/creative-workspace/releases/tag/untagged-965ef5882febb3631098), draft prerelease.
- The draft contains 16 Actions-built assets: eight archives (three platform bundles and five original UI/candidate previews) and eight `.sha256` sidecars. All eight downloaded archives passed `sha256sum -c`; their sizes and SHA-256 values also match GitHub's asset metadata.

The release remains a draft because original app parity and server/provider acceptance are incomplete. In particular, DesignCraft's original action bridge and save/provider/reopen/recovery work remains unfinished. GridCraft and WordCraft previews execute in browser WASM and are not server adapters. Do not claim the suite or those apps are available as server-processed products.

Next bounded roadmap item: ORG-DECK-UI, then CADCraft, FigCraft and SoundCraft original UI previews. After those, resume the full server/provider acceptance order in `docs/artcraft-expansion.md`. Preserve the DesignCraft Select All WIP, untracked `engines/filmcraft/`, and all protected live services.
