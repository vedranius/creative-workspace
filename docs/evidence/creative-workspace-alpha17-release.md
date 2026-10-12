# Creative Workspace alpha.17 release verification

## Release state

- Product commit: `53445c84ade1e272b3a8ed5f2b9c2aee22a861fa` (`fix(designcraft): retain primary browser smoke session`).
- Immutable tag: `v0.2.0-alpha.17` resolves to the same commit.
- GitHub Checks run [`38206102465`](https://github.com/vedranius/creative-workspace/actions/runs/38206102465) passed. Build/release run [`38206102488`](https://github.com/vedranius/creative-workspace/actions/runs/38206102488) passed all target builds, original UI jobs, native bundle smokes, browser verification, and publish.
- Draft prerelease ID `410203579` contains five Actions-built archives and their five checksum sidecars. The release remains draft/prerelease because original `DesignApp` state/action dispatch, file-provider parity, save acknowledgement, reopen/recovery, and full original-app parity are incomplete.
- The first run, `38204423605`, stopped before publication when an existing browser regression's session tracker selected the temporary A4 smoke session. The tracker was fixed in `53445c8`; no alpha.17 tag was made by that failed run.

## DesignCraft `file.new` evidence

The gateway accepts only a bounded `{ "preset": "A4" }` action, forwards the original preset to the owned native worker and returns the command ID, state revision, read model and bounded server PNG. Native worker evidence is [designcraft-par03-file-new-native.json](designcraft-par03-file-new-native.json); Chromium evidence is [designcraft-par03-file-new-browser.json](designcraft-par03-file-new-browser.json). Both report `file.new`, revision 1, one page and a 595×842 PNG. Chromium reports zero uncaught errors.

The original upstream preset click and local `DesignApp` session/panels are still not connected to this gateway seam. This is not a DesignCraft availability claim.

## Actions assets and SHA256

All five archives and five `.sha256` sidecars were downloaded from the draft. Sidecar checks passed for every archive; the three OS bundles also passed tar/zip archive integrity checks.

| Actions asset | SHA256 |
| --- | --- |
| `creative-workspace-0.2.0-alpha.17-darwin-arm64.tar.gz` | `32c0cc6b9fa39f220300b222376c03a5d7aa12acfc97870a0a61df72d584bd60` |
| `creative-workspace-0.2.0-alpha.17-designcraft-par03-preview.tar.gz` | `87fe8d884310215beed122d1b682f1199b303a91d2d66e7acb76efd7072e11fa` |
| `creative-workspace-0.2.0-alpha.17-filmcraft-original-ui.tar.gz` | `c0cc780ccbd2b05b2c97c05931799b42a9b389f646f71ed538ff87c3abee2883` |
| `creative-workspace-0.2.0-alpha.17-linux-x64.tar.gz` | `dae1a1c9c024292e07f59ef06b692b9dd827e5a9eb0fbfdb4b828d59c8a037ef` |
| `creative-workspace-0.2.0-alpha.17-win32-x64.zip` | `28ce546056394acbcee3af12b3fa96fbc298d57ebdd4d17d71dcb9f9214807a9` |

The draft is an alpha prototype release, not a complete original Creative Suite bundle. Engine support, original UI parity and browser/provider acceptance remain limited to the evidence recorded by the workflow and application handoffs.
