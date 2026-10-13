# Creative Workspace v0.2.0-alpha.27 release verification

Verified 2026-10-13 after the full Actions workflow completed.

- Correction commit: `a82d144e0882cf80f984ef9221461804d81ab8d2`
- Immutable tag: `v0.2.0-alpha.27` → `a82d144e0882cf80f984ef9221461804d81ab8d2`
- GitHub release: prerelease, draft; intentionally not promoted because full original-app/server/provider parity remains incomplete.
- Cross-platform checks: `38328228402`, all three OS jobs passed.
- Build/release workflow: [run 38328228411](https://github.com/vedranius/creative-workspace/actions/runs/38328228411), conclusion `success`. Contract, original FilmCraft regression, original DesignCraft browser proof, native engine matrix, all three target bundles and publish succeeded.
- GitHub CLI identity was verified as `vedranius` before inspection.
- Downloaded all six Actions-built archives and `.sha256` sidecars to temporary storage; `sha256sum -c *.sha256` returned `OK` for every pair.

| Actions-built asset | SHA-256 |
| --- | --- |
| `creative-workspace-0.2.0-alpha.27-linux-x64.tar.gz` | `bfcfac50f097cc61ad8788c88eeb28c90c328f93cc4cb64ffd598b4ca0f638bf` |
| `creative-workspace-0.2.0-alpha.27-win32-x64.zip` | `4a0e4cea27a1a3bdbfeef618e58666a0f66a569855db22fc17467c7560e8d6fb` |
| `creative-workspace-0.2.0-alpha.27-darwin-arm64.tar.gz` | `9b8bd5528a16f790b1325c009f331179be51154901db7b0681d52384233f14cb` |
| `creative-workspace-0.2.0-alpha.27-designcraft-host-canvas-candidate.tar.gz` | `5e602efd4332ccdf47357485eba959160957366fc6440a3b64f22f619981f9bc` |
| `creative-workspace-0.2.0-alpha.27-designcraft-par03-preview.tar.gz` | `526186d894882f9ffe93cea706d466c7192c37dfc04f7f299470dd088357131a` |
| `creative-workspace-0.2.0-alpha.27-filmcraft-original-ui.tar.gz` | `74114425c7ab53f9ff30942075d5551ff1912e80d78fd7ab4bf3aae6c130ead7` |

Alpha.27 only makes the existing Save Copy protocol fixture compare canonical filesystem paths on macOS. Product behavior is unchanged from alpha.26. This release verification does not accept DesignCraft as a supported app: the candidate remains unregistered, laptop write acknowledgement and recovery are incomplete, and full original action parity is pending. Keep the release draft.
