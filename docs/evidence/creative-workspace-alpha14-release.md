# Creative Workspace 0.2.0-alpha.14 release evidence

Checked 2026-10-11. This is an unpublished prerelease candidate; the public release channel remains alpha.7.

## Source and CI

- Source commit: `95d04cead4eb30d8d34cb65cc2c453d0bccbdea9`.
- Immutable tag: `v0.2.0-alpha.14`, pointing to the source commit above.
- [Checks run 38184007149](https://github.com/vedranius/creative-workspace/actions/runs/38184007149): passed on Windows, macOS and Linux.
- [Build and release run 38184007123](https://github.com/vedranius/creative-workspace/actions/runs/38184007123): passed. This includes all 12 native target jobs, FilmCraft browser regression, DesignCraft original UI build/registration, DesignCraft server-worker/browser verification, three platform bundle/smoke jobs and publish.
- DesignCraft patch remains `a72bd8e7bb0302ddae7bd35ee8df6df6bb35ab8164b1c2973d436db99b87c3c2`. Actions successfully registered it after the optimized Trunk build with the new helper that includes untracked files in the exact diff.

## Draft release assets

GitHub draft prerelease: `v0.2.0-alpha.14` (release ID `RE_kwDOVDgEq84YcAK_`). All five archives and their sidecars were downloaded from the release and each archive passed `sha256sum -c`:

- `creative-workspace-0.2.0-alpha.14-linux-x64.tar.gz`
- `creative-workspace-0.2.0-alpha.14-win32-x64.zip`
- `creative-workspace-0.2.0-alpha.14-darwin-arm64.tar.gz`
- `creative-workspace-0.2.0-alpha.14-filmcraft-original-ui.tar.gz`
- `creative-workspace-0.2.0-alpha.14-designcraft-par03-preview.tar.gz`

Each archive has a corresponding `.sha256` sidecar. The release remains draft because original ArtCraft full-function parity, browser permission, providers, destination acknowledgement, save/reopen and recovery acceptance are unfinished. The DesignCraft sample/read-model slice is not an availability claim.
