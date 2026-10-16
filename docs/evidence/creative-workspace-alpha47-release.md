# Creative Workspace alpha.47 release verification

Verified 2026-10-16 by the authenticated `vedranius` GitHub CLI.

- Checks run `38841885282`: success on Ubuntu, macOS and Windows.
- Build/release run `38841885286`: success on `fb1831d4a8eb344cfb38cdc55c22448780812e50`; all jobs, including `publish`, completed successfully.
- Immutable tag `v0.2.0-alpha.47` resolves directly to that commit. Release is a prerelease draft, as required while original app and provider parity remain incomplete.
- Draft release contains 24 assets: 12 archives and 12 `.sha256` sidecars. All 12 archives were downloaded to isolated host scratch and each sidecar was checked individually with `sha256sum -c`.

| Actions-built archive | SHA-256 |
| --- | --- |
| `creative-workspace-0.2.0-alpha.47-cadcraft-original-ui.tar.gz` | `9a893c421b2fb238c72d69c25df6c6c170b8467575db105e942fcacc48099667` |
| `creative-workspace-0.2.0-alpha.47-darwin-arm64.tar.gz` | `6f0c7fdc4a24bdfd3810a9b90fb27904aa81aa2d99cb7cc23d25b77f448460cb` |
| `creative-workspace-0.2.0-alpha.47-deckcraft-original-ui.tar.gz` | `4d80615d8d5e6d6b908ff98bf6793d6d07691b66c7d48406854ecb8595979251` |
| `creative-workspace-0.2.0-alpha.47-designcraft-host-canvas-candidate.tar.gz` | `ba37ffb14f0118d6f923e121823dad69399be70478c0f88497ce41f3f1cc2e57` |
| `creative-workspace-0.2.0-alpha.47-designcraft-par03-preview.tar.gz` | `6120740b91cff402752edbb048090afa4616a23980a0bbc0b5e78eca307294b5` |
| `creative-workspace-0.2.0-alpha.47-figcraft-original-ui.tar.gz` | `b67ccecd3ed61e56bb274ba1042a2612e2f1710033125a0bbe98a3184ba56b8e` |
| `creative-workspace-0.2.0-alpha.47-filmcraft-original-ui.tar.gz` | `79ecdc5306053b82564d992cf641bd045676f041c19da57fe4de7247cbd9da07` |
| `creative-workspace-0.2.0-alpha.47-gridcraft-original-ui.tar.gz` | `624f5d37accc92e64ae8c1891ec8c4011e29879a8025c17a96fdf3a4100ab2f8` |
| `creative-workspace-0.2.0-alpha.47-linux-x64.tar.gz` | `35c1b9faa03cc651d560acfb0786779e13ac3a37d2c04d25c906be3d1f98b988` |
| `creative-workspace-0.2.0-alpha.47-soundcraft-original-ui.tar.gz` | `3f430f38305239bc8ba39cd5a45d6da8b404b7ce5ea06ece5b507b2f961848d1` |
| `creative-workspace-0.2.0-alpha.47-win32-x64.zip` | `bf68ad18d3c1cf19f1a56f3a291b66edc6a2ae6b10a807128fcf24a3d20ef4e2` |
| `creative-workspace-0.2.0-alpha.47-wordcraft-original-ui.tar.gz` | `fd549408d6ae67da376107171d0d8e71ee2bdc8843ba10d4845aabc7f3f6ee3b` |

These are release integrity results only. SoundCraft is an original browser UI preview: audio decode/edit/DSP/playback/export are still browser-local WASM, with no server integration or provider acceptance. Keep the app planned and the release draft. The SoundCraft build and browser evidence is in [the preview handoff](../soundcraft-original-ui-preview.md).
