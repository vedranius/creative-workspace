# Creative Workspace v0.2.0-alpha.26 release verification

Verified 2026-10-13 after the full Actions workflow completed.

- Feature commit: `16d96b3da8c1697b719f9185ef1d0057fe5720b6`
- Immutable tag: `v0.2.0-alpha.26` → `16d96b3da8c1697b719f9185ef1d0057fe5720b6`
- GitHub release: prerelease, draft; intentionally not promoted while DesignCraft parity/provider acceptance remains incomplete.
- Build/release workflow: [run 38325225198](https://github.com/vedranius/creative-workspace/actions/runs/38325225198), conclusion `success`. Contract, original FilmCraft regression, original DesignCraft browser verification, all native engine matrix jobs, Linux x64/macOS arm64/Windows x64 bundles, and publish succeeded.
- GitHub CLI identity was verified as `vedranius` before inspection.
- Downloaded every release archive and `.sha256` sidecar to temporary storage; `sha256sum -c *.sha256` returned `OK` for all six pairs.

| Actions-built asset | SHA-256 |
| --- | --- |
| `creative-workspace-0.2.0-alpha.26-linux-x64.tar.gz` | `2f4662bd82fd2f6f3d5b019a62c4bc32a9a28db30f95c31632918f649c7fc2e3` |
| `creative-workspace-0.2.0-alpha.26-win32-x64.zip` | `f60e441861338b52264622ff472a5707289deb0968b1fa853dd3abb830fcd785` |
| `creative-workspace-0.2.0-alpha.26-darwin-arm64.tar.gz` | `b196c83c04ce1fdbe08e15c066eed4a169873772caf7c9601625704152aca3a5` |
| `creative-workspace-0.2.0-alpha.26-designcraft-host-canvas-candidate.tar.gz` | `64c61468055562c667257274b649ad96abbab5d5936cec17a4bc2f3d447c369e` |
| `creative-workspace-0.2.0-alpha.26-designcraft-par03-preview.tar.gz` | `0abbbffbc4e4868876d404c6f1f177500919e067c15215f2cdd72aee1a8be346` |
| `creative-workspace-0.2.0-alpha.26-filmcraft-original-ui.tar.gz` | `849a0f38970c4cd21aeb4783e507fa93adad4d8ccf4d92dc6cdd4c240f972e41` |

This verifies release construction and asset integrity; it does not accept the DesignCraft candidate as a supported app. The original Save a Copy path currently supports only server workspace destination with workspace retention. Laptop write acknowledgement, recovery, remaining original actions and full parity are still required. Keep DesignCraft planned and the release draft.
