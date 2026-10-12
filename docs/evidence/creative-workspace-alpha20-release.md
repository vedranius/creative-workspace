# Creative Workspace alpha.20 release verification

Verified 2026-10-12 against GitHub as `vedranius`.

- Build/release workflow [38256341061](https://github.com/vedranius/creative-workspace/actions/runs/38256341061) completed successfully, including the release publish job.
- Immutable tag `v0.2.0-alpha.20` resolves to commit `ee69c299aa6aee0d5bb907f132b87a0e8f5d4f6a`.
- Draft prerelease [410699265](https://github.com/vedranius/creative-workspace/releases/tag/untagged-7813aba7c960a82cb169) contains all six Actions-built archives and six `.sha256` sidecars. Each archive passed `sha256sum -c` after download.
- The six archive pairs are the Darwin arm64 bundle, Linux x64 bundle, Windows x64 bundle, DesignCraft host-canvas candidate, DesignCraft PAR-03 preview, and original FilmCraft UI.

The release stays a draft. The DesignCraft artifact proves the original A4 preset → owned worker ACK → acknowledged mirror/server canvas slice only. Original editing actions, full original UI parity, common providers, explicit destination/retention, save destination acknowledgement, reopen and recovery are incomplete. No availability claim is supported. Do not replace any protected live UI package with the candidate.

Next bounded work remains the first actual original DesignApp edit action through the ordered pending/ACK boundary, followed by a new server render/read-model revision. Preserve `engines/filmcraft/` and protected live services.
