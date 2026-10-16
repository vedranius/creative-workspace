# Creative Workspace 0.2.0-alpha.45 release evidence

- Product source: `a0e88245ed89d3ad034bbc7eaaf91d8a022d710c` (`feat: add original CADCraft preview`)
- Immutable tag: `v0.2.0-alpha.45`, pushed to `vedranius/creative-workspace`
- Release: [alpha.45 draft](https://github.com/vedranius/creative-workspace/releases/tag/v0.2.0-alpha.45); intentionally remains a prerelease draft while full application/provider acceptance is incomplete.
- Actions-built assets: 10 archives and 10 SHA256 sidecars (20 release assets). The original build/release run `38822906898` completed target builds and uploaded these assets; Checks `38822907261` passed. The run's publish gate initially expected nine archive pairs. Follow-up checks `38828769245` and `38829005906` passed after correcting the expected pair and asset counts to ten and twenty. Workflow-dispatch was unavailable to the authenticated token, so the release remains a draft.
- Download verification: downloaded all 10 archives and all 10 sidecars from the GitHub draft; each sidecar matched its archive byte-for-byte SHA256. GitHub's asset digests match those values.
- CADCraft archive: `creative-workspace-0.2.0-alpha.45-cadcraft-original-ui.tar.gz`, 8,509,318 bytes, SHA256 `b5899e8bd836e77cc4ff3510d28adfd5d1ec04947fcd6b97fb3ce798962a75df`.

This release contains the original CADCraft browser UI preview. Geometry and export still execute in browser WASM. Real folder permission, laptop write acknowledgement and recovery, server-owned CAD processing, full tool/action parity and native OS acceptance remain unverified; CADCraft stays planned.
