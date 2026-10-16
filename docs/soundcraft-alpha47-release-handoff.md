# SoundCraft alpha.47 release handoff

**Task:** ORG-SOUND-UI release gate verification.

**Published work:** feature commit `fb1831d` (`feat: add SoundCraft original UI preview`) is on `main`. Checks `38841885282` and Build/release `38841885286` passed. The immutable `v0.2.0-alpha.47` tag resolves to the feature commit; GitHub release is a prerelease draft. All 12 Actions-built archive/checksum pairs were downloaded and verified. Detailed hashes are in [release evidence](evidence/creative-workspace-alpha47-release.md).

**Scope:** SoundCraft has exact-pin upstream UI build/registration and isolated Chromium rendering evidence ([preview](soundcraft-original-ui-preview.md)). Browser WASM still owns session editing, audio decode/DSP, playback and export. Do not report server integration or availability; keep catalog status planned and the release draft.

**Next task:** resume the preserved DesignCraft PAR-03 Select All WIP using its exact handoff at `build/host-tmp/par03-edit-select-all-20261015/HANDOFF.md`. First inspect the coordinator state and directly wait for its recorded owner; preserve current `src/designcraft.js`, `test/designcraft.test.js` and unrelated `engines/filmcraft/` changes. Then continue server processing/provider acceptance for all 13 apps in the order in `docs/artcraft-expansion.md`.
