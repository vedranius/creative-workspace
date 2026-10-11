# FIL-MKV-01 Alpha.10 release verification

- Workflow: [Build and release 38166022700](https://github.com/vedranius/creative-workspace/actions/runs/38166022700) — **success**.
- Version/tag: `0.2.0-alpha.10`; immutable tag points to commit `6481512ae825ecab09dfa5a9ff731b54ecbe2574`; GitHub release 409866460 remains **draft/prerelease**.
- Release verifier downloaded and checked all eight assets against API size/digest and adjacent SHA256 sidecars.
- Linux x64, Windows x64 and macOS arm64 prototype bundles each contain the target manifest, Node 24 runtime, four pinned native engines, startup evidence, and native open/edit/save/reopen smoke reports. Embedded engine and Node bytes match manifest SHA256 values.
- FilmCraft preview is browser-local. Its source pin, reviewed patch SHA256 and every listed UI payload hash match the archive metadata.
- [Original browser report](filmcraft-mkv-alpha10-browser-report.json): `ok: true`, 8 cases, 0 uncaught errors. The run artifact is from Chromium 156.0.8078.4; real file-picker permissions are not tested. [Screenshot](filmcraft-mkv-alpha10-original-ui.png).

## Downloaded assets and SHA256

- `creative-workspace-0.2.0-alpha.10-darwin-arm64.tar.gz` — 110152614 bytes; SHA256 `4c7c7a3953c4a4384b5d64e4ff8e5b149d644d5b2a12bb262aa0edcb7a3000c5`
- `creative-workspace-0.2.0-alpha.10-darwin-arm64.tar.gz.sha256` — 120 bytes; SHA256 `06c5aeab3a4808085fca7f6b8f7449c23adb29f0e80239cba562b9ac0521447d`
- `creative-workspace-0.2.0-alpha.10-filmcraft-original-ui.tar.gz` — 12707959 bytes; SHA256 `b25e29d4c4772fb9e67cbe4d8a9bf698fc457247518e568522aceda9616efe66`
- `creative-workspace-0.2.0-alpha.10-filmcraft-original-ui.tar.gz.sha256` — 129 bytes; SHA256 `2d28a9df8920c1da698e0eaac1f58e4b3c2d26ed0ba2b9ecba52891d5f1e8828`
- `creative-workspace-0.2.0-alpha.10-linux-x64.tar.gz` — 122061325 bytes; SHA256 `7b0afbbabd885122c82212f7daa0d87ddc7f619d5ba50ea26f4b1f757d2829bc`
- `creative-workspace-0.2.0-alpha.10-linux-x64.tar.gz.sha256` — 117 bytes; SHA256 `1726b8a6086c761562fe604649fbcd37350ae98630e904183f71d622060da473`
- `creative-workspace-0.2.0-alpha.10-win32-x64.zip` — 109257236 bytes; SHA256 `ce3bc6015f702d120c80fa161c88b3d902983d5db6f46bae1bf0f45bb0c15348`
- `creative-workspace-0.2.0-alpha.10-win32-x64.zip.sha256` — 114 bytes; SHA256 `aa3071a511d13fbc751921912042f1821881d7a0e5d39b6233d4ee0597420aa6`

## Scope limits

The native bundles are prototype bundles, not complete original-app server ports. FilmCraft editing remains browser-local. Real directory-picker permissions, all seven original app server/provider/save-ACK/full-parity milestones, and broader OS/browser compatibility remain unverified. The release therefore stays a draft/prerelease.
